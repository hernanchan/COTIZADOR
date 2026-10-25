import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {montarAsistentePdf} from '../cotizador-v2-ensayo-archivos.mjs';

const page=readFileSync(new URL('../vidriera/cotizar.html',import.meta.url),'utf8');
const quote=readFileSync(new URL('../cotizador-web-v2.html',import.meta.url),'utf8');
function formulario(){
 let box=null,callback=null;
 const p={value:'1',isConnected:true,closest:()=>host};
 const calc={disabled:false,onclick:()=>{if(callback)callback()}};
 const host={parentNode:{insertBefore(n){box=n;n.isConnected=true}}};
 const app={isConnected:true,querySelector(s){
  if(s==='#pages')return p;
  if(s==='#calc')return calc;
  if(s==='#saberEnsayoPdf')return box;
  return null;
 }};
 const before=globalThis.document;
 globalThis.document={createElement(tag){
  return {tag,style:{},isConnected:false,children:[],
   appendChild(child){this.children.push(child)},
   append(...xs){this.children.push(...xs)},
   setAttribute(){}};
 }};
 return {app,p,calc,input:()=>box.children[2].children[0],
  onClick:fn=>{callback=fn},restore:()=>{globalThis.document=before}};
}
function referencia(i,name,pages){
 return {itemIndex:i,service:'impresiones',reference:{
  schema:'saber-pdf-local-pendiente-v1',
  localRef:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
  nombre:name,bytes:1234,paginas:pages,estado:'PENDIENTE_DE_ENVIO',
  recibido:false,verificadoServidor:false
 }};
}
function tienda(search){
 const script=page.split('<script>')[1]?.split('</script>')[0];
 assert.ok(script,'Código del carrito base presente');
 const values=new Map(),listeners={},loc={search,hostname:'example.test',href:'',pathname:'/cotizar.html'};
 const document={getElementById:()=>({textContent:'',hidden:true})};
 const ctx={
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
  window:{addEventListener:(event,handler)=>{listeners[event]=handler}},
  URLSearchParams,location:loc,document,Set,
  fetch:async()=>({ok:false})
 };
 runInNewContext(script,ctx);
 assert.equal(typeof listeners.message,'function');
 return {values,loc,send(payload,origin='https://hernanchan.github.io'){
  listeners.message({origin,data:{type:'SABER_ADD_PRINT',payload}});
 }};
}
test('dos archivos se asocian con referencias distintas; lectura local no cambia la cotización',async()=>{
 const ui=formulario();
 try{
  const quotes=[],files=['primero.pdf','segundo.pdf'];let n=0;
  const read=async file=>({nombre:file.name,paginas:n===0?3:6,
   bytes:1200,verificacion:'LOCAL_PRELIMINAR',subido:false,pagoAutorizado:false});
  assert.equal(montarAsistentePdf(ui.app,{
   leer:async file=>{const r=await read(file);n++;return r},
   antesDeCotizar:ref=>{if(ref)quotes.push(ref)}
  }),true);
  const input=ui.input();input.files=[{name:files[0]}];
  await input.onchange();ui.calc.onclick();
  assert.equal(quotes.length,1);
  assert.equal(quotes[0].nombre,files[0]);
  assert.equal(quotes[0].estado,'PENDIENTE_DE_ENVIO');
  assert.equal(quotes[0].recibido,false);
  assert.equal(quotes[0].verificadoServidor,false);
  input.files=[{name:files[1]}];
  await input.onchange();
  ui.calc.onclick();
  assert.equal(quotes.length,2);
  assert.equal(quotes[1].nombre,files[1]);
  assert.equal(quotes[1].paginas,6);
  assert.notEqual(quotes[0].localRef,quotes[1].localRef);
  assert.equal(ui.calc.disabled,false);
  ui.p.value='5';
  ui.calc.onclick();
  assert.equal(quotes.length,2,'Páginas alteradas manualmente no se asocian a otro PDF');
 }finally{ui.restore()}
});
test('carrito integrado guarda exactamente una referencia por trabajo y sin bytes',()=>{
 const t=tienda('?ensayoArchivos=1');
 const payload={id:'PRINT-333',type:'print',name:'Dos impresiones',
  price:18000,qty:1,detail:'3 páginas B/N | 6 páginas color',
  deposit:9000,pdfDrafts:[referencia(0,'primero.pdf',3),referencia(1,'segundo.pdf',6)]};
 t.send(payload);
 const items=JSON.parse(t.values.get('saberCartV1'));
 assert.equal(items.length,1);
 assert.equal(items[0].price,18000);
 assert.equal(items[0].deposit,9000);
 assert.equal(items[0].pdfDrafts.length,2);
 assert.deepEqual(items[0].pdfDrafts.map(x=>[x.itemIndex,x.reference.nombre]),
  [[0,'primero.pdf'],[1,'segundo.pdf']]);
 assert.equal(items[0].pdfDrafts[0].reference.recibido,false);
 assert.equal(items[0].pdfDrafts[0].reference.verificadoServidor,false);
 assert.equal(t.loc.href,'index.html?carrito=1');
 assert.doesNotMatch(JSON.stringify(items),/dataBase64|arrayBuffer|driveFileId|uploadToken/);
});
test('sin modo ensayo, el carrito anterior conserva el flujo comercial exacto',()=>{
 const t=tienda('');
 const payload={id:'PRINT-3',type:'print',name:'Impresión',
  price:1000,qty:1,detail:'Impresiones',deposit:500,
  pdfDrafts:[referencia(0,'a.pdf',2)]};
 t.send(payload);
 const [item]=JSON.parse(t.values.get('saberCartV1'));
 assert.equal(item.price,1000);
 assert.equal(item.deposit,500);
 assert.ok(!Object.hasOwn(item,'pdfDrafts'));
});
test('archivos ajenos o metadatos inyectados se descartan sin aceptar subida ni pago',()=>{
 const t=tienda('?ensayoArchivos=1');
 const injection={...referencia(0,'sensible.pdf',1),
  reference:{...referencia(0,'sensible.pdf',1).reference,
   driveFileId:'fake',recibido:true}};
 t.send({id:'PRINT-4',type:'print',name:'Impresión',
  price:900,qty:1,detail:'doc',deposit:450,pdfDrafts:[injection]});
 const [item]=JSON.parse(t.values.get('saberCartV1'));
 assert.deepEqual(item.pdfDrafts,[]);
 assert.equal(item.price,900);
 const before=JSON.stringify(JSON.parse(t.values.get('saberCartV1')));
 t.send({id:'PRINT-5',type:'print',name:'Otra',price:1100,
  qty:1,detail:'doc',deposit:550},'https://sitio-ajeno.test');
 assert.equal(t.values.get('saberCartV1'),before);
});
test('La vista del cotizador no serializa PDF; usa texto seguro al mostrar nombres',()=>{
 assert.match(quote,/archivoPdfEnsayo:archivoParaTrabajo/);
 assert.match(quote,/extra\.textContent='PDF: '/);
 assert.match(quote,/pdfDrafts=archivosEnsayoEnabled\?t\.items\.map/);
 assert.match(page,/event\.origin!=='https:\/\/hernanchan\.github\.io'/);
 assert.match(page,/pdfDrafts\.push\(\{itemIndex:d\.itemIndex/);
 assert.doesNotMatch(quote,/dataBase64|\\.arrayBuffer\(\)/);
});
