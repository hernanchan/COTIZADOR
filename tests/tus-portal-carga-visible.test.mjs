import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorTUSClientePruebas,paginaCotizadorV2PruebaPrivada}
 from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const KEY='abc123456789testing';
function expectPage(page){
 const iframe=page.indexOf('<iframe id="smart"');
 const form=page.indexOf('<div id="acciones-pedido">');
 const contact=page.indexOf('id="cliente-nombre"');
 const button=page.indexOf('id="send-all-pdf"');
 const headline=page.indexOf('Cargá tus archivos una sola vez');
 assert.ok(iframe>0&&form>iframe&&contact>iframe&&button>iframe,
  'El cargador tiene que ser visible ANTES del resumen y del formulario');
 assert.ok(headline>0&&headline<iframe,'Primero indicar la carga');
 assert.ok(!page.includes('#acciones-pedido{position:sticky;top:0;'),
  'El formulario nunca debe cubrir el cargador con una cabecera fija');
 assert.ok(page.includes('#acciones-pedido{position:static;top:auto;'));
 assert.equal((page.match(/id="send-all-pdf"/g)||[]).length,1);
 assert.equal((page.match(/id="smart"/g)||[]).length,1);
 assert.match(page,/src="\/prueba-v2\/carga-inteligente/);
}
test('Portal del comprador: carga antes de contacto, sin cabecera tapa-archivos',()=>{
 expectPage(paginaCotizadorTUSClientePruebas(KEY,true,null,true));
});
test('Portal del operador: misma corrección de estructura y seguridad',()=>{
 expectPage(paginaCotizadorV2PruebaPrivada(KEY,true,null,true));
});
test('iframe: selección múltiple JPG PNG PDF visible sin opciones previas',()=>{
 const html=paginaCargaUnica();
 assert.match(html,/id="zonaArchivos">/);
 assert.match(html,/type="file" accept="\.pdf,\.jpg,\.jpeg,\.png,application\/pdf,image\/jpeg,image\/png" multiple/);
 assert.ok(html.indexOf('id="archivos"')<html.indexOf('id="modoConfiguracion"'));
 assert.match(html,/name="modoImpresionLote" value="individual" checked/);
});
