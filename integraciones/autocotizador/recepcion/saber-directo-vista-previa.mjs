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
 const aviso='<div id="preview-aviso" role="status" style="background:#0a3158;color:#fff;padding:11px 16px;text-align:center;font:700 13px/1.4 system-ui,sans-serif">VISTA DE DISEÑO · SIN CONTRASEÑA · No se realizan pedidos ni pagos.</div>';

 // Muestra estática y fechada de la hoja pública "Productos web (MODELO)".
 // Es independiente de la tienda: NO define stock ni precios operativos.
 // En producción, las páginas originales siguen usando el CSV publicado.
 const modelo=[
  {cat:'Escolar',name:'Resaltador Filgo x 4 pastel',desc:'Resaltador cuerpo chato pastel',precio:5400,oferta:4500,photo:'1h1LuTjbxOHLBz5LjwRnedTDGu7xSt8Ew'},
  {cat:'Escolar',name:'Marcadores Jumbo Sabonis x 12',desc:'12 colores punta mediana alta duración',precio:7500,oferta:6500,photo:'1NAzMD691MCl7EVd8ezeEMu0Higk1INn7'},
  {cat:'Oficina',name:'Resma A4 P AMPA 70 g',desc:'500 hojas',precio:8000,oferta:8000,photo:'1_j9dvL-8db2nJ01xKmjlZO3gbY1qrXOH'},
  {cat:'Escolar',name:'Bolígrafo borrable',desc:'Personajes varios',precio:4900,oferta:0,photo:'1XvxoMqFsU7FvgL6u3KZ_KZgeI04e6dlc'}
 ];
 const foto=p=>'https://drive.google.com/thumbnail?id='+p.photo+'&sz=w1200';
 const money=n=>'$ '+new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n);
 const safe=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const rebaja=p=>p.oferta>0&&p.oferta<p.precio;
 const card=p=>'<article class="v3-sample-offer"><img src="'+foto(p)+'" alt="'+safe(p.name)+'" loading="lazy" decoding="async">'+
  '<div><small>'+safe(p.cat)+' · ARTÍCULO DE LA PLANILLA MODELO</small><strong>'+safe(p.name)+'</strong>'+
  '<p>'+safe(p.desc)+'</p><div class="v3-sample-price"><b>'+money(rebaja(p)?p.oferta:p.precio)+'</b>'+
  (rebaja(p)?'<del>'+money(p.precio)+'</del>':'')+'</div></div></article>';
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
