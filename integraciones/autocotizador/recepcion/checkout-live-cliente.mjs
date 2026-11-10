/** Checkout Pro LIVE desde una orden productiva ya confirmada.
 * No crea órdenes, no cotiza y jamás llama endpoints de /prueba-v2.
 * El Worker verifica sesión/HMAC, importe y relación orden-archivos en D1.
 */
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const KEY='saber-live-pedido-v1';
function safeMp(url){
 let u;try{u=new URL(url)}catch{return false}
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
  /(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(u.hostname);
}
function validateOrder(p){
 return p&&Object.keys(p).sort().join(',')==='amountArs,commercialOrderId,fileCount,webOrderId'&&
  WEB.test(p.webOrderId)&&UUID.test(p.commercialOrderId)&&
  Number.isSafeInteger(p.amountArs)&&p.amountArs>0&&p.amountArs<=50000000&&
  Number.isSafeInteger(p.fileCount)&&p.fileCount>=1&&p.fileCount<=10;
}
export async function iniciarCheckoutLiveCliente({orden,fetcher=fetch,storage=sessionStorage,origin=location.origin}={}){
 if(origin!==ORIGIN||!validateOrder(orden)||typeof fetcher!=='function'||
    typeof storage?.setItem!=='function')throw Error('LIVE_ORDEN_PRODUCTIVA_NO_VERIFICABLE');
 const body=JSON.stringify({action:'start',webOrderId:orden.webOrderId,
  commercialOrderId:orden.commercialOrderId});
 const r=await fetcher('/api/pedido/live/checkout',{method:'POST',
  credentials:'same-origin',redirect:'error',
  headers:{'Content-Type':'application/json'},body});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data?.ok!==true||
   data.webOrderId!==orden.webOrderId||
   data.commercialOrderId!==orden.commercialOrderId||
   data.amountArs!==orden.amountArs||data.fileCount!==orden.fileCount||
   data.uploadAuthorized!==false||data.productionAuthorized!==false||
   !safeMp(data.checkoutUrl))throw Error('LIVE_CHECKOUT_NO_AUTORIZADO');
 // Antes de navegar a Mercado Pago conservar solo identificadores, no PDFs.
 storage.setItem(KEY,JSON.stringify({
  webOrderId:orden.webOrderId,commercialOrderId:orden.commercialOrderId
 }));
 return data.checkoutUrl;
}
export const LIVE_CHECKOUT_STORAGE_KEY=KEY;
