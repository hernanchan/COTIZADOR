import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
import {normalizarTrabajoTUS} from '../integraciones/autocotizador/recepcion/tus-directo-cliente.mjs';
const sitekey='1234567890abcdefghijklmnopqrstuvwxyz0123';

test('portal actual conserva un CTA y scripts HTML válidos con TUS OFF y ON',async()=>{
 for(const enabled of [false,true]){
  const html=paginaCotizadorV2PruebaPrivada(sitekey,enabled);
  const match=html.match(/<script type="module">([\s\S]+?)<\/script>/);
  assert.ok(match,'script del cotizador encontrado');
  const transformed=await transform(match[1],{loader:'js',format:'esm',target:'es2022'});
  assert.ok(transformed.code.length>2500);
  assert.ok(match[1].includes('const TUS_ENABLED='+enabled));
  assert.ok(html.includes('id="send-all-pdf"'));
  assert.ok(html.includes('id="precio-smart"'));
  assert.ok(match[1].includes('await enviarTUSDesdeCarrito(pending)'));
  assert.ok(match[1].includes('await prepararSesionesDeLote(pending)'));
  assert.equal((html.match(/id="send-all-pdf"/g)||[]).length,1);
  assert.ok(!html.includes('MercadoPago.checkout'));
 }
});
const sha='a'.repeat(64);
const order='WEB-ENSAYO-1234567890ABCDEF1234567890ABCDEF';
const base={
 reference:{schema:'saber-pdf-local-pendiente-v1',localRef:'11111111-1111-4111-8111-111111111111',
  nombre:'Mapa_Municipal_A0.pdf',sha256:sha,bytes:2048,paginas:1,
  estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false},
 archivoLocal:{name:'Mapa_Municipal_A0.pdf',size:2048,arrayBuffer:async()=>new ArrayBuffer(2048)},
};
const meta={fileId:'pdf-aaaaaaaaaaaaaaaa-11111111111141118111111111111111',
  orderId:order,name:base.reference.nombre,mode:'bn',bytes:2048,sha256:sha,
  pages:1,partBytes:512*1024,parts:1};
test('normalizador reutiliza una opción A4 con precio existente, sin agregar segunda pantalla',()=>{
 const d={...base};
 const plan={meta,opcionesKey:JSON.stringify({formato:'a4',caras:'double',copias:2,
  anillado:'individual',materialColor:'obra70',paginasPorHoja:2})};
 const t=normalizarTrabajoTUS(d,plan);
 assert.equal(t.opciones.seleccion,'a4');
 assert.equal(t.opciones.caras,'double');
 assert.equal(t.opciones.copias,2);
 assert.equal(t.opciones.anillado,'individual');
 assert.equal(t.opciones.paginasPorHoja,2);
 assert.equal(t.meta.pages,1);
});
test('normalizador reutiliza clasificación CAD/Póster y no permite SHA inválido',()=>{
 const d={...base,ploteo:{modo:'bn',copias:1,papelPoster:'obra80',
  clasificacionCliente:[{numero:1,anchoCm:84.1,altoCm:118.9,modo:'cad'}]}};
 const t=normalizarTrabajoTUS(d,{meta,opcionesKey:'null'});
 assert.equal(t.opciones.seleccion,'original');
 assert.equal(t.opciones.clasificacionCliente[0].modo,'cad');
 assert.equal(t.opciones.papelPoster,'obra80');
 assert.throws(()=>normalizarTrabajoTUS(d,{meta:{...meta,sha256:'0'.repeat(64)},opcionesKey:'null'}),/no corresponde/);
});
test('sólo PDF del mismo hash y referencia, se bloquean los intercambios de archivo',()=>{
 const d={...base,archivoLocal:{name:base.reference.nombre,size:1024,arrayBuffer:async()=>new ArrayBuffer(1024)}};
 assert.throws(()=>normalizarTrabajoTUS(d,{meta,opcionesKey:'null'}),/no corresponde/);
});


test('TUS solicitado pero mal configurado bloquea Google Drive e informa solamente requisitos',async()=>{
 const html=paginaCotizadorV2PruebaPrivada(sitekey,false,{
  solicitado:true,listo:false,invalidos:['DOCS_TUS_SUPABASE_SERVICE_KEY']
 });
 assert.match(html,/Supabase\/TUS no está operativo/);
 assert.match(html,/DOCS_TUS_SUPABASE_SERVICE_KEY/);
 assert.match(html,/const TUS_BLOCKED=true/);
 assert.match(html,/sendAllButton\.disabled=TUS_BLOCKED\|\|/);
 const script=html.match(/<script type="module">([\s\S]+?)<\/script>/)?.[1];
 assert.ok(script);
 await transform(script,{loader:'js',format:'esm',target:'es2022'});
 const ready=paginaCotizadorV2PruebaPrivada(sitekey,true,{solicitado:true,listo:true,invalidos:[]});
 assert.match(ready,/const TUS_BLOCKED=false/);
 assert.match(ready,/const TUS_ENABLED=true/);
});
