#!/usr/bin/env python3
"""앱을 파일 하나짜리 HTML 매뉴얼로 묶는다(iCloud에서 바로 열기용, 오프라인 동작).
사용: python3 build_single.py v2  ->  ../전국해안일주_20261002-09_매뉴얼_v2.html
"""
import os, sys
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(H, p), encoding='utf-8').read()
ver = sys.argv[1] if len(sys.argv) > 1 else 'v2'
out = os.path.join(H, '..', f'전국해안일주_20261002-09_매뉴얼_{ver}.html')
assert not os.path.exists(out), f'이미 있음: {out} (덮어쓰지 않는다, 버전을 올릴 것)'
html = rd('index.html')
html = html.replace('<link rel="stylesheet" href="app.css">', '<style>\n' + rd('app.css') + '\n</style>')
html = html.replace('<script src="app.js" defer></script>',
    '<script>window.TRIP = ' + rd('data/trip.json') + ';</script>\n<script>\n' + rd('app.js') + '\n</script>')
for tag in ('<link rel="manifest" href="manifest.webmanifest">\n', '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'):
    html = html.replace(tag, '')
open(out, 'w', encoding='utf-8').write(html)
print(out)
