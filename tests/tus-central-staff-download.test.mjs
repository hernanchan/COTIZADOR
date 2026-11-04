import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto,randomUUID} from 'node:crypto';

const source=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,
 crypto:webcrypto,console,AbortSignal,fetch:()=>{throw Error('No se permiten requests externos')}});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
const commercial='e2d76c8b-ce1c-4daf-9030-4bd402295a68';
const webId='WEB-ENSAYO-01937C3514FB89DC23D78AE7BCBCDDDD';
const receipts=['DOC-1175c8c4-fac1-4cd2-bc71-23104635ecd3','DOC-6af43b5b-385c-4a04-9e68-494ddc3e647e'];
const manifest={
 trabajos:receipts.map((receipt,i)=>({
  orden:i+1,nombreOriginal:'Archivo_'+(i+1)+'.pdf',
  reciboPrivado:receipt,paginasOriginales:16,bytes:i?10131027:17849230,servicio:'documentos'
 }))
};
let allocatedNumber=null;
const db={
 prepare(sql){
  let args=[];
  const st={
   bind(...p){args=p;return st},
   async run(){
    if(sql.includes("INSERT OR IGNORE INTO central_work_order_numbers")&&
       args[0]===commercial&&allocatedNumber===null){
     allocatedNumber=1;return {meta:{changes:1}};
    }
    return {meta:{changes:0}};
   },
   async first(){
    if(sql.includes('SELECT m.commercial_order_id FROM central_document_manifests m JOIN orders o'))
     return args[0]===commercial?{commercial_order_id:commercial}:null;
    if(sql.includes('SELECT number FROM central_work_order_numbers'))
     return args[0]===commercial&&allocatedNumber!==null?{number:allocatedNumber}:null;
    if(sql.includes('FROM orders WHERE id=? AND status='))
      return args[0]===commercial?{id:commercial,status:'awaiting_payment',amount_ars:2432}:null;
    if(sql.includes('FROM central_document_manifests m LEFT JOIN central_order_contacts c')||
       sql.includes('FROM central_document_manifests WHERE commercial_order_id=?'))
      return args[0]===commercial?{web_order_id:webId,manifest_json:JSON.stringify(manifest),
       amount_ars:2432,file_count:2,created_at:'2026-11-01 15:36:00'}:null;
    return null;
   }
  };
  return st;
 }
};
const env={
 DB:db,DEMO_ADMIN_KEY:'TEST_PANEL_KEY',
 MP_TEST_ACCESS_TOKEN:'FAKE', MP_TEST_SELLER_ID:'test',
 TEST_WEBHOOK_URL:'https://test.invalid/webhook',
 MP_WEBHOOK_SECRET:'TEST_WEBHOOK_SECRET'
};
function call(key,id=commercial){
 const u='https://saber-pagos-pruebas.libreriasaber.workers.dev/admin/api/central/unpaid-detail?id='+id;
 const headers=key?{Authorization:'Bearer '+key}:{};
 return ctx.worker.fetch(new Request(u,{headers}),env);
}
test('sin clave del operador no se expone ningún recibo',async()=>{
 const response=await call();
 assert.equal(response.status,401);
 assert.ok(!(await response.text()).includes(receipts[0]));
});
test('D1 confirma dos recibos TUS, SIN cobro ni habilitación de producción',async()=>{
 const response=await call(env.DEMO_ADMIN_KEY);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.documentos.esTUS,true);
 assert.equal(data.documentos.webOrderId,webId);
 assert.equal(data.documentos.archivos,2);
 assert.deepEqual(data.documentos.trabajos.map(x=>x.reciboPrivado),receipts);
 assert.equal(data.paymentAuthorized,false);
 assert.equal(data.listoParaProducir,false);
 assert.ok(!JSON.stringify(data).includes('service_role'));
});
test('clave incorrecta o pedido ajeno se rechazan',async()=>{
 assert.equal((await call('WRONG')).status,401);
 assert.equal((await call(env.DEMO_ADMIN_KEY,randomUUID())).status,404);
 assert.equal((await call(env.DEMO_ADMIN_KEY,'INVALID')).status,400);
});
test('la vista central enlaza solo recibos de TUS a portal Basic, no ofrece URLs de Storage',()=>{
 assert.ok(source.includes('Ver PDF privados'));
 assert.ok(source.includes('Descargar PDF original'));
 assert.ok(source.includes('/prueba-v2/personal-descargar'));
 assert.ok(!source.includes('getPublicUrl('));
});


test('botón Ver PDF privados abre detalle JUNTO al pedido y muestra fallas en el mismo lugar',()=>{
 const pos=source.indexOf('const adminHtml = `');
 const start=source.indexOf('<script>',pos);
 const end=source.indexOf('</script>',start);
 assert.ok(pos>=0&&start>pos&&end>start);
 const client=source.slice(start+8,end);
 new vm.Script(client);
 assert.match(client,/showUnpaidDetails\(o\.commercial_order_id,panel,btn\)/);
 assert.match(client,/li\.append\(btn\);\s*li\.append\(panel\)/);
 const show=client.slice(client.indexOf('async function showUnpaidDetails('),
  client.indexOf('async function refreshCronState(){'));
 assert.ok(show.includes('target.replaceChildren('));
 assert.ok(show.includes('target.append(area)'));
 assert.ok(show.includes('target.scrollIntoView('));
 assert.ok(show.includes('No se pudo abrir este pedido'));
 assert.ok(show.includes('trigger.disabled=true'));
 assert.ok(!show.includes('details.replaceChildren('),
  'No usar la columna de detalle al final de una lista larga');
});


test('instrucciones de impresión visibles, sin asumir opciones ausentes',()=>{
 const begin=source.indexOf('const adminHtml = `');
 const start=source.indexOf('<script>',begin),end=source.indexOf('</script>',start);
 assert.ok(start>=0&&end>start);
 const client=source.slice(start+8,end);
 // La interpolación de template literals deja escapes JS correctos en el HTML.
 const generated=vm.runInContext('adminHtml',ctx);
 const parsed=generated.slice(generated.indexOf('<script>')+8,generated.indexOf('</script>'));
 new vm.Script(parsed);
 assert.ok(client.includes('function agregarFichaDeImpresion('));
  assert.ok(client.includes('agregarFichaDeImpresion(area,t,{trabajos:x.documentos.trabajos});'));
 assert.ok(client.includes('NO CONSTA — verificar'));
 assert.ok(client.includes('tipoAnillado'));
  assert.ok(client.includes('ANILLADO CONJUNTO'));
 assert.ok(client.includes('Páginas por cara'));
 assert.ok(client.includes('Copiar instrucciones'));
 assert.ok(client.includes('NO IMPRIMIR SIN PAGO CONFIRMADO'));
});

test('la normalización firmada conserva anillado y no lo inventa para pedidos históricos',()=>{
 const receipt='DOC-12345678-1234-4234-8234-1234567890ab';
 const bytes=10131027,sha='b'.repeat(64);
 const data={
  schema:'saber-central-recepcion-verificada-v1',orderId:webId,
  filesReceived:true,paymentAuthorized:false,listoParaProducir:false,
  importeVerificado:2432,
  recibos:[{fileId:'file1',receiptId:receipt,sha256:sha,bytes,pages:16}],
  ficha:{schema:'saber-central-ficha-produccion-v1',orderId:webId,
   pagoConfirmado:false,listoParaProducir:false,totalVerificadoSinPago:2432,
   trabajos:[{
    orden:1,idTrabajo:'work1',servicio:'documentos',
    fileId:'file1',nombreOriginal:'prueba.pdf',reciboPrivado:receipt,
    sha256:sha,paginasOriginales:16,paginasElegidas:Array.from({length:16},(_,i)=>i+1),
    copias:1,formatoFinal:'a4',carasPresupuestadas:'simple',
    paginasPorCaraPresupuestadas:1,tipoAnillado:'individual',
    material:'obra80',modo:'bn',
    pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false
   }]}
 };
 const normalize=vm.runInContext('centralSafeManifest',ctx);
 const normalized=normalize(data);
 assert.equal(normalized.trabajos[0].tipoAnillado,'individual');
 assert.equal(normalized.trabajos[0].carasPresupuestadas,'simple');
 assert.equal(normalized.trabajos[0].modo,'bn');
 assert.equal(normalized.trabajos[0].material,'obra80');
 const historical=structuredClone(data);
 delete historical.ficha.trabajos[0].tipoAnillado;
 assert.equal(normalize(historical).trabajos[0].tipoAnillado,null);
 assert.equal(normalize(historical).pagoConfirmado,false);
});


test('secuencial corto 001 se asigna una sola vez a pedido histórico, solo administrador',async()=>{
 const url='https://saber-pagos-pruebas.libreriasaber.workers.dev/admin/api/central/asignar-numero';
 const payload=JSON.stringify({orderId:commercial});
 const req=(key)=>new Request(url,{method:'POST',headers:{
  'Content-Type':'application/json',Authorization:'Bearer '+key
 },body:payload});
 assert.equal((await ctx.worker.fetch(req('WRONG'),env)).status,401);
 const first=await ctx.worker.fetch(req(env.DEMO_ADMIN_KEY),env);
 assert.equal(first.status,200);
 const x=await first.json();
 assert.equal(x.numeroOrden,'001');
 assert.equal(x.paymentAuthorized,false);
 assert.equal(x.listoParaProducir,false);
 const again=await ctx.worker.fetch(req(env.DEMO_ADMIN_KEY),env);
 assert.equal((await again.json()).numeroOrden,'001');
 assert.equal(allocatedNumber,1);
 const detail=await call(env.DEMO_ADMIN_KEY);
 const saved=await detail.json();
 assert.equal(saved.documentos.numeroOrden,'001');
});
test('asignación nueva se guarda atómicamente en el lote de pedido junto al D1',()=>{
 assert.match(source,/INSERT INTO central_work_order_numbers\(commercial_order_id\) VALUES\(\?\)/);
 assert.match(source,/INTEGER PRIMARY KEY AUTOINCREMENT/);
 assert.match(source,/INSERT OR IGNORE INTO central_work_order_numbers/);
 assert.ok(!source.includes('ROW_NUMBER() OVER'));
});


test('A5 original se presenta como A5, con tarifa A4 explícita, sin mutar la ficha',()=>{
 assert.match(source,/\["a5","a4","a3"\]\.includes\(t\.formatoFinal\)/);
 assert.ok(source.includes('t.formatoFinal==="a5"?'));
 assert.ok(source.includes('"Tarifa A4 vigente (A5 sin ampliar)"'));
 assert.match(source,/formatoFinal:texto\(w\.formatoFinal\)/);
});


test('14x20 real llega al D1 y se muestra como original con tarifa A4, no como A4',()=>{
 const sha='a'.repeat(64),receipt='DOC-12345678-1234-4234-8234-1234567890ab';
 const medidas=Array.from({length:14},(_,i)=>({pagina:i+1,anchoCm:14,altoCm:20}));
 const job={orden:1,idTrabajo:'pdf1',servicio:'documentos',
  fileId:'file1',nombreOriginal:'CARATULAS DIARIA.pdf',reciboPrivado:receipt,
  sha256:sha,paginasOriginales:14,paginasElegidas:medidas.map(p=>p.pagina),
  copias:1,formatoFinal:'personalizado_a4',tarifaAplicada:'a4',
  medidasOriginalesCm:medidas,
  carasPresupuestadas:'simple',paginasPorCaraPresupuestadas:1,
  tipoAnillado:'ninguno',material:'estandar',modo:'bn',
  pdfImprimibleVerificado:false,descargaPrivadaHabilitada:false};
 const payload={schema:'saber-central-recepcion-verificada-v1',
  orderId:webId,filesReceived:true,paymentAuthorized:false,
  listoParaProducir:false,importeVerificado:1400,
  recibos:[{fileId:'file1',receiptId:receipt,sha256:sha,bytes:15000,pages:14}],
  ficha:{schema:'saber-central-ficha-produccion-v1',orderId:webId,
   pagoConfirmado:false,listoParaProducir:false,totalVerificadoSinPago:1400,
   trabajos:[job]}};
 const normal=vm.runInContext('centralSafeManifest',ctx)(payload);
 assert.equal(normal.trabajos[0].formatoFinal,'personalizado_a4');
 assert.equal(normal.trabajos[0].tarifaAplicada,'a4');
 assert.equal(normal.trabajos[0].medidasOriginalesCm.length,14);
 assert.equal(normal.trabajos[0].medidasOriginalesCm[13].altoCm,20);
 assert.match(source,/Original: /);
 assert.match(source,/Tarifa A4 vigente \(original sin ampliar\)/);
 const tampered=structuredClone(payload);
 tampered.ficha.trabajos[0].medidasOriginalesCm[0].anchoCm=31;
 assert.throws(()=>vm.runInContext('centralSafeManifest',ctx)(tampered),/medidas originales/i);
});
