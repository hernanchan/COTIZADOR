/** Diagnóstico solo lectura funcional, POST verify-only, sin operaciones comerciales.
 * La clave administrativa se inyecta como secreto GitHub, jamás se imprime.
 */
const key=process.env.SABER_DOCS_CENTRAL_ADMIN_KEY;
if(typeof key!=='string'||key.length<32)throw Error('El secreto administrativo no está disponible en GitHub.');
const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const response=await fetch(host+'/api/ensayo-probar-puente-central',{
 method:'POST',redirect:'error',signal:AbortSignal.timeout(18000),
 headers:{'Origin':host,'Content-Type':'application/json','Authorization':'Bearer '+key},
 body:JSON.stringify({operation:'verify-only'})
});
const data=await response.json().catch(()=>null);
if(response.status!==200||data?.ok!==true||data?.signed!==true||
 data?.dbTouched!==false||data?.orderCreated!==false||
 data?.paymentAuthorized!==false||data?.checkoutEnabled!==false)
 throw Error('Diagnóstico no confirmado: HTTP '+response.status+
  '; error='+String(data?.error||data?.reason||'respuesta inesperada').slice(0,100));
console.log('PUENTE_HMAC_REAL_OK: firma HMAC validada, D1 intacta, sin pedidos ni pagos.');
