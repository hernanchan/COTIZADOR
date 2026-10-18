// Proxy de mismo origen. Sin despliegue/configuración no habilita pagos ni usa producción.
const operations=new Set(['session','polaroid-proof','cart-order','pay','status']);
const reply=(error,status)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 if(env?.CHECKOUT_ENABLED!=='APROBADO'||!env.PAYMENTS?.fetch||!env.CHECKOUT_GATEWAY_KEY||!env.CHECKOUT_HOST)
  return reply('Pagos online todavía no habilitados',503);
 const url=new URL(request.url),origin='https://'+env.CHECKOUT_HOST;
 if(url.origin!==origin||request.headers.get('Origin')!==origin||
   (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))return reply('Origen no autorizado',403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return reply('Formato inválido',415);
 const op=url.searchParams.get('op');if(!operations.has(op))return reply('Operación inválida',400);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply('Origen no verificable',403);
 // No confiar solo en Content-Length: limitar también transferencias fragmentadas.
 const reader=request.body?.getReader();if(!reader)return reply('Faltan datos',400);
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
  if(size>64000){await reader.cancel();return reply('Solicitud demasiado extensa',413)}chunks.push(value)}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
 try{
  const result=await env.PAYMENTS.fetch(new Request('https://payments.internal/checkout/'+op,{method:'POST',headers:{
   'Content-Type':'application/json','Authorization':request.headers.get('Authorization')||'',
   'x-checkout-gateway':env.CHECKOUT_GATEWAY_KEY,'x-checkout-client-ip':ip},body}));
  return new Response(result.body,{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 }catch{return reply('No pudimos comunicarnos con pagos. Tu carrito sigue guardado.',502)}
}
