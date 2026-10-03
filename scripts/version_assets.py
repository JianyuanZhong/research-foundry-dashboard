"""Invalidate browser/CDN script and stylesheet caches when asset contents change."""
from pathlib import Path
import re,hashlib
root=Path(__file__).resolve().parents[1]/'site'
for page in root.rglob('*.html'):
 def replace(match):
  attr,url=match.groups();relative=url.split('?',1)[0]
  if relative.startswith(('http:','https:','/','#')):return match.group(0)
  p=page.parent/relative
  if p.suffix not in ['.js','.css'] or not p.is_file():return match.group(0)
  digest=hashlib.sha256(p.read_bytes()).hexdigest()[:12]
  return f'{attr}="{relative}?v={digest}"'
 page.write_text(re.sub(r'(src|href)="([^"]+)"',replace,page.read_text()))
print('Script and stylesheet URLs versioned by content hash')
