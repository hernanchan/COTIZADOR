/** SABER: contrato de integración TUS, no desplegado. No usar pruebas de navegador como verificación de servidor. */
const SHA=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const OBJ=/^([a-f0-9-]{36})\/([a-f0-9-]{36})\.pdf$/i;
const MAX=20*1024*1024;
export const SCHEMA='saber-tus-private-verified-v1';
export function validateManifest(m){
 if(!m||m.schema!=='saber-tus-private-manifest-v1'||!WEB.test(m.orderId||'')||
 !UUID.test(m.clientOrderId||'')||!Array.isArray(m.files)||m.files.length<1||m.files.length>30||
 m.paymentAuthorized!==false||m.checkoutEnabled!==false||m.registeredInD1!==false)
 throw Error('Manifiesto TUS preliminar inválido');
 let bytes=0;const seen=new Set();
 const files=m.files.map((f,i)=>{
  if(!f||!UUID.test(f.localRef||'')||!OBJ.test(f.objectName||'')||!SHA.test(f.sha256||'')||
   !Number.isSafeInteger(f.bytes)||f.bytes<5||f.bytes>MAX||
   !Number.isSafeInteger(f.pages)||f.pages<1||f.pages>2000||
   !f.options||typeof f.options!=='object'||Array.isArray(f.options)||
   seen.has(f.localRef)||seen.has(f.objectName))
   throw Error('Archivo TUS inválido #'+i);
  seen.add(f.localRef);seen.add(f.objectName);bytes+=f.bytes;
  return {localRef:f.localRef,objectName:f.objectName,sha256:f.sha256,bytes:f.bytes,pages:f.pages,options:f.options};
 });
 if(bytes>60*1024*1024)throw Error('Lote TUS supera 60 MiB');
 return {orderId:m.orderId,clientOrderId:m.clientOrderId,files,bytes};
}
export function reconcileVerifiedObjects(manifest,proofs){
 const m=validateManifest(manifest);
 if(!Array.isArray(proofs)||proofs.length!==m.files.length)throw Error('Faltan PDF verificados');
 const map=new Map();
 for(const p of proofs){
  if(!p||p.schema!==SCHEMA||p.verified!==true||p.bucketPrivate!==true||
   p.provenance!=='server-storage'||typeof p.objectName!=='string'||map.has(p.objectName)||
   !SHA.test(p.sha256||'')||!Number.isSafeInteger(p.bytes)||!Number.isSafeInteger(p.pages))
   throw Error('Comprobante TUS no confiable');
  map.set(p.objectName,p);
 }
 return {...m,files:m.files.map(f=>{
  const p=map.get(f.objectName);
  if(!p||p.sha256!==f.sha256||p.bytes!==f.bytes||p.pages!==f.pages)
   throw Error('El PDF almacenado no coincide con el manifiesto');
  return {...f,verified:true};
 })};
}
/** Inyectar funciones exclusivamente server-side: verificación real de Storage,
 * cotización con tarifas servidor y registro D1 transaccional/idempotente.
 * NO es una ruta pública y NO usa el identificador GAS como si fuera TUS.
 */
export async function stagePrivateTusOrder({manifest,verifyFromPrivateBucket,quoteOnServer,createOrderOnce}){
 const m=validateManifest(manifest);
 if([verifyFromPrivateBucket,quoteOnServer,createOrderOnce].some(fn=>typeof fn!=='function'))
  throw Error('Faltan dependencias privadas');
 const proofs=[];
 for(const f of m.files)proofs.push(await verifyFromPrivateBucket({
  orderId:m.orderId,objectName:f.objectName,expectedSha256:f.sha256,
  expectedBytes:f.bytes,expectedPages:f.pages
 }));
 const checked=reconcileVerifiedObjects(manifest,proofs);
 const q=await quoteOnServer({orderId:checked.orderId,files:checked.files});
 if(!q||q.orderId!==checked.orderId||q.serverRecalculated!==true||
   !Number.isSafeInteger(q.totalArs)||q.totalArs<=0||
   q.paymentAuthorized!==false||q.filesQuoted!==checked.files.length)
  throw Error('Presupuesto servidor no conciliado');
 const saved=await createOrderOnce({
  idempotencyKey:checked.clientOrderId,webOrderId:checked.orderId,
  verifiedFiles:checked.files,serverQuote:q
 });
 if(!saved||saved.webOrderId!==checked.orderId||
  saved.fileCount!==checked.files.length||saved.persisted!==true||
  saved.paymentAuthorized!==false)throw Error('D1 no confirmó el pedido completo');
 return {ok:true,webOrderId:checked.orderId,orderId:saved.orderId,
  totalArs:q.totalArs,verifiedFiles:checked.files.length,
  paymentAuthorized:false,checkoutEnabled:false,listoParaProducir:false,
  idempotent:saved.idempotent===true};
}