// Bind the encrypted cloud store to the existing local-first financial editor.
let applyingCloud=false;
function cloudSnapshot(){return JSON.parse(JSON.stringify({version:state.version,items:state.items,settings:state.settings}));}
function cloudLabel(){const c=window.cloudStore;return !c?.connected?'Somente neste navegador':({synced:'Nuvem atualizada',pending:'Alterações pendentes',saving:'Salvando na nuvem…',connecting:'Conferindo a nuvem…',offline:'Sem conexão · salvo localmente',conflict:'Revisar versões do estudo',error:'Nuvem precisa de atenção'}[c.status]||'Estudo na nuvem');}
function updateCloudBadge(){
 const c=window.cloudStore,button=document.getElementById('cloud-button');
 if(button){button.title=cloudLabel();button.dataset.status=c?.status||'local';button.querySelector('.cloud-dot').textContent=c?.status==='synced'?'●':c?.connected?'◌':'☁';}
 const status=document.querySelector('.local-status');if(status&&storageOK)status.textContent='● '+cloudLabel();
 const statusEl=document.getElementById('cloud-state');if(statusEl)statusEl.textContent=c?.message||'Guarde o estudo na nuvem e abra em outro aparelho.';
 const updated=document.getElementById('cloud-updated');if(updated)updated.textContent=c?.meta?.updatedAt?'Último salvamento: '+new Date(c.meta.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Ainda não há salvamento confirmado na nuvem.';
 const actions=document.getElementById('cloud-actions');if(actions)actions.innerHTML=cloudActions();
 const code=document.getElementById('cloud-current-code');if(code)code.value=c?.meta?.code||'';
 const box=document.getElementById('cloud-code-box');if(box)box.hidden=!c?.connected;
}
function cloudActions(){const c=window.cloudStore,busy=c?.busy?'disabled':'';if(!c?.connected)return '<button class="primary" data-cloud-action="create">Salvar meu estudo na nuvem</button>';return `${c.status==='conflict'?'<div class="notice warning"><strong>Há duas versões.</strong> Escolha abrir a versão da nuvem ou guardar as alterações deste aparelho como um novo estudo. Nenhuma versão será sobrescrita automaticamente.</div><button data-cloud-action="remote">Abrir versão da nuvem</button><button class="primary" data-cloud-action="fork">Salvar minha versão como novo estudo</button>':`<button class="primary" data-cloud-action="sync" ${busy}>${c.meta?.pending?'Enviar alterações pendentes':'Sincronizar agora'}</button>`}<button class="quiet" data-cloud-action="disconnect" ${busy}>Desconectar este aparelho</button>`;}
function showCloud(){
 const c=window.cloudStore,d=document.getElementById('cloud-dialog');
 d.innerHTML=`<div class="cloud-heading"><div><span class="eyebrow">SEU ESTUDO, ONDE VOCÊ ESTIVER</span><h2>Salvar e abrir na nuvem</h2></div><button class="quiet" data-cloud-action="close" aria-label="Fechar nuvem">×</button></div><div class="cloud-status-box"><strong id="cloud-state"></strong><small id="cloud-updated"></small></div><div id="cloud-code-box" ${!c.connected?'hidden':''}><label class="field"><span>Código secreto deste estudo</span><input id="cloud-current-code" type="password" readonly autocomplete="off" aria-label="Código secreto deste estudo" value="${e(c.meta?.code||'')}"></label><div class="button-row" style="margin-top:9px"><button class="small" data-cloud-action="copy">Copiar código</button><button class="small quiet" data-cloud-action="reveal">Mostrar / ocultar</button></div><p class="cloud-help">Guarde este código em um lugar seguro. Quem tiver o código pode abrir e editar o estudo. Sem ele, não há recuperação automática.</p></div><div id="cloud-actions" class="cloud-actions"></div><div class="cloud-divider"></div><h3>Abrir um estudo em outro aparelho</h3><p class="cloud-help">Abra este mesmo app no celular ou computador, toque em Nuvem e cole o código abaixo.</p><label class="field"><span>Código do estudo que você quer abrir</span><input id="cloud-input" type="password" placeholder="FL-…" autocomplete="off" spellcheck="false" aria-label="Código do estudo para abrir"></label><button data-cloud-action="open" class="small" style="margin-top:12px">Abrir estudo pelo código</button><p class="cloud-help">O conteúdo é criptografado neste aparelho antes de ser salvo. O banco não recebe as propostas em texto aberto. Sem internet, suas alterações ficam neste navegador até poderem ser enviadas.</p>${localStorage.getItem(KEY+'-before-cloud')?'<button class="quiet small" data-cloud-action="previous">Baixar cópia local anterior</button>':''}`;
 updateCloudBadge();d.showModal();
}
function applyCloudStudy(data){
 const next=parseStudy({...data,selected:state.selected,view:state.view});
 if(JSON.stringify(cloudSnapshot())!==JSON.stringify(data))try{localStorage.setItem(KEY+'-before-cloud',JSON.stringify(state));}catch{}
 applyingCloud=true;try{state=next;save();render();}finally{applyingCloud=false;}
}
window.cloudStore=new StudyCloud({getStudy:cloudSnapshot,onStudy:applyCloudStudy,onStatus:updateCloudBadge});
document.addEventListener('click',async ev=>{
 const button=ev.target.closest('[data-cloud-action]');if(!button)return;
 const action=button.dataset.cloudAction,c=window.cloudStore,d=document.getElementById('cloud-dialog');
 try{
  if(action==='show')return showCloud();
  if(action==='close')return d.close();
  if(action==='copy'){if(!c.meta?.code)return;await navigator.clipboard.writeText(c.meta.code);return toast('Código copiado. Guarde-o para abrir em outro aparelho.');}
  if(action==='reveal'){const input=document.getElementById('cloud-current-code');input.type=input.type==='password'?'text':'password';return;}
  if(action==='create'){await c.create();updateCloudBadge();if(c.meta?.revision>0)toast('Estudo salvo na nuvem. Copie e guarde o código.');return;}
  if(action==='sync'){await c.flush();return;}
  if(action==='open'){
   if(c.busy)return toast('Aguarde o salvamento em andamento.');
   const value=document.getElementById('cloud-input').value;button.disabled=true;button.textContent='Buscando estudo…';
   let remote;try{remote=await c.inspect(value);parseStudy({...remote.study});}finally{button.disabled=false;button.textContent='Abrir estudo pelo código';}
   d.close();return ask('Abrir o estudo da nuvem?',`Encontramos ${remote.study.items.length} propostas. Elas substituirão o estudo exibido neste aparelho. Uma cópia local anterior será guardada.`,async()=>{try{await c.accept(remote);toast('Estudo da nuvem aberto. Alterações serão salvas automaticamente.');}catch(err){toast(err.message);}});
  }
  if(action==='remote'){
   d.close();return ask('Usar a versão da nuvem?','As alterações deste aparelho serão guardadas em uma cópia local anterior. Você passará a editar a versão que está na nuvem.',async()=>{try{await c.useRemote();toast('Versão da nuvem carregada.');}catch(err){toast(err.message);}});
  }
  if(action==='fork'){
   d.close();return ask('Criar outro estudo na nuvem?','Esta versão receberá um novo código. O estudo anterior na nuvem será preservado com seu código original.',async()=>{await c.create();showCloud();});
  }
  if(action==='disconnect'){
   d.close();return ask('Desconectar este aparelho?',c.meta?.pending?'Há alterações ainda não enviadas. Elas continuarão neste navegador. Guarde o código para voltar a conectar.':'O estudo continuará na nuvem e neste navegador. Guarde o código para conectar novamente.',()=>{try{c.disconnect();toast('Aparelho desconectado.');}catch(err){toast(err.message);}});
  }
  if(action==='previous'){const previous=localStorage.getItem(KEY+'-before-cloud');if(previous)download('franquia-lab-copia-anterior.json',previous,'application/json');}
 }catch(err){toast(err.message||'Não foi possível concluir. Sua cópia local foi preservada.');}
});
window.addEventListener('online',()=>cloudStore.status==='conflict'?null:cloudStore.init());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudStore.init();});
setInterval(()=>{if(!document.hidden)cloudStore.init();},20000);
cloudStore.init();
