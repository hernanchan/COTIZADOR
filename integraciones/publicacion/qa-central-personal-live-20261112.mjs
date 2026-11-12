import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {paginaCentralPersonalLive} from '../autocotizador/recepcion/pagina-central-personal-live.mjs';
const WEB='WEB-ENSAYO-'+'A'.repeat(32);
const UUID='123e4567-e89b-42d3-a456-426614174000';
let state='pendiente',version=0,updated=0;
const url='/personal/central';
const server=createServer(async(req,res)=>{
 if(req.url===url){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(paginaCentralPersonalLive());return;
 }
 if(req.url==='/personal/api/live-board'){
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({ok:true,orders:[
   {orderId:UUID,webOrderId:WEB,numeroOrden:'026',amountArs:5300,fileCount:2,
    receivedCount:2,pendingCount:0,tusCount:1,r2Count:1,
    nombreCliente:'Cliente Ensayo',telefonoContacto:'3510000000',direccionCliente:null,
    productionState:state,productionVersion:version},
   {orderId:'123e4567-e89b-42d3-a456-426614174001',
    webOrderId:'WEB-ENSAYO-'+'B'.repeat(32),numeroOrden:'027',
    amountArs:1000,fileCount:1,receivedCount:0,pendingCount:1,tusCount:1,r2Count:0,
    productionState:'pendiente',productionVersion:0}
  ]}));return;
 }
 if(req.url==='/personal/api/live-status'){
  const chunks=[];for await(const c of req)chunks.push(c);
  const p=JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(p.orderId,UUID);assert.equal(p.from,state);
  assert.equal(p.version,version);assert.equal(p.operator,'Operador Saber');
  assert.equal(p.confirmed,true);
  assert.equal(p.to,'en_preparacion');
  state='en_preparacion';version++;updated++;
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({ok:true,to:state,version,orderId:UUID}));return;
 }
 res.writeHead(404).end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const host='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:900}});
  page.on('dialog',async dialog=>{
   if(dialog.type()==='prompt')await dialog.accept('Operador Saber');
   else await dialog.accept();
  });
  const response=await page.goto(host+url);
  assert.equal(response.status(),200);
  await page.getByText('Orden 026').waitFor({timeout:10000});
  const body=await page.locator('body').innerText();
  for(const label of ['Nuevos','En preparación','En espera','Listos','Entregados','Cliente Ensayo']){
   assert.ok(body.includes(label),label);
  }
  assert.equal(await page.locator('a[href*="/personal/paquete?webOrderId="]').count(),1);
  assert.equal(await page.getByText('Iniciar preparación').count(),updated?0:1);
  const viewport=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(viewport.scroll<=viewport.width+5,'mobile overflow');
  if(width===390){
   await page.getByText('Iniciar preparación').click();
   await page.getByText('Orden 026').waitFor();
   await page.waitForFunction(()=>document.getElementById('lane-en_preparacion')?.innerText.includes('Orden 026'),{timeout:10000});
   assert.equal(updated,1);
  }
  console.log('SABER_CENTRAL_CHROME_'+width+'_COLS_ZIP_GOOD');
  await page.close();
 }
 console.log('SABER_CENTRAL_UI_ACTION_MOCK_NO_D1_NO_PAYMENTS_PASS');
}finally{await browser.close();server.close();}
