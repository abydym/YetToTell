"""Build a source-only ZIP for repository upload, excluding local/private state."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT.parent/'YetToTell-minimal.zip'
files=[]
for name in ['README.md','docs/usage.md','docs/structure.md','课程.md','requirements.txt','.gitignore','启动课件.cmd','更新课件.cmd','更新PDF.cmd','结束服务.cmd']:
    files.append(ROOT/name)
files.extend(p for p in (ROOT/'docs/images').iterdir() if p.suffix == '.png')
files.extend(p for p in (ROOT/'assets').rglob('*') if p.is_file())
files.extend(p for p in (ROOT/'lesson').iterdir() if p.suffix in ('.py','.ps1'))
files.extend(p for p in (ROOT/'lesson/dist').iterdir() if p.is_file() and p.suffix in ('.html','.js','.css') and p.name!='content.js')
# Tests and their outputs stay in the development workspace.
with ZipFile(DEST,'w',ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, 'YetToTell/'+path.relative_to(ROOT).as_posix())
print(f'Packaged {len(files)} source files: {DEST.name}')
