// Capability-based authorization for anonymous, encrypted studies. Never list studies.
const MAX_BYTES=1_000_000;
export const GITHUB_PAGES_ORIGIN='https://dcadv789.github.io';
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const error=(code,message,status)=>json({error:code,message},status);
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function validPayload(p){return p&&p.format===1&&typeof p.iv==='string'&&/^[A-Za-z0-9_-]{16}$/.test(p.iv)&&typeof p.ciphertext==='string'&&p.ciphertext.length>=24&&p.ciphertext.length<MAX_BYTES&&/^[A-Za-z0-9_-]+$/.test(p.ciphertext);}
async function handleAuthorizedStudy(request,db){
 const token=request.headers.get('authorization')?.match(/^Study ([a-f0-9]{64})$/)?.[1];
 if(!token)return error('UNAUTHORIZED','Código de acesso necessário.',401);
 if(!['GET','POST','PUT'].includes(request.method))return error('METHOD_NOT_ALLOWED','Método não permitido.',405);
 if(!db)return error('UNAVAILABLE','O banco da nuvem está indisponível. Sua cópia local foi preservada.',503);
 try{
   const id=await digest('franquia-lab:record:'+token);
   if(request.method==='GET'){
     const row=await db.prepare('SELECT payload, revision, updated_at FROM studies WHERE id = ?').bind(id).first();
     if(!row)return error('NOT_FOUND','Estudo não encontrado. Confira o código.',404);
     return json({payload:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at});
   }
   if(!request.headers.get('content-type')?.startsWith('application/json'))return error('INVALID_BODY','Envie um estudo válido.',400);
   const length=Number(request.headers.get('content-length')||0);
   if(length>MAX_BYTES)return error('TOO_LARGE','O estudo ultrapassou o limite de tamanho.',413);
   const raw=await request.text();
   if(new TextEncoder().encode(raw).length>MAX_BYTES)return error('TOO_LARGE','O estudo ultrapassou o limite de tamanho.',413);
   let body;try{body=JSON.parse(raw);}catch{return error('INVALID_BODY','Estudo inválido.',400);}
   if(!validPayload(body.payload))return error('INVALID_BODY','Conteúdo criptografado inválido.',400);
   const now=new Date().toISOString(),payload=JSON.stringify(body.payload);
   if(request.method==='POST'){
     const result=await db.prepare('INSERT INTO studies (id, payload, revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,payload,now,now).run();
     if(result.meta.changes!==1)return error('ALREADY_EXISTS','Este estudo já existe. Abra a versão salva.',409);
     return json({revision:1,updatedAt:now},201);
   }
   if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)return error('INVALID_REVISION','Versão do estudo inválida.',400);
   const result=await db.prepare('UPDATE studies SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(payload,now,id,body.expectedRevision).run();
   if(result.meta.changes!==1){
     const exists=await db.prepare('SELECT revision FROM studies WHERE id = ?').bind(id).first();
     return exists?error('CONFLICT','O estudo mudou em outro aparelho. Escolha qual versão usar.',409):error('NOT_FOUND','Estudo não encontrado.',404);
   }
   return json({revision:body.expectedRevision+1,updatedAt:now});
 }catch{
   return error('UNAVAILABLE','Não foi possível acessar a nuvem agora. Sua cópia local foi preservada.',503);
 }
}
export async function handleStudy(request,db){
 const origin=request.headers.get('origin');
 const allowed=!origin||origin===new URL(request.url).origin||origin===GITHUB_PAGES_ORIGIN;
 if(!allowed)return error('FORBIDDEN','Origem não permitida.',403);
 const corsHeaders=origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{};
 if(request.method==='OPTIONS'){
   const method=request.headers.get('access-control-request-method');
   const headers=(request.headers.get('access-control-request-headers')||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
   if(!origin||!['GET','POST','PUT'].includes(method)||headers.some(h=>!['authorization','content-type'].includes(h)))return error('FORBIDDEN','Requisição não permitida.',403);
   return new Response(null,{status:204,headers:{...corsHeaders,'access-control-allow-methods':'GET, POST, PUT','access-control-allow-headers':'Authorization, Content-Type','access-control-max-age':'600','cache-control':'no-store'}});
 }
 const response=await handleAuthorizedStudy(request,db);
 if(!origin)return response;
 const headers=new Headers(response.headers);for(const [key,value] of Object.entries(corsHeaders))headers.set(key,value);
 return new Response(response.body,{status:response.status,headers});
}
