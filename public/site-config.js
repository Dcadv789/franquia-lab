(function(root){
 'use strict';
 // Public service address; study codes and encryption keys never belong here.
 const pagesOrigin='https://dcadv789.github.io';
 const cloudOrigin='https://franquia-lab-sp-7m4x.tendersnow68.chatgpt.site';
 root.FRANQUIA_CLOUD_ENDPOINT=root.location?.origin===pagesOrigin?cloudOrigin+'/api/study':'/api/study';
})(globalThis);
