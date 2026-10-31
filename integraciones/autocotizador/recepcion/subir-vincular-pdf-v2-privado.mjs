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
/**
 * Identificador estable de la REFERENCIA, no sólo del contenido.
 * Dos archivos byte a byte idénticos pueden pertenecer a trabajos distintos
 * del mismo pedido y deben conservar recibos independientes.
 */
export function fileIdParaReferencia(r){
 if(!r||!SHA.test(r.sha256||'')||!UUID.test(r.localRef||''))
  throw Error('Referencia documental inválida para iniciar recepción.');
 return 'pdf-'+r.sha256.slice(0,16)+'-'+r.localRef.replace(/-/g,'').toLowerCase();
}
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
async function sameOriginRpc(path,body,{fetcher,origin,onRequestTiming}){
 if(typeof origin!=='string'||!/^https:\/\/[^/?#]+$/.test(origin)||
    !/^\/api\/ensayo-(?:pdf-ampliado|vincular-pdf-v2)$/.test(path))
  throw Error('Recepción privada fuera del origen autorizado.');
 const reqUrl=new URL(path,origin);
 const fase=path==='/api/ensayo-vincular-pdf-v2'?'vinculo':
  ['start','status','part','finish'].includes(body?.op)?body.op:'otro';
 const inicio=performance.now();
 try{
  const res=await fetcher(reqUrl.href,{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
   credentials:'same-origin',redirect:'error'});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.ok!==true)throw Error(data?.error||'El servidor no confirmó la recepción.');
  return data;
 }finally{
  // Sólo categoría y milisegundos: jamás incluir tokens, nombre o datos PDF.
  // La telemetría no debe poder romper una recepción real.
  try{onRequestTiming({fase,duracionMs:Math.max(0,Math.round(performance.now()-inicio))})}
  catch(_){}
 }
}
export async function subirYVincularPdfCotizadorV2({
 archivo,referencia,orderId,modo,turnstileToken,opciones,
 origin,fetcher=fetch,subtle=crypto.subtle,onProgress=()=>{},
 sesionPrevia=null,onSession=()=>{},onRequestTiming=()=>{}
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
     typeof onRequestTiming!=='function'||
   (sesionPrevia!==null&&(!RECEIPT.test(sesionPrevia?.uploadId||'')||
    typeof sesionPrevia.token!=='string'||sesionPrevia.token.length<16||
    sesionPrevia.token.length>256||
    sesionPrevia.orderId!==orderId||sesionPrevia.localRef!==r.localRef||
    sesionPrevia.sha256!==r.sha256||sesionPrevia.modo!==modo||
    sesionPrevia.opcionesKey!==JSON.stringify(opciones??null))))
  throw Error('El archivo, el trabajo o la verificación no corresponden.');
 if(opciones!==undefined&&(!opciones||typeof opciones!=='object'||Array.isArray(opciones)||
    !['anillado,caras,copias,formato,materialColor',
      'anillado,caras,copias,formato,materialColor,paginasPorHoja']
      .includes(Object.keys(opciones).sort().join(','))||
    ![1,2,4,9].includes(opciones.paginasPorHoja??1)||
    !['a4','a3'].includes(opciones.formato)||!['simple','double'].includes(opciones.caras)||
    !['ninguno','individual'].includes(opciones.anillado)||
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
 const rpc=(path,payload)=>sameOriginRpc(path,payload,{fetcher,origin,onRequestTiming});
 const parts=Math.ceil(bytes.length/PART);
 onProgress({phase:'inicio',completed:0,total:parts});
 let session,freshSession=false;
 if(sesionPrevia){
  // Sólo reintentar dentro de esta pestaña. No conservar la credencial
  // bearer de GAS en localStorage ni sessionStorage.
  session={uploadId:sesionPrevia.uploadId,token:sesionPrevia.token};
  // La sesión fue creada por el inicio HMAC de esta misma tanda, todavía
  // sin envío. El marcador se elimina de onSession ANTES de subir un bloque:
  // cualquier reintento debe consultar Drive, nunca confiar en él otra vez.
  freshSession=sesionPrevia.batchFresh===true;
  onProgress({phase:freshSession?'inicio':'reanudacion',completed:0,total:parts});
 }else{
  const start=await rpc('/api/ensayo-pdf-ampliado',{op:'start',turnstileToken,
   meta:{orderId,fileId:fileIdParaReferencia(r),
    name:r.nombre,mode:modo,bytes:r.bytes,sha256:r.sha256,
    partBytes:PART,parts}
  });
  if(!RECEIPT.test(start.uploadId||'')||
     typeof start.token!=='string'||start.token.length<16||
     start.token.length>256||start.paymentAuthorized!==false||
     start.orderId!==orderId)
   throw Error('El servidor no confirmó una sesión privada.');
  session={uploadId:start.uploadId,token:start.token};
  // Sólo el receptor HMAC puede confirmar que esta sesión se acaba de crear.
  // Con receptores antiguos o sesiones reutilizadas consultamos Drive como antes.
  freshSession=start.newSession===true;
 }
 // Guardar exclusivamente en memoria de la página tras verificar SHA local.
 // Si falla una transferencia, la próxima llamada consulta partes existentes.
 onSession(Object.freeze({...session,orderId,localRef:r.localRef,
  sha256:r.sha256,modo,opcionesKey:JSON.stringify(opciones??null)}));
 // Una sesión nueva NO puede tener fragmentos: evitar la ida extra a GAS.
 // El reinicio, la falta de indicador y toda sesión existente consultan Drive.
 let accepted=new Set();
 if(!freshSession){
  const status=await rpc('/api/ensayo-pdf-ampliado',{op:'status',...session});
  if(status.uploadId!==session.uploadId||
     !Array.isArray(status.acceptedParts))
   throw Error('El estado de subida es incoherente.');
  accepted=new Set(status.acceptedParts);
  if(accepted.size!==status.acceptedParts.length||
     [...accepted].some(i=>!Number.isSafeInteger(i)||i<0||i>=parts))
   throw Error('El servidor informó fragmentos incompatibles.');
 }
 onProgress({phase:'estado',completed:accepted.size,total:parts});
 for(let index=0;index<parts;index++){
  if(accepted.has(index))continue;
  const part=bytes.subarray(index*PART,Math.min(bytes.length,(index+1)*PART));
  const proof=await digest(part,subtle);
  let received;
  try{
   received=await rpc('/api/ensayo-pdf-ampliado',{
    op:'part',...session,index,bytes:part.length,
    sha256:proof,dataBase64:asBase64(part)
   });
  }catch(error){
   // Si la conexión se corta después de que Google aceptó el bloque,
   // nunca repetirlo a ciegas. Consultar primero el estado autenticado.
   // Si falla el estado, conservar la sesión para reintento manual.
   let remote;
   try{remote=await rpc('/api/ensayo-pdf-ampliado',{
    op:'status',...session
   });}catch{throw error;}
   if(remote.uploadId!==session.uploadId||
      !Array.isArray(remote.acceptedParts)||
      new Set(remote.acceptedParts).size!==remote.acceptedParts.length||
      remote.acceptedParts.some(i=>!Number.isSafeInteger(i)||i<0||i>=parts))
    throw Error('Estado remoto incompatible tras un corte de conexión.');
   if(!remote.acceptedParts.includes(index))throw error;
   received={accepted:true,index};
   onProgress({phase:'recuperado',completed:index+1,total:parts});
  }
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
    (quote.paginasPorHoja??1)!==(opciones.paginasPorHoja??1)||
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
  // Un comprobante firmado del servidor, sin credenciales de recepción.
  ...(linked.comprobanteServidor?{comprobanteServidor:linked.comprobanteServidor}:{}),
  precioRecalculado:false,paymentAuthorized:false,
  listoParaProducir:false,
  ...(opciones===undefined?{}:{cotizacionServidor:Object.freeze({
   estado:quote.estado,totalArs:quote.totalArs,priceVersion:quote.priceVersion,
   paginasOriginales:quote.paginasOriginales,formato:quote.formato,caras:quote.caras,
   copias:quote.copias,anillado:quote.anillado,grupoAnillado:quote.grupoAnillado||'',
   materialColor:quote.materialColor,
   paginasPorHoja:quote.paginasPorHoja??1,
   paymentAuthorized:false
  })})
 });
}

/**
 * Procesa hasta dos sesiones independientes en paralelo. Cada sesión
 * conserva su orden interno de fragmentos, SHA, recuperación e idempotencia.
 * Ante un error no inicia archivos adicionales, pero deja terminar los
 * envíos que ya estaban en curso; nunca cancela ni borra sesiones válidas.
 */
export async function ejecutarRecepcionParalela(trabajos,procesar,onOk,limite=2){
 if(!Array.isArray(trabajos)||trabajos.length<1||trabajos.length>30||
    typeof procesar!=='function'||typeof onOk!=='function'||
    !Number.isSafeInteger(limite)||limite<1||limite>2)
  throw Error('Planificación privada de PDF inválida.');
 let proximo=0,detener=false,confirmados=0,fallos=0;
 async function carril(){
  while(!detener){
   const indice=proximo++;
   if(indice>=trabajos.length)return;
   let bien=false;
   try{bien=(await procesar(trabajos[indice],indice))===true}
   catch{bien=false}
   if(!bien){fallos++;detener=true;return}
   confirmados++;
   onOk(trabajos[indice],indice,confirmados);
  }
 }
 await Promise.all(Array.from({length:Math.min(limite,trabajos.length)},()=>carril()));
 return Object.freeze({confirmados,fallos,total:trabajos.length,
  completo:!detener&&confirmados===trabajos.length});
}
