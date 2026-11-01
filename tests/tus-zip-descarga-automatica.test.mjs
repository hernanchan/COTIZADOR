import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const zipJs=readFileSync(new URL('../integraciones/autocotizador/recepcion/zip-tus-cliente.txt',import.meta.url),'utf8');
const clientJs=readFileSync(new URL('../integraciones/autocotizador/recepcion/paquete-tus-cliente.txt',import.meta.url),'utf8');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ORDER='WEB-ENSAYO-ABCDEF0123456789ABCDEF0123456789';

async function runCase({count=5,large=false,broken=false}={}){
 const state={textContent:''},listeners={};
 const button={disabled:true,textContent:'Descargar ZIP completo',
  addEventListener(type,fn){listeners[type]=fn}};
 const elements={estado:state,zip:button,numero:{textContent:''},
  detalle:{textContent:''}};
 const created=[],blobUrls=[];
 let active=0,maxActive=0,requests=0;
 const sources=Array.from({length:count},(_,i)=>
  new Blob(['%PDF-1.7\noriginal-'+(i+1)+'\n%%EOF'],{type:'application/pdf'}));
 const trabajos=sources.map((src,i)=>({
  orden:i+1,nombreOriginal:'Original '+(i+1)+'.pdf',
  reciboPrivado:'DOC-'+(i+1),servicio:'documentos',paginasOriginales:1,
  paginasElegidas:[1],copias:1,formatoFinal:'a4',modo:'bn',
  paginasPorCaraPresupuestadas:1,carasPresupuestadas:'simple',
  tipoAnillado:'ninguno',material:'estandar',
  bytes:large?20*1024*1024:src.size
 }));
 const document={getElementById(id){return elements[id]},
  createElement(){return {href:'',download:'',click(){created.push(this.download)},
   remove(){}}},body:{append(){}}};
 class BrowserURL extends URL{}
 BrowserURL.createObjectURL=blob=>{blobUrls.push(blob);return 'blob:test-'+blobUrls.length};
 BrowserURL.revokeObjectURL=()=>{};
 const env={document,location:{href:'https://example.test/prueba-v2/orden-paquete?webOrderId='+ORDER},
  URL:BrowserURL,TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
  setTimeout(fn,ms){if(ms<1000)setTimeout(fn,ms)},console,
  async fetch(path,opts){
   if(path.endsWith('ensayo-tus-paquete-manifiesto'))
    return {ok:true,json:async()=>({
     ok:true,webOrderId:ORDER,numeroOrden:'027',importe:1500,
     estadoPago:'SIN_PAGO_CONFIRMADO',paymentAuthorized:false,trabajos
    })};
   if(path.endsWith('ensayo-tus-descargar-personal')){
    requests++;active++;maxActive=Math.max(maxActive,active);
    const index=trabajos.findIndex(x=>x.reciboPrivado===JSON.parse(opts.body).receiptId);
    await delay((count-index)%3*7+2);
    active--;
    const blob=broken&&index===0?new Blob(['NOT-PDF']):sources[index];
    return {ok:true,headers:{get:()=> 'application/pdf'},blob:async()=>blob};
   }
   throw Error('Ruta inesperada '+path);
  }};
 const ctx=vm.createContext(env);
 vm.runInContext(zipJs+'\n'+clientJs,ctx);
 for(let i=0;i<150&&!blobUrls.length&&!/No se pudo descargar/.test(state.textContent);i++)
  await delay(3);
 return {state,button,created,blobUrls,sources,maxActive,requests,listeners};
}
test('clic desde Central => ZIP se descarga automáticamente, PDF intactos, orden estable y concurrencia <=3',async()=>{
 const x=await runCase({count:5});
 assert.equal(x.created.length,1,x.state.textContent);
 assert.deepEqual(x.created,['ORDEN_027.zip']);
 assert.equal(x.requests,5);
 assert.ok(x.maxActive>1,'No debe descargarse PDF secuencialmente');
 assert.ok(x.maxActive<=3,'Limitar concurrencia para proteger CPU/red');
 assert.equal(x.button.disabled,false);
 assert.equal(x.button.textContent,'Descargar ZIP nuevamente');
 assert.equal(x.blobUrls.length,1);
 const bytes=new Uint8Array(await x.blobUrls[0].arrayBuffer());
 const data=new DataView(bytes.buffer);
 let offset=0;
 for(let i=0;i<x.sources.length;i++){
  assert.equal(data.getUint32(offset,true),0x04034b50);
  const nameLength=data.getUint16(offset+26,true);
  const filename=new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength));
  assert.equal(filename,'PDF_'+String(i+1).padStart(2,'0')+'.pdf');
  const size=data.getUint32(offset+18,true),start=offset+30+nameLength;
  assert.deepEqual(bytes.slice(start,start+size),new Uint8Array(await x.sources[i].arrayBuffer()));
  offset=start+size;
 }
 assert.equal(data.getUint32(offset,true),0x04034b50);
});
test('pedido mayor a 160 MiB se rechaza ANTES de descargar originales',async()=>{
 const x=await runCase({count:9,large:true});
 assert.equal(x.requests,0);
 assert.equal(x.created.length,0);
 assert.equal(x.button.disabled,false);
 assert.match(x.state.textContent,/160 MiB/);
});
test('PDF corrupto aborta ZIP, permite reintentar manualmente sin entregar paquete incompleto',async()=>{
 const x=await runCase({count:3,broken:true});
 assert.equal(x.created.length,0);
 assert.equal(x.blobUrls.length,0);
 assert.equal(x.button.disabled,false);
 assert.match(x.state.textContent,/PDF incompleto|PDF inválido|No se pudo descargar/);
 assert.equal(typeof x.listeners.click,'function');
});
