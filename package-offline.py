from pathlib import Path
import re
root=Path(__file__).parent
dest=root.parent.parent/'outputs'
dest.mkdir(exist_ok=True)
html=(root/'public/index.html').read_text(encoding='utf-8')
css=(root/'public/style.css').read_text(encoding='utf-8')
model=(root/'public/model.js').read_text(encoding='utf-8')
app=(root/'public/app.js').read_text(encoding='utf-8-sig')
html=re.sub(r'<script src="cloud-[^"]+"></script>','',html)
html=re.sub(r'<script src="site-config[^"]+"></script>','',html)
html=re.sub(r'<link rel="stylesheet" href="cloud\.css[^"]*">','',html)
html=re.sub(r'<button id="cloud-button".*?</button>','',html)
html=html.replace('<dialog id="cloud-dialog"></dialog>','')
html=re.sub(r'<link rel="stylesheet" href="style\.css(?:\?v=[a-zA-Z0-9-]+)?">',lambda _: '<style>'+css+'</style>',html)
html=re.sub(r'<script src="model\.js(?:\?v=[a-zA-Z0-9-]+)?"></script><script src="app\.js(?:\?v=[a-zA-Z0-9-]+)?"></script>',lambda _: '<script>'+model+'</script><script>'+app+'</script>',html)
(dest/'Franquia-Lab.html').write_text(html,encoding='utf-8')
print('Standalone app saved: '+str(dest/'Franquia-Lab.html'))
