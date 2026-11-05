/**
 * Vista visual protegida. No crea pedidos, no inicia cobros, ni comparte datos privados.
 * Se ejecuta sólo dentro de v2PrivateBrowserResponse con autenticación privada.
 */
const HOME='/prueba-v2/diseno-saber-directo';
const OFFERS=HOME+'/ofertas.html';

export function prepararVistaDisenoPrivada(html,{ofertas=false}={}){
 if(typeof html!=='string'||!html.includes('<body>')||!html.includes('</body>'))
  throw Error('HTML de vista previa incompatible');
 let page=html
  .replace(/<meta name="robots" content="index,follow">/i,'<meta name="robots" content="noindex,nofollow,noarchive">')
  .replaceAll('href="cotizar.html"','href="/prueba-v2/"')
  .replaceAll('href="ofertas.html','href="'+OFFERS)
  .replaceAll('href="index.html#','href="'+HOME+'#')
  .replaceAll('href="index.html"','href="'+HOME+'"')
  .replace(/<meta name="referrer"[^>]*>/i,'<meta name="referrer" content="no-referrer">');
 // El aviso no tapa el menú y evita confundir el catálogo histórico con cobro operativo.
 const notice='<div id="saber-preview-banner" role="status" style="position:relative;z-index:99;background:#0A3158;color:#fff;padding:11px 15px;text-align:center;font:700 13px/1.4 system-ui,sans-serif">VISTA PREVIA PRIVADA DE DISEÑO · Los pedidos y mensajes están desactivados.</div>';
 const clickGuard=`<script>
 (function(){
  function aviso(){window.alert('Vista previa: pedidos y mensajes desactivados. Usá el cotizador de pruebas para ensayar el circuito.');}
  document.addEventListener('click',function(event){
   const target=event.target;
   if(!target || typeof target.closest!=='function')return;
   const action=target.closest('[onclick]');
   const link=target.closest('a[href]');
   const code=action?.getAttribute('onclick')||'';
   const url=link?.getAttribute('href')||'';
   const blocked=/sendWhatsApp\\s*\\(|askProduct\\s*\\(/.test(code)||
    /^(?:https?:)?\\/\\/(?:wa\\.me|api\\.whatsapp\\.com)/i.test(url)||
    /^mailto:/i.test(url);
   if(blocked){event.preventDefault();event.stopImmediatePropagation();aviso();}
  },true);
 })();
 </script>`;
 page=page.replace('<body>','<body>'+notice);
 page=page.replace('</body>',clickGuard+'</body>');
 return page;
}

/**
 * SOLO DISEÑO, sin clave: no usa la página funcional ni expone su JavaScript.
 * Las ofertas son bloques de muestra sin precio; no hay consultas de
 * catálogo, pedidos, pagos, almacenamiento local ni contacto por WhatsApp.
 * La ruta es pública y no indexable: NO se publican datos privados.
 */
const PUBLIC_HOME='/prueba-v2/diseno-sin-clave';
const PUBLIC_OFFERS=PUBLIC_HOME+'/ofertas.html';

export function prepararVistaDisenoAbierta(html,{ofertas=false}={}){
 if(typeof html!=='string'||!html.includes('<body>')||!html.includes('</body>'))
  throw Error('Vista incompatible');
 let page=html
  // Es crucial borrar por completo el JS histórico antes de publicar HTML sin clave:
  // en ese JS hay carrito, WhatsApp, nombres/identificadores de transferencias y pago.
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'')
  .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi,'')
  .replace(/<meta\s+name="robots"\s+content="index,follow">/i,'<meta name="robots" content="noindex,nofollow,noarchive">')
  .replace(/<meta\s+name="referrer"[^>]*>/gi,'')
  .replace(/<a\b([^>]*?)href="([^"]*)"/gi,(_,attrs,target)=>{
    let href='#preview-aviso';
    if(target.startsWith('#'))href=target;
    else if(target.startsWith('ofertas.html'))href=PUBLIC_OFFERS+target.slice('ofertas.html'.length);
    else if(target.startsWith('index.html#'))href=PUBLIC_HOME+target.slice('index.html'.length);
    else if(target==='index.html')href=PUBLIC_HOME;
    return '<a'+attrs+'href="'+href+'"';
  })
  .replace(/\s+target="_blank"/gi,'')
  .replace(/<aside class="cart"[\s\S]*?<\/aside>/i,'')
  .replace(/<div class="overlay"[^>]*><\/div>/i,'');
 const aviso='<div id="preview-aviso" role="status" style="background:#0a3158;color:#fff;padding:11px 16px;text-align:center;font:700 13px/1.4 system-ui,sans-serif">VISTA DE DISEÑO · SIN CONTRASEÑA · No se realizan pedidos ni pagos.</div>';
 if(ofertas){
   page=page.replace('Cargando productos…','Aquí se mostrarán las ofertas y novedades. En esta demostración no hay precios ni compras.');
   page=page.replace('Productos publicados desde la misma planilla de Librería Saber. Podés agregarlos al carrito y combinarlos con trabajos de impresión.','Así se verá el catálogo de ofertas. No se muestran datos comerciales ni se realizan pedidos en esta vista.');
 }else{
   for(const id of ['gridEscolar','gridOficina','gridNovedades']){
     page=page.replace('id="'+id+'"></div>','id="'+id+'"><div class="product-status">Espacio para productos destacados: el catálogo no está conectado en esta vista de diseño.</div></div>');
   }
   page=page.replace('<h2 id="promoTitle">Promoción semanal</h2>','<h2 id="promoTitle">Promociones a primera vista</h2>');
   page=page.replace('<p id="promoText">El cotizador aplica automáticamente el beneficio vigente.</p>','<p id="promoText">Aquí aparecerá la promoción vigente del día al conectar el nuevo diseño con el cotizador.</p>');
 }
 const harmlessScript=ofertas?'':`<script>
 (function(){
   const buttons=Array.from(document.querySelectorAll('[data-panel]'));
   const panels=Array.from(document.querySelectorAll('[data-content]'));
   buttons.forEach(button=>button.addEventListener('click',()=>{
     buttons.forEach(b=>b.classList.toggle('active',b===button));
     panels.forEach(p=>p.hidden=p.dataset.content!==button.dataset.panel);
   }));
 })();
 </script>`;
 page=page.replace('<body>','<body>'+aviso);
 page=page.replace('</body>',harmlessScript+'</body>');
 return page;
}
