"""Stop only the loopback service belonging to this project directory."""
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def stop():
    port = int(os.environ.get('CLASSROOM_PORT', '18801'))
    url = f'http://127.0.0.1:{port}'
    try:
        with urllib.request.urlopen(url+'/api/health', timeout=3) as response:
            health = json.load(response)
    except urllib.error.URLError:
        print('No reachable classroom service on this port. Nothing was stopped.')
        return
    expected = hashlib.sha256(str(ROOT.resolve()).encode()).hexdigest()[:16]
    if health.get('instance') != expected or health.get('app') != 'generic-classroom':
        raise ValueError('This port belongs to another service or course. Nothing was stopped.')
    if not health.get('canShutdown'):
        raise ValueError('This is an older server. Restart it with the updated project before using this script.')
    raw = (ROOT.parent/'课程.md').read_text(encoding='utf-8-sig')
    body = json.dumps({'hash': hashlib.sha256(raw.encode()).hexdigest()}).encode()
    request = urllib.request.Request(url+'/api/shutdown', data=body,
        headers={'Content-Type':'application/json','Origin':url})
    with urllib.request.urlopen(request, timeout=10) as response:
        if json.load(response).get('status') != 'stopping':
            raise ValueError('The server did not acknowledge shutdown.')
    for _ in range(30):
        try:
            with urllib.request.urlopen(url+'/api/health',timeout=.5):
                pass
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            print('YetToTell service stopped. You can close the browser tab.')
            return
        time.sleep(.1)
    raise ValueError('Shutdown was requested, but the port is still responding.')

if __name__ == '__main__':
    try:
        stop()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
