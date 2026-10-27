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


const marker="bridgeButton.addEventListener('click',()=>{";
const begin=source.indexOf(marker);
const finish=source.indexOf("\n });\n}\n$('prepararPedido')",begin);
assert.ok(begin>=0&&finish>begin,'No se encontró el callback real del botón');
const clickHandler=new Function('leyendo','ultimoPresupuesto','entries','window','location','info',
 source.slice(begin+marker.length,finish));

function runPrivateHandoff(name='MUEBLES.pdf',size=2464154){
 const file=new File([new Uint8Array(size)],name,{type:'application/pdf'});
 const sent=[],info={textContent:''};
 const entry={
  archivoOriginal:file,name:file.name,anillado:'ninguno',paginasPorHoja:1,
  paginas:Array.from({length:8},(_,i)=>i+1),modo:'bn',caras:'simple',copias:1
 };
 const quote={estado:'PRELIMINAR',total:800,
  plan:[{indice:0,destino:'documentos',formatoFinal:'a4',
   paginasElegidas:Array.from({length:8},(_,i)=>i+1)}]};
 const window={parent:{postMessage:(payload,origin)=>sent.push({payload,origin})}};
 clickHandler(false,quote,[entry],window,{origin:'https://example.test'},info);
 return {sent,info,file};
}

test('el callback real agrega MUEBLES.pdf de ocho paginas a la cola privada, sin enviarlo a Drive',()=>{
 const {sent,info,file}=runPrivateHandoff();
 assert.equal(sent.length,1,info.textContent);
 assert.equal(sent[0].payload.type,'SABER_SMART_DOCUMENTS_TO_PRIVATE');
 assert.equal(sent[0].payload.files[0],file);
 assert.equal(sent[0].payload.total,800);
 assert.deepEqual(sent[0].payload.options.map(o=>({
  formato:o.formato,modo:o.modo,caras:o.caras,copias:o.copias,paginas:o.paginas,
  nombre:o.nombre
 })),[{formato:'a4',modo:'bn',caras:'simple',copias:1,paginas:8,nombre:'MUEBLES.pdf'}]);
 assert.match(info.textContent,/enviados a la cola/);
});

test('el callback real rechaza nombres no PDF y archivos superiores a 20 MB',()=>{
 for(const [name,size] of [['MUEBLES.txt',2464154],['MUEBLES.pdf',20*1024*1024+1]]){
  const {sent,info}=runPrivateHandoff(name,size);
  assert.equal(sent.length,0);
  assert.match(info.textContent,/20 MB/);
 }
});
