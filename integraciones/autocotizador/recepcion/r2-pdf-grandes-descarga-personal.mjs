/**
 * Libreria Saber — descarga privada de un PDF grande de prueba desde R2.
 *
 * SOLO operario con Basic; jamás permiso de comprador. Por seguridad se vuelve
 * a comprobar el SHA-256 del objeto firmado ANTES de liberar su cuerpo.
 * No acredita una orden en D1 ni reemplaza la integración pendiente del ZIP.
 * La prueba utiliza recibos de R2 de vida limitada, no URL pública del bucket.
 */
import {leerReciboR2} from './r2-pdf-grandes-privado.mjs';
import {verificarIntegridadR2Grande} from './r2-pdf-integridad-stream.mjs';

const FLAG='PRIVATE_TEST_ONLY';
const URL='/prueba-v2/api/ensayo-r2-descargar-personal';
const respond=(message,status)=>new Response(JSON.stringify({
 ok:false,error:message,checkoutEnabled:false,paymentAuthorized:false,
}),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex, nofollow',
 'Referrer-Policy':'no-referrer',
}});
function configurationReady(env){
 const key=env?.DOCS_R2_RECEIPT_KEY;
 return env?.DOCS_R2_BIG_ENABLED===FLAG&&
   typeof key==='string'&&key.length>=32&&key.length<=2048&&
   ![env?.DOCS_TUS_RECEIPT_KEY,env?.DOCS_V2_PRIVATE_UI_SECRET,
     env?.CENTRAL_BRIDGE_KEY].includes(key)&&
   typeof env?.SABER_R2_GRANDES?.get==='function';
}
export async function descargarR2GrandePersonal(request,env,{
 authorized=false,now,subtle,digestFactory,
 verify=verificarIntegridadR2Grande,
}={}){
 // No revelar el estado del bucket, los nombres ni los hashes a terceros.
 if(authorized!==true)return respond('Acceso restringido al personal.',403);
 if(!configurationReady(env))return respond('Descarga de PDF grandes no habilitada.',503);
 const url=new URL(request.url);
 if(request.method!=='POST'||url.protocol!=='https:'||url.pathname!==URL||
   url.search||url.hash||
   request.headers.get('Origin')!==url.origin||
   (request.headers.get('Sec-Fetch-Site')&&
    request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return respond('Solicitud de descarga no autorizada.',403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return respond('Tipo de solicitud no admitido.',415);
 try{
  if(Number(request.headers.get('Content-Length')||'0')>4800)
   return respond('Solicitud demasiado extensa.',413);
  const body=await request.text();
  if(body.length>4800)return respond('Solicitud demasiado extensa.',413);
  const data=JSON.parse(body);
  if(!data||typeof data!=='object'||Array.isArray(data)||
     Object.keys(data).join(',')!=='proof')
   return respond('Comprobante no admitido.',422);
  const args={bucket:env.SABER_R2_GRANDES,secret:env.DOCS_R2_RECEIPT_KEY,
   ...(typeof now==='function'?{now}:{}),
   ...(subtle?{subtle}:{})};
  const claim=await leerReciboR2(data.proof,args);
  // La lectura del objeto puede transferir cientos de MB. En este ensayo
  // se hace SOLO por decisión expresa del personal autenticado.
  const checked=await verify({...args,proof:data.proof,
   ...(digestFactory?{digestFactory}:{})});
  if(checked?.sha256Verificado!==true||checked?.bytes!==claim.bytes||
     checked?.sha256!==claim.sha256||checked?.objectKey!==claim.key)
   return respond('No se pudo comprobar la integridad del original.',409);
  const object=await env.SABER_R2_GRANDES.get(claim.key);
  if(!object||object.size!==claim.bytes||
    !(object.body instanceof ReadableStream))
   return respond('PDF privado incompleto.',409);
  // Nombre creado desde UUID validado por la firma. No usar nombre subido
  // por comprador en cabecera Content-Disposition.
  const id=claim.key.split('/').at(-1);
  if(!/^[a-f0-9-]{36}\.pdf$/i.test(id))
   return respond('Archivo no permitido.',409);
  return new Response(object.body,{status:200,headers:{
   'Content-Type':'application/pdf',
   'Content-Disposition':'attachment; filename="SABER-'+id+'"',
   'Content-Length':String(claim.bytes),
   'Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow',
   'Referrer-Policy':'no-referrer',
  }});
 }catch{
  // Los detalles internos no se comparten; jamás incluir nombres ni proofs.
  console.warn('saber_r2_staff_download_rejected');
  return respond('El PDF grande no está disponible o su comprobante venció.',422);
 }
}
