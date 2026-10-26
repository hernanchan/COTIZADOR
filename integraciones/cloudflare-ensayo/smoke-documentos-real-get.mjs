/** Smoke de seguridad por GET contra Documentos instalado; sin claves ni escrituras. */
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const paths=['/api/ensayo-probar-puente-central','/api/ensayo-preparar-documentos-v2','/api/ensayo-carga-unica','/prueba-v2/'];
for(const path of paths){
 const reply=await fetch(host+path,{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(16000)});
 const type=reply.headers.get('content-type')||'';
 const raw=(await reply.text()).slice(0,2000);
 if(reply.status>=200&&reply.status<300){
   if(path!=='/prueba-v2/')throw Error(path+': GET no autenticado fue aceptado inesperadamente.');
   // La página V2 no puede ser pública.
   if(raw.includes('Cotizador V2 en ensayo privado'))throw Error('Portal privado expuesto sin autenticación.');
 }
 if(path==='/api/ensayo-probar-puente-central'&&reply.status!==503)
   throw Error('Diagnóstico HMAC no está cerrado en GET (HTTP '+reply.status+').');
 console.log('GET '+path+': '+reply.status+'; content-type='+type.split(';')[0]+'; sin efectos secundarios.');
}
console.log('DOCUMENTOS_REAL_GET_SMOKE_OK: acceso GET cerrado, sin PDF, D1, claves ni cobros.');
