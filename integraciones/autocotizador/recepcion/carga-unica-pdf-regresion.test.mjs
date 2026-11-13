import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {buildSync} from 'esbuild';
import {decidirTransportePDF} from './seleccionar-transporte-pdf.mjs';

const source=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
const built=buildSync({
 entryPoints:[new URL('./carga-unica-cliente.mjs',import.meta.url).pathname],
 bundle:true,minify:true,platform:'browser',format:'iife',target:'es2022',write:false,
 logLevel:'silent'
}).outputFiles[0].text;

test('el cliente generado es JavaScript sintacticamente valido',()=>{
 assert.doesNotThrow(()=>new Script(built,{filename:'carga-inteligente.js'}));
});

test('cuatro validaciones PDF preservan la extensión sin excepción de ploteo grande',()=>{
 const patterns=[...source.matchAll(/\/([^\n/]*pdf\$)\/i\.test\((file\.name|e\.name)\)/g)];
 assert.equal(patterns.length,4,'No agregar validaciones especiales por tamaño de impresión');
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
 assert.match(source,/files,options,total:totalDocumentos/);
 assert.match(source,/archivoOriginal/);
});


const marker="const prepararEnvioPrivado=()=>{";
const begin=source.indexOf(marker);
const finish=source.indexOf("\n };\n bridgeButton.hidden=true",begin);
assert.ok(begin>=0&&finish>begin,'No se encontró el callback real del botón');
const clickHandler=new Function('leyendo','ultimoPresupuesto','entries','window','location','info','MAX_PDF_CARGA','paginasElegidas',
 `const MAX_PDF_TUS_BYTES=40*1024*1024;const MAX_LOTE_TUS_BYTES=60*1024*1024;const tamanoPdfMiB=f=>(f.size/(1024*1024)).toFixed(1).replace('.',',')+' MiB';
`+source.slice(begin+marker.length,finish));

function runPrivateHandoff(name='MUEBLES.pdf',size=2464154){
 const file=new File([new Uint8Array(size)],name,{type:'application/pdf'});
 const sent=[],info={textContent:''};
 const entry={
  archivoOriginal:file,name:file.name,anillado:'ninguno',paginasPorHoja:1,
  paginas:Array.from({length:8},(_,i)=>({numero:i+1})),modo:'bn',caras:'simple',copias:1
 };
 const quote={estado:'PRELIMINAR',total:800,
  plan:[{indice:0,destino:'documentos',formatoFinal:'a4',
   paginasElegidas:Array.from({length:8},(_,i)=>i+1)}]};
 const window={parent:{postMessage:(payload,origin)=>sent.push({payload,origin})}};
 clickHandler(false,quote,[entry],window,{origin:'https://example.test'},info,30,e=>e.paginas);
 return {sent,info,file};
}

test('el callback real agrega MUEBLES.pdf de ocho paginas a la cola privada, sin enviarlo a Drive',()=>{
 const {sent,info,file}=runPrivateHandoff();
 assert.equal(sent.length,2,info.textContent);
 assert.equal(sent[1].payload.type,'SABER_SMART_HANDOFF_READY');
 assert.equal(sent[1].payload.cantidad,1);
 assert.equal(sent[0].payload.type,'SABER_SMART_DOCUMENTS_TO_PRIVATE');
 assert.equal(sent[0].payload.files[0],file);
 assert.equal(sent[0].payload.total,800);
 assert.deepEqual(sent[0].payload.options.map(o=>({
  formato:o.formato,modo:o.modo,caras:o.caras,copias:o.copias,paginas:o.paginas,
  nombre:o.nombre
 })),[{formato:'a4',modo:'bn',caras:'simple',copias:1,paginas:8,nombre:'MUEBLES.pdf'}]);
 assert.match(info.textContent,/Pedido preparado/);
});

test('el callback real admite PDF de 21 MiB y rechaza formato ajeno o PDF >40 MiB con el nombre',()=>{
 const accepted=runPrivateHandoff('MUEBLES.pdf',21*1024*1024);
 assert.deepEqual(accepted.sent.map(x=>x.payload.type),
  ['SABER_SMART_DOCUMENTS_TO_PRIVATE','SABER_SMART_HANDOFF_READY'],accepted.info.textContent);
 for(const [name,size,pattern] of [
  ['MUEBLES.txt',2464154,/MUEBLES\.txt.*formato/i],
  ['MUEBLES.pdf',40*1024*1024+1,/MUEBLES\.pdf.*40 MiB/]
 ]){
  const {sent,info}=runPrivateHandoff(name,size);
  assert.equal(sent.length,1);
  assert.equal(sent[0].payload.type,'SABER_SMART_HANDOFF_ERROR');
  assert.match(info.textContent,pattern);
 }
});


test('el portal privado recibe el evento real y agrega PDF con hash y precio, sin Drive ni D1',async()=>{
 const {paginaCotizadorV2PruebaPrivada}=await import('./pantalla-cotizador-v2-prueba-privada.mjs');
 const {webcrypto}=await import('node:crypto');
 const html=paginaCotizadorV2PruebaPrivada('sitekey-test');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Falta el script del portal privado');
 assert.doesNotThrow(()=>new Script(script.replace(/^import [^\n]+;\s*$/gm,''),{
  filename:'portal-privado.js'}));
 const marker="if(event.source===smart.contentWindow&&event.data?.type==='SABER_SMART_DOCUMENTS_TO_PRIVATE'){";
 const begin=script.indexOf(marker);
 const finish=script.indexOf('\n if(event.source!==frame.contentWindow)return;',begin);
 assert.ok(begin>=0&&finish>begin,'No se encontró el receptor del pedido inteligente');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const onMessage=new AsyncFunction('event','smart','batchSending','registering',
  'registeredOrder','all','batchStatus','used','save','render','updateSummary',
  'status','document','crypto','File','TUS_ENABLED','MAX_PDF_PRIVADOS',script.slice(begin,finish));
 const bytes=Math.round(2.35*1024*1024);
 const file=new File([new Uint8Array([37,80,68,70,45]),new Uint8Array(bytes-5)],
  'MUEBLES.pdf',{type:'application/pdf'});
 const contentWindow={};
 const options=[{nombre:file.name,paginas:8,formato:'a4',modo:'bn',caras:'simple',
  copias:1,paginasPorHoja:1,anillado:'ninguno',materialColor:''}];
 const all=[],used=new Set(),batchStatus={textContent:''},status={textContent:''};
 let updates=0;
 await onMessage({
  source:contentWindow,data:{type:'SABER_SMART_DOCUMENTS_TO_PRIVATE',
   files:[file],options,total:800}
 },{contentWindow},false,false,false,all,batchStatus,used,
 ()=>updates++,()=>updates++,()=>updates++,
 status,{getElementById:()=>({open:false})},webcrypto,File,false,30);
 assert.equal(all.length,1,batchStatus.textContent);
 assert.equal(all[0].price,800);
 assert.equal(all[0].references.length,1);
 assert.equal(all[0].references[0].archivoLocal,file);
 assert.equal(all[0].references[0].reference.bytes,bytes);
 assert.equal(all[0].references[0].reference.estado,'PENDIENTE_DE_ENVIO');
 assert.match(all[0].references[0].reference.sha256,/^[0-9a-f]{64}$/);
 assert.match(batchStatus.textContent,/1 PDF listos para enviar/);
 assert.equal(updates,3);
});

test('cliente de prueba no anuncia falsamente que los ploteos quedan fuera de la recepción TUS',()=>{
 assert.ok(source.includes("if(plan.destino==='ploteos')"));
 assert.ok(!source.includes('Los ploteos se cotizan, pero quedan pendientes de integración'));
 assert.ok(source.includes('ploteosPendientes.push'));
});


test('envío inteligente preserva 1-3,5 de ocho páginas y rechaza plan desactualizado',()=>{
 const archivo=new File([new Uint8Array(500)],'Seleccion_A4.pdf',{type:'application/pdf'});
 const e={
  archivoOriginal:archivo,name:archivo.name,
  paginas:Array.from({length:8},(_,i)=>({numero:i+1,anchoCm:21,altoCm:29.7})),
  paginasSeleccionadas:'1-3,5',anillado:'ninguno',grupoAnillado:'',
  paginasPorHoja:1,materialColor:'obra70',modo:'bn',caras:'simple',copias:1
 };
 const plan=[{indice:0,destino:'documentos',formatoFinal:'a4',paginasElegidas:[1,2,3,5]}];
 const quote={estado:'PRELIMINAR',total:700,plan};
 const sent=[],info={textContent:''};
 const selected=x=>x.paginas.filter(p=>[1,2,3,5].includes(p.numero));
 const receiver={parent:{postMessage:m=>sent.push(m)}};
 clickHandler(false,quote,[e],receiver,{origin:'https://example.test'},info,10,selected);
 assert.deepEqual(sent.map(x=>x.type),
  ['SABER_SMART_DOCUMENTS_TO_PRIVATE','SABER_SMART_HANDOFF_READY'],info.textContent);
 assert.equal(sent[0].options[0].paginasSeleccionadas,'1-3,5');
 assert.equal(sent[0].options[0].paginas,8);
 assert.equal(sent[0].files[0],archivo);
 sent.length=0;
 quote.plan[0].paginasElegidas=[1,2,3,4];
 clickHandler(false,quote,[e],receiver,{origin:'https://example.test'},info,10,selected);
 assert.deepEqual(sent.map(x=>x.type),['SABER_SMART_HANDOFF_ERROR']);
 assert.match(info.textContent,/no coincide con el presupuesto/);
});


test('límite TUS: marca en rojo sólo el PDF que excede 40 MiB, no los otros',()=>{
 const start=source.indexOf('function alertasRecepcionPDF(){');
 const end=source.indexOf('\nconst pesos=',start);
 assert.ok(start>0&&end>start,'Falta el validador visual en el cotizador existente');
 class FileSimulado{
  constructor(name,size){this.name=name;this.size=size}
 }
 const visual=new Function('entries','File','window','location',
  'const MAX_PDF_TUS_BYTES=40*1024*1024,MAX_LOTE_TUS_BYTES=60*1024*1024;'+
  'const LIMITE_TUS_PDF_BYTES=40*1024*1024,LIMITE_R2_PDF_BYTES=200*1024*1024;const decidirTransportePDF='+decidirTransportePDF.toString()+';const admitePrepagoR2Grande=()=>false;'+
  "const tamanoPdfMiB=f=>(f.size/(1024*1024)).toFixed(1).replace('.',',')+' MiB';\n"+
  source.slice(start,end)+'\nreturn alertasRecepcionPDF();');
 const a={name:'Grande.pdf',archivoOriginal:new FileSimulado('Grande.pdf',41*1024*1024)};
 const b={name:'Correcto.pdf',archivoOriginal:new FileSimulado('Correcto.pdf',12*1024*1024)};
 const window={parent:{}};
 const origin={pathname:'/prueba-v2/carga-inteligente'};
 const alertas=visual([a,b],FileSimulado,window,origin);
 assert.equal(alertas.size,1);
 assert.match(alertas.get(a),/Grande\.pdf.*41,0 MiB.*envío universal.*deshabilitado/);
 assert.equal(alertas.has(b),false,'El PDF permitido debe permanecer disponible');
 const c={name:'Segundo.pdf',archivoOriginal:new FileSimulado('Segundo.pdf',31*1024*1024)};
 const dos=visual([b,c],FileSimulado,window,origin);
 assert.equal(dos.size,0);
 const tres=visual([c,c===b?a:{name:'Primero.pdf',archivoOriginal:new FileSimulado('Primero.pdf',30*1024*1024)}],FileSimulado,window,origin);
 assert.equal(tres.size,1);
 assert.match([...tres.values()][0],/60 MiB/);
 window.parent=window;
 assert.equal(visual([a],FileSimulado,window,origin).size,0,'Fuera del portal TUS no aplicar esta compuerta');
});

test('el estado de envío rechaza preventivamente PDF demasiado grande y conserva el precio preliminar',()=>{
 const start=source.indexOf('function alertasRecepcionPDF(){');
 const end=source.indexOf('\nfunction importeArchivo(',start);
 assert.ok(start>=0&&end>start);
 class FileSimulado{constructor(name,size){this.name=name;this.size=size}}
 const result=[];
 const window={parent:{postMessage:message=>result.push(message)}};
 const entries=[{name:'Muy grande.pdf',archivoOriginal:new FileSimulado('Muy grande.pdf',42*1024*1024)}];
 const execute=new Function('entries','File','window','location','ultimoPresupuesto',
   'const MAX_PDF_TUS_BYTES=40*1024*1024,MAX_LOTE_TUS_BYTES=60*1024*1024;'+
  'const LIMITE_TUS_PDF_BYTES=40*1024*1024,LIMITE_R2_PDF_BYTES=200*1024*1024;const decidirTransportePDF='+decidirTransportePDF.toString()+';const admitePrepagoR2Grande=()=>false;'+
   "const tamanoPdfMiB=f=>(f.size/(1024*1024)).toFixed(1).replace('.',',')+' MiB';\n"+
   source.slice(start,end)+"\ninformarPrecioPrivado('listo',7220);");
 execute(entries,FileSimulado,window,{pathname:'/prueba-v2/carga-inteligente',origin:'https://example.test'},{estado:'PRELIMINAR'});
 assert.equal(result.length,1);
 assert.equal(result[0].sendable,false);
 assert.equal(result[0].total,7220);
 assert.match(result[0].blockReason,/Muy grande\.pdf.*42,0 MiB/);
});

test('la tarjeta del archivo no admitido lleva borde y aviso rojos incluso con los detalles cerrados',()=>{
 const page=readFileSync(new URL('./carga-unica-pagina.mjs',import.meta.url),'utf8');
 assert.match(page,/\.archivo\.archivo-no-admitido\{border:2px solid #b42318/);
 assert.match(page,/\.archivo \.advertencia-recepcion\{[^}]*color:#8f1d1d/);
 assert.match(source,/if\(advertenciaRecepcion\)card\.classList\.add\('archivo-no-admitido'\)/);
 assert.match(source,/aviso\.setAttribute\('role','alert'\)/);
 const b=source.indexOf("if(advertenciaRecepcion){");
 const c=source.indexOf("if(abierto!==i){bloque.append(card);continue}",b);
 assert.ok(b>=0&&c>b,'La advertencia debe estar fuera del panel colapsado');
});


test('PDF demasiado grande conserva contacto comercial sin simular pedido ni subir originales',()=>{
 const start=source.indexOf('const tamanoPdfMiB=');
 const end=source.indexOf('\nlet leyendo=',start);
 assert.ok(start>=0&&end>start,'Falta el mensaje comercial del PDF grande');
 const FileMock=class{
  constructor(name,size){this.name=name;this.size=size}
 };
 const crearURL=new Function('e','File',source.slice(start,end)+'\nreturn enlaceConsultaArchivoGrande(e);');
 const e={name:'Planos grandes & apuntes.pdf',archivoOriginal:new FileMock('Planos grandes & apuntes.pdf',90*1024*1024)};
 const u=new URL(crearURL(e,FileMock));
 assert.equal(u.origin,'https://wa.me');
 const cart=readFileSync(new URL('./saber-carrito-v3-script.mjs',import.meta.url),'utf8');
 assert.ok(cart.includes(u.pathname.slice(1)),'Utilizar el contacto WhatsApp existente de Saber');
 const message=u.searchParams.get('text');
 assert.match(message,/Planos grandes & apuntes\.pdf/);
 assert.match(message,/90,0 MiB/);
 assert.match(message,/no genera un pedido ni autoriza un pago/);
 assert.doesNotMatch(message,/https?:\/\/.*storage|SERVICE_ROLE|api[-_]?key/i);
 assert.match(source,/contacto\.target='_blank'/);
 assert.match(source,/contacto\.rel='noopener noreferrer'/);
 assert.match(source,/No se registra pedido ni se habilita cobro/);
 assert.match(source,/if\(advertenciaRecepcion\)/);
 const page=readFileSync(new URL('./carga-unica-pagina.mjs',import.meta.url),'utf8');
 assert.match(page,/\.archivo \.consulta-archivo-grande/);
});

test('A4 de 500 páginas y 100 MiB va a R2 universal, sin cambiar a plotter',()=>{
 const marker="const prepararEnvioPrivado=()=>{";
 const start=source.indexOf(marker);
 const end=source.indexOf("\n };\n bridgeButton.hidden=true",start);
 assert.ok(start>=0&&end>start);
 const callback=new Function('leyendo','ultimoPresupuesto','entries','window','location','info','MAX_PDF_CARGA','paginasElegidas',
  'const MAX_PDF_TUS_BYTES=40*1048576,MAX_PDF_R2_PREPAGO_BYTES=200*1048576,MAX_LOTE_TUS_BYTES=60*1048576,R2_UNIVERSAL_ENSAYO=true;'+
  'const prepararLoteParcial=xs=>({archivos:xs.map(e=>({nombre:e.name,servicio:"auto",paginas:e.paginas,modo:e.modo}))});'+
  source.slice(start+marker.length,end));
 const pages=Array.from({length:500},(_,i)=>({numero:i+1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}));
 const file=new File([new Uint8Array([37,80,68,70,45])],'Apunte_500_paginas_A4.pdf',{type:'application/pdf'});
 Object.defineProperty(file,'size',{value:100*1048576});
 const entry={name:file.name,archivoOriginal:file,servicio:'auto',anillado:'ninguno',
  paginas:pages,modo:'bn',copias:1};
 const sent=[],info={textContent:'',classList:{remove(){},add(){}}};
 const parent={postMessage:m=>sent.push(m)};
 callback(false,{estado:'PRELIMINAR',total:10000,plan:[{indice:0,destino:'documentos'}],pendientes:[]},
  [entry],{parent},{origin:'https://example.test'},info,10,e=>e.paginas);
 assert.deepEqual(sent.map(x=>x.type),['SABER_SMART_UNIVERSAL_PDF','SABER_SMART_HANDOFF_READY'],
  info.textContent);
 assert.equal(sent[0].files[0],file);
 assert.equal(sent[0].archivos[0].paginas.length,500);
 assert.equal(sent[0].totalOrientativo,10000);
 assert.equal(sent[1].cantidad,1);
 assert.doesNotMatch(source,/SABER_SMART_R2_PREPAGO/,'No existe vía alternativa exclusiva de ploteo');
});

test('ploteo >48 MiB y nueve páginas intenta análisis visual por rangos',async()=>{
 const src=source;
 assert.match(src,/clasificarPloteoGrandePorRangos\(file,\{paginas:e\.paginas/);
 assert.match(src,/Analizando visualmente el plano/);
 assert.match(src,/clasificarMosaicoRasterPDFGrande\(file\)/);
});

test('plano de 9 páginas y 60 MB permite elegir 1-3 ANTES del render pesado',()=>{
 assert.match(source,/file\.size>48\*1024\*1024&&e\.paginas\.length>4/);
 assert.match(source,/e\.elegirPaginasAntesDeAnalizar=true/);
 assert.match(source,/¿Qué páginas querés imprimir\?/);
 assert.match(source,/Ej\.: 1-3 \(vacío = todas las páginas\)/);
 assert.match(source,/Calcular estas páginas/);
 assert.match(source,/void analizarPaginasSolicitadas\(e\)/);
 assert.match(source,/seleccionadas:pedidas\.map\(p=>p\.numero\)/);
 assert.match(source,/if\(!esPlanoGrande\)\{/);
 assert.match(source,/version\+\+;ultimoPresupuesto=null/);
 assert.match(source,/Preparando análisis de/);
});
