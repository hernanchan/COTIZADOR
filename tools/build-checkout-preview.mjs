// Genera un ensayo local; nunca escribe sobre vidriera ni despliega.
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const out=resolve(process.argv[2]||'/tmp/saber-checkout-preview');
if(out===root||out.startsWith(root+'/'))throw Error('La vista de ensayo debe generarse fuera del repositorio.');
await mkdir(out,{recursive:true});
await cp(root+'/vidriera',out,{recursive:true});
const routes=JSON.parse(await readFile(root+'/vidriera/_routes.json','utf8'));
routes.include.push('/api/checkout');
await writeFile(out+'/_routes.json',JSON.stringify(routes,null,2)+'\n');
const read=p=>readFile(root+'/'+p,'utf8');
const assets='integraciones/mercadopago/pruebas/';
await cp(root+'/'+assets+'pedido-pago.html',out+'/pedido-pago.html');
for(const file of ['carrito-adapter.js','checkout-client.js'])await cp(root+'/'+assets+file,out+'/'+file);
const config={enabled:false,rollout:'PENDIENTE_DE_APROBACION',turnstileSiteKey:''};
const boot=prefix=>`<script>window.SABER_CHECKOUT_CONFIG=${JSON.stringify(config)}</script><script src="${prefix}carrito-adapter.js"></script><script src="${prefix}checkout-client.js"></script>`;
let shop=await read('vidriera/index.html');
shop=shop.replace('</body>',boot('')+`<script>
const payButton=document.querySelector('.checkout');
const selector=document.createElement('fieldset');
selector.innerHTML='<legend>Elegí cómo pagar</legend><label><input type="radio" name="medioPagoSaber" value="mp" checked> Tarjeta de crédito, débito o dinero en Mercado Pago</label><label><input type="radio" name="medioPagoSaber" value="transferencia"> Transferencia bancaria</label><p>No se aplican recargos ni descuentos en esta etapa de pruebas.</p>';
payButton.before(selector);
const instructions=document.createElement('p');instructions.setAttribute('role','status');
selector.after(instructions);
payButton.textContent='Continuar con el pago';
payButton.onclick=async()=>{
 payButton.disabled=true;
 try{
  const method=document.querySelector('input[name="medioPagoSaber"]:checked')?.value;
  if(method==='transferencia'){
   const result=await SaberCheckout.transfer();
   if(result.state==='cancelled')return;
   instructions.textContent=result.state==='paid'?'Pedido ya pagado':
    'Transferí $ '+Number(result.amount_ars).toLocaleString('es-AR')+
    ' al alias '+result.alias+'. Pedido: '+result.order_id+
    '. Queda pendiente de acreditación bancaria. No es una confirmación de pago.';
  }else{
   const result=await SaberCheckout.checkout();
   if(result.state==='paid')instructions.textContent='Pago confirmado. Pedido '+result.order_id;
  }
 }catch(e){instructions.textContent=e.message}finally{payButton.disabled=false}
};
document.querySelector('.deposit').hidden=true;
document.querySelector('.cart-hint').textContent='Pago total. La confirmación depende de la verificación del pago y de los archivos recibidos.';
</script></body>`);
await writeFile(out+'/index.html',shop);
let editor=await read('vidriera/polaroids/editor.html');
// begin ANTES de iniciar el envío; receipt ANTES de borrar la clave temporal.
editor=editor.replace('  if(!receivingSession){', '  await window.SaberCheckout.begin();\n  if(!receivingSession){');
editor=editor.replace('  receivedOrder=Object.freeze({reference,', '  const paymentProof=await window.SaberCheckout.receipt(reference,receivingSession.uploadKey);\n  receivedOrder=Object.freeze({receiptProofToken:paymentProof.proof_token,reference,');
editor=editor.replace('qty:1,price,deposit:price/2,','qty:1,price,deposit:0,receiptProofToken:receivedOrder.receiptProofToken,');
editor=editor.replace('</head>',boot('../')+'</head>');
await writeFile(out+'/polaroids/editor.html',editor);
let resultPage=await read(assets+'pedido-pago.html');
resultPage=resultPage.replace('<!--CHECKOUT_BOOT-->',boot(''));
await writeFile(out+'/pedido-pago.html',resultPage);
console.log('Vista generada y apagada: '+out);
