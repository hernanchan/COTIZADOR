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

export function prepararVistaDisenoAbierta(html,{ofertas=false,categoria=''}={}){
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
 const aviso='<div id="preview-aviso" role="status" style="background:#0a3158;color:#fff;padding:11px 16px;display:flex;align-items:center;justify-content:center;gap:15px;flex-wrap:wrap;text-align:center;font:700 13px/1.4 system-ui,sans-serif"><span>VISTA DE DISEÑO · SIN CONTRASEÑA · Carrito de prueba. No se realizan pedidos ni pagos.</span><button type="button" class="demo-cart-trigger" data-demo-open>Ver carrito <span data-demo-badge>0</span></button></div>';

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
   page=page.replace('<h2 id="promoTitle">Promoción semanal</h2>','<h2 id="promoTitle">Promoción del día</h2>');
   page=page.replace('<p id="promoText">El cotizador aplica automáticamente el beneficio vigente.</p>','<p id="promoText">Aquí aparecerá la promoción vigente cuando se habiliten los pedidos.</p>');
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
 .demo-cart-disabled{width:100%;padding:15px;margin-top:15px;background:#d9e1e7;color:#5e6c78;border:0;border-radius:8px;font-weight:900;cursor:not-allowed}
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
  '<button class="demo-cart-summary-button" type="button" data-demo-preview disabled>Preparar pedido para WhatsApp (prueba)</button><pre class="demo-cart-summary" data-demo-summary hidden></pre><button class="demo-cart-disabled" type="button" disabled>Enviar pedido (desactivado)</button>'+
  '<p class="demo-cart-caption">Modo prueba: podés agregar y quitar productos, pero no se envían pedidos, archivos ni pagos. Los precios pertenecen a la planilla MODELO al 05/11/2026.</p>'+
  '</div></aside>'+
  '<button type="button" class="demo-cart-float" data-demo-open>Carrito <span data-demo-badge>0</span></button>';
 page=page.replace('</body>',cartUi+'</body>');
 const cartScript='<script>(function(){'+
  'const catalog='+rawData+';'+
  "const byCode=Object.fromEntries(catalog.map(x=>[x.code,x]));"+
  "const key='saber_v3_carrito_ensayo';"+
  'let cart={};let previousFocus=null;'+
  "const store=()=>{try{sessionStorage.setItem(key,JSON.stringify(cart))}catch(e){}};"+
  "try{const saved=JSON.parse(sessionStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [code,qty] of Object.entries(saved))if(byCode[code]&&Number.isSafeInteger(qty)&&qty>0&&qty<=99)cart[code]=qty}catch(e){};"+
  "const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);"+
  "const drawer=document.querySelector('[data-demo-drawer]');const curtain=document.querySelector('[data-demo-curtain]');"+
  "function render(){let count=0,total=0;const lines=[];for(const [code,qty] of Object.entries(cart)){const product=byCode[code];if(!product)continue;count+=qty;total+=qty*product.price;"+
  "lines.push('<div class=\"demo-cart-item\"><strong>'+product.name+'</strong><small>'+money(product.price)+' c/u · '+money(product.price*qty)+'</small><div class=\"demo-cart-qty\"><button type=\"button\" data-demo-step=\"-1\" data-demo-code=\"'+code+'\" aria-label=\"Quitar uno\">−</button><b>'+qty+'</b><button type=\"button\" data-demo-step=\"1\" data-demo-code=\"'+code+'\" aria-label=\"Agregar uno\">+</button><button type=\"button\" class=\"demo-remove\" data-demo-remove=\"'+code+'\">Eliminar</button></div></div>');}"+
  "document.querySelector('[data-demo-lines]').innerHTML=lines.join('')||'<p>Tu carrito todavía está vacío. Elegí un producto y agregalo.</p>';"+
  "document.querySelector('[data-demo-total]').textContent=money(total);document.querySelectorAll('[data-demo-badge]').forEach(el=>el.textContent=count);document.querySelector('[data-demo-preview]').disabled=count===0;document.querySelector('[data-demo-summary]').hidden=true;}"+
  "function open(){previousFocus=document.activeElement;drawer.hidden=false;curtain.hidden=false;drawer.querySelector('[data-demo-close]').focus()}"+
  "function close(){drawer.hidden=true;curtain.hidden=true;if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus()}"+
  "document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element))return;const add=target.closest('[data-demo-add]');if(add){const code=add.getAttribute('data-demo-add');if(byCode[code]){cart[code]=Math.min(99,(cart[code]||0)+1);store();render();open()}return}"+
  "const step=target.closest('[data-demo-step]');if(step){const code=step.getAttribute('data-demo-code');const delta=Number(step.getAttribute('data-demo-step'));if(byCode[code]&&[-1,1].includes(delta)){const qty=(cart[code]||0)+delta;if(qty<=0)delete cart[code];else cart[code]=Math.min(99,qty);store();render()}return}"+
  "const summary=target.closest('[data-demo-preview]');if(summary){const entries=Object.entries(cart).filter(([code,qty])=>byCode[code]&&Number.isSafeInteger(qty)&&qty>0);if(!entries.length)return;let total=0;const lines=['Hola, Librería Saber. Quisiera consultar por estos artículos:','','PRODUCTOS'];for(const [code,qty] of entries){const p=byCode[code];const subtotal=p.price*qty;total+=subtotal;lines.push(qty+' × '+p.name+' ('+code+') — '+money(subtotal));}lines.push('', 'TOTAL ORIENTATIVO: '+money(total),'', '¿Me confirman disponibilidad y precio vigente antes de finalizar?');const el=document.querySelector('[data-demo-summary]');el.textContent=lines.join('\\n');el.hidden=false;el.scrollIntoView({block:'nearest',behavior:'smooth'});return}const remove=target.closest('[data-demo-remove]');if(remove){delete cart[remove.getAttribute('data-demo-remove')];store();render();return}"+
  "if(target.closest('[data-demo-open],.cart-open,.mcart')){open();return}if(target.closest('[data-demo-close],[data-demo-curtain]')){close();return}});"+
  "document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!drawer.hidden)close()});render();"+
  '})();</script>';

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
 page=page.replace('</body>',harmlessScript+cartScript+'</body>');
 return page;
}
