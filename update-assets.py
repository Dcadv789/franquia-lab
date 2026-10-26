"""Version browser assets by their contents so releases load as one consistent set."""
from pathlib import Path
import hashlib
import re
import json
project=Path(__file__).parent
root=project/'public'
path=root/'index.html'
html=path.read_text(encoding='utf-8-sig')
for name in ('style.css','cloud.css','model.js','site-config.js','cloud-crypto.js','cloud-store.js','app.js','cloud-ui.js'):
    digest=hashlib.sha256((root/name).read_bytes()).hexdigest()[:12]
    html=re.sub(re.escape(name)+r'(?:\?v=[a-zA-Z0-9-]+)?(?=")',name+'?v='+digest,html)
path.write_text(html,encoding='utf-8')
(project/'app/index-html.ts').write_text('export const indexHtml = '+json.dumps(html,ensure_ascii=False)+';\n',encoding='utf-8')
print('Asset URLs updated.')
