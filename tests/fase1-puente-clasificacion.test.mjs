import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
const html=paginaCotizadorV2PruebaPrivada('testSiteKey1111');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
test('portal privado genera JS sintacticamente valido',()=>{
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script.replace(/^import [^\n]+;\s*$/gm,'')));
});
test('clasificacion de CAD/poster sale del navegador sin envio PDF',()=>{
 assert.match(source,/SABER_FASE1_PLOTEO_PRELIMINAR/);
 assert.match(source,/clasificacionCliente=e\.paginas\.map/);
 assert.match(source,/numero:j\+1,anchoCm:p\.anchoCm,altoCm:p\.altoCm,modo:p\.modo/);
 assert.match(source,/throw Error\('Ploteo clasificado y comunicado al portal privado/);
 assert.match(script,/SABER_FASE1_PLOTEO_PRELIMINAR/);
 assert.match(script,/NO se adjuntó ni recibió el PDF/);
 assert.match(source,/plan\.destino!=='documentos'/);
});
test('instrucciones de ploteo no se confunden con alta real de pedido',()=>{
 const marker=source.indexOf("if(plan.destino==='ploteos')");
 const end=source.indexOf("if(plan.destino!=='documentos')",marker);
 const segment=source.slice(marker,end);
 assert.ok(marker>0&&end>marker);
 assert.doesNotMatch(segment,/SABER_SMART_DOCUMENTS_TO_PRIVATE|api\/ensayo-pdf/);
 const listener=script.indexOf("event.data?.type==='SABER_FASE1_PLOTEO_PRELIMINAR'");
 assert.ok(listener>0);
 assert.ok(listener<script.indexOf("event.data?.type==='SABER_SMART_DOCUMENTS_TO_PRIVATE'"));
});
