import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const jsPath = resolve(here,'../integraciones/interfaz-pc/interfaz-pc.js');
const cssPath = resolve(here,'../integraciones/interfaz-pc/interfaz-pc.css');
const js = readFileSync(jsPath,'utf8');
const css = readFileSync(cssPath,'utf8');

test('JS de PC tiene sintaxis valida para Node',()=>{
 const result=spawnSync(process.execPath,['--check',jsPath],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('PC se activa solo a partir de 900px y estilos fuera de movil',()=>{
 assert.match(js,/matchMedia\('\(min-width:900px\)'\)\.matches\)return/);
 assert.match(css,/@media\(min-width:900px\)/);
 assert.doesNotMatch(css,/@media\(max-width:899px\)/);
});
test('la interfaz reutiliza IDs y motor de cotizacion, sin codigo de pagos ni red',()=>{
 for(const id of ['zonaArchivos','configComunGlobal','presupuesto','prepararPedido','resumenPedido','lista']) assert.ok(js.includes(id),id);
 assert.doesNotMatch(js,/\bfetch\s*\(|MercadoPago|service_role|supabase\.co|r2_buckets/i);
});
test('todos iguales guarda juntos los archivos compatibles',()=>{
 assert.match(js,/function saveCommon\(/);
 assert.match(js,/const candidates=commonFiles\(\)/);
 assert.match(js,/for\(const c of candidates\)ready\.add\(all\.indexOf\(c\)\)/);
 assert.match(js,/batchButton\.onclick=saveCommon/);
 assert.match(js,/isCommonCompatible/);
 assert.match(js,/Documentos \(A3\|A4\|A5\|Legal\)/);
});
test('no aplica automaticamente impresiones comunes a ploteos o tamano pendiente',()=>{
 assert.match(js,/grupo-pedido/);
 assert.match(js,/\.pregunta-tamano/);
 assert.match(js,/fileValid\(c\)/);
 assert.match(js,/const quality=amp\.querySelector/);
});
test('valida color, caras y copias antes de guardar lote',()=>{
 assert.match(js,/commonControl\('Impresión para todos'\)/);
 assert.match(js,/commonControl\('Caras para todos'\)/);
 assert.match(js,/commonCopies\(\)/);
 assert.match(js,/Number\.isSafeInteger/);
 assert.match(js,/Number\(copias\.value\)>500/);
});
test('cambiar configuracion invalida guardado anterior y bloquea revision',()=>{
 assert.match(js,/ready\.delete\(i\)/);
 assert.match(js,/ready\.delete\(index\)/);
 assert.match(js,/next\.disabled=!\(/);
 assert.match(js,/by\('prepararPedido'\)\.disabled/);
});
test('guardado individual abre siguiente pendiente',()=>{
 assert.match(js,/save\.onclick=saveCurrent/);
 assert.match(js,/findIndex\(\(x,i\)=>i>selected&&!ready\.has\(i\)\)/);
});

test('PC incluye confirmacion de tamaño para todo el lote sin cambiar motor de cotizacion',()=>{
 assert.match(js,/function applySizeForBatch\(size\)/);
 assert.match(js,/const pendingSizes=/);
 assert.match(js,/\.pregunta-tamano button\.tamano-opcion/);
 for(const text of ['A4 para todos','A3 para todos','Mantener tamaño original'])assert.ok(js.includes(text),text);
 assert.match(js,/button\.click\(\)/);
});
test('detecta medida pendiente sin depender del botón de Ploteo seleccionado',()=>{
 assert.match(js,/const needsSize=c=>!!c\.querySelector\('\.pregunta-tamano'\)/);
 const needsSizeExpression=js.slice(js.indexOf('const needsSize='),js.indexOf('const pendingSizes='));
 assert.doesNotMatch(needsSizeExpression,/\.eleccion-plotter-boton\.seleccionada/);
});
test('avisos de tamaños se agrupan visualmente, sin quitar advertencias originales',()=>{
 assert.match(js,/function condenseSizeWarnings\(count\)/);
 assert.match(js,/pc-collapsed-warning/);
 assert.match(css,/pc-collapsed-warning/);
 assert.match(css,/overflow-x:hidden/);
});

test('la elección de tamaño se ve debajo de Todos iguales, no dentro del presupuesto',()=>{
 assert.match(js,/modeCard\.append\(sizeStep\)/);
 assert.match(js,/side\.append\(el\('h2','','Tu presupuesto'\),by\('presupuesto'\)\)/);
 assert.match(js,/sizeTitle\.textContent='3\. Elegí el tamaño de '/);
 assert.match(js,/filebox\.hidden=true/);
 assert.match(js,/batch\.hidden=true/);
 assert.match(js,/by\('configComunGlobal'\)\.hidden=true/);
 assert.match(js,/filebox\.hidden=false/);
 assert.match(css,/#pc-mode-card #pc-size-step/);
});
test('al cargar archivos guía automáticamente hacia el primer paso pendiente, solo en PC',()=>{
 assert.match(js,/function guideToSize\(key\)/);
 assert.match(js,/sizeStep\.scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
 assert.match(js,/guideToSize\(nextKeys\)/);
 assert.match(js,/lastAttentionKey=''/);
});
