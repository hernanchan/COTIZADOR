import vm from 'node:vm';
import {paginaDescargaTUSPersonal} from '../integraciones/autocotizador/recepcion/pantalla-descarga-tus-personal.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
import {readFileSync} from 'node:fs';
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
  assert.ok(match[1].includes('const TUS_BLOCKED='+(!enabled)));
  assert.ok(match[1].includes('ensayo-tus-comprobar'));
  assert.ok(match[1].includes('TUS_ENABLED&&!tusPreflightOK'));
  assert.ok(match[1].includes('STORAGE_FIRMA_OK'));
  assert.ok(match[1].includes("registeredShortOrder"));
  assert.ok(match[1].includes("Orden N.º "));
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


test('las solicitudes TUS comparten el alcance Basic /prueba-v2/ y cookie HttpOnly',()=>{
 const page=paginaCotizadorV2PruebaPrivada(sitekey,true,{solicitado:true,listo:true,invalidos:[]});
 assert.ok(page.includes("fetch('/prueba-v2/api/ensayo-tus-comprobar'"));
 const root=new URL('../integraciones/autocotizador/recepcion/',import.meta.url);
 const uploader=readFileSync(new URL('tus-directo-cliente.mjs',root),'utf8');
 assert.ok(uploader.includes("call('/prueba-v2/api/ensayo-tus-iniciar'"));
 assert.ok(uploader.includes("call('/prueba-v2/api/ensayo-tus-registrar'"));
 const worker=readFileSync(new URL('worker-fase4-cotizador-unificado.mjs',root),'utf8');
 assert.ok(worker.includes("v2SessionCookie(env,'/prueba-v2/api/')"));
 assert.ok(worker.includes("page==='/prueba-v2/api/ensayo-tus-comprobar'"));
 assert.ok(worker.includes("page==='/prueba-v2/api/ensayo-tus-iniciar'"));
 assert.ok(worker.includes("page==='/prueba-v2/api/ensayo-tus-registrar'"));
});


test('descarga del personal exige Basic y consulta protegida D1+SHA; no publica URL Storage',async()=>{
 const page=paginaDescargaTUSPersonal();
 const script=page.match(/<script>([\s\S]+?)<\/script>/)?.[1];
 assert.ok(script);
 await transform(script,{loader:'js',format:'esm',target:'es2022'});
 assert.match(page,/\bdescargar PDF original/i);
 assert.ok(page.includes('/prueba-v2/api/ensayo-tus-descargar-personal'));
 assert.ok(!page.includes('service_role'));
 assert.ok(!page.includes('DOCS_TUS_SUPABASE_SERVICE_KEY'));
 const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.ok(worker.includes("page==='/prueba-v2/personal-descargar'"));
 assert.ok(worker.includes("page==='/prueba-v2/api/ensayo-tus-descargar-personal'"));
 assert.ok(worker.includes("authorized:v2PrivateBrowserAuthorized(request,env)==='allow'"));
 const central=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
 assert.ok(central.includes('"/admin/api/central/unpaid-detail"'));
 assert.ok(central.includes('if(!tokenOK(req,env))return json({error:"No autorizado"},401);'));
});


test('el cliente ve confirmación grande y número corto solo luego de registro D1',()=>{
 const html=paginaCotizadorV2PruebaPrivada(sitekey,true);
 const script=html.match(/<script type="module">([\s\S]+?)<\/script>/)?.[1];
 assert.ok(script);
 const begin=script.indexOf('function mostrarEstadoCliente(');
 const end=script.indexOf('let batchSending=',begin);
 assert.ok(begin>=0&&end>begin);
 const created=[],scroll=[],classes={},view={hidden:true,replaceChildren(...items){
  this.children=items;
 },scrollIntoView(settings){scroll.push(settings)}};
 const progress={textContent:''},send={textContent:''};
 const context=vm.createContext({
  document:{body:{classList:{toggle(k,v){classes[k]=v}}},createElement(tag){
   const node={tagName:tag,textContent:'',className:'',addEventListener(){}};created.push(node);return node;
  }},
  vistaEstadoPedido:view,batchProgress:progress,sendAllButton:send
 });
 vm.runInContext(script.slice(begin,end),context);
 const show=vm.runInContext('mostrarEstadoCliente',context);
 show('enviando','Enviando PDF','Recepción en curso');
 assert.equal(view.hidden,false);
 assert.equal(scroll.length,0);
 assert.equal(classes['estado-registro'],false);
 show('registrado','Pedido recibido correctamente','PDF registrados',null);
 assert.equal(scroll.length,0);
 assert.equal(classes['estado-registro'],false);
 show('registrado','Pedido recibido correctamente','2 PDF verificados','007');
 assert.equal(classes['estado-registro'],true);
 assert.equal(scroll.length,1);
 assert.equal(view.children[1].textContent,'Orden N.º 007');
 assert.equal(progress.textContent.includes('Orden N.º 007'),true);
 assert.equal(send.textContent,'Orden N.º 007 recibida');
 assert.ok(html.includes('body.estado-registro #vista-estado-pedido'));
 assert.ok(script.includes('resultado.numeroOrden'));
 assert.ok(script.includes('registeredShortOrder=resultado.numeroOrden'));
});


test('cotizador inteligente acepta 14x20 y preserva elección original en TUS',()=>{
 const html=paginaCotizadorV2PruebaPrivada(sitekey,true);
 assert.ok(html.includes('personalizado_a4'));
 assert.ok(html.includes('Tamaño original menor que A4'));
 assert.ok(html.includes("opt.formato"));
 const sha='f'.repeat(64),name='CARATULAS DIARIA.pdf';
 const d={reference:{sha256:sha,nombre:name,bytes:12345,paginas:14},
  archivoLocal:{name,size:12345}};
 const plan={meta:{fileId:'file-123',mode:'bn',name,sha256:sha,bytes:12345},
  opcionesKey:JSON.stringify({formato:'personalizado_a4',copias:1,
   caras:'simple',anillado:'ninguno',paginasPorHoja:1,materialColor:''})};
 const normalized=normalizarTrabajoTUS(d,plan);
 assert.equal(normalized.opciones.seleccion,'original');
 assert.equal(normalized.opciones.copias,1);
 assert.equal(normalized.opciones.anillado,'ninguno');
});
