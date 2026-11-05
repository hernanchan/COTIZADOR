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
   // La vista pública de diseño no consulta la planilla ni muestra precios.
   const visualProducts=[
    ['Escolar y papelería','https://images.unsplash.com/photo-1764818958942-f104ba6f8358?auto=format&fit=crop&w=680&q=76'],
    ['Oficina y materiales','https://images.unsplash.com/photo-1625225231874-dc5df462f1ee?auto=format&fit=crop&w=680&q=76'],
    ['Detalles para crear','https://images.unsplash.com/photo-1646809021377-6fe5ba140b4a?auto=format&fit=crop&w=680&q=76']
   ];
   page=page.replace('<div class="empty">Cargando productos…</div>',visualProducts.map(([name,src])=>
      '<div class="v3-sample-offer"><img src="'+src+'" alt="'+name+'" loading="lazy" decoding="async"><div><small>FOTO ILUSTRATIVA · SIN PRECIO</small><strong>'+name+'</strong><p>En la tienda real aparecerán artículos de la planilla, con su fotografía y precio vigente.</p></div></div>'
   ).join(''));
   page=page.replace('Productos publicados desde la misma planilla de Librería Saber. Podés agregarlos al carrito y combinarlos con trabajos de impresión.','Explorá cómo se mostrarán los productos. Esta versión es una vista visual, no una tienda operativa.');
   page=page.replace('</style>',String.raw`
    .v3-sample-offer{background:#fff;border:1px solid #e4e9ed;border-radius:10px;overflow:hidden}
    .v3-sample-offer img{display:block;width:100%;height:245px;object-fit:cover}
    .v3-sample-offer>div{padding:17px}
    .v3-sample-offer small{font-size:9px;color:#bd6c24;letter-spacing:.07em;font-weight:800}
    .v3-sample-offer strong{display:block;font:800 20px Manrope,sans-serif;color:#0a3158;margin:9px 0}
    .v3-sample-offer p{font-size:12px;line-height:1.45;color:#667789}
    @media(max-width:620px){.v3-sample-offer img{height:185px}}
   `+'</style>');

 }else{

   // Fotografías de ambientación con licencia Unsplash. Muestra sin stock ni precios.
   const sampleCards={
     gridEscolar:[
       ['Cuadernos y papel','ESCOLAR','https://images.unsplash.com/photo-1764818958942-f104ba6f8358?auto=format&fit=crop&w=780&q=77'],
       ['Colores para tus ideas','ESCOLAR','https://images.unsplash.com/photo-1646809021377-6fe5ba140b4a?auto=format&fit=crop&w=780&q=77']
     ],
     gridOficina:[
       ['Papel y organización','OFICINA','https://images.unsplash.com/photo-1625225231874-dc5df462f1ee?auto=format&fit=crop&w=780&q=77'],
       ['Material para estudiar','OFICINA','https://images.unsplash.com/photo-1764818958942-f104ba6f8358?auto=format&fit=crop&w=780&q=77']
     ],
     gridNovedades:[
       ['Papelería con onda','NOVEDADES','https://images.unsplash.com/photo-1646809021377-6fe5ba140b4a?auto=format&fit=crop&w=780&q=77'],
       ['Ideas para regalar','NOVEDADES','https://images.unsplash.com/photo-1625225231874-dc5df462f1ee?auto=format&fit=crop&w=780&q=77']
     ]
   };
   const sampleMarkup=id=>'<div class="preview-photo-grid">'+(sampleCards[id]||[]).map(([name,category,img])=>
      '<article class="preview-photo-product"><img src="'+img+'" alt="'+name+'" loading="lazy" decoding="async">'+
      '<div><small>'+category+' · FOTO ILUSTRATIVA</small><strong>'+name+'</strong><p>Próximamente, productos reales y precios del catálogo.</p></div></article>'
   ).join('')+'</div>';
   for(const id of Object.keys(sampleCards)){
     page=page.replace('id="'+id+'"></div>','id="'+id+'">'+sampleMarkup(id)+'</div>');
   }
   page=page.replace('</style>',String.raw`
     .preview-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;grid-column:1/-1}
     .preview-photo-product{background:#fff;min-width:0;border:1px solid #dfe6ea;border-radius:9px;overflow:hidden}
     .preview-photo-product img{width:100%;height:200px;object-fit:cover;display:block}
     .preview-photo-product>div{padding:16px}
     .preview-photo-product small{display:block;font-size:10px;font-weight:900;letter-spacing:.05em;color:#b56622}
     .preview-photo-product strong{display:block;margin:7px 0;font:800 19px/1.2 Manrope,sans-serif;color:#0d3352}
     .preview-photo-product p{font-size:12px;color:#627586;margin:0}
     @media(max-width:650px){.preview-photo-grid{grid-template-columns:1fr}.preview-photo-product img{height:178px}}
   `+'</style>');
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
