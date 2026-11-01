/**
 * Descarga privada exclusiva del operador de Librería Saber, rama de pruebas.
 * La URL sólo contiene identificadores, NUNCA firmas, tokens ni links de Storage.
 * El backend exige Basic y comprueba pertenencia en D1 + SHA-256 antes de devolver bytes.
 */
export function paginaDescargaTUSPersonal(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
 <title>Librería Saber · PDF original privado</title>
 <style>body{font:16px system-ui,Arial,sans-serif;color:#123356;background:#edf4fa;max-width:660px;margin:32px auto;padding:20px}
 section{padding:24px;border:1px solid #bbcee0;border-radius:12px;background:white}
 button{background:#135187;color:#fff;border:0;border-radius:8px;padding:13px 18px;cursor:pointer}
 button:disabled{opacity:.5} .note{font-size:.88rem;color:#4b6177}#status{margin:15px 0;white-space:pre-wrap}
 </style></head><body><section><h1>PDF original · recepción privada</h1>
 <p class="note">Solo operador autorizado. Se verifica el recibo en D1 y el SHA-256 de Supabase. Este archivo no es un PDF impuesto ni acredita pago.</p>
 <p id="detalle"></p><button id="descargar" disabled>Descargar PDF original</button>
 <p id="status" role="status" aria-live="polite">Validando referencia de pedido…</p>
 </section><script>
 const url=new URL(location.href);
 const webOrderId=url.searchParams.get('webOrderId')||'';
 const receiptId=url.searchParams.get('receiptId')||'';
 const orderOK=/^WEB-[A-Za-z0-9_-]{5,80}$/.test(webOrderId);
 const receiptOK=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(receiptId);
 const btn=document.getElementById('descargar'),status=document.getElementById('status');
 document.getElementById('detalle').textContent=orderOK&&receiptOK?
  'Pedido '+webOrderId+' · Recibo '+receiptId:'Referencia incompleta o inválida';
 if(orderOK&&receiptOK){btn.disabled=false;status.textContent='Archivo pendiente de descarga verificada.'}
 else status.textContent='No se recibió una referencia válida desde el Centro de Pedidos.';
 btn.addEventListener('click',async()=>{
  btn.disabled=true;status.textContent='Comprobando pertenencia y SHA del PDF…';
  try{
   const res=await fetch('/prueba-v2/api/ensayo-tus-descargar-personal',{
    method:'POST',credentials:'same-origin',redirect:'manual',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({orderId:webOrderId,receiptId})
   });
   if(!res.ok||!String(res.headers.get('Content-Type')||'').startsWith('application/pdf'))
    throw Error('La descarga privada no está autorizada o aún no está disponible (HTTP '+res.status+').');
   const pdf=await res.blob();
   if(pdf.size<5||pdf.size>20*1024*1024)throw Error('Tamaño del PDF fuera del límite');
   const first=new Uint8Array(await pdf.slice(0,5).arrayBuffer());
   if(String.fromCharCode(...first)!=='%PDF-')throw Error('No se recibió un PDF válido');
   const uri=URL.createObjectURL(pdf);
   const link=document.createElement('a');link.href=uri;
   link.download=receiptId+'.pdf';document.body.appendChild(link);
   link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(uri),15000);
   status.textContent='PDF original descargado. No imprimir ni entregar sin verificar el pago.';
  }catch(e){status.textContent=String(e.message||e)}
  finally{btn.disabled=false}
 });
 </script></body></html>`;
}
