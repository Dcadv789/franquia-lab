(function(root){
 'use strict';
 class StudyCloud {
  constructor({getStudy,onStudy,onStatus,storage=root.localStorage,fetcher=(...args)=>fetch(...args),endpoint=root.FRANQUIA_CLOUD_ENDPOINT||'/api/study'}){
   Object.assign(this,{getStudy,onStudy,onStatus,storage,fetcher,endpoint});
   this.meta=null;this.status='local';this.message='Estudo salvo apenas neste navegador.';this.busy=false;this.timer=null;this.lastLocal=JSON.stringify(getStudy());
   try{const m=JSON.parse(storage.getItem('franquia-lab-cloud-v1')||'null');if(m&&StudyCrypto.valid(m.code)&&Number.isInteger(m.revision)&&m.revision>=0)this.meta=m;}catch{}
  }
  get connected(){return !!this.meta;}
  persist(){try{if(this.meta)this.storage.setItem('franquia-lab-cloud-v1',JSON.stringify(this.meta));else this.storage.removeItem('franquia-lab-cloud-v1');}catch{this.localWarning=true;}}
  setStatus(status,message){this.status=status;this.message=message;this.onStatus?.(this);}
  async request(method,code,body){
   let response;
   try{response=await this.fetcher(this.endpoint,{method,headers:{authorization:'Study '+await StudyCrypto.token(code),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{const err=Error('Sem conexão com a nuvem. A cópia deste navegador foi mantida.');err.code='OFFLINE';throw err;}
   let result;try{result=await response.json();}catch{throw Error('A nuvem não respondeu corretamente. Tente novamente.');}
   if(!response.ok){const err=Error(result.message||'Não foi possível salvar na nuvem.');err.code=result.error;throw err;}
   return result;
  }
  fail(err){if(err.code==='CONFLICT')this.setStatus('conflict','O estudo mudou em outro aparelho. Suas alterações locais foram preservadas.');else this.setStatus(err.code==='OFFLINE'?'offline':'error',err.message);}
  async init(){if(!this.meta){this.setStatus('local',this.message);return;}if(this.meta.creating||this.meta.pending)await this.flush();else await this.pull();}
  changed(){
   const next=JSON.stringify(this.getStudy());if(next===this.lastLocal)return;this.lastLocal=next;
   if(!this.meta)return;
   this.meta.pending=true;this.persist();
   if(this.status==='conflict'){this.onStatus?.(this);return;}
   this.setStatus('pending','Alterações neste aparelho aguardando envio.');
   clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1000);
  }
  async create(){
   if(this.busy)throw Error('Aguarde a sincronização em andamento.');
   this.meta={code:StudyCrypto.generate(),revision:0,pending:true,creating:true,updatedAt:null};this.lastLocal=JSON.stringify(this.getStudy());this.persist();this.setStatus('pending','Criando um novo estudo na nuvem…');
   await this.flush();return this.meta;
  }
  async inspect(code){code=StudyCrypto.normalize(code);if(!StudyCrypto.valid(code))throw Error('Cole o código completo, começando com FL-.');const result=await this.request('GET',code);return {...result,code,study:await StudyCrypto.decrypt(result.payload,code)};}
  async accept(remote){
   if(this.busy)throw Error('Aguarde a sincronização em andamento.');
   this.onStudy(remote.study);this.lastLocal=JSON.stringify(this.getStudy());
   this.meta={code:remote.code,revision:remote.revision,pending:false,creating:false,updatedAt:remote.updatedAt};this.persist();
   this.setStatus('synced','Estudo atualizado na nuvem.');
  }
  async flush(){
   clearTimeout(this.timer);if(!this.meta||this.busy||this.status==='conflict')return;
   if(!this.meta.pending&&!this.meta.creating)return this.pull();
   this.busy=true;this.setStatus('saving','Salvando seu estudo na nuvem…');
   const meta=this.meta,serialized=JSON.stringify(this.getStudy());
   try{
    const payload=await StudyCrypto.encrypt(JSON.parse(serialized),meta.code);
    let result;
    if(meta.creating){
     try{result=await this.request('POST',meta.code,{payload});}
     catch(err){if(err.code!=='ALREADY_EXISTS')throw err;const existing=await this.inspect(meta.code);if(JSON.stringify(existing.study)!==serialized){this.meta.revision=existing.revision;this.meta.creating=false;this.persist();const conflict=Error('A criação anterior foi concluída. Abra a versão da nuvem ou salve esta versão como um novo estudo.');conflict.code='CONFLICT';throw conflict;}result=existing;}
    }else result=await this.request('PUT',meta.code,{payload,expectedRevision:meta.revision});
    meta.revision=result.revision;meta.creating=false;meta.updatedAt=result.updatedAt;
    meta.pending=JSON.stringify(this.getStudy())!==serialized;this.persist();
    this.setStatus(meta.pending?'pending':'synced',meta.pending?'Há alterações mais recentes aguardando envio.':'Estudo atualizado na nuvem.');
   }catch(err){this.fail(err);}finally{this.busy=false;this.onStatus?.(this);}
   if(this.meta?.pending&&this.status==='pending')this.timer=setTimeout(()=>this.flush(),400);
  }
  async pull(){
   if(!this.meta||this.busy||this.status==='conflict')return;
   if(this.meta.pending)return this.flush();
   this.busy=true;this.setStatus('connecting','Conferindo a versão da nuvem…');
   try{
    const remote=await this.inspect(this.meta.code);
    if(this.meta.pending){
     if(remote.revision!==this.meta.revision){const err=Error('Alterações simultâneas.');err.code='CONFLICT';throw err;}
    }else{
     if(remote.revision!==this.meta.revision||!this.hydrated){this.onStudy(remote.study);this.lastLocal=JSON.stringify(this.getStudy());this.hydrated=true;}
     this.meta.revision=remote.revision;this.meta.updatedAt=remote.updatedAt;this.persist();
     this.setStatus('synced','Estudo atualizado na nuvem.');
    }
   }catch(err){this.fail(err);}finally{this.busy=false;this.onStatus?.(this);}
   if(this.meta?.pending&&this.status!=='conflict')await this.flush();
  }
  async useRemote(){if(!this.meta||this.busy)return;const remote=await this.inspect(this.meta.code);await this.accept(remote);}
  disconnect(){if(this.busy)throw Error('Aguarde a sincronização em andamento.');clearTimeout(this.timer);this.meta=null;this.persist();this.lastLocal=JSON.stringify(this.getStudy());this.setStatus('local','Desconectado da nuvem. O estudo continua neste navegador.');}
 }
 root.StudyCloud=StudyCloud;
})(globalThis);
