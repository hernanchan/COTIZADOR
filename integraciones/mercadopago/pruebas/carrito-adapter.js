/* Librería Saber · adaptación del carrito de vidriera al checkout.
   Preparación en rama de pruebas. NO es un checkout habilitado.
   El servidor debe validar precios y disponibilidad antes de crear la preferencia.
*/
(function(global){
 "use strict";
 const REF=/^POL-[A-F0-9]{24}$/;
 const money=n=>Number(n);
 function snapshot(cart){
  if(!Array.isArray(cart)||!cart.length||cart.length>100)throw Error("El carrito está vacío o excede el máximo.");
  const items=cart.map((x,i)=>{
   const qty=x.type==="print"?1:Number(x.qty);
   if(!Number.isSafeInteger(qty)||qty<1||qty>500)throw Error("Cantidad inválida en el artículo "+(i+1));
   const price=money(x.price);
   if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(price))throw Error("Precio inválido en el artículo "+(i+1));
   const type=x.type==="product"?"product":x.type==="print"?"print":null;
   if(!type)throw Error("Tipo de artículo desconocido");
   const refs=Array.isArray(x.receivedReferences)?x.receivedReferences:[];
   if(type==="print"&&x.photoOrder===true&&!(x.filesReceived===true&&refs.length===1&&REF.test(String(refs[0]))))throw Error("Faltan fotos recibidas en el trabajo "+(i+1));
   if(Array.isArray(x.draftReferences)&&x.draftReferences.length)throw Error("Hay archivos sin recepción confirmada.");
   const isPolaroid=type==="print"&&x.photoOrder===true;
   const proof=String(x.receiptProofToken||"");
   if(isPolaroid&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proof))
    throw Error("Las Polaroids necesitan una constancia de recepción verificada antes del pago.");
   if(type==="print"&&!isPolaroid)
    throw Error("Los trabajos de impresión todavía requieren un precio validado por el servidor.");
   return {type,code:type==="product"?String(x.id||"").slice(0,80):"POLAROID_A4",
    proof_token:isPolaroid?proof:undefined,name:String(x.name||"").slice(0,180),qty,
    // Solo referencia visual. El backend JAMÁS debe usar este importe como fuente de verdad.
    displayUnitPrice:price,detail:type==="print"?String(x.detail||"").slice(0,1500):"",
    photoReferences:type==="print"?refs.filter(r=>REF.test(String(r))).map(String):[]};
  });
  return {schema:"saber-cart-v1",currency:"ARS",paymentMode:"FULL",items,
   displayTotal:items.reduce((sum,x)=>sum+x.displayUnitPrice*x.qty,0)};
 }
 function fromLocalStorage(){
  const cart=snapshot(JSON.parse(global.localStorage.getItem("saberCartV1")||"[]"));
  const fingerprint=JSON.stringify(cart.items);
  let existing=null;
  try{existing=JSON.parse(global.localStorage.getItem("saberCartCheckoutIntentV1")||"null")}catch{}
  const valid=existing&&existing.fingerprint===fingerprint&&/^[0-9a-f-]{36}$/i.test(String(existing.id||""));
  const id=valid?existing.id:global.crypto.randomUUID();
  if(!valid)global.localStorage.setItem("saberCartCheckoutIntentV1",JSON.stringify({fingerprint,id}));
  return {...cart,client_order_id:id};
 }
 global.SaberCartPaymentAdapter=Object.freeze({snapshot,fromLocalStorage});
})(window);
