/**
 * QA de PDF sintético creado por este repositorio, NO aprobación de archivo de cliente.
 * Sólo el pedido sandbox V2 cuyo pago y R2/SHA ya fueron comprobados; ninguna venta real.
 */
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {revisarPdfR2Local} from './preprensa-r2-archivo-local.mjs';
const docs='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const web='WEB-ENSAYO-72E9F66A8BC34CC9B25D70EF49C1A8D3';
const commercial='89608817-95b1-41bc-ac88-579da519d32c';
const sha='68efbfed36babb0b76d3cf98d547d94b2af00af4dcbbd619d04f1c9f7fa13ee5';
const bytes=62915011,amount=4400;
const pass=process.env.SABER_V2_OPERATOR_PASSWORD;
if(typeof pass!=='string'||pass.length<16)throw Error('QA_MISSING_STAFF_CREDENTIAL');
const basic='Basic '+Buffer.from('operador:'+pass).toString('base64');
async function documents(path,body){
 const r=await fetch(docs+path,{method:'POST',headers:{Authorization:basic,
   Origin:docs,'Content-Type':'application/json'},body:JSON.stringify(body),
   redirect:'manual',signal:AbortSignal.timeout(180000)});
 const data=r.headers.get('content-type')?.startsWith('application/json')?await r.json():null;
 return {r,data};
}
const health=await fetch(central+'/health',{signal:AbortSignal.timeout(15000)}).then(r=>r.json());
if(health.ok!==true||health.paymentsEnabled!==false||health.databaseReady!==true)
 throw Error('QA_UNSAFE_CENTRAL_HEALTH');
const pay=await documents('/prueba-v2/api/ensayo-r2-prepago-checkout',{
 action:'status',webOrderId:web,commercialOrderId:commercial});
if(pay.r.status!==200||pay.data?.ok!==true||
 pay.data.estado!=='pagado_esperando_archivo'||pay.data.amountArs!==amount||
 pay.data.uploadAuthorized!==true)throw Error('QA_PAYMENT_NOT_VERIFIED');
const reference=await documents('/prueba-v2/api/ensayo-r2-referencia-personal',{
 webOrderId:web,fileId:'planoA1',sha256:sha,bytes
});
const ref=reference.data;
if(reference.r.status!==200||ref?.paidVerified!==true||ref.received!==true||
 ref.sha256!==sha||ref.bytes!==bytes||ref.declaredPages!==1||
 !/^DOC-[a-f0-9-]{36}$/i.test(ref.receiptId||''))
 throw Error('QA_R2_REFERENCE_NOT_VERIFIED');
const creds=[
 ['SABER_CENTRAL_DEMO_ADMIN_KEY',process.env.SABER_CENTRAL_DEMO_ADMIN_KEY],
 ['DEMO_ADMIN_KEY',process.env.DEMO_ADMIN_KEY],
 ['SABER_CENTRAL_ADMIN_KEY',process.env.SABER_CENTRAL_ADMIN_KEY],
 ['SABER_DOCS_CENTRAL_ADMIN_KEY',process.env.SABER_DOCS_CENTRAL_ADMIN_KEY],
 ['SABER_V2_OPERATOR_PASSWORD',pass]
];
for(const [label,secret] of creds){
 console.log('QA_ADMIN_SECRET_'+label+'='+(typeof secret==='string'&&secret.length?'PRESENT':'MISSING'));
}
const available=creds.filter(([_,secret])=>typeof secret==='string'&&secret);
let authorization=null,reviews;
for(const [label,key] of available){
 const r=await fetch(central+'/admin/api/central/r2-paid-review',{
  headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
 console.log('QA_ADMIN_AUTH_'+label+'_HTTP_'+r.status);
 if(r.status===200){
  const obj=await r.json();if(obj.ok!==true)throw Error('QA_INVALID_REVIEW_LIST');
  authorization='Bearer '+key;reviews=obj;console.log('QA_CENTRAL_ADMIN_AUTHENTICATED_AS='+label);break;
 }
}
if(!authorization)throw Error('QA_CENTRAL_ADMIN_CREDENTIAL_UNAVAILABLE');
const row=reviews.orders?.find(x=>x.commercialOrderId===commercial);
if(!row||row.webOrderId!==web||row.amountArs!==amount||
 row.receiptId!==ref.receiptId||row.received!==true||row.verifiedReceipt!==true||
 row.quotedParametersAvailable!==true||!row.quoteSnapshot)
 throw Error('QA_REVIEW_AND_V2_SNAPSHOT_NOT_MATCH');
const q=row.quoteSnapshot;
if(q.schema!=='saber-r2-cotizacion-firmada-v1'||
 q.importeArs!==4400||q.copias!==1||q.modoImpresion!=='bn'||
 q.seleccion!=='original'||q.papelPoster!=='obra80'||
 q.paginas.length!==1||q.paginas[0][2]!=='cad'||
 q.paginas[0][3]!=='rollo60'||q.paginas[0][4]!=='obra80')
 throw Error('QA_QUOTED_CLASSIFICATION_PAPER_OR_PRICE_MISMATCH');
console.log('QA_V2_SIGNED_QUOTE_SNAPSHOT_RECEIVED_D1');
const tmp=await mkdtemp(join(tmpdir(),'saber-qa-v2-r2-'));
try{
 const path=join(tmp,'original.pdf');
 const res=await fetch(docs+'/prueba-v2/api/ensayo-r2-descargar-d1-personal',{
  method:'POST',headers:{Authorization:basic,Origin:docs,
   'Content-Type':'application/json'},
  body:JSON.stringify({orderId:web,receiptId:ref.receiptId}),
  signal:AbortSignal.timeout(180000),redirect:'manual'});
 if(res.status!==200||!res.body||!res.headers.get('content-type')?.startsWith('application/pdf')||
  Number(res.headers.get('content-length'))!==bytes)
  throw Error('QA_ORIGINAL_DOWNLOAD_REJECTED_'+res.status);
 await pipeline(Readable.fromWeb(res.body),createWriteStream(path));
 const geometry=await revisarPdfR2Local({filePath:path,webOrderId:web,
  commercialOrderId:commercial,receiptId:ref.receiptId,
  expectedSha256:sha,expectedBytes:bytes,
  paginasDeclaradas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}],amountArs:4400});
 const dim=geometry.measuredDimensions?.[0];
 if(geometry.sha256Verificado!==true||geometry.geometryMatchesQuote!==true||
  geometry.measuredPages!==1||!dim||
  Math.abs(dim.anchoCm-59.4)>0.1||Math.abs(dim.altoCm-84.1)>0.1||
  geometry.readyForPrinting!==false||geometry.productionAuthorized!==false)
  throw Error('QA_PDF_CONTENT_NOT_MATCHING');
 console.log('QA_PDF_REAL_SHA_SIZE_PAGE_A1_GEOMETRY_VERIFIED');
 // Solo el ensayo sintético: registra que el operador de QA comprobó la
 // clasificación declarada, el material D1 y que el contenido es sintético.
 const approval={schema:'saber-r2-preprensa-aprobacion-v1',orderId:commercial,
  receiptId:ref.receiptId,medidasCm:[[59.4,84.1]],
  operator:'QA SANDBOX - original sintetico',
  notes:'Ensayo sintético generado por GitHub Actions: SHA, A1, 1 página, CAD declarado, 1 copia B/N, papel obra80 y rollo60, importe $4400 comprobados. No es cliente.',
  confirmed:{clasificacion:true,contenido:true,copias:true,papel:true,precio:true,rollo:true}};
 const response=await fetch(central+'/admin/api/central/r2-prepress-approve',{
  method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},
  body:JSON.stringify(approval),signal:AbortSignal.timeout(25000)});
 const data=await response.json().catch(()=>({}));
 if(![200,201].includes(response.status)||data.ok!==true||data.approved!==true)
  throw Error('QA_APPROVAL_D1_FAILED_'+response.status+'_'+String(data.error||''));
 console.log('QA_R2_PREPRESS_APPROVED_D1_SANDBOX_ONLY_IDEMPOTENT='+Boolean(data.idempotent));
 console.log('QA_NO_PRINTER_COMMANDS_NO_REAL_PAYMENTS_NO_MAIN');
}finally{await rm(tmp,{recursive:true,force:true})}
