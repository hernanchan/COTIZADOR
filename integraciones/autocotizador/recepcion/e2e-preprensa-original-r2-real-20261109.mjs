/** Prueba PRIVADA sin nuevo pago ni nueva subida: original que R2 ya conserva. */
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {revisarPdfR2Local} from './preprensa-r2-archivo-local.mjs';
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const order='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const commercial='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const sha='68efbfed36babb0b76d3cf98d547d94b2af00af4dcbbd619d04f1c9f7fa13ee5';
const bytes=62915011;
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;
if(typeof pass!=='string'||!pass)throw Error('STAFF_BASIC_SECRET_MISSING');
const auth='Basic '+Buffer.from('operador:'+pass).toString('base64');
const headers={Authorization:auth,'Content-Type':'application/json',Origin:base};
async function request(route,body,{timeout=100000}={}){
 const res=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(body),
  redirect:'manual',signal:AbortSignal.timeout(timeout)});
 return res;
}
const hp=await fetch(central+'/health',{signal:AbortSignal.timeout(20000)}).then(r=>r.json());
if(hp.ok!==true||hp.databaseReady!==true||hp.paymentsEnabled!==false)
 throw Error('PREPRESS_CENTRAL_OR_REAL_PAYMENTS_UNSAFE');
const status=await request('/prueba-v2/api/ensayo-r2-prepago-checkout',
 {action:'status',webOrderId:order,commercialOrderId:commercial});
const payment=await status.json();
if(status.status!==200||payment.ok!==true||payment.estado!=='pagado_esperando_archivo'||
 payment.amountArs!==4400||payment.uploadAuthorized!==true)
 throw Error('PREPRESS_PAID_ORDER_NOT_RECONCILED');
console.log('PREPRESS_REAL_MP_SANDBOX_PAYMENT_CONFIRMED');
const resolved=await request('/prueba-v2/api/ensayo-r2-referencia-personal',
 {webOrderId:order,fileId:'planoA1',sha256:sha,bytes});
const ref=await resolved.json();
if(resolved.status!==200||ref.ok!==true||ref.paidVerified!==true||
 ref.sha256!==sha||ref.bytes!==bytes||ref.declaredPages!==1||
 !/^DOC-[a-f0-9-]{36}$/i.test(ref.receiptId||'')||
 ref.productionAuthorized!==false)
 throw Error('PREPRESS_HMAC_CENTRAL_R2_REFERENCE_NOT_VERIFIED_'+resolved.status+'_'+String(ref.error||''));
console.log('PREPRESS_REAL_R2_REFERENCED_BY_TWO_CENTRAL_D1_LOOKUPS');
const dir=await mkdtemp(join(tmpdir(),'saber-r2-preflight-e2e-'));
const filePath=join(dir,'original-from-r2.pdf');
try{
 const res=await request('/prueba-v2/api/ensayo-r2-descargar-d1-personal',
  {orderId:order,receiptId:ref.receiptId},{timeout:190000});
 if(res.status!==200||!String(res.headers.get('content-type')||'').startsWith('application/pdf')||
  Number(res.headers.get('content-length'))!==bytes||!res.body)
  throw Error('PREPRESS_STAFF_DOWNLOAD_REJECTED_'+res.status);
 await pipeline(Readable.fromWeb(res.body),createWriteStream(filePath));
 console.log('PREPRESS_FULL_PRIVATE_ORIGINAL_DOWNLOADED_BYTES='+bytes);
 const review=await revisarPdfR2Local({
  filePath,webOrderId:order,commercialOrderId:commercial,receiptId:ref.receiptId,
  expectedSha256:sha,expectedBytes:bytes,
  paginasDeclaradas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}],
  amountArs:4400
 });
 if(review.schema!=='saber-r2-informe-preprensa-local-v1'||
   review.sha256Verificado!==true||review.geometryMatchesQuote!==true||
   review.measuredPages!==1||review.measuredDimensions.length!==1||
   review.readyForPrinting!==false||review.productionAuthorized!==false||
   review.priceRecalculated!==false||review.cadPosterClassificationVerified!==false)
  throw Error('PREPRESS_REVIEW_NOT_SAFE');
 const dim=review.measuredDimensions[0];
 if(Math.abs(dim.anchoCm-59.4)>0.1||Math.abs(dim.altoCm-84.1)>0.1)
  throw Error('PREPRESS_A1_DIMENSIONS_NOT_MATCHING_DECLARATION');
 console.log('PREPRESS_R2_REAL_FILE_SHA256_MATCH_AND_PAGE_COUNT_1_A1_59_4x84_1_CM');
 console.log('PREPRESS_R2_PLOTTER_ORIGINAL_HEAVY_COPY_RECOMMENDED='+review.copyForPlotterRequired);
 console.log('PREPRESS_COMMERCIAL_PRICE_NOT_RECALCULATED_OPERATOR_REVIEW_REQUIRED');
 console.log('PREPRESS_NO_NEW_PAYMENT_NO_NEW_R2_UPLOAD_NO_PRINT_AUTHORIZATION');
}finally{
 await rm(dir,{recursive:true,force:true});
}
