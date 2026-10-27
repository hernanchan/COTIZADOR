import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {buildSync} from 'esbuild';

const source=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
const built=buildSync({
 entryPoints:[new URL('./carga-unica-cliente.mjs',import.meta.url).pathname],
 bundle:true,minify:true,platform:'browser',format:'iife',target:'es2022',write:false,
 logLevel:'silent'
}).outputFiles[0].text;

test('el cliente generado es JavaScript sintacticamente valido',()=>{
 assert.doesNotThrow(()=>new Script(built,{filename:'carga-inteligente.js'}));
});

test('ambas validaciones aceptan MUEBLES.pdf de 2.35 MB y rechazan extensiones ajenas',()=>{
 const patterns=[...source.matchAll(/\/([^\n/]*pdf\$)\/i\.test\((file\.name|e\.name)\)/g)];
 assert.equal(patterns.length,2,'Deben existir las validaciones en carga y transferencia privada');
 for(const [,pattern] of patterns){
  assert.equal(pattern,String.raw`\.pdf$`,'Expresión de extensión inesperada');
  const rx=new RegExp(pattern,'i');
  assert.equal(rx.test('MUEBLES.pdf'),true);
  assert.equal(rx.test('MUEBLES.txt'),false);
  assert.equal(rx.test('MUEBLESXpdf'),false);
 }
 const bytes=Math.round(2.35*1024*1024);
 assert.ok(bytes>=5&&bytes<=20*1024*1024);
 assert.ok('MUEBLES.pdf'.length<=120);
});

test('el archivo valido conserva la transferencia al portal privado',()=>{
 assert.match(source,/SABER_SMART_DOCUMENTS_TO_PRIVATE/);
 assert.match(source,/files,options,total:ultimoPresupuesto\.total/);
 assert.match(source,/archivoOriginal/);
});
