(function(root){
 'use strict';
 const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 async function sha(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
 async function key(code){return crypto.subtle.importKey('raw',await sha('franquia-lab:encryption:'+code),'AES-GCM',false,['encrypt','decrypt']);}
 const normalize=value=>String(value).trim();
 function valid(code){return /^FL-[A-Za-z0-9_-]{43}$/.test(code);}
 function generate(){return 'FL-'+encode(crypto.getRandomValues(new Uint8Array(32)));}
 async function token(code){return Array.from(await sha('franquia-lab:access:'+code)).map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function encrypt(study,code){
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(code),new TextEncoder().encode(JSON.stringify(study))));
   // Chunk conversion avoids spreading a large encrypted study onto the JS stack.
   let binary='';for(let i=0;i<cipher.length;i+=8192)binary+=String.fromCharCode(...cipher.subarray(i,i+8192));
   return {format:1,iv:encode(iv),ciphertext:btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
 }
 async function decrypt(payload,code){
   if(payload.format!==1)throw Error('Formato da nuvem não reconhecido.');
   try{return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv)},await key(code),decode(payload.ciphertext))));}
   catch{throw Error('Não foi possível abrir o estudo com este código.');}
 }
 root.StudyCrypto={generate,valid,normalize,token,encrypt,decrypt};
})(globalThis);
