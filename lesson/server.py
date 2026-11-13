"""Loopback-only classroom service with optimistic source locking."""
import base64
import hashlib
import json
import os
import threading
import uuid
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from build_markdown import build, parse_markdown, SOURCE
from classroom import replace_config, embed_config, image_source
from source_text import apply_text_edits, source_fields
ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get('CLASSROOM_PORT', '18801'))
LOCK = threading.Lock()
INSTANCE = hashlib.sha256(str(ROOT.resolve()).encode()).hexdigest()[:16]
def current():
    raw = SOURCE.read_text(encoding='utf-8-sig')
    return raw, hashlib.sha256(raw.encode()).hexdigest()
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)
    def result(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)
    def local(self):
        return self.headers.get('Host') == f'127.0.0.1:{PORT}' and self.headers.get('Origin', f'http://127.0.0.1:{PORT}') == f'http://127.0.0.1:{PORT}'
    def do_GET(self):
        # Source can be regenerated more than once within a filesystem timestamp tick.
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        if self.headers.get('Host') != f'127.0.0.1:{PORT}':
            self.result(403, {'error': '请使用本机 127.0.0.1 地址。'})
        elif urlsplit(self.path).path == '/api/health':
            self.result(200, {'app': 'generic-classroom', 'version': 6, 'canShutdown': True, 'instance': INSTANCE})
        else:
            super().do_GET()
    def do_POST(self):
        if not self.local():
            self.result(403, {'error': '仅允许当前本地课件页面发起操作。'})
            return
        if self.path not in ('/api/save', '/api/upload', '/api/media', '/api/export', '/api/shutdown'):
            self.result(404, {'error': '未知接口。'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 16 * 1024 * 1024:
                raise ValueError('请求大小应在 16 MB 内。')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('请求需要 JSON 对象。')
            with LOCK:
                raw, digest = current()
                if data.get('hash') != digest:
                    self.result(409, {'error': '课程.md 已变更或当前页面属于其他课程。请先下载当前改动留存，再刷新页面后重试。'})
                    return
                if self.path == '/api/shutdown':
                    self.result(200, {'status': 'stopping'})
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                    return
                if self.path == '/api/save':
                    updated = replace_config(apply_text_edits(raw, data.get('textEdits', {})), data['canvas'])
                    parsed = parse_markdown(updated)
                    embed_config(parsed['canvas'], ROOT.parent)
                    temporary = ROOT.parent / '.validate-course.md'
                    try:
                        temporary.write_text(updated, encoding='utf-8')
                        build(temporary, check=True)
                    finally:
                        temporary.unlink(missing_ok=True)
                    backup = ROOT.parent / '.local' / 'backups'
                    backup.mkdir(parents=True, exist_ok=True)
                    (backup / f'{uuid.uuid4().hex}.md').write_text(raw, encoding='utf-8')
                    try:
                        SOURCE.write_text(updated, encoding='utf-8')
                        build()
                    except Exception:
                        SOURCE.write_text(raw, encoding='utf-8')
                        build()
                        raise
                    source, digest = current()
                    self.result(200, {'source': source, 'hash': digest, 'sourceFields': source_fields(source)})
                elif self.path == '/api/media':
                    self.result(200, {'src': image_source(data['src'], ROOT.parent)})
                elif self.path == '/api/upload':
                    uri = data['data']
                    image_source(uri, ROOT.parent)
                    mime, encoded = uri.split(';base64,', 1)
                    suffix = {'data:image/png': '.png', 'data:image/jpeg': '.jpg', 'data:image/webp': '.webp', 'data:image/gif': '.gif', 'data:image/svg+xml': '.svg'}[mime]
                    blob = base64.b64decode(encoded, validate=True)
                    if len(blob) > 8 * 1024 * 1024:
                        raise ValueError('图片不能超过 8 MB。')
                    name = hashlib.sha256(blob).hexdigest()[:20] + suffix
                    directory = ROOT.parent / 'assets' / 'uploads'
                    directory.mkdir(exist_ok=True)
                    (directory / name).write_bytes(blob)
                    self.result(200, {'src': 'assets/uploads/' + name})
                else:
                    from pdf_export import export_pdf
                    build()
                    path = export_pdf(data.get('mode', 'student'), data.get('range', 'core'), f'http://127.0.0.1:{PORT}/index.html', data.get('pages'), data.get('signature'))
                    pdf = path.read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/pdf')
                    self.send_header('Content-Length', str(len(pdf)))
                    self.send_header('Content-Disposition', 'attachment; filename="classroom.pdf"')
                    self.end_headers()
                    self.wfile.write(pdf)
        except (ValueError, KeyError, TypeError, OSError) as error:
            self.result(400, {'error': str(error)})
        except Exception:
            import traceback
            traceback.print_exc()
            self.result(500, {'error': '操作失败，请检查 lesson/server-error.log。'})
if __name__ == '__main__':
    print(f'Local classroom: http://127.0.0.1:{PORT}', flush=True)
    (ROOT / 'server.pid').write_text(str(os.getpid()), encoding='ascii')
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        pid = ROOT / 'server.pid'
        if pid.exists() and pid.read_text().strip() == str(os.getpid()):
            pid.unlink()
