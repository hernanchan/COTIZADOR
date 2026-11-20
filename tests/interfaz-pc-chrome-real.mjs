/**
 * Prueba con Chromium REAL de PC V8. Solo lectura de Cloudflare:
 * recupera las fuentes del Worker original versionado, inyecta la UI de la rama,
 * y monta el Worker en memoria usando una contraseña ficticia.
 * Nunca publica, escribe o accede al entorno comercial.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const ACCOUNT=process.env.SABER_CF_ACCOUNT_ID;
const TOKEN=process.env.SABER_CF_DEPLOY_TOKEN;
if(!ACCOUNT||!TOKEN)throw Error('Se necesitan secretos de solo lectura del entorno de pruebas');
const WORKER='saber-ampliaciones-ensayo-20261120';
const BASE='https://'+WORKER+'.libreriasaber.workers.dev';
const SOURCE_VERSION='7e380acc-9a44-4703-bd57-9db6333b0cf8';
const assert=(v,msg)=>{if(!v)throw Error(msg)};
const ui=fs.readFileSync('integraciones/interfaz-pc/interfaz-pc.js','utf8');
const css=fs.readFileSync('integraciones/interfaz-pc/interfaz-pc.css','utf8');
const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(ACCOUNT)+'/workers/workers/'+WORKER+'/versions/'+SOURCE_VERSION+'?include=modules,sourcemaps';
const res=await fetch(url,{headers:{Authorization:'Bearer '+TOKEN}});
assert(res.ok,'No se pudo consultar la fuente original del ensayo: HTTP '+res.status);
const value=await res.json();assert(value.success===true,'Cloudflare no devolvió versión válida');
const maps=(value.result.modules||[]).map(m=>{try{return JSON.parse(Buffer.from(m.content_base64,'base64').toString('utf8'))}catch{return null}}).filter(m=>m?.version===3&&Array.isArray(m.sourcesContent));
assert(maps.length===1,'No se identificó un único mapa de fuentes');
const contents=new Map();
for(let i=0;i<maps[0].sources.length;i++){
 const name=String(maps[0].sources[i]).replaceAll('\\','/').split('/').pop();
 if(['ensayo-safe.mjs','index.mjs','consulta-seguimiento-cliente.mjs'].includes(name)){
  assert(!contents.has(name),'Fuente duplicada '+name);
  contents.set(name,maps[0].sourcesContent[i]);
 }
}
for(const name of ['ensayo-safe.mjs','index.mjs','consulta-seguimiento-cliente.mjs'])assert(typeof contents.get(name)==='string','Falta fuente original '+name);
function replaceConstant(source,name,text){
 const prefix='const '+name+' = ';
 const start=source.indexOf(prefix),second=source.indexOf(prefix,start+prefix.length);
 assert(start>=0&&second<0,'Constante no única '+name);
 let i=start+prefix.length;assert(source[i]==='"','Esperaba literal serializado para '+name);
 let j=i+1;for(;j<source.length;j++){if(source[j]==='\\'){j++;continue}if(source[j]==='"')break}
 assert(j<source.length,'Literal sin cerrar '+name);
 const k=source.indexOf(';',j+1);assert(k>j&&/^\s*$/.test(source.slice(j+1,k)),'Fin no seguro '+name);
 return source.slice(0,start)+prefix+JSON.stringify(text)+';'+source.slice(k+1);
}
let wrapper=contents.get('ensayo-safe.mjs');
wrapper=replaceConstant(wrapper,'PC_CSS',css);
wrapper=replaceConstant(wrapper,'PC_JS',ui);
assert(wrapper.includes('modeCard.append(sizeStep)'),'La V8 no coloca el selector bajo Todos iguales');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'saber-chrome-v8-'));
fs.mkdirSync(path.join(folder,'src'));
for(const [name,source] of contents)fs.writeFileSync(path.join(folder,'src',name),name==='ensayo-safe.mjs'?wrapper:source);
const compiled=path.join(folder,'bundle.mjs');
const build=spawnSync('npx',['--yes','esbuild@0.25.12',path.join(folder,'src','ensayo-safe.mjs'),'--bundle','--platform=browser','--format=esm','--target=es2022','--outfile='+compiled],{encoding:'utf8',maxBuffer:2*1024*1024});
assert(build.status===0,'No compiló Worker de ensayo: '+build.stderr.slice(0,500));
const trial=(await import(pathToFileURL(compiled).href)).default;
assert(typeof trial.fetch==='function','Worker compilado sin fetch');
const TEST_PASS='1234567890-ensayo-automatico-solamente';
const auth='Basic '+Buffer.from('operador:'+TEST_PASS).toString('base64');
const env={ENSAYO_PASSWORD:TEST_PASS};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
const page=await context.newPage();
const messages=[];
page.on('pageerror',e=>messages.push('JS ERROR: '+e.message.slice(0,200)));
page.on('console',e=>{if(e.type()==='error')messages.push('CONSOLE ERROR: '+e.text().slice(0,200))});
page.on('requestfailed',r=>messages.push('REQUEST FAILED: '+r.url().slice(0,120)));
await page.route('**/*',async route=>{
 const request=route.request(),address=request.url();
 if(!address.startsWith(BASE+'/'))return route.continue();
 try{
  const headers={...request.headers(),authorization:auth};
  delete headers.host;
  const response=await trial.fetch(new Request(address,{method:request.method(),headers}),env,{waitUntil(){}});
  const buffer=Buffer.from(await response.arrayBuffer());
  await route.fulfill({status:response.status,body:buffer,headers:{'content-type':response.headers.get('content-type')||'text/plain;charset=UTF-8'}});
 }catch(e){
  messages.push('INTERCEPT ERROR: '+e.message);
  await route.fulfill({status:500,body:'Ensayo local falló'});
 }
});
try{
 const navigation=await page.goto(BASE+'/interfaz-pc',{waitUntil:'domcontentloaded',timeout:60000});
 assert(navigation.status()===200,'Pantalla de ensayo sin HTTP 200: '+navigation.status());
 const fileInputs=await page.locator('input[type=file]').count();
 console.log('PANTALLA_PC_CARGADA: campos de archivos='+fileInputs);
 assert(fileInputs>=1,'No hay campo de carga de archivos');
 const input=page.locator('#zonaArchivos input[type=file]').first();
 assert(await input.count()===1,'No se localizó el selector de PDF/JPG/PNG');
 const buffers=[];
 for(let i=0;i<5;i++){
  const doc=await PDFDocument.create();
  const pg=doc.addPage([473.67,841.89]);
  const font=await doc.embedFont(StandardFonts.Helvetica);
  pg.drawText('Prueba privada Saber imagen '+(i+1),{x:35,y:780,font,size:18});
  buffers.push({name:'ensayo_imagen_'+(i+1)+'.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
 }
 await input.setInputFiles(buffers);
 await page.waitForFunction(()=>document.querySelectorAll('#lista section.archivo').length>=5,{timeout:60000});
 console.log('CARGA_REAL: '+await page.locator('#lista section.archivo').count()+' PDF procesados');
 const all=page.locator('input[name=modoImpresionLote][value=comun]');
 if(!(await all.isChecked()))await all.check();
 await page.waitForFunction(()=>{const x=document.querySelector('#pc-size-step');return x&&!x.hidden&&x.parentElement?.id==='pc-mode-card'}, {timeout:30000});
 await page.waitForTimeout(600);
 const step=page.locator('#pc-size-step');
 console.log('SELECTOR: visible='+await step.isVisible()+' contenedor='+await step.evaluate(n=>n.parentElement.id));
 assert(await step.isVisible(),'La elección conjunta de tamaño no es visible');
 assert(await page.locator('#pc-sidebar #pc-size-step').count()===0,'El tamaño sigue oculto en presupuesto');
 const before=await step.boundingBox();
 const left=await page.locator('#pc-mode-card').boundingBox();
 assert(before&&left&&before.x>=left.x&&before.x<left.x+left.width,'Selector fuera de la columna izquierda');
 console.log('SELECTOR_PC: dentro de Todos iguales, columna izquierda');
 await page.locator('#pc-size-buttons [data-target-size=a4]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#lista .pregunta-tamano').length===0,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#pc-batch-apply')?.textContent?.includes('Guardar 5'),{timeout:30000});
 const controls=page.locator('#configComunGlobal .opciones-comunes');
 assert(await controls.isVisible(),'No aparecen las opciones comunes de color/caras/copias');
 console.log('TAMAÑO_ÚNICO: cinco PDF ahora son impresiones comunes');
 const selects=page.locator('#configComunGlobal select');
 console.log('SELECTS COMUNES:',JSON.stringify(await selects.evaluateAll(nodes=>nodes.map(n=>({aria:n.getAttribute('aria-label'),options:Array.from(n.options).map(o=>[o.value,o.textContent])})))));
 const count=await selects.count();
 if(count>=2){
  for(let i=0;i<2;i++){
   const options=await selects.nth(i).locator('option').evaluateAll(nodes=>nodes.map(o=>o.value).filter(Boolean));
   if(options.length)await selects.nth(i).selectOption(options[0]);
  }
 }
 const copies=page.locator('#configComunGlobal input[aria-label="Aplicar copias a todo el grupo"]');
 if(await copies.count())await copies.fill('1');
 await page.locator('#pc-batch-apply').click();
 await page.waitForFunction(()=>document.querySelector('#pc-progress')?.textContent?.includes('5 de 5'),{timeout:10000});
 console.log('LOTE COMPLETO: '+await page.locator('#pc-progress').textContent());
 await page.waitForTimeout(4000);
 console.log('BOTÓN SIGUIENTE: '+(await page.locator('#pc-next').isEnabled()?'habilitado':'no habilitado'));
 console.log('BOTÓN PREPARAR: '+(await page.locator('#prepararPedido').isEnabled()?'habilitado':'no habilitado'));
 console.log('CAMPOS SELECCIONADOS: '+JSON.stringify(await page.locator('#configComunGlobal select').evaluateAll(nodes=>nodes.map(n=>({aria:n.getAttribute('aria-label'),value:n.value})))));
 console.log('ESTADO GENERAL: '+(await page.locator('#estado').innerText()).slice(0,500).replace(/\s+/g,' '));
 console.log('ARCHIVOS DETALLE: '+JSON.stringify(await page.locator('#lista section.archivo').evaluateAll(nodes=>nodes.map(n=>n.innerText.slice(0,150)))));
 const sideText=await page.locator('#presupuesto').innerText();
 console.log('PRESUPUESTO: '+sideText.slice(0,500).replace(/\s+/g,' '));
 assert(await page.locator('#pc-next').isEnabled(),'REGRESIÓN: cinco PDF figuran listos pero el presupuesto permanece pendiente; no se puede revisar el pedido');
 assert(!messages.some(x=>x.startsWith('JS ERROR')),'Errores de Javascript en Chrome: '+messages.join(' | '));
 console.log('PRUEBA_CHROME_REAL_APROBADA: 5 PDF -> único tamaño A4 -> opciones compartidas -> 5/5 guardados');
}catch(e){
 console.error('PRUEBA_CHROME_REAL_FALLÓ: '+e.message);
 console.error('DIAGNÓSTICO '+JSON.stringify(messages.slice(0,10)));
 console.error('DOM '+JSON.stringify(await page.evaluate(()=>({
  title:document.title,
  cards:document.querySelectorAll('#lista section.archivo').length,
  sizeStep:document.querySelector('#pc-size-step')?.outerHTML.slice(0,200),
  common:document.querySelector('#configComunGlobal')?.outerHTML.slice(0,300),
  body:document.body.innerText.slice(0,700)
 })).catch(()=>({unavailable:true}))));
 throw e;
}finally{await browser.close();}
