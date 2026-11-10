/** Retorno informativo de Mercado Pago LIVE.
 * El redirect NO acredita pagos: solo la Central conciliada en D1 lo hace.
 * Nunca se usan payment_id, status ni merchant_order de la URL para autorizar R2/TUS.
 */
const HOST='pedidos.libreriasaber.com.ar';
const ON='GO_COMERCIAL_CONFIRMADO';
export function paginaRetornoLive(request,env){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.protocol!=='https:'||u.hostname!==HOST||
    u.pathname!=='/pedido/estado'||env?.SABER_ENTORNO!=='produccion'||
    env?.DOCS_MP_LIVE_GATE!==ON)
  return new Response('No disponible',{status:404,headers:{'Cache-Control':'no-store'}});
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Estado del pedido | Librería Saber</title>
<style>body{font-family:system-ui,Arial,sans-serif;background:#f5f8fc;color:#183650;margin:0;padding:24px}
main{max-width:540px;margin:7vh auto;background:white;border:1px solid #dae5ee;border-radius:16px;padding:30px}
h1{font-size:24px}a{color:#075b91}button{font:inherit;padding:10px 16px;background:#113c69;color:#fff;border:0;border-radius:9px;cursor:pointer}
small{color:#526579}#estado{line-height:1.6}</style></head><body><main>
<h1>Volviste a Librería Saber</h1>
<p id="estado" role="status" aria-live="polite">Estamos verificando el estado de tu pedido. Volver desde Mercado Pago no significa que el pago ya esté acreditado.</p>
<button type="button" id="revisar">Consultar nuevamente</button>
<p><a href="/cotizar">Volver al cotizador</a></p>
<small>Si Mercado Pago confirma el pago pero todavía no aparece acreditado, conservá el comprobante. No realices otro pago por este aviso.</small>
</main><script>
(function(){
 const output=document.getElementById('estado');
 const button=document.getElementById('revisar');
 async function revisar(){
  let order;
  try{order=JSON.parse(sessionStorage.getItem('saber-live-pedido-v1')||'null')}catch{}
  if(!order||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(order.webOrderId||'')||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(order.commercialOrderId||'')){
   output.textContent='No encontramos la referencia de esta compra en esta pestaña. Consultá tu pedido desde el cotizador; no vuelvas a pagar por este mensaje.';
   return;
  }
  button.disabled=true;
  try{
   const response=await fetch('/api/pedido/live/checkout',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'status',webOrderId:order.webOrderId,commercialOrderId:order.commercialOrderId})});
   const data=await response.json();
   if(!response.ok||data?.ok!==true||data.webOrderId!==order.webOrderId||
     data.commercialOrderId!==order.commercialOrderId)throw Error('pendiente');
   output.textContent=data.estado==='pagado_esperando_archivos'&&data.uploadAuthorized===true
    ?'Pago acreditado. Volvé al cotizador para completar la recepción de tus archivos.'
    :data.estado==='revocado'
    ?'El pago no se encuentra vigente. Comunicate con Librería Saber antes de continuar.'
    :'El pago todavía está pendiente de acreditación. Podés consultar nuevamente.';
  }catch{output.textContent='No pudimos consultar la acreditación en este momento. Conservá tu comprobante y probá nuevamente; no repitas el pago.'}
  finally{button.disabled=false}
 }
 button.addEventListener('click',revisar);revisar();
})();
</script></body></html>`;
 return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'no-store, private','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'}});
}
