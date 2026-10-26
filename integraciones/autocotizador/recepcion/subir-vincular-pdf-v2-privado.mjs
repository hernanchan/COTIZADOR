/**
 * ÚNICO PDF de un trabajo V2: reelección -> SHA local -> recepción GAS ->
 * comprobación real de Google -> vínculo estricto contra cotizador.
 *
 * Sólo ensayos same-origin en Worker privado. Nunca se invoca desde la tienda
 * pública ni persiste el File o los tokens en localStorage.
 * No cambia precio/estado del pedido, no habilita checkout.
 */
const PART=512*1024;
const LIMIT=20*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
function asBase64(bytes){
 let value='';
 for(let p=0;p<bytes.length;p+=12288)
  value+=btoa(String.fromCharCode(...bytes.subarray(p,p+12288)));
 return value;
}
async function digest(bytes,subtle){
 const result=await subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
}
async function sameOriginRpc(path,body,{fetcher,origin}){
 if(typeof origin!=='string'||!/^https:\/\/[^/?#]+$/.test(origin)||
    !/^\/api\/ensayo-(?:pdf-ampliado|vincular-pdf-v2)$/.test(path))
  throw Error('Recepción privada fuera del origen autorizado.');
 const reqUrl=new URL(path,origin);
 const res=await fetcher(reqUrl.href,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  credentials:'same-origin',redirect:'error'});
 const data=await res.json().catch(()=>null);
 if(!res.ok||data?.ok!==true)throw Error(data?.error||'El servidor no confirmó la recepción.');
 return data;
}
export async function subirYVincularPdfCotizadorV2({
 archivo,referencia,orderId,modo,turnstileToken,opciones,
 origin,fetcher=fetch,subtle=crypto.subtle,onProgress=()=>{},
 sesionPrevia=null,onSession=()=>{}
}){
 const r=referencia;
 if(!r||r.schema!=='saber-pdf-local-pendiente-v1'||
    !UUID.test(r.localRef||'')||!SHA.test(r.sha256||'')||
    !Number.isSafeInteger(r.bytes)||r.bytes<5||r.bytes>LIMIT||
    !Number.isSafeInteger(r.paginas)||r.paginas<1||r.paginas>2000||
    r.estado!=='PENDIENTE_DE_ENVIO'||r.recibido!==false||
    r.verificadoServidor!==false||
    typeof r.nombre!=='string'||r.nombre.length>120||
    !/\.pdf$/i.test(r.nombre)||
    !archivo||archivo.name!==r.nombre||archivo.size!==r.bytes||
    typeof archivo.arrayBuffer!=='function'||
    !WEB.test(orderId||'')||!['bn','color'].includes(modo)||
    (sesionPrevia===null&&(typeof turnstileToken!=='string'||turnstileToken.length<10))||
    typeof onProgress!=='function'||typeof onSession!=='function'||
   (sesionPrevia!==null&&(!RECEIPT.test(sesionPrevia?.uploadId||'')||
    typeof sesionPrevia.token!=='string'||sesionPrevia.token.length<16||
    sesionPrevia.token.length>256||
    sesionPrevia.orderId!==orderId||sesionPrevia.localRef!==r.localRef||
    sesionPrevia.sha256!==r.sha256||sesionPrevia.modo!==modo||
    sesionPrevia.opcionesKey!==JSON.stringify(opciones??null))))
  throw Error('El archivo, el trabajo o la verificación no corresponden.');
 if(opciones!==undefined&&(!opciones||typeof opciones!=='object'||Array.isArray(opciones)||
    Object.keys(opciones).sort().join(',')!=='anillado,caras,copias,formato,materialColor'||
    !['a4','a3'].includes(opciones.formato)||!['simple','double'].includes(opciones.caras)||
    !['ninguno','juntos'].includes(opciones.anillado)||
    !Number.isSafeInteger(opciones.copias)||opciones.copias<1||opciones.copias>200||
    typeof opciones.materialColor!=='string'||
    !/^[A-Za-z0-9_-]{1,80}$/.test(opciones.materialColor)))
  throw Error('Opciones del presupuesto de servidor inválidas.');
 // Never accept an arbitrary HTTP destination from the caller: this is
 // a relative-only, fixed-path workflow pinned to one HTTPS test origin.
 const bytes=new Uint8Array(await archivo.arrayBuffer());
 if(bytes.length!==r.bytes||
    String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-'||
    await digest(bytes,subtle)!==r.sha256)
  throw Error('El PDF seleccionado es distinto del PDF cotizado.');
 const rpc=(path,payload)=>sameOriginRpc(path,payload,{fetcher,origin});
 const parts=Math.ceil(bytes.length/PART);
 onProgress({phase:'inicio',completed:0,total:parts});
 let session;
 if(sesionPrevia){
  // Sólo reintentar dentro de esta pestaña. No conservar la credencial
  // bearer de GAS en localStorage ni sessionStorage.
  session={uploadId:sesionPrevia.uploadId,token:sesionPrevia.token};
  onProgress({phase:'reanudacion',completed:0,total:parts});
 }else{
  const start=await rpc('/api/ensayo-pdf-ampliado',{op:'start',turnstileToken,
   meta:{orderId,fileId:'pdf-'+r.sha256.slice(0,24),
    name:r.nombre,mode:modo,bytes:r.bytes,sha256:r.sha256,
    partBytes:PART,parts}
  });
  if(!RECEIPT.test(start.uploadId||'')||
     typeof start.token!=='string'||start.token.length<16||
     start.token.length>256||start.paymentAuthorized!==false||
     start.orderId!==orderId)
   throw Error('El servidor no confirmó una sesión privada.');
  session={uploadId:start.uploadId,token:start.token};
 }
 // Guardar exclusivamente en memoria de la página tras verificar SHA local.
 // Si falla una transferencia, la próxima llamada consulta partes existentes.
 onSession(Object.freeze({...session,orderId,localRef:r.localRef,
  sha256:r.sha256,modo,opcionesKey:JSON.stringify(opciones??null)}));
 const status=await rpc('/api/ensayo-pdf-ampliado',{op:'status',...session});
 if(status.uploadId!==session.uploadId||
    !Array.isArray(status.acceptedParts))
  throw Error('El estado de subida es incoherente.');
 const accepted=new Set(status.acceptedParts);
 onProgress({phase:'estado',completed:accepted.size,total:parts});
 if(accepted.size!==status.acceptedParts.length||
    [...accepted].some(i=>!Number.isSafeInteger(i)||i<0||i>=parts))
  throw Error('El servidor informó fragmentos incompatibles.');
 for(let index=0;index<parts;index++){
  if(accepted.has(index))continue;
  const part=bytes.subarray(index*PART,Math.min(bytes.length,(index+1)*PART));
  const proof=await digest(part,subtle);
  const received=await rpc('/api/ensayo-pdf-ampliado',{
   op:'part',...session,index,bytes:part.length,
   sha256:proof,dataBase64:asBase64(part)
  });
  if(received.accepted!==true||received.index!==index)
   throw Error('Un fragmento del PDF no fue aceptado.');
  onProgress({phase:'transferencia',completed:index+1,total:parts});
 }
 const finished=await rpc('/api/ensayo-pdf-ampliado',{
  op:'finish',...session,sha256:r.sha256,bytes:r.bytes,parts
 });
 if(finished.received!==true||finished.sha256!==r.sha256||
    finished.bytes!==r.bytes||finished.receiptId!==session.uploadId)
  throw Error('La recepción quedó sin confirmar.');
 onProgress({phase:'verificacion',completed:parts,total:parts});
 const linked=await rpc('/api/ensayo-vincular-pdf-v2',{
  referencia:r,sesion:session,expectedOrderId:orderId,expectedMode:modo,
  ...(opciones===undefined?{}:{opciones})
 });
 if(linked.schema!=='saber-v2-pdf-conciliado-privado-v1'||
    linked.localRef!==r.localRef||linked.orderId!==orderId||
    linked.sha256!==r.sha256||linked.receiptId!==session.uploadId||
    linked.pages!==r.paginas||linked.reciboGoogleVerificado!==true||
    linked.precioRecalculado!==false||
    linked.paymentAuthorized!==false||linked.listoParaProducir!==false)
  throw Error('Google no confirmó el PDF de este trabajo.');
 const quote=linked.cotizacionServidor;
 if(opciones!==undefined&&(!quote||
    quote.estado!=='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
    !Number.isSafeInteger(quote.totalArs)||quote.totalArs<=0||
    quote.paginasOriginales!==r.paginas||quote.formato!==opciones.formato||
    quote.caras!==opciones.caras||quote.copias!==opciones.copias||
    quote.anillado!==opciones.anillado||quote.materialColor!==opciones.materialColor||
    quote.paymentAuthorized!==false||
    linked.checkoutEnabled!==false))
  throw Error('El servidor no confirmó el presupuesto documental.');
 onProgress({phase:'confirmado',completed:parts,total:parts});
 // Never return a bearer token; must not be persisted in the cart.
 return Object.freeze({
  schema:linked.schema,localRef:linked.localRef,
  orderId:linked.orderId,receiptId:linked.receiptId,
  sha256:linked.sha256,pages:linked.pages,
  estado:linked.estado,reciboGoogleVerificado:true,
  precioRecalculado:false,paymentAuthorized:false,
  listoParaProducir:false,
  ...(opciones===undefined?{}:{cotizacionServidor:Object.freeze({
   estado:quote.estado,totalArs:quote.totalArs,priceVersion:quote.priceVersion,
   paginasOriginales:quote.paginasOriginales,formato:quote.formato,caras:quote.caras,
   copias:quote.copias,anillado:quote.anillado,materialColor:quote.materialColor,
   paymentAuthorized:false
  })})
 });
}
