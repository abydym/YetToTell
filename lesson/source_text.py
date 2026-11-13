"""Edit visible Markdown text without rewriting unrelated source or teacher notes."""
import re
from classroom import extract


def source_fields(text):
    # extract() preserves line numbers while removing the classroom fence.
    lines = extract(text)[0].splitlines()
    result, sid, section, start, fence = {}, None, None, 0, False

    def finish(end):
        if not sid or section not in ('页面', '问题'):
            return
        rows = list(range(start, end))
        while rows and not lines[rows[0]].strip():
            rows.pop(0)
        while rows and not lines[rows[-1]].strip():
            rows.pop()
        if section == '问题' and rows:
            result[sid]['question'] = {'start': rows[0], 'end': rows[-1]+1,
                'prefix': '', 'suffix': '', 'value': '\n'.join(lines[i] for i in rows)}
        if section != '页面':
            return
        groups, group = [], []
        for i in rows:
            if lines[i].strip():
                group.append(i)
            elif group:
                groups.append(group)
                group = []
        if group:
            groups.append(group)
        count = 0
        for group in groups:
            bullets = lines[group[0]].startswith('- ')
            for indices in ([ [i] for i in group ] if bullets else [group]):
                value = lines[indices[0]][2:] if bullets else ' '.join(lines[i] for i in indices)
                result[sid][f'point-{count}'] = {'start': indices[0], 'end': indices[-1]+1,
                    'prefix': '- ' if bullets else '', 'suffix': '', 'value': value}
                count += 1

    for i, line in enumerate(lines):
        if line.startswith('```'):
            fence = not fence
            continue
        if fence:
            continue
        match = re.fullmatch(r'## (.+?) \{#([a-z][a-z0-9-]*)\}', line)
        if match:
            finish(i)
            sid, section = match[2], None
            result[sid] = {'title': {'start': i, 'end': i+1, 'prefix': '## ',
                'suffix': ' {#'+sid+'}', 'value': match[1]}}
        elif line.startswith('### '):
            finish(i)
            section, start = line[4:].strip(), i+1
    finish(len(lines))
    return result


def normalize_text(key, value):
    if not isinstance(value, str) or len(value) > 20000:
        raise ValueError('文字内容需要是 20000 字以内的文本。')
    value = value.replace('\r\n', '\n').replace('\r', '\n').strip()
    if key != 'question':
        value = re.sub(r'\s*\n\s*', ' ', value)
    if not value:
        raise ValueError('原文标题、要点或问题不能为空；如需删除，请编辑 Markdown 结构。')
    if any(row.startswith(('```', '# ' , '## ', '### ')) for row in value.splitlines()):
        raise ValueError('文字编辑不能插入页标题、小节标题或代码围栏。')
    if any(ord(c) < 32 and c not in '\n\t' for c in value):
        raise ValueError('文字中包含无效控制字符。')
    return value


def apply_text_edits(text, edits):
    if not isinstance(edits, dict):
        raise ValueError('textEdits 必须是对象。')
    fields = source_fields(text)
    replacements = []
    for sid, changes in edits.items():
        if sid not in fields or not isinstance(changes, dict):
            raise ValueError('未知页或文字编辑格式无效。')
        for key, value in changes.items():
            if key not in fields[sid]:
                raise ValueError(f'不可编辑的文字目标：{sid}/{key}')
            field = fields[sid][key]
            value = normalize_text(key, value)
            if key.startswith('point-') and value.startswith('- ') and not field['prefix']:
                raise ValueError('段落内容无需添加列表符号。')
            if value != field['value']:
                replacements.append((field['start'], field['end'], field['prefix']+value+field['suffix']))
    rows = text.split('\n')
    for start, end, value in sorted(replacements, reverse=True):
        rows[start:end] = value.split('\n')
    return '\n'.join(rows)
