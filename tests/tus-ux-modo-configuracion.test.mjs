import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');

test('carga móvil visible desde el inicio y modo individual predeterminado',()=>{
 const html=paginaCargaUnica();
 assert.match(html,/id="modoConfiguracion"/);
 assert.match(html,/name="modoImpresionLote" value="comun"/);
 assert.match(html,/name="modoImpresionLote" value="individual"/);
 assert.match(html,/id="zonaArchivos"/);
 assert.doesNotMatch(html,/id="zonaArchivos" hidden/);
 assert.match(html,/name="modoImpresionLote" value="individual" checked/);
 assert.match(html,/id="configComunGlobal" hidden/);
 assert.ok(html.indexOf('id="archivos"')<html.indexOf('id="modoConfiguracion"'));
});
test('shared options and file overrides stay scoped to their work',()=>{
 assert.match(source,/let modoLote='individual'/);
 assert.match(source,/const zona=\$\('zonaArchivos'\);if\(zona\)zona.hidden=false/);
 assert.ok(source.includes('window.SABER_TRABAJOS_PEDIDO'));
 assert.ok(source.includes('const configTrabajo=id=>'));
 assert.ok(source.includes("select.value=seleccion"));
 assert.ok(source.includes("if(modoLote==='comun')for(const e of entries)if(e.trabajoPedidoId===window.SABER_TRABAJO_ACTUAL)aplicarConfiguracionComunAlDocumento(e)"));
 assert.ok(source.includes('btn.onclick=()=>{e.seleccion=tam;aplicarConfiguracionComunAlDocumento(e);cambio()}'));
 assert.ok(source.includes("sel.value;aplicarConfiguracionComunAlDocumento(e);cambio()"));
 assert.ok(source.includes('await analizarArchivoPDF(e,file);aplicarConfiguracionComunAlDocumento(e)'));
 assert.ok(source.includes('function aplicarConfiguracionComunAlDocumento(e)'));
 assert.ok(source.includes("if(modoLote!=='comun'||!e?.paginas"));
 assert.ok(source.includes("if(!destino.confirmado||destino.destino!=='documentos')return"));
 assert.ok(source.includes('work.configuracion={...work.configuracion,[campo]:valor}'));
 assert.ok(source.includes("e.trabajoPedidoId===window.SABER_TRABAJO_ACTUAL"));
 assert.ok(source.includes("const barra=controlesComunes({id:'a4',indices},true)"));
 assert.ok(!source.includes('bloque.append(comunes)'));
 assert.match(source,/campo\.disabled=false/);
 assert.match(source,/if\(!modoLote\)\{\$\('estado'\)/);
 assert.doesNotMatch(source,/bloque.append\\(comunes\\)/);
 assert.match(source,/function renderConfiguracionGlobal\(/);
 assert.match(source,/clasificarDestino\(paginasElegidas\(e\)\|\|e\.paginas,e\.seleccion\)\.destino==='documentos'/);
 assert.match(source,/renderConfiguracionGlobal\(\);/);
 assert.match(source,/const lote=prepararLoteParcial\(cotizables\)/);
 assert.match(source,/const entries=\[\]/);
 assert.match(source,/trabajosPedido:sidecarTrabajosPedido\(\)/);
 assert.match(source,/grupoAnillado:anillados\.get\(key\)/);
});

test('shared mode suppresses repeated per-file print widgets except explicit overrides',()=>{
 assert.ok(source.includes("if(modoLote!=='comun'||pregunta)principal.append(filaTam)"));
 assert.ok(source.includes("if(modoLote!=='comun'||abierto===i)mostrarSelectorRapido(card,e,i)"));
 assert.ok(source.includes("modoLote==='comun'?'Personalizar este PDF':'Más opciones'"));
 assert.ok(source.includes("global?'Páginas por cara para estos documentos':'Páginas por cara para todos'"));
 assert.ok(source.includes("else if(campo==='paginasPorHoja')e.paginasPorHoja=valor"));
 assert.ok(source.includes("v=>aplicar('paginasPorHoja',Number(v))"));
});
