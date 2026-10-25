/**
 * Backend only: attach private completed PDF draft to a verified D1 document.
 * No PDF bytes, URLs or Google tokens cross the Service Binding.
 * Both switches must be present; never uses public Workers fetch.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
export async function registrarPdfCompuestoCentralFirmado({
 guardado,env,subtle=crypto.subtle,
 nuevoId=()=>crypto.randomUUID(),ahora=()=>Math.floor(Date.now()/1000)
}){
 if(env?.DOCS_PRINT_DRAFT_CENTRAL_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_RELAY_KEY||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_CENTRAL_ADMIN_KEY||
    typeof env?.SABER_CENTRAL?.fetch!=='function')
  throw Error('Registro de PDF compuesto en Central deshabilitado.');
 let u;
 try{u=new URL(env.CENTRAL_TEST_URL)}catch{throw Error('Central privada no configurada.')}
 if(u.protocol!=='https:'||!HOST.test(u.hostname)||u.port||u.username||
    u.password||u.search||u.hash||u.pathname!=='/internal/central/stage')
  throw Error('Destino de Central ajeno al ensayo privado.');
 const f=guardado;
 if(!f||f.schema!=='saber-pdf-compuesto-drive-privado-v1'||
    !WEB.test(f.orderId||'')||!FILE.test(f.fileId||'')||
    !RECEIPT.test(f.originalReceiptId||'')||
    !RECEIPT.test(f.borradorReceiptId||'')||
    f.originalReceiptId===f.borradorReceiptId||
    !HASH.test(f.sha256||'')||
    !Number.isSafeInteger(f.bytes)||f.bytes<100||f.bytes>20*1024*1024||
    !Number.isSafeInteger(f.pages)||f.pages<1||f.pages>2000||
    f.estado!=='BORRADOR_VERIFICADO_EN_DRIVE_PAGO_PENDIENTE'||
    f.guardadoEnDrive!==true||f.pdfImprimibleVerificado!==false||
    f.descargaPrivadaHabilitada!==false||
    f.paymentAuthorized!==false||f.listoParaProducir!==false)
  throw Error('El PDF compuesto no tiene constancia privada de Drive.');
 const payload={
  schema:'saber-central-borrador-drive-v1',orderId:f.orderId,
  fileId:f.fileId,originalReceiptId:f.originalReceiptId,
  receiptId:f.borradorReceiptId,sha256:f.sha256,bytes:f.bytes,pages:f.pages,
  estado:f.estado,guardadoEnDrive:true,pdfImprimibleVerificado:false,
  descargaPrivadaHabilitada:false,paymentAuthorized:false,listoParaProducir:false
 };
 const timestamp=ahora(),requestId=nuevoId(),body=JSON.stringify(payload);
 if(!Number.isSafeInteger(timestamp)||!UUID.test(requestId)||body.length>2500)
  throw Error('Firma privada incompleta.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(timestamp+'\n'+requestId+'\n'+body))));
 u.pathname='/internal/central/stage-print-draft';
 const response=await env.SABER_CENTRAL.fetch(new Request(u.href,{
  method:'POST',headers:{
   'Content-Type':'application/json','x-saber-ts':String(timestamp),
   'x-saber-request-id':requestId,'x-saber-signature':signature
  },body
 }));
 const raw=await response.text();
 if(![200,201].includes(response.status)||raw.length>3000)
  throw Error('La Central no aceptó el comprobante del PDF privado.');
 let result;
 try{result=JSON.parse(raw)}catch{throw Error('Central respondió sin confirmación legible.')}
 if(result.saved!==true||result.web_order_id!==f.orderId||
    result.receipt_id!==f.borradorReceiptId||
    result.paymentAuthorized!==false||result.productionAuthorized!==false)
  throw Error('La Central no confirmó la asociación privada.');
 return Object.freeze({
  registered:true,idempotent:Boolean(result.idempotent),
  orderId:f.orderId,borradorReceiptId:f.borradorReceiptId,
  paymentAuthorized:false,productionAuthorized:false,
  descargaPrivadaHabilitada:false
 });
}
