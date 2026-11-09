/**
 * Descarga de original R2 para personal, desde navegador del mostrador.
 * Acceso a la PÁGINA y POST protegido por HTTP Basic del Worker.
 * No concede permiso de imprimir; no utiliza URL del bucket.
 */
import zipJs from './zip-tus-cliente.txt';
import pdfOrdenJs from './pdf-orden-tus-cliente.txt';
import pdfHojaR2Js from './pdf-hoja-r2-preprensa.txt';
export function paginaR2PreprensaPersonal(){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
 <title>Original R2 · Revisión de preprensa · Librería Saber</title>
 <style>*{box-sizing:border-box}body{font:16px system-ui,Arial,sans-serif;
  color:#163d62;background:#edf3f8;max-width:740px;margin:5vh auto;padding:18px}
 main{background:#fff;border:1px solid #d6dfe8;border-radius:12px;padding:24px}
 h1{font-size:23px}p{line-height:1.5}.warning{padding:14px;border-left:4px solid #a56717;
 background:#fff3df}.note{font-size:.92rem;color:#475a69}
 button{padding:13px 19px;border:0;border-radius:8px;background:#175b8c;color:#fff;
 font:inherit;cursor:pointer}button:disabled{opacity:.6;cursor:not-allowed}
 #result{white-space:pre-wrap;overflow-wrap:anywhere;font-weight:600;margin-top:18px}
 </style></head><body><main>
 <h1>Original recibido por R2</h1>
 <p id="identidad">Verificando referencia…</p>
 <p class="warning"><strong>Revisión de preprensa obligatoria.</strong> El pago y la integridad
 del archivo no acreditan que sus páginas, medida, escala, clasificación CAD/póster,
 material y precio final coincidan con la impresión solicitada.</p>
 <button id="download" disabled>Descargar PDF original privado</button>
 <button id="zip-r2" disabled>Descargar ZIP de revisión + hoja A4</button>
 <p class="warning">El ZIP es exclusivamente para preprensa: NO es una orden lista para imprimir.</p>
 <p class="note">Sólo personal autorizado. Descarga verificada con Central D1 y SHA-256
 del objeto R2. No modifica el PDF ni genera pedidos o cobros.</p>
 <p id="result" role="status" aria-live="polite">Esperando…</p>
 </main><script>
 ${zipJs}
 ${pdfOrdenJs}
 ${pdfHojaR2Js}
 (()=>{
  'use strict';
  const q=new URL(location.href).searchParams;
  const webOrderId=q.get('webOrderId')||'';
  const receiptId=q.get('receiptId')||'';
  const valid=/^WEB-ENSAYO-[A-F0-9]{32}$/.test(webOrderId)&&
   /^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(receiptId);
  const label=document.getElementById('identidad');
  const status=document.getElementById('result');
  const button=document.getElementById('download');
  const zipButton=document.getElementById('zip-r2');
  if(!valid){
   label.textContent='Referencia incompleta o inválida. Abrí el pedido desde la Central.';
   status.textContent='No se solicitó ninguna descarga.';
   return;
  }
  label.textContent='Pedido '+webOrderId+' · Recibo '+receiptId;
  button.disabled=false;zipButton.disabled=false;
  status.textContent='El original sólo se descargará cuando lo solicites.';
  let active=false;
  zipButton.addEventListener('click',async()=>{
   if(active)return;
   active=true;button.disabled=true;zipButton.disabled=true;
   status.textContent='Preparando paquete de revisión: descargando y verificando original…';
   try{
    const res=await fetch('/prueba-v2/api/ensayo-r2-descargar-d1-personal',{
     method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({orderId:webOrderId,receiptId})
    });
    if(!res.ok||!String(res.headers.get('Content-Type')||'').startsWith('application/pdf'))
     throw Error('No se autorizó el original R2 (HTTP '+res.status+').');
    const size=Number(res.headers.get('Content-Length'));
    if(!Number.isSafeInteger(size)||size<=40*1024*1024||
       size>200*1024*1024)
     throw Error('El PDF está fuera del límite permitido para este paquete.');
    // Solo se arma en estación del operador; el Worker transmite el original
    // verificado por SHA y ETag, pero nunca comprime PDF grande en Cloudflare.
    const original=await res.blob();
    if(original.size!==size||original.type!=='application/pdf')
     throw Error('Descarga incompleta o formato inesperado.');
    const hoja=generarHojaPreprensaR2(webOrderId,receiptId,size);
    status.textContent='Generando ZIP local sin alterar el PDF…';
    const paquete=await crearZipSinCompresion([
     {name:'PDF_01.pdf',blob:original},
     {name:'PREPRENSA_R2_NO_IMPRIMIR.pdf',blob:hoja}
    ],{maxBytes:210*1024*1024});
    const href=URL.createObjectURL(paquete);
    const a=document.createElement('a');a.href=href;
    a.download='PREPRENSA_'+receiptId+'.zip';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),60000);
    status.textContent='ZIP de revisión generado. Original + hoja A4. NO imprimir hasta aprobar medidas, CAD/póster, papel, copias y precio.';
   }catch(e){
    status.textContent='No se generó el ZIP: '+String(e?.message||e);
   }finally{active=false;button.disabled=false;zipButton.disabled=false}
  });
  button.addEventListener('click',async()=>{
   if(active)return;
   active=true;button.disabled=true;
   status.textContent='Central y R2: comprobando hash antes de descargar…';
   try{
    // Chrome exige activación de usuario PARA ABRIR el selector de archivo.
    // Debe invocarse antes del primer await de red, no después del hash R2.
    const fileHandle=window.showSaveFilePicker?await window.showSaveFilePicker({
     suggestedName:receiptId+'.pdf',types:[{
      description:'Documento PDF original',accept:{'application/pdf':['.pdf']}
     }]
    }):null;
    const res=await fetch('/prueba-v2/api/ensayo-r2-descargar-d1-personal',{
     method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({orderId:webOrderId,receiptId})
    });
    if(!res.ok||!String(res.headers.get('Content-Type')||'').startsWith('application/pdf'))
      throw Error('El servidor no autorizó el archivo (HTTP '+res.status+').');
    const size=Number(res.headers.get('Content-Length'));
    if(!Number.isSafeInteger(size)||size<=40*1024*1024||size>256*1024*1024)
      throw Error('El tamaño recibido no está dentro del cupo esperado.');
    if(fileHandle&&res.body){
      const writable=await fileHandle.createWritable();
      try{
       const reader=res.body.getReader();let read=0;
       while(true){
        const part=await reader.read();
        if(part.done)break;
        read+=part.value.byteLength;
        if(read>size)throw Error('Llegaron más bytes que los previstos.');
        await writable.write(part.value);
       }
       if(read!==size)throw Error('Descarga incompleta.');
       await writable.close();
      }catch(e){await writable.abort().catch(()=>{});throw e}
    }else{
      if(size>120*1024*1024)
       throw Error('Este navegador no permite descargar archivos grandes por fragmentos. Usá Chrome en una PC.');
      const blob=await res.blob();
      if(blob.size!==size)throw Error('Descarga incompleta.');
      const anchor=document.createElement('a');
      const src=URL.createObjectURL(blob);
      anchor.href=src;anchor.download=receiptId+'.pdf';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(src),60000);
    }
    status.textContent='Original descargado para revisión. Verificar páginas, dimensiones, CAD/póster, copias, papel y tarifa. NO IMPRIMIR sin aprobar la orden.';
   }catch(e){
    status.textContent='No se completó la descarga: '+String(e?.message||e);
   }finally{active=false;button.disabled=false}
  });
 })();
 </script></body></html>`;
}
