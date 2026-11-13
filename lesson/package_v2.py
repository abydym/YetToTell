"""Package local sources without changing the authored HTML template."""
import json, re, shutil
from pathlib import Path
R = Path(__file__).parent
D = R / 'dist'
h = (D / 'index.html').read_text(encoding='utf-8')
(D / 'assets').mkdir(exist_ok=True)
shutil.copytree(R.parent / 'assets' / 'katex', D / 'assets' / 'katex', dirs_exist_ok=True)
for name in ['content.js','app.js','style.css','v2.js','v2.css','teacher.js','teaching.js','polish.css','editor.js','editor.css']:
    shutil.copyfile(D / name, D / 'assets' / name)
def inline_style(match):
    css = (D / 'assets' / match[1]).read_text(encoding='utf-8')
    if match[1].startswith('katex/'):
        css = css.replace('url(fonts/', 'url(assets/katex/fonts/')
    return '<style>' + css + '</style>'
single = re.sub(r'<link rel="stylesheet" href="assets/([^\"]+)">', inline_style, h)
single = re.sub(r'<script src="assets/([^\"]+)"></script>', lambda m: '<script>' + (D/'assets'/m[1]).read_text(encoding='utf-8').replace('</script', '<\\/script') + '</script>', single)
(R.parent / '课件.html').write_text(single, encoding='utf-8')
print('Packaged classroom')
