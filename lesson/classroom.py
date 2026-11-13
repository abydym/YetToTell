"""Versioned Markdown canvas, validation, and portable media embedding."""
import base64
import copy
import json
import math
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlsplit

BLOCK = re.compile(r'^```classroom\s*\n(.*?)^```\s*$', re.M | re.S)
IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'}


def extract(text):
    matches = list(BLOCK.finditer(text))
    if len(matches) > 1:
        raise ValueError('classroom 配置块只能有一个。')
    config = {'version': 1, 'slides': {}}
    if matches:
        match = matches[0]
        try:
            config = json.loads(match[1])
        except json.JSONDecodeError as error:
            line = text[:match.start()].count('\n') + error.lineno + 1
            raise ValueError(f'第 {line} 行：classroom JSON 格式错误：{error.msg}') from error
        text = text[:match.start()] + '\n' * match[0].count('\n') + text[match.end():]
    return text, config


def replace_config(text, config):
    block = '```classroom\n' + json.dumps(config, ensure_ascii=False, indent=2) + '\n```'
    if BLOCK.search(text):
        return BLOCK.sub(lambda _: block, text)
    return text.rstrip() + '\n\n' + block + '\n'


def number(value, lo, hi, label):
    if type(value) not in (float, int) or not math.isfinite(value) or not lo <= value <= hi:
        raise ValueError(f'{label} 必须在 {lo}—{hi} 之间。')


def style(value):
    if not isinstance(value, dict) or set(value) - {'fontSize', 'fontFamily', 'color', 'bold', 'align', 'dx', 'dy', 'w', 'h'}:
        raise ValueError('字体样式字段无效。')
    if 'fontSize' in value:
        number(value['fontSize'], 10, 96, '字号')
    if not isinstance(value.get('fontFamily', 'sans'), str) or not re.fullmatch(r'[\w \-,\u4e00-\u9fff]{1,120}', value.get('fontFamily', 'sans')):
        raise ValueError('字体名称无效。')
    for key in ('dx','dy','w','h'):
        if key in value:number(value[key], -100 if key in ('dx','dy') else 2, 100, key)
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', value.get('color', '#172633')):
        raise ValueError('颜色应使用 #RRGGBB。')
    if type(value.get('bold', False)) is not bool or value.get('align', 'left') not in ('left', 'center', 'right'):
        raise ValueError('加粗或对齐值无效。')


def validate(config, slides):
    if not isinstance(config, dict) or set(config) - {'version', 'slides'} or config.get('version') != 1 or not isinstance(config.get('slides'), dict):
        raise ValueError('classroom 需要 version: 1 和 slides 对象。')
    by_id = {s['id']: s for s in slides}
    ids = set()
    for sid, cfg in config['slides'].items():
        if sid not in by_id or not isinstance(cfg, dict) or set(cfg) - {'elements', 'styles'}:
            raise ValueError(f'classroom 页配置无效：{sid}')
        styles = cfg.get('styles', {})
        if not isinstance(styles, dict):
            raise ValueError(f'{sid}: styles 应为对象。')
        for key, val in styles.items():
            allowed = {'title', 'points', 'question'} | {f'point-{i}' for i in range(len(by_id[sid]['points']))}
            if key not in allowed:
                raise ValueError(f'{sid}: 未知文字目标 {key}')
            style(val)
        elements = cfg.get('elements', [])
        if not isinstance(elements, list) or len(elements) > 100:
            raise ValueError(f'{sid}: elements 应为不超过 100 项的数组。')
        for el in elements:
            if not isinstance(el, dict) or set(el) - {'id', 'type', 'x', 'y', 'w', 'h', 'src', 'alt', 'fixed', 'text', 'widget', 'props', 'style', 'printText', 'point'}:
                raise ValueError(f'{sid}: 控件字段无效。')
            eid = el.get('id', '')
            if not isinstance(eid, str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', eid) or eid in ids:
                raise ValueError(f'{sid}: 控件 id 无效或重复：{eid}')
            ids.add(eid)
            if el.get('type') not in ('image', 'widget', 'text', 'html'):
                raise ValueError(f'{sid}/{eid}: type 应为 image、widget、text 或 html。')
            for key in ('x', 'y', 'w', 'h'):
                number(el.get(key), 0 if key in ('x', 'y') else 2, 100, f'{sid}/{eid}/{key}')
            if el['x'] + el['w'] > 100.01 or el['y'] + el['h'] > 100.01:
                raise ValueError(f'{sid}/{eid}: 控件超出画布。')
            if type(el.get('fixed', False)) is not bool or (el.get('fixed') and el['type'] != 'image'):
                raise ValueError('fixed 仅适用于图片，值为 true 或 false。')
            for key in ('src', 'alt', 'text', 'printText'):
                if key in el and (not isinstance(el[key], str) or len(el[key]) > (12000000 if key == 'src' else 20000)):
                    raise ValueError(f'{eid}/{key}: 文本无效或过长。')
            if 'point' in el:
                number(el['point'], 0, len(by_id[sid]['points']) - 1, 'point')
                if type(el['point']) is not int or el['type'] != 'image':
                    raise ValueError('point 必须为图片对应的整数要点索引。')
            style(el.get('style', {}))
            if el['type'] in ('image', 'html') and not el.get('src'):
                raise ValueError(f'{eid}: 缺少 src。')
            if el['type'] == 'html' and not el.get('printText'):
                raise ValueError(f'{eid}: HTML 控件必须提供 printText 静态打印说明。')
            if el['type'] == 'widget':
                props = el.get('props', {})
                if el.get('widget') not in ('counter', 'range', 'tabs', 'reveal') or not isinstance(props, dict):
                    raise ValueError(f'{eid}: 未知互动控件或 props 无效。')
                if set(props) - {'label', 'min', 'max', 'step', 'value', 'items', 'text'}:
                    raise ValueError(f'{eid}: 未知 props 字段。')
                for key in ('label', 'text'):
                    if key in props and (not isinstance(props[key], str) or len(props[key]) > 4000):
                        raise ValueError(f'{eid}: {key} 应为文本。')
                if el['widget'] in ('counter', 'range'):
                    for key, default in [('min', 0), ('max', 100), ('step', 1), ('value', 0)]:
                        number(props.get(key, default), 0.001 if key == 'step' else -100000, 100000, key)
                    if not props.get('min', 0) <= props.get('value', 0) <= props.get('max', 100) or props.get('min', 0) >= props.get('max', 100):
                        raise ValueError(f'{eid}: 数值范围或初始值无效。')
                if el['widget'] == 'tabs':
                    items = props.get('items')
                    if not isinstance(items, list) or not 1 <= len(items) <= 12 or any(not isinstance(i, dict) or set(i) != {'label', 'text'} or any(not isinstance(v, str) or len(v) > 4000 for v in i.values()) for i in items):
                        raise ValueError(f'{eid}: tabs 需要 1—12 项 label/text。')


def local_file(src, root):
    path = (root / src).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError('媒体不存在或超出课程目录：' + src)
    return path


def image_source(src, root):
    if src.startswith('data:image/'):
        match = re.fullmatch(r'data:(image/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)', src)
        if not match:
            raise ValueError('图片 data URL 无效。')
        base64.b64decode(match[2], validate=True)
        return src
    if src.startswith(('https://', 'http://')):
        url = urlsplit(src)
        if not url.hostname or url.username or url.password or any(c in src for c in '<>"\r\n'):
            raise ValueError('图片网址无效。')
        return src
    path = local_file(src, root)
    mime = mimetypes.guess_type(path.name)[0]
    if mime not in IMAGE_TYPES:
        raise ValueError('不支持的图片格式：' + src)
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()


def embed_config(config, root):
    result = copy.deepcopy(config)
    for cfg in result['slides'].values():
        for el in cfg.get('elements', []):
            if el['type'] == 'image':
                el['_src'] = image_source(el['src'], root)
            elif el['type'] == 'html':
                path = local_file(el['src'], root)
                if path.suffix.lower() not in ('.html', '.htm'):
                    raise ValueError('HTML 控件应指向课程目录内的 .html 文件。')
                el['_html'] = path.read_text(encoding='utf-8-sig')
    return result
