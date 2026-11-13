"""Markdown is the source of truth. Build with the Python standard library."""
import argparse
from classroom import extract, validate, embed_config, image_source
from source_text import source_fields
import hashlib
import json
import re
import runpy
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '课程.md'
SECTIONS = {'页面', 'SQL', '问题', '教师答案', '逐字稿', '备课提示'}
WIDGETS = {'', 'overview', 'wide', 'system', 'request', 'anomaly', 'anomalyDelete',
           'tableExplore', 'schemaMotion', 'types', 'keys', 'candidate', 'composite',
           'relations', 'rules', 'foreign', 'elements', 'levelsMotion', 'architecture',
           'queryAll', 'projection', 'literal', 'filter', 'pipeline', 'boundary',
           'logic', 'precedence', 'sortMotion', 'alias', 'distinct', 'null',
           'nullCompare', 'practice', 'courseSource', 'recap'}

def parse_markdown(text):
    text, canvas = extract(text)
    lines = text.lstrip('\ufeff').splitlines()
    meta, slides, current, section, fence = {}, [], None, None, False
    for number, line in enumerate(lines, 1):
        if line.startswith('```'):
            if current is None or section != 'SQL':
                raise ValueError(f'第 {number} 行：代码围栏只能放在“### SQL”下。')
            fence = not fence
            continue
        if not fence and line.startswith('## '):
            match = re.fullmatch(r'## (.+?) \{#([a-z][a-z0-9-]*)\}', line)
            if not match:
                raise ValueError(f'第 {number} 行：页标题格式为 ## 标题 {{#唯一英文编号}}')
            current = {'title': match[1], 'id': match[2], '_line': number, '_parts': {}}
            slides.append(current)
            section = None
        elif not fence and line.startswith('### '):
            section = line[4:].strip()
            if current is None or section not in SECTIONS:
                raise ValueError(f'第 {number} 行：无法识别小标题“{section}”。')
            if section in current['_parts']:
                raise ValueError(f'第 {number} 行：本页重复了“{section}”。')
            current['_parts'][section] = []
        elif current is not None and section:
            current['_parts'][section].append(line)
        elif line.strip() and not line.startswith('# '):
            match = re.fullmatch(r'([^：:]+)[：:]\s*(.*)', line)
            if not match:
                raise ValueError(f'第 {number} 行：此处应填写“字段：值”，或以 ### 页面开始正文。')
            (current if current is not None else meta)[match[1].strip()] = match[2].strip()
    if fence:
        raise ValueError('SQL 代码块缺少结束的三个反引号。')
    if not slides:
        raise ValueError('没有找到课件页。')
    seen = set()
    for s in slides:
        if s['id'] in seen:
            raise ValueError(f"页编号重复：{s['id']}")
        seen.add(s['id'])
        parts = {k: '\n'.join(v).strip() for k, v in s.pop('_parts').items()}
        def fail(message):
            raise ValueError(f"第 {s['_line']} 行《{s['title']}》：{message}")
        try:
            s['minutes'] = float(s.pop('时长'))
        except (KeyError, ValueError):
            fail('时长必须填写分钟数。')
        if not 0 < s['minutes'] <= 30:
            fail('单页时长应大于 0 且不超过 30 分钟。')
        route = s.pop('路径', '主线')
        if route not in ('主线', '补充'):
            fail('路径只能为主线或补充。')
        s['extra'] = route == '补充'
        s['widget'] = s.pop('动画', '')
        if s['widget'] not in WIDGETS:
            fail(f"动画名称不支持：{s['widget']}")
        s['ref'] = s.pop('教材', '')
        s['sub'] = s.pop('章节', '课程内容')
        s['exercise'] = s.pop('练习', '否') == '是'
        s['points'] = []
        for block in re.split(r'\n\s*\n', parts.get('页面', '')):
            if not block.strip():
                continue
            if block.startswith('- '):
                for row in block.splitlines():
                    if not row.startswith('- '):
                        fail('每个要点请独占一行并以 - 空格开头。')
                    s['points'].append(row[2:])
            else:
                s['points'].append(' '.join(block.splitlines()))
        for dest, src in [('code', 'SQL'), ('question', '问题'), ('answer', '教师答案'),
                          ('script', '逐字稿'), ('notes', '备课提示')]:
            s[dest] = parts.get(src, '')
        if not s['points'] or not s['script']:
            fail('页面正文和逐字稿均不能为空。')
        if s['question'] and not s['answer']:
            fail('有问题时需要填写教师答案。')
        if s['widget'] == 'recap' and s['id'] != 'recap':
            fail('思维导图页编号应为 recap。')
        del s['_line']
        unknown = set(s) - {'title', 'id', 'minutes', 'extra', 'widget', 'ref', 'sub',
                            'exercise', 'points', 'code', 'question', 'answer', 'script', 'notes'}
        if unknown:
            raise ValueError(f"《{s['title']}》有未知字段：{', '.join(unknown)}")
    if False:
        needed={'dbconcept','relations','pipeline','verify'}-seen
        if needed:
            raise ValueError('思维导图缺少目标页编号：'+', '.join(sorted(needed)))
    validate(canvas, slides)
    return {'canvas': canvas, 'title': meta.get('标题', '课程主题'),
            'author': meta.get('作者', ''), 'email': meta.get('邮箱', ''),
            'version': 4, 'slides': slides}

def atomic_write(path, content):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(content, encoding='utf-8')
    tmp.replace(path)

def build(source=SOURCE, check=False):
    raw = source.read_text(encoding='utf-8-sig')
    data = parse_markdown(raw)
    slides = data['slides']
    main = sum(s['minutes'] for s in slides if not s['extra'])
    extras = sum(s['minutes'] for s in slides if s['extra'])
    print(f"校验通过：{len(slides)} 页，主线 {main:g} 分钟，补充 {extras:g} 分钟。")
    data['sourceMarkdown'] = raw
    data['sourceHash'] = hashlib.sha256(raw.encode()).hexdigest()
    data['sourceFields'] = source_fields(raw)
    data['canvas'] = embed_config(data['canvas'], source.parent)
    for slide in slides:
        for i, point in enumerate(slide['points']):
            def embed(m):
                return '![' + m[1] + '](' + image_source(m[2], source.parent) + ')'
            slide['points'][i] = re.sub(r'!\[([^]]*)\]\(([^)]+)\)', embed, point)
    if check:
        return data
    encoded = json.dumps(data, ensure_ascii=False, indent=2)
    atomic_write(ROOT / 'content.json', encoded)
    atomic_write(ROOT / 'dist/content.js', 'window.LESSON=' + encoded.replace('<', '\\u003c') + ';\n')
    runpy.run_path(str(ROOT / 'package_v2.py'))
    script = ['教师逐字稿\n来源：课程.md\n\n']
    route = [f'主线 {main:g} 分钟；补充 {extras:g} 分钟。教师窗口默认按主线翻页。\n\n']
    position = 0
    for i, s in enumerate(slides):
        tag = '补充' if s['extra'] else '主线'
        script.append(f"\n{'='*32}\n{i+1:02d} {s['title']}（{tag} {s['minutes']:g} 分钟）\n\n{s['script']}\n\n问题\n{s['question']}\n\n教师答案\n{s['answer']}\n\n备课提示\n{s['notes']}\n")
        if not s['extra']:
            route.append(f"{position:g}—{position+s['minutes']:g} 分钟  {i+1:02d} {s['title']}\n")
            position += s['minutes']
    atomic_write(ROOT / '逐页说课稿_教师专用.txt', ''.join(script))
    atomic_write(ROOT / '新版逐页备课与90分钟路线.txt', ''.join(route))
    atomic_write(ROOT / 'build-info.json', json.dumps({'source': source.name,
                 'sha256': hashlib.sha256(raw.encode()).hexdigest(), 'slides': len(slides),
                 'main_minutes': main, 'extra_minutes': extras}, ensure_ascii=False, indent=2))
    print('已更新独立 HTML、本地服务页面、教师逐字稿和时间路线。PDF 请运行“更新PDF.cmd”。')
    return data

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', type=Path, default=SOURCE)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--watch', action='store_true')
    args = ap.parse_args()
    previous = None
    try:
        while True:
            fingerprint = hashlib.sha256(args.source.read_bytes()).digest()
            if fingerprint != previous:
                try:
                    build(args.source, args.check)
                except (ValueError, OSError) as error:
                    print(f'更新失败：{error}')
                    if not args.watch:
                        raise SystemExit(1)
                previous = fingerprint
            if not args.watch:
                break
            time.sleep(.8)
    except KeyboardInterrupt:
        print('已停止监听。')
