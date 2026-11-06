/**
 * Librería Saber — canaria REAL, sólo para ensayo en el Worker privado.
 * Sube un PDF sintético por TUS, pide la verificación SHA/precios al mismo
 * backend del cliente y crea el pedido comercial SIN cobrar ni entregarlo.
 * Nunca modifica archivos ya almacenados ni usa tokens administrativos Storage.
 *
 * Se ejecuta exclusivamente en GitHub Actions con contraseña privada existente.
 */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {Upload} from 'tus-js-client';

const DOCS='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const STORAGE='https://qkbbqzbannyhuanngjpw.storage.supabase.co';
const PASS=process.env.SABER_V2_OPERATOR_PASSWORD;
if(typeof PASS!=='string'||PASS.length<16)throw Error('MISSING_PRIVATE_TEST_PASSWORD');
const auth='Basic '+Buffer.from('operador:'+PASS).toString('base64');
const origin=DOCS;
const headers={Authorization:auth,Origin:origin,'Content-Type':'application/json'};
const timeout=(ms=35000)=>AbortSignal.timeout(ms);
const get=async(path)=>{
 const r=await fetch(DOCS+path,{headers:{Authorization:auth},signal:timeout(),redirect:'manual'});
 if(r.status!==200)throw Error('PRIVATE_PREFLIGHT_HTTP_'+r.status);
 const data=await r.json();
 return data;
};
const post=async(path,payload)=>{
 const r=await fetch(DOCS+path,{method:'POST',headers,body:JSON.stringify(payload),
  redirect:'manual',signal:timeout(110000)});
 if(r.status!==200)throw Error('PRIVATE_ORDER_'+path.split('/').pop()+'_HTTP_'+r.status);
 const d=await r.json();
 if(d.ok!==true)throw Error('PRIVATE_ORDER_REJECTED');
 return d;
};
const price=await get('/prueba-v2/precios-web.json');
if(!/^d1-approved-revision-[1-9][0-9]*$/.test(price?.priceVersion||''))
 throw Error('PRIVATE_D1_PRICE_VERSION_MISSING');
const check=await get('/health').catch(()=>({}));
if(check?.paymentsEnabled===true)throw Error('REAL_PAYMENTS_UNEXPECTEDLY_ENABLED');
console.log('PRICES_VERIFIED_FROM_PRIVATE_D1');

const orderId='WEB-ENSAYO-'+randomBytes(16).toString('hex').toUpperCase();
const clientOrderId=randomUUID();
const fileId='CANARY001';
const pdf=await PDFDocument.create();
const page=pdf.addPage([595.28,841.89]);
const font=await pdf.embedFont(StandardFonts.Helvetica);
page.drawText('ENSAYO DE BORRADO - LIBRERIA SABER', {x:40,y:770,size:19,font,color:rgb(0.1,0.2,0.4)});
page.drawText('Documento sintetico. No corresponde a un cliente ni a un pedido real.',{x:40,y:720,size:10,font});
page.drawText('Fecha de prueba: 06-11-2026. Orden aislada: '+orderId,{x:40,y:690,size:10,font});
const bytes=Buffer.from(await pdf.save());
const sha256=createHash('sha256').update(bytes).digest('hex');
const name='CANARIA_BORRADO_SABER.pdf';
if(bytes.length<150||bytes.length>100000)throw Error('CANARY_PDF_UNEXPECTED_SIZE');
const meta={fileId,name,mode:'bn',bytes:bytes.length,sha256,pages:1};

const started=await post('/prueba-v2/api/ensayo-tus-iniciar',{orderId,metas:[meta]});
if(started.orderId!==orderId||started.sessions?.length!==1||
 started.projectRef!=='qkbbqzbannyhuanngjpw'||started.bucket!=='saber-tus-lab'||
 started.paymentAuthorized!==false||started.checkoutEnabled!==false||
 typeof started.publishableKey!=='string'||started.publishableKey.length<30)
 throw Error('CANARY_AUTHORIZATION_MISMATCH');
const session=started.sessions[0];
if(session.fileId!==fileId||session.bytes!==bytes.length||
 !session.objectName?.startsWith('v2/'+orderId+'/')||
 !/^v2\/WEB-ENSAYO-[A-F0-9]{32}\/[0-9a-f-]{36}\.pdf$/.test(session.objectName)||
 typeof session.signature!=='string'||session.signature.length<12||
 typeof session.proof!=='string'||session.proof.length<40)
 throw Error('CANARY_RECEIPT_MISMATCH');
console.log('TUS_SESSION_PRIVATE_OK ORDER='+orderId+' SIZE='+bytes.length);
await new Promise((resolve,reject)=>{
 const upload=new Upload(bytes,{
  endpoint:STORAGE+'/storage/v1/upload/resumable/sign',
  headers:{apikey:started.publishableKey,'x-signature':session.signature},
  uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
  retryDelays:[0,1000,3000],chunkSize:6*1024*1024,
  metadata:{bucketName:started.bucket,objectName:session.objectName,
    contentType:'application/pdf',cacheControl:'0'},
  onError:()=>reject(Error('CANARY_TUS_UPLOAD_FAILED')),
  onSuccess:resolve
 });
 upload.start();
});
console.log('CANARY_STORAGE_UPLOAD_CONFIRMED');
const opciones={servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
 copias:1,modo:'bn',caras:'simple',paginasPorHoja:1,papelPoster:'obra80',
 anillado:'ninguno',grupoAnillado:'',materialColor:'obra70',
 productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1};
const final=await post('/prueba-v2/api/ensayo-tus-registrar',{
 orderId,clientOrderId,expectedPriceVersion:price.priceVersion,
 entries:[{proof:session.proof,opciones}]
});
if(final.webOrderId!==orderId||final.archivosVerificados!==1||
 !/^[a-f0-9-]{36}$/.test(final.orderId||'')||
 final.checkoutEnabled!==false||final.paymentAuthorized!==false||
 final.listoParaProducir!==false||
 !Number.isSafeInteger(final.totalArs)||final.totalArs<1)
 throw Error('CANARY_D1_RECONCILIATION_FAILED');
console.log('CANARY_REGISTERED_D1_PENDING_PAYMENT',JSON.stringify({
 webOrderId:orderId,commercialOrderId:final.orderId,workNumber:final.numeroOrden,
 storageObject:session.objectName,sha256,bytes:bytes.length,
 totalArs:final.totalArs,files:1,payment:'PENDIENTE',delivery:'NO_ENTREGADO'
}));
console.log('CANARY_REAL_UPLOAD_DONE_PURGE_OFF_HISTORICAL_UNTOUCHED');
