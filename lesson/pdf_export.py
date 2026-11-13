"""Render local slides and optionally attach private, invisible attribution."""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
import pymupdf as fitz
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent

def export_pdf(mode='student', scope='core', base_url=None, pages=None, signature=None):
    if mode not in ('student', 'teacher') or scope not in ('core', 'all'):
        raise ValueError('无效的 PDF 导出选项。')
    config = json.loads((ROOT/'content.json').read_text(encoding='utf-8'))
    if pages is not None:
        if not isinstance(pages,list) or not pages or any(type(n) is not int or not 1 <= n <= len(config['slides']) for n in pages):
            raise ValueError('无效的页码范围。')
        pages = sorted(set(pages))
    signature = signature or {'enabled': False, 'name': '', 'contact': ''}
    if not isinstance(signature, dict) or type(signature.get('enabled', False)) is not bool:
        raise ValueError('PDF 签名设置无效。')
    for key, limit in [('name', 120), ('contact', 200)]:
        if not isinstance(signature.get(key, ''), str) or len(signature.get(key, '')) > limit or any(ord(c)<32 for c in signature.get(key,'')):
            raise ValueError('PDF 签名文本无效或过长。')
    enabled = signature.get('enabled', False)
    author = signature.get('name', '') if enabled else ''
    contact = signature.get('contact', '') if enabled else ''
    token = uuid.uuid4().hex
    out = ROOT/'exports'
    out.mkdir(exist_ok=True)
    raw = out/f'.render-{token}.pdf'
    final = out/f'classroom_{mode}_{scope}.pdf'
    url = (base_url or (ROOT/'dist/index.html').as_uri()) + f'?print=1&mode={mode}&range={scope}'
    if pages:
        url += '&pages=' + ','.join(map(str,pages))
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        try:
            page = browser.new_page(viewport={'width':1280,'height':720})
            page.goto(url, wait_until='load')
            page.wait_for_function('window.__printReady === true')
            page.evaluate('document.fonts.ready')
            page.wait_for_function("Array.from(document.querySelectorAll('.print-slide img')).every(i=>i.complete)", timeout=20000)
            missing = page.locator('.print-slide img').evaluate_all('(images)=>images.filter(i=>!i.naturalWidth).map(i=>i.alt)')
            if missing:
                raise ValueError('PDF 图片加载失败：' + '、'.join(missing))
            page.pdf(path=str(raw), print_background=True, prefer_css_page_size=True)
        finally:
            browser.close()
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        with fitz.open(raw) as doc:
            before = [hashlib.sha256(pg.get_pixmap(matrix=fitz.Matrix(.4,.4),alpha=False).samples).hexdigest() for pg in doc]
            marker = f'{author} | {contact} | ExportID={token} | UTC={timestamp}'
            doc.set_metadata({'title':config['title'],'author':author,'subject':contact,'keywords':marker if enabled else '', 'creator':'Classroom PDF Exporter','producer':'Chromium + PyMuPDF'})
            if enabled:
                doc.set_xml_metadata(f'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>{escape(author)}</rdf:li></rdf:Seq></dc:creator><dc:description>{escape(marker)}</dc:description></rdf:Description></rdf:RDF></x:xmpmeta>')
                for n,pg in enumerate(doc,1):
                    # CJK built-in font preserves Chinese attribution in extraction too.
                    pg.insert_text((12,pg.rect.height-10),marker+f' | Page={n}',fontname='china-s',fontsize=2,render_mode=3)
            temp = out/f'.marked-{token}.pdf'
            doc.save(temp,garbage=4,deflate=True)
        with fitz.open(temp) as check:
            after = [hashlib.sha256(pg.get_pixmap(matrix=fitz.Matrix(.4,.4),alpha=False).samples).hexdigest() for pg in check]
            assert before == after, '隐藏署名改变了可见排版。'
            assert check.metadata['author'] == author
            if enabled:
                assert all(token in pg.get_text().replace(' ', '') for pg in check)
            report = {'pages':len(check),'mode':mode,'scope':scope,'signature_enabled':enabled,'metadata_verified':True,'render_pixels_unchanged_after_marking':True,'sha256':hashlib.sha256(temp.read_bytes()).hexdigest()}
        temp.replace(final)
        final.with_suffix('.audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        return final
    finally:
        raw.unlink(missing_ok=True)

if __name__ == '__main__':
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument('--mode',default='student');ap.add_argument('--scope',default='core');ap.add_argument('--url')
    args=ap.parse_args()
    print(export_pdf(args.mode,args.scope,args.url))
