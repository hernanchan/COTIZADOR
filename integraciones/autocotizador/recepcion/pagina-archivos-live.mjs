/** Adaptador visual comprador LIVE: un solo scroll y un solo total.
 * No modifica clasificación, precios, archivos ni pagos.
 */
export function prepararCotizadorArchivosLive(htmlEntrada){
 if(typeof htmlEntrada!=='string'||!htmlEntrada.includes('id="zonaArchivos"'))
  throw Error('HTML_COTIZADOR_NO_COMPATIBLE');
 const html=htmlEntrada
        .replace(/<p class="nota">[\s\S]*?<\/p>/,
          '<p class="nota"><strong>Elegí tus archivos.</strong> PDF, JPG o PNG. Las medidas se detectan por el contenido y podés elegir el tamaño final de impresión. El importe se confirma antes del pago; tus archivos originales se envían en forma privada solamente después de acreditarlo.</p>')
        .replace('Podés seleccionar varios a la vez (hasta 30).',
          'Podés seleccionar hasta 10 PDF o hasta 30 imágenes JPG/PNG.')
        .replace('<script src="/prueba-carga-unica.js" defer></script>',
         '<script src="/cotizar/archivos.js" defer></script>')
        .replace(/href="\/prueba-cotizador-conjunto"/g,'href="/cotizar"')
        .replace('</head><body>',`<style>
          html,body{overflow-x:hidden;max-width:100%}
          body{background:transparent}
          main{box-shadow:none;margin:0;padding:4px;max-width:none;width:100%}
          main>h1,main>.nota,main>h2,main>p:has(a[href="/cotizar"]){display:none}
          #presupuesto,#prepararPedido{display:none!important}
          #zonaArchivos{padding:12px;margin:5px 0 12px}
          #zonaArchivos #archivos{width:100%;max-width:100%;font-size:16px}
          #lista,.grupo-pedido,.archivo{max-width:100%;min-width:0}
          .grupo-pedido .archivo{overflow:visible}
          @media(max-width:600px){
           main{padding:3px}
           #zonaArchivos{padding:10px}
           .panel-edicion .controles{grid-template-columns:minmax(0,1fr)}
           .opciones-comunes label{flex:1 1 100%}
           .fila{gap:7px;padding:9px}
           .modo-config{padding:10px}
          }
          </style></head><body>`)
        .replace('</body></html>',`<script>
          (() => {
           if(window.parent===window||location.pathname!=='/cotizar/archivos')return;
           let last=0;
           const send=(force=false)=>{
            const h=Math.ceil(Math.max(document.body.scrollHeight,
             document.documentElement.scrollHeight));
            if(h>=280&&h<=30000&&(force||Math.abs(h-last)>3)){
             last=h;
             window.parent.postMessage({type:'SABER_SMART_RESIZE',height:h},location.origin);
            }
           };
           addEventListener('message',event=>{
            if(event.origin===location.origin&&event.source===window.parent&&
               event.data?.type==='SABER_SMART_RESIZE_REQUEST')send(true);
           });
           if(typeof ResizeObserver==='function')new ResizeObserver(()=>send()).observe(document.body);
           addEventListener('load',send);
           requestAnimationFrame(send);
          })();
          </script></body></html>`);
 if(!html.includes('SABER_SMART_RESIZE')||!html.includes('id="archivos"'))
  throw Error('HTML_COTIZADOR_NO_ADAPTADO');
 return html;
}
