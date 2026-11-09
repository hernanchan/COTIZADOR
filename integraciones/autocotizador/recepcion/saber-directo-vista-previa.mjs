/**
 * Vista visual protegida. No crea pedidos, no inicia cobros, ni comparte datos privados.
 * Se ejecuta sólo dentro de v2PrivateBrowserResponse con autenticación privada.
 */
import {carritoV3Cliente} from './saber-carrito-v3-script.mjs';

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

export function prepararVistaDisenoAbierta(html,{ofertas=false,categoria='',pedidoTUS=false}={}){
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
    else if(target==='cotizar.html')href=pedidoTUS?'/prueba-v2/pedido-cliente':'https://libreriasaber.com.ar/cotizar';
    else if(target.startsWith('ofertas.html'))href=PUBLIC_OFFERS+target.slice('ofertas.html'.length);
    else if(target.startsWith('index.html#'))href=PUBLIC_HOME+target.slice('index.html'.length);
    else if(target==='index.html')href=PUBLIC_HOME;
    return '<a'+attrs+'href="'+href+'"';
  })
  .replace(/\s+target="_blank"/gi,'')
  .replace(/<aside class="cart"[\s\S]*?<\/aside>/i,'')
  .replace(/<div class="overlay"[^>]*><\/div>/i,'');
 const aviso='<div id="preview-aviso" role="status" style="background:#0a3158;color:#fff;padding:11px 16px;display:flex;align-items:center;justify-content:center;gap:15px;flex-wrap:wrap;text-align:center;font:700 13px/1.4 system-ui,sans-serif"><span>'+
 (pedidoTUS?'VISTA DE PRUEBAS · Productos por WhatsApp; impresiones con pedido, pago Sandbox y seguimiento.':'VISTA DE DISEÑO · SIN CONTRASEÑA · Productos por WhatsApp; impresiones en el cotizador actual.')+
 '</span><a href="'+(pedidoTUS?'/prueba-v2/pedido-cliente':'/prueba-v2/cotizar-cliente')+'" style="color:#fff;text-decoration:underline;text-underline-offset:3px">'+
 (pedidoTUS?'Probar envío completo de PDF':'Probar cotización nueva sin clave')+'</a>'+
 '<a href="/prueba-v2/" style="color:#fff;text-decoration:underline;text-underline-offset:3px">Acceso del personal</a>'+
 '<button type="button" class="demo-cart-trigger" data-demo-open>Ver carrito <span data-demo-badge>0</span></button></div>';

 // Muestra estática y fechada de la hoja pública "Productos web (MODELO)".
 // Es independiente de la tienda: NO define stock ni precios operativos.
 // En producción, las páginas originales siguen usando el CSV publicado.
 const modelo=[
  {cat:'Escolar',name:'Resaltador Filgo x 4 pastel',desc:'Resaltador cuerpo chato pastel',precio:5400,oferta:4500,code:'ESC001',photo:'1h1LuTjbxOHLBz5LjwRnedTDGu7xSt8Ew'},
  {cat:'Escolar',name:'Marcadores Jumbo Sabonis x 12',desc:'12 colores punta mediana alta duración',precio:7500,oferta:6500,code:'ESC002',photo:'1NAzMD691MCl7EVd8ezeEMu0Higk1INn7'},
  {cat:'Oficina',name:'Resma A4 P AMPA 70 g',desc:'500 hojas',precio:8000,oferta:8000,code:'OFI001',photo:'1_j9dvL-8db2nJ01xKmjlZO3gbY1qrXOH'},
  {cat:'Escolar',name:'Bolígrafo borrable',desc:'Personajes varios',precio:4900,oferta:0,code:'esc003',photo:'1XvxoMqFsU7FvgL6u3KZ_KZgeI04e6dlc'}
 ];
 const foto=p=>'https://drive.google.com/thumbnail?id='+p.photo+'&sz=w1200';
 const money=n=>'$ '+new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n);
 const safe=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const rebaja=p=>p.oferta>0&&p.oferta<p.precio;
 const card=p=>'<article class="v3-sample-offer"><img src="'+foto(p)+'" alt="'+safe(p.name)+'" loading="lazy" decoding="async">'+
  '<div><small>'+safe(p.cat)+' · ARTÍCULO DE LA PLANILLA MODELO</small><strong>'+safe(p.name)+'</strong>'+
  '<p>'+safe(p.desc)+'</p><div class="v3-sample-price"><b>'+money(rebaja(p)?p.oferta:p.precio)+'</b>'+
  (rebaja(p)?'<del>'+money(p.precio)+'</del>':'')+'</div>'+
  '<button class="v3-sample-add" type="button" data-demo-add="'+safe(p.code)+'">Agregar al carrito</button></div></article>';
 const note='<p class="v3-sample-note">Datos de la planilla MODELO consultados el 05/11/2026. Solo muestra visual; antes de vender se confirmarán precios y disponibilidad.</p>';
 const styles='.visual-sheet-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;grid-column:1/-1}'+
  '.v3-sample-offer{background:#fff;min-width:0;border:1px solid #dee7eb;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}'+
  '.v3-sample-offer img{display:block;width:100%;height:200px;object-fit:contain;background:#f7f9fa}'+
  '.v3-sample-offer>div{padding:13px 15px;display:flex;flex:1;flex-direction:column;gap:7px}'+
  '.v3-sample-offer small{font-size:9px;color:#b36b2b;font-weight:900;letter-spacing:.04em}'+
  '.v3-sample-offer strong{color:#103554;font:800 17px/1.2 Manrope,sans-serif}'+
  '.v3-sample-offer p{font-size:12px;line-height:1.4;color:#627586;margin:0}'+
  '.v3-sample-price{display:flex;gap:10px;align-items:baseline;margin-top:auto}'+
  '.v3-sample-price b{font:800 20px Manrope,sans-serif;color:#103554}'+
  '.v3-sample-price del{font-size:12px;color:#83919e}'+
  '.v3-sample-add{display:block;background:#f7942e;color:#173851;border:0;border-radius:7px;font:800 13px/1.3 Manrope,sans-serif;padding:11px 10px;cursor:pointer;margin-top:9px;width:100%}'+
  '.v3-sample-add:hover{background:#ffad56}'+
  '.v3-sample-note{grid-column:1/-1;display:block;margin:0;padding:11px;background:#fff4e4;color:#72572e;font-size:12px;border-radius:7px}'+
  '@media(max-width:650px){.visual-sheet-grid{grid-template-columns:1fr}.v3-sample-offer{display:grid;grid-template-columns:39% 61%;min-height:156px}.v3-sample-offer img{height:100%;min-height:156px}.v3-sample-offer strong{font-size:15px}.v3-sample-price b{font-size:17px}}';
 const grid=items=>'<div class="visual-sheet-grid">'+items.map(card).join('')+note+'</div>';
 if(ofertas){
   const cat=String(categoria||'').trim().toUpperCase();
   const current=cat==='ESCOLAR'||cat==='OFICINA'||cat==='NOVEDADES'?
     modelo.filter(p=>p.cat.toUpperCase()===cat):modelo.filter(rebaja);
   const titulo=cat==='ESCOLAR'?'Escolar':cat==='OFICINA'?'Oficina':cat==='NOVEDADES'?'Novedades':'Ofertas destacadas';
   page=page.replace('<h1 id="pageTitle">Todas las ofertas</h1>','<h1 id="pageTitle">'+titulo+'</h1>');
   page=page.replace('<div class="empty">Cargando productos…</div>',current.length?grid(current):
     '<div class="v3-sample-note">La planilla MODELO no tiene artículos activos en esta categoría.</div>');
   page=page.replace('Productos publicados desde la misma planilla de Librería Saber. Podés agregarlos al carrito y combinarlos con trabajos de impresión.','Esta es una muestra de artículos cargados en Google Sheets. Pedidos y pagos están desactivados.');
 }else{
   for(const [id,cat] of [['gridEscolar','Escolar'],['gridOficina','Oficina'],['gridNovedades','Novedades']]){
     const cards=modelo.filter(p=>p.cat===cat).slice(0,2);
     page=page.replace('id="'+id+'"></div>','id="'+id+'">'+(cards.length?grid(cards):
       '<div class="v3-sample-note">La planilla MODELO no tiene artículos activos en esta categoría.</div>')+'</div>');
   }
   // Conservar el mensaje prudente: nunca anunciar descuentos sin fuente autorizada.
 }
 // La preview sin clave no tiene carrito mixto funcional: evitar una promesa
 // de pedido único mientras los dos sistemas aún no se integraron.
 if(!ofertas){
   page=page.replace(
    'Entrás al cotizador, calculás el trabajo y al final elegís <strong>Agregar al pedido general</strong>. El trabajo vuelve automáticamente a este carrito junto con los artículos.',
    pedidoTUS?'Podés cotizar, enviar y pagar tu trabajo en el nuevo sistema de ensayo. Los productos se consultan por WhatsApp en un pedido aparte.':'Podés cotizar tus impresiones en el sitio actual. En esta etapa, los artículos y los trabajos de impresión se consultan por separado.'
   ).replace(
    '<small>Un solo pedido</small><b>Artículos + impresión</b><p>1. Agregás los productos que quieras.<br>2. Cotizás impresiones, fotos, stickers, ploteos o gráfica.<br>3. Volvés al carrito con todo integrado y enviás un único pedido por WhatsApp.</p>',
    pedidoTUS?'<small>Dos servicios disponibles</small><b>Productos e impresiones</b><p>1. Consultás artículos por WhatsApp.<br>2. Cotizás, enviás y pagás impresiones en el nuevo sistema de ensayo.<br>3. Seguís la preparación desde el enlace de tu pedido.</p>':'<small>Dos servicios disponibles</small><b>Productos e impresiones</b><p>1. Consultás productos desde el carrito por WhatsApp.<br>2. Cotizás documentos, fotos o ploteos en el cotizador actual.<br>3. Estamos preparando la integración de ambos en una sola compra.</p>'
   );
 }
 page=page.replace('</style>',styles+'</style>');

 // Carrito de ENSAYO: guarda únicamente códigos/cantidades en sesión local.
 // No usa el JS de ventas del sitio, no contacta Google, WhatsApp, MP ni D1.
 const catalogue=modelo.map(p=>({code:p.code,name:p.name,price:rebaja(p)?p.oferta:p.precio}));
 const rawData=JSON.stringify(catalogue).replace(/</g,'\\u003c');
 const cartCss=String.raw`
 .demo-cart-trigger{background:#f7942e;border:0;color:#15334b;padding:9px 13px;border-radius:7px;cursor:pointer;font-weight:900}
 .demo-cart-trigger [data-demo-badge]{background:#fff;color:#0e3151;border-radius:12px;padding:3px 7px;margin-left:5px}
 .demo-cart-curtain[hidden],.demo-cart-drawer[hidden]{display:none!important}
 .demo-cart-curtain{position:fixed;inset:0;background:rgba(6,26,43,.65);z-index:190}
 .demo-cart-drawer{position:fixed;right:0;top:0;bottom:0;width:min(440px,100%);background:#fff;color:#18334c;z-index:191;box-shadow:-14px 0 46px #0d284855;display:flex;flex-direction:column}
 .demo-cart-head{padding:20px;border-bottom:1px solid #e2e7eb;display:flex;justify-content:space-between;gap:12px;align-items:center}
 .demo-cart-head h2{margin:0;color:#0a3158;font:800 25px Manrope,sans-serif}
 .demo-cart-close{border:0;background:#eef3f6;font-size:22px;border-radius:6px;width:40px;height:40px;cursor:pointer}
 .demo-cart-body{padding:19px;overflow:auto;flex:1}
 .demo-cart-item{border:1px solid #e1e7ec;border-radius:9px;padding:14px;margin:0 0 12px}
 .demo-cart-item strong{display:block;margin-bottom:6px;color:#153b59}
 .demo-cart-item small{color:#687a89}
 .demo-cart-qty{display:flex;align-items:center;gap:10px;margin-top:11px}
 .demo-cart-qty button{width:34px;height:34px;border:1px solid #d4dfe8;border-radius:6px;background:#fff;cursor:pointer;font-size:17px}
 .demo-cart-qty .demo-remove{width:auto;height:auto;font-size:12px;margin-left:auto;color:#a13f2e;border:0;background:none}
 .demo-cart-foot{border-top:1px solid #e3e8ec;padding:20px}
 .demo-cart-total{display:flex;justify-content:space-between;gap:10px;font:800 20px Manrope,sans-serif;color:#0a3158}
 .demo-cart-wa{display:block;background:#168b5b;color:#fff;border-radius:8px;margin-top:12px;padding:14px 12px;text-align:center;text-decoration:none;font-weight:900}.demo-cart-wa[hidden]{display:none!important}.demo-cart-disabled{width:100%;padding:15px;margin-top:15px;background:#d9e1e7;color:#5e6c78;border:0;border-radius:8px;font-weight:900;cursor:not-allowed}
 .demo-cart-summary-button{width:100%;padding:14px 12px;margin-top:15px;background:#f7942e;color:#16354a;border:0;border-radius:8px;font-weight:900;cursor:pointer}.demo-cart-summary-button:disabled{background:#d9e1e7;color:#5e6c78;cursor:not-allowed}.demo-cart-summary[hidden]{display:none!important}.demo-cart-summary{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7fa;border:1px solid #dce5eb;border-radius:8px;padding:14px;margin:14px 0 2px;color:#173851;font:13px/1.55 system-ui,sans-serif}.demo-cart-caption{color:#647888;font-size:12px;line-height:1.5;margin:10px 0 0}
 .demo-cart-float{position:fixed;bottom:19px;right:20px;z-index:70;background:#f7942e;border:none;color:#12314a;border-radius:100px;box-shadow:0 7px 28px #0e304b40;padding:13px 16px;font-size:14px;font-weight:900;cursor:pointer}
 @media(max-width:650px){.demo-cart-float{right:12px;bottom:73px;padding:12px 15px}.demo-cart-head h2{font-size:23px}}
 `;
 page=page.replace('</style>',cartCss+'</style>');
 const cartUi='<div class="demo-cart-curtain" data-demo-curtain hidden></div>'+
  '<aside class="demo-cart-drawer" data-demo-drawer role="dialog" aria-modal="true" aria-label="Tu carrito de prueba" hidden>'+
  '<div class="demo-cart-head"><h2>Tu carrito</h2><button type="button" class="demo-cart-close" data-demo-close aria-label="Cerrar carrito">×</button></div>'+
  '<div class="demo-cart-body" data-demo-lines></div><div class="demo-cart-foot">'+
  '<div class="demo-cart-total"><span>Total de productos</span><strong data-demo-total>$ 0</strong></div>'+
  '<button class="demo-cart-summary-button" type="button" data-demo-preview disabled>Preparar pedido para WhatsApp (prueba)</button><pre class="demo-cart-summary" data-demo-summary hidden></pre><a class="demo-cart-wa" data-demo-whatsapp hidden target="_blank" rel="noopener noreferrer">Abrir WhatsApp para consultar</a>'+
  '<p class="demo-cart-caption">Los precios se actualizan desde Google Sheets. Al abrir WhatsApp vos decidís si enviás el mensaje. Saber debe confirmar disponibilidad y precio final; no se generan reservas ni pagos.</p>'+
  '</div></aside>'+
  '<button type="button" class="demo-cart-float" data-demo-open>Carrito <span data-demo-badge>0</span></button>';
 page=page.replace('</body>',cartUi+'</body>');
 const cartScript='<script>'+carritoV3Cliente.replace('/*CATALOGO_INICIAL*/',rawData)+'</script>';

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
 page=page.replace('<body>','<body>'+aviso+'<div data-live-status role="status" style="text-align:center;padding:8px 12px;background:#f3f7fa;color:#36576b;font:700 12px/1.5 system-ui,sans-serif">Cargando precios de Google Sheets...</div>');
 page=page.replace('</body>',harmlessScript+cartScript+'</body>');
 return page;
}
