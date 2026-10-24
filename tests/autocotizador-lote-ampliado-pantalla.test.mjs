import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {paginaLotePdfAmpliado} from '../integraciones/autocotizador/recepcion/pantalla-lote-pdf-ampliado.mjs';

test('pantalla piloto de 30 PDF: un pedido, archivos individuales y endpoints aislados',()=>{
 const html=paginaLotePdfAmpliado('0x4AAAAaa_TEST_SITEKEY_123456');
 assert.match(html,/hasta treinta archivos|treinta archivos|30 PDF/i);
 assert.match(html,/MAX_BATCH_BYTES=60\*1024\*1024/);
 assert.match(html,/batchOrderId/);
 assert.match(html,/const orderId=batchOrderId/);
 assert.match(html,/fileId:'pdf-'\+sha\.slice\(0,24\)/);
 assert.match(html,/file\.size>20\*1048576/);
 assert.match(html,/recibidos\.length>=30/);
 assert.match(html,/\/api\/ensayo-pdf-ampliado/);
 assert.match(html,/\/api\/ensayo-cotizar-lote-ampliado/);
 assert.doesNotMatch(html,/rpc\('\/api\/ensayo-pdf'/);
 assert.doesNotMatch(html,/rpc\('\/api\/ensayo-cotizar-lote'/);
 assert.match(html,/Pagos: DESACTIVADOS/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.ok(script.length>500);
 assert.doesNotThrow(()=>new Function(script));
});
test('pantalla y rutas de ensayo siguen detrás de variable privada',()=>{
 const path=new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url);
 const source=readFileSync(path,'utf8');
 assert.match(source,/page==='\/prueba-cotizador-lote-ampliado'/);
 assert.match(source,/page==='\/api\/ensayo-pdf-ampliado'/);
 assert.match(source,/page==='\/api\/ensayo-cotizar-lote-ampliado'/);
 assert.match(source,/DOCS_EXTENDED_RECEIVER_ENABLED!=='PRIVATE_TEST_ONLY'/);
 assert.match(source,/extended\?30:5/);
 assert.match(source,/maxFiles,maxFileBytes,requireSharedOrder:extended/);
});


test('recarga: conservar solamente referencia aleatoria, sin tokens ni PDFs',()=>{
 const html=paginaLotePdfAmpliado('0x4AAAAaa_TEST_SITEKEY_123456');
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 const start=script.indexOf("const ORDER_RECOVERY_KEY='saber-lote-ampliado-order-v1'");
 const end=script.indexOf("const add=$('add')",start);
 assert.ok(start>0&&end>start);
 const recoveryBlock=script.slice(start,end);
 const store=new Map();let generated=0;
 function mount(){
  const context=vm.createContext({
   sessionStorage:{getItem:k=>store.get(k)||null,
    setItem:(k,v)=>store.set(k,v)},
   crypto:{getRandomValues(array){generated++;array.fill(generated);return array}},
   Date,JSON,Uint8Array,Array,Number
  });
  vm.runInContext(recoveryBlock+"\nthis.__orderId=batchOrderId;",context);
  return context.__orderId;
 }
 const first=mount();
 assert.match(first,/^WEB-ENSAYO-[A-F0-9]{32}$/);
 const saved=JSON.parse(store.get('saber-lote-ampliado-order-v1'));
 assert.deepEqual(Object.keys(saved).sort(),['createdAt','orderId','version']);
 assert.equal(saved.orderId,first);
 assert.equal(mount(),first);
 assert.equal(generated,1,'No debe regenerar el pedido al recargar');
 assert.match(script,/const progress=await rpc\('\/api\/ensayo-pdf-ampliado'/);
 assert.doesNotMatch(script,/const progress=sesionNueva\?/);
 assert.doesNotMatch(script,/localStorage/);
 // El único valor guardado es la referencia: los archivos y tokens
 // requieren volver a seleccionar el PDF y autenticar con Turnstile.
 const serialized=JSON.stringify([...store]);
 assert.doesNotMatch(serialized,/uploadId|dataBase64|token|PDF-1/);
});
test('estado de recuperación mal formado se descarta sin confiar en él',()=>{
 const html=paginaLotePdfAmpliado('0x4AAAAaa_TEST_SITEKEY_123456');
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 const code=script.slice(script.indexOf('const ORDER_RECOVERY_KEY'),script.indexOf("const add=$('add')"));
 const values=new Map([['saber-lote-ampliado-order-v1',JSON.stringify({
  version:1,orderId:'WEB-ENSAYO-'+'A'.repeat(32),createdAt:Date.now()-25*60*60*1000
 })]]);
 const context=vm.createContext({sessionStorage:{
  getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)
 },crypto:{getRandomValues:arr=>(arr.fill(2),arr)},Date,JSON,Uint8Array,Array,Number});
 vm.runInContext(code+"\nthis.__orderId=batchOrderId;",context);
 assert.notEqual(context.__orderId,'WEB-ENSAYO-'+'A'.repeat(32));
 assert.equal(JSON.parse(values.get('saber-lote-ampliado-order-v1')).orderId,context.__orderId);
});
