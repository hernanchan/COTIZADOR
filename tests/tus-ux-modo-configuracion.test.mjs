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
 assert.ok(source.includes('const configuracionComun={}'));
 assert.ok(source.includes("select.value=seleccion"));
 assert.ok(source.includes("configuracionComun.modo||''"));
 assert.ok(source.includes("configuracionComun.caras||''"));
 assert.ok(source.includes("configuracionComun.anillado||''"));
 assert.ok(source.includes("copias.value=String(configuracionComun.copias)"));
 assert.ok(source.includes("if(modoLote==='comun')for(const e of entries)aplicarConfiguracionComunAlDocumento(e)"));
 assert.ok(source.includes('btn.onclick=()=>{e.seleccion=tam;aplicarConfiguracionComunAlDocumento(e);cambio()}'));
 assert.ok(source.includes("sel.value;aplicarConfiguracionComunAlDocumento(e);cambio()"));
 assert.ok(source.includes('await analizarArchivoPDF(e,file);aplicarConfiguracionComunAlDocumento(e)'));
 assert.ok(source.includes('function aplicarConfiguracionComunAlDocumento(e)'));
 assert.ok(source.includes("if(modoLote!=='comun'||!e?.paginas"));
 assert.ok(source.includes("if(!destino.confirmado||destino.destino!=='documentos')return"));
 assert.ok(source.includes('if(global)configuracionComun[campo]=valor'));
 assert.ok(source.includes('aplicarConfiguracionComunAlDocumento(entries[start+i])'));
 assert.ok(source.includes("const barra=controlesComunes({id:'a4',indices},true)"));
 assert.ok(!source.includes('bloque.append(comunes)'));
 assert.match(source,/campo\.disabled=!modoLote/);
 assert.match(source,/if\(!modoLote\)\{\$\('estado'\)/);
 assert.doesNotMatch(source,/bloque.append\\(comunes\\)/);
 assert.match(source,/function renderConfiguracionGlobal\(/);
 assert.match(source,/clasificarDestino\(paginasElegidas\(e\)\|\|e\.paginas,e\.seleccion\)\.destino==='documentos'/);
 assert.match(source,/renderConfiguracionGlobal\(\);/);
 assert.match(source,/const lote=prepararLoteParcial\(entries\)/);
 assert.match(source,/const entries=\[\]/);
});
