import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const portal=paginaCotizadorV2PruebaPrivada('sitekey-ensayo-privado',true);
const script=portal.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];

test('UI TUS: exactamente diez PDF, sin cambiar el límite del clasificador independiente',()=>{
 assert.match(client,/MAX_PDF_CARGA=location\.pathname==='\/prueba-v2\/carga-inteligente'\?10:30/);
 assert.match(client,/entries\.length\+files\.length>MAX_PDF_CARGA/);
 assert.match(client,/entries\.length>MAX_PDF_CARGA/);
 assert.ok(paginaCargaUnica().includes('Podés seleccionar varios a la vez (hasta 30).'));
 assert.ok(worker.includes("'Podés seleccionar varios a la vez (hasta 10).'"));
 assert.ok(worker.includes("page==='/prueba-v2/carga-inteligente'"));
});
test('confirmación final ofrece iniciar otro pedido y descarta la referencia local anterior',()=>{
 assert.ok(script,'Falta script del portal');
 assert.doesNotThrow(()=>new Script(script.replace(/^import [^\n]+;\s*$/gm,'')));
 const start=script.indexOf('function mostrarEstadoCliente(estado,titulo,detalle,numeroOrden=null){');
 const end=script.indexOf('\nlet batchSending=',start);
 assert.ok(start>=0&&end>start,'No está la pantalla de recibo');
 const view={hidden:true,children:[],replaceChildren(...x){this.children=x},scrollIntoView(){}};
 const doc={
  body:{classList:{toggle(){}}},
  getElementById(){return view},
  createElement(tag){return {tag,events:{},
   addEventListener(type,callback){this.events[type]=callback}}}
 };
 const progress={textContent:''},send={textContent:''},removed=[],visited=[];
 const store={removeItem(k){removed.push(k)}};
 const location={assign(path){visited.push(path)}};
 const run=new Function('document','batchProgress','sendAllButton','sessionStorage',
  'RECOVERY_KEY','location','const vistaEstadoPedido=document.getElementById("vista-estado-pedido");\n'+script.slice(start,end)+
  '\nmostrarEstadoCliente("registrado","Pedido recibido", "3 archivos", "008");return vistaEstadoPedido;');
 const result=run(doc,progress,send,store,'saber-v2-ensayo-metadatos-v1',location);
 assert.equal(result.hidden,false);
 assert.ok(result.children.some(e=>e.textContent==='Orden N.º 008'));
 const btn=result.children.find(e=>e.tag==='button');
 assert.ok(btn);
 assert.equal(btn.textContent,'Iniciar otro pedido');
 btn.events.click();
 assert.deepEqual(removed,['saber-v2-ensayo-metadatos-v1']);
 assert.deepEqual(visited,['/prueba-v2/']);
});
