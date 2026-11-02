import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');

test('private PDF editor requests configuration mode before upload',()=>{
 const html=paginaCargaUnica();
 assert.match(html,/id="modoConfiguracion"/);
 assert.match(html,/name="modoImpresionLote" value="comun"/);
 assert.match(html,/name="modoImpresionLote" value="individual"/);
 assert.match(html,/id="zonaArchivos" hidden/);
 assert.match(html,/id="configComunGlobal" hidden/);
 assert.ok(html.indexOf('id="modoConfiguracion"')<html.indexOf('id="archivos"'));
});
test('shared mode preserves per-file size, pages, server quote and individual exceptions',()=>{
 assert.match(source,/let modoLote=null/);
 assert.match(source,/campo\.disabled=!modoLote/);
 assert.match(source,/if\(!modoLote\)\{\$\('estado'\)/);
 assert.match(source,/const configuracionComun=\\{\\}/);
 assert.match(source,/function aplicarConfiguracionComunAlDocumento\\(e\\)/);
 assert.match(source,/if\\(modoLote!=='comun'\\|\\|!e\\?\\.paginas/);
 assert.match(source,/if\\(!destino.confirmado\\|\\|destino.destino!=='documentos'\\)return/);
 assert.match(source,/if\\(global\\)configuracionComun\\[campo\\]=valor/);
 assert.match(source,/aplicarConfiguracionComunAlDocumento\\(entries\\[start\\+i\\]\\)/);
 assert.match(source,/const barra=controlesComunes\\(\\{id:'a4',indices\\},true\\)/);
 assert.doesNotMatch(source,/bloque.append\\(comunes\\)/);
 assert.match(source,/function renderConfiguracionGlobal\(/);
 assert.match(source,/clasificarDestino\(paginasElegidas\(e\)\|\|e\.paginas,e\.seleccion\)\.destino==='documentos'/);
 assert.match(source,/renderConfiguracionGlobal\(\);/);
 assert.match(source,/const lote=prepararLoteParcial\(entries\)/);
 assert.match(source,/const entries=\[\]/);
});
