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
   return {type,code:type==="product"?String(x.id||"").slice(0,80):null,name:String(x.name||"").slice(0,180),qty,
    // Solo referencia visual. El backend JAMÁS debe usar este importe como fuente de verdad.
    displayUnitPrice:price,detail:type==="print"?String(x.detail||"").slice(0,1500):"",
    photoReferences:type==="print"?refs.filter(r=>REF.test(String(r))).map(String):[]};
  });
  return {schema:"saber-cart-v1",currency:"ARS",paymentMode:"FULL",items,
   displayTotal:items.reduce((sum,x)=>sum+x.displayUnitPrice*x.qty,0)};
 }
 function fromLocalStorage(){return snapshot(JSON.parse(global.localStorage.getItem("saberCartV1")||"[]"))}
 global.SaberCartPaymentAdapter=Object.freeze({snapshot,fromLocalStorage});
})(window);
