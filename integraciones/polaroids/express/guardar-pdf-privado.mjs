/** Adaptador de backend Express -> Apps Script privado (sólo PDF final).
 * No es una ruta pública ni se importa en el editor del cliente.
 * Nunca se entregan a visitantes las credenciales, PDFs o ID de Google Drive.
 */
const GOOGLE_SCRIPT=/^\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec\/?$/;
const HEX=/^[a-f0-9]{64}$/;
const REF=/^POL-[A-F0-9]{24}$/;
function base64Bytes(bytes){
 const strings=[];
 // Bloques múltiplos de 3 para poder concatenar segmentos Base64 sin padding interior.
 const SIZE=3*32768;
 for(let i=0;i<bytes.length;i+=SIZE){
  const part=bytes.subarray(i,Math.min(bytes.length,i+SIZE));
  let s='';for(let j=0;j<part.length;j++)s+=String.fromCharCode(part[j]);
  strings.push(btoa(s));
 }
 return strings.join('');
}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
export async function guardarPdfPrivadoEnGAS({
 referencia,contenidoPdf,bytes,sha256,paginas,fotos,
 env,fetcher=fetch,subtle=crypto.subtle,
 nonce=()=>crypto.randomUUID(),ahora=()=>Math.floor(Date.now()/1000)
}){
 if(env?.EXPRESS_PDF_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env.EXPRESS_PDF_HMAC_KEY!=='string'||env.EXPRESS_PDF_HMAC_KEY.length<32)
  throw Error('Recepción privada Express deshabilitada.');
 const key=env.EXPRESS_PDF_HMAC_KEY;
 let url;
 try{url=new URL(env.EXPRESS_PDF_SCRIPT_URL)}catch(_){throw Error('Receptor GAS no configurado.')}
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||
    !GOOGLE_SCRIPT.test(url.pathname)||url.username||url.password||
    url.port||url.hash||url.search)
  throw Error('El servidor Express no está autorizado.');
 if(!REF.test(referencia||'')||!(contenidoPdf instanceof Uint8Array)||
    contenidoPdf.length!==bytes||bytes<100||bytes>12*1024*1024||
    !HEX.test(sha256||'')||!Number.isSafeInteger(paginas)||paginas<1||paginas>4||
    !Number.isSafeInteger(fotos)||fotos<1||fotos>24||
    paginas!==Math.ceil(fotos/6))
  throw Error('PDF Express fuera de los límites del receptor.');
 const actual=hex(new Uint8Array(await subtle.digest('SHA-256',contenidoPdf)));
 if(actual!==sha256||String.fromCharCode(...contenidoPdf.subarray(0,5))!=='%PDF-')
  throw Error('No se enviará un PDF modificado.');
 const payloadJson=JSON.stringify({
  op:'guardarPdfExpress',referencia,sha256,bytes,paginas,fotos,
  pdfBase64:base64Bytes(contenidoPdf)
 });
 const timestamp=ahora(),requestNonce=nonce();
 if(!Number.isSafeInteger(timestamp)||!(/^[a-f0-9-]{36}$/i).test(requestNonce))
  throw Error('Firma de receptor inválida.');
 const message=timestamp+'\n'+requestNonce+'\n'+payloadJson;
 const hmac=await subtle.importKey('raw',new TextEncoder().encode(key),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',hmac,new TextEncoder().encode(message))));
 const body=JSON.stringify({timestamp,nonce:requestNonce,payloadJson,signature});
 const original=await fetcher(url.href,{method:'POST',
  headers:{'Content-Type':'text/plain;charset=UTF-8'},
  body,redirect:'manual',signal:AbortSignal.timeout(35000)});
 let response=original;
 if([301,302,303,307,308].includes(original.status)){
  const redirected=new URL(original.headers.get('Location')||'',url);
  if(redirected.protocol!=='https:'||redirected.hostname!=='script.googleusercontent.com'||
     !redirected.pathname.startsWith('/macros/echo')||
     redirected.username||redirected.password||redirected.port)
   throw Error('Google devolvió una redirección no autorizada.');
  response=await fetcher(redirected.href,{method:'GET',redirect:'error',
   headers:{'Accept':'application/json'},signal:AbortSignal.timeout(35000)});
 }
 if(!response.ok)throw Error('Drive no confirmó el PDF.');
 const text=await response.text();
 if(text.length>1500)throw Error('Respuesta de Drive inválida.');
 let reply;
 try{reply=JSON.parse(text)}catch(_){throw Error('Google devolvió una respuesta inesperada.')}
 if(!reply||reply.ok!==true||reply.verified!==true||
    reply.referencia!==referencia||reply.sha256!==sha256||
    reply.bytes!==bytes||reply.paginas!==paginas||reply.fotos!==fotos)
  throw Error('El PDF todavía no está comprobado en Drive.');
 return {ok:true,verified:true,referencia,sha256,bytes,paginas,fotos};
}
