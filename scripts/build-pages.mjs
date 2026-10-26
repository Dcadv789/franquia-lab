import { readdir, mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root=process.cwd(),source=resolve(root,'public'),output=resolve(root,'_site');
await mkdir(output,{recursive:true});
async function copyDirectory(from,to){
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Links simbólicos não são permitidos no pacote público.');
  if(entry.isDirectory())await copyDirectory(join(from,entry.name),join(to,entry.name));
  else if(entry.isFile())await copyFile(join(from,entry.name),join(to,entry.name));
 }
}
await copyDirectory(source,output);
let html=await readFile(join(output,'index.html'),'utf8');
for(const match of [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?v=[a-zA-Z0-9-]+)?"/g)]){
 const asset=match[1];if(asset.includes('://')||asset.startsWith('/'))continue;
 const bytes=await readFile(join(output,asset));
 const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
 html=html.replace(match[0],match[0].replace(/="[^"]+"$/,`="${asset}?v=${hash}"`));
}
await writeFile(join(output,'index.html'),html);
await writeFile(join(output,'.nojekyll'),'');
console.log('GitHub Pages pronto em _site/ (somente arquivos públicos).');
