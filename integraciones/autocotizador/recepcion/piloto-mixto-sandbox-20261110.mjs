/**
 * PILOTO MIXTO PRIVADO: único borrador + orden + preferencia MP TEST.
 * Genera PDFs sintéticos reproducibles; NO sube originales ni realiza pagos.
 * Para continuar postpago debe confirmarse el pago sandbox por el comprador.
 */
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const host='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const central='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const password=process.env.SABER_V2_OPERATOR_PASSWORD;
assert.ok(typeof password==='string'&&password.length>=16,'PILOT_STAFF_PASSWORD_MISSING');
const authorization='Basic '+Buffer.from('operador:'+password).toString('base64');
const baseHeaders={Authorization:authorization,Origin:host,'Sec-Fetch-Site':'same-origin'};
const expectedId='WEB-ENSAYO-'+createHash('sha256')
 .update('SABER_PILOTO_MIXTO_2026-11-10_REV3_ONCE')
 .digest('hex').slice(0,32).toUpperCase();
const sha=b=>createHash('sha256').update(b).digest('hex');
async function health(){
 const r=await fetch(central+'/health',{signal:AbortSignal.timeout(18000)});
 const h=await r.json();
 assert.equal(h.ok,true,'PILOT_SANDBOX_HEALTH_NOT_OK');
 assert.equal(h.databaseReady,true,'PILOT_SANDBOX_D1_NOT_READY');
 assert.equal(h.paymentsEnabled,false,'PILOT_REAL_PAYMENTS_ENABLED_STOP');
}
async function get(path){
 const r=await fetch(host+path,{headers:baseHeaders,signal:AbortSignal.timeout(30000)});
 const body=await r.json().catch(()=>({error:'NOT_JSON'}));
 assert.equal(r.status,200,'PILOT_GET_'+path+'_HTTP_'+r.status+'_'+(body.error||''));
 return body;
}
async function post(path,payload){
 const r=await fetch(host+path,{method:'POST',
  headers:{...baseHeaders,'Content-Type':'application/json'},
  body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(75000)});
 const body=await r.json().catch(()=>({error:'NOT_JSON'}));
 if(!r.ok||body?.ok!==true)throw Error(
  'PILOT_'+path.replaceAll('/','_')+'_HTTP_'+r.status+'_'+String(body?.error||'UNKNOWN'));
 return body;
}
function generatedPdf(width,height,{big=false}={}){
 const chunks=[],offs=[0];let n=0;
 const put=x=>{const bytes=Buffer.isBuffer(x)?x:Buffer.from(x,'utf8');chunks.push(bytes);n+=bytes.length};
 put('%PDF-1.4\n');
 const objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+width+' '+height+'] /Contents 4 0 R /Resources << >> >>'
 ];
 for(let i=0;i<objs.length;i++){offs[i+1]=n;put((i+1)+' 0 obj\n'+objs[i]+'\nendobj\n')}
 offs[4]=n;
 const content=big?Buffer.alloc(60*1048576,32):Buffer.from('q\nQ\n');
 put('4 0 obj\n<< /Length '+content.length+' >>\nstream\n');
 put(content);
 put('\nendstream\nendobj\n');
 const xref=n;
 put('xref\n0 5\n0000000000 65535 f \n');
 for(let i=1;i<5;i++)put(String(offs[i]).padStart(10,'0')+' 00000 n \n');
 put('trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
 return Buffer.concat(chunks,n);
}
await health();
const prices=await get('/prueba-v2/precios-web.json');
assert.match(prices.priceVersion||'',/^d1-approved-revision-[1-9]\d*$/);
console.log('PILOT_PRICE_APPROVED='+prices.priceVersion);
const small=generatedPdf(595.28,841.89);
const big=generatedPdf(1683.78,2383.94,{big:true});
assert.ok(small.length>200&&small.length<40*1048576);
assert.ok(big.length>40*1048576&&big.length<=200*1048576);
const configs=[
 {nombre:'SABER-QA-A4-1P.pdf',
  paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
  seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
  paginasPorHoja:1,anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'},
 {nombre:'SABER-QA-A1-60MiB.pdf',
  paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}],
  seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
  paginasPorHoja:1,anillado:'ninguno',grupoAnillado:'',materialColor:'',papelPoster:'obra80'}
];
const manifests=[small,big].map((p,i)=>({
 fileId:'saber_qa_'+(i+1),nombre:configs[i].nombre,bytes:p.length,sha256:sha(p)
}));
console.log('PILOT_MIXED_TUS_BYTES='+small.length+' R2_BYTES='+big.length);
const draft=await post('/prueba-v2/api/ensayo-r2-borrador-universal',{
 webOrderId:expectedId,archivos:configs,manifiestos:manifests
});
assert.equal(draft.webOrderId,expectedId);
assert.equal(draft.fileCount,2);
assert.ok(draft.totalArs>0&&draft.paymentAuthorized===false&&draft.filesUploaded===false);
console.log('PILOT_DRAFT_STORED_TOTAL_ARS='+draft.totalArs);
const order=await post('/prueba-v2/api/ensayo-r2-orden-universal',{
 webOrderId:expectedId,draftId:draft.draftId,quoteHash:draft.quoteHash,
 telefono:'3510000000' // Exclusivamente QA, nunca cliente real.
});
assert.equal(order.webOrderId,expectedId);
assert.equal(order.fileCount,2);
assert.equal(order.totalArs,draft.totalArs);
assert.ok(/^\d{3,}$/.test(order.numeroOrden||''));
console.log('PILOT_UNIQUE_COMMERCIAL_ORDER='+order.commercialOrderId);
console.log('PILOT_ORDER_NUMBER='+order.numeroOrden);
const checkout=await post('/prueba-v2/api/ensayo-r2-checkout-universal',{
 action:'start',webOrderId:expectedId,commercialOrderId:order.commercialOrderId
});
assert.equal(checkout.estado,'pendiente');
assert.equal(checkout.amountArs,draft.totalArs);
assert.equal(checkout.uploadAuthorized,false);
const url=new URL(checkout.checkoutUrl);
assert.equal(url.protocol,'https:');
assert.ok(/(^|\.)mercadopago\.com(\.ar)?$/.test(url.hostname));
console.log('PILOT_SANDBOX_MP_CHECKOUT_URL='+checkout.checkoutUrl);
const status=await post('/prueba-v2/api/ensayo-r2-checkout-universal',{
 action:'status',webOrderId:expectedId,commercialOrderId:order.commercialOrderId
});
assert.ok(['pendiente','pagado_esperando_archivos'].includes(status.estado));
if(status.estado==='pendiente')assert.equal(status.uploadAuthorized,false);
console.log('PILOT_MP_STATUS='+status.estado);
console.log('PILOT_WEB_ORDER_ID='+expectedId);
console.log('PILOT_NO_R2_UPLOAD_NO_TUS_UPLOAD_NO_REAL_PAYMENT_NO_MAIN_CHANGE');
await health();
