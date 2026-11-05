/**
 * Carrito retail V3 SOLO vista de ensayo (HTML seguro sin script comercial antiguo).
 * Revalida precios del CSV publicado por el Worker ANTES de preparar WhatsApp.
 * El enlace wa.me requiere un segundo clic humano y no envía el mensaje.
 */
export const carritoV3Cliente=String.raw`
(function(){
 'use strict';
 const path='/prueba-v2/diseno-sin-clave/catalogo.json';
 const key='saber_v3_carrito_ensayo';
 let catalog=/*CATALOGO_INICIAL*/;
 let byCode=new Map(catalog.map(x=>[x.code,x]));
 let cart=Object.create(null),live=false,validatedAt=0,previousFocus=null;
 const drawer=document.querySelector('[data-demo-drawer]'),curtain=document.querySelector('[data-demo-curtain]');
 const summary=document.querySelector('[data-demo-summary]'),wa=document.querySelector('[data-demo-whatsapp]');
 const status=document.querySelector('[data-live-status]');
 const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function say(message,bad=false){if(status){status.textContent=message;status.style.color=bad?'#a33e31':'#246149'}}
 function save(){try{sessionStorage.setItem(key,JSON.stringify(cart))}catch(_){}}
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||'{}');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved))
   for(const [code,qty] of Object.entries(saved))
    if(byCode.has(code)&&Number.isSafeInteger(qty)&&qty>0&&qty<=99)cart[code]=qty;
 }catch(_){}
 function clearDraft(){summary.textContent='';summary.hidden=true;wa.removeAttribute('href');wa.hidden=true;validatedAt=0}
 function render(){
  let count=0,total=0;
  const lines=[];
  for(const [code,qty] of Object.entries(cart)){
   const p=byCode.get(code);
   if(!p||!Number.isSafeInteger(qty)||qty<1)continue;
   count+=qty;total+=p.price*qty;
   lines.push('<div class="demo-cart-item"><strong>'+esc(p.name)+'</strong><small>'+
    money(p.price)+' c/u · '+money(p.price*qty)+'</small><div class="demo-cart-qty">'+
    '<button type="button" data-demo-step="-1" data-demo-code="'+esc(code)+'" aria-label="Quitar uno">−</button>'+
    '<b>'+qty+'</b><button type="button" data-demo-step="1" data-demo-code="'+esc(code)+'" aria-label="Agregar uno">+</button>'+
    '<button type="button" class="demo-remove" data-demo-remove="'+esc(code)+'">Eliminar</button></div></div>');
  }
  document.querySelector('[data-demo-lines]').innerHTML=lines.join('')||'<p>Tu carrito está vacío. Elegí un producto para comenzar.</p>';
  document.querySelector('[data-demo-total]').textContent=money(total);
  document.querySelectorAll('[data-demo-badge]').forEach(el=>el.textContent=count);
  document.querySelector('[data-demo-preview]').disabled=!live||count===0;
  clearDraft();
 }
 function card(p){
  const offer=p.offer>0&&p.offer<p.regularPrice;
  const img=p.photo?'<img src="'+esc(p.photo)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">':'';
  return '<article class="v3-sample-offer">'+img+'<div><small>'+esc(p.cat)+' · CATÁLOGO ACTUAL</small>'+
   '<strong>'+esc(p.name)+'</strong><p>'+esc(p.desc||'')+'</p>'+
   '<div class="v3-sample-price"><b>'+money(p.price)+'</b>'+
   (offer?'<del>'+money(p.regularPrice)+'</del>':'')+'</div>'+
   '<button class="v3-sample-add" type="button" data-demo-add="'+esc(p.code)+'">Agregar al carrito</button></div></article>';
 }
 function fillGrid(items){return '<div class="visual-sheet-grid">'+
  (items.length?items.map(card).join(''):'<p>No hay artículos activos en esta sección.</p>')+
  '<p class="v3-sample-note">Precios consultados ahora en Google Sheets. Disponibilidad y precio final sujetos a confirmación de Librería Saber.</p></div>'}
 function renderCatalog(){
  const all=document.getElementById('grid');
  if(all){
   const cat=((new URLSearchParams(location.search)).get('categoria')||'').trim().toUpperCase();
   all.innerHTML=fillGrid(cat?catalog.filter(p=>p.cat.toUpperCase()===cat):
    catalog.filter(p=>p.offer>0&&p.offer<p.regularPrice));
  }else{
   for(const [id,cat] of [['gridEscolar','ESCOLAR'],['gridOficina','OFICINA'],['gridNovedades','NOVEDADES']]){
    const el=document.getElementById(id);
    if(el)el.innerHTML=fillGrid(catalog.filter(p=>p.cat.toUpperCase()===cat).slice(0,2));
   }
  }
 }
 async function refresh(){
  live=false;clearDraft();document.querySelector('[data-demo-preview]').disabled=true;
  const response=await fetch(path,{method:'GET',cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Lectura de catálogo fallida');
  const data=await response.json();
  if(!data.ok||!Array.isArray(data.products)||data.products.length<1||data.products.length>500)
   throw Error('Catálogo sin artículos válidos');
  const fresh=data.products.map(p=>({
   code:String(p.code),name:String(p.name),cat:String(p.cat),desc:String(p.desc||''),
   regularPrice:Number(p.price),offer:p.offer===null?null:Number(p.offer),
   price:Number(p.finalPrice),photo:p.photo||null
  })).filter(p=>/^[a-zA-Z0-9_-]{1,48}$/.test(p.code)&&Number.isSafeInteger(p.price)&&p.price>0);
  if(!fresh.length)throw Error('No hay artículos para consultar');
  catalog=fresh;byCode=new Map(fresh.map(p=>[p.code,p]));
  let removed=0;
  for(const code of Object.keys(cart))if(!byCode.has(code)){delete cart[code];removed++}
  save();live=true;renderCatalog();render();
  say(removed?'Actualizamos precios y quitamos del carrito los productos que ya no están activos.':
   'Catálogo y precios actualizados desde Google Sheets. Ya podés preparar una consulta.');
 }
 function open(){
  previousFocus=document.activeElement;
  drawer.hidden=false;curtain.hidden=false;
  drawer.querySelector('[data-demo-close]').focus();
 }
 function close(){
  drawer.hidden=true;curtain.hidden=true;
  if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus();
 }
 async function prepare(){
  say('Comprobando precios actuales antes de preparar WhatsApp...');
  try{await refresh()}catch(e){
   say('No se pudieron verificar los precios. La consulta está desactivada hasta recuperar la conexión.',true);
   return;
  }
  const items=Object.entries(cart).filter(([code,qty])=>byCode.has(code)&&Number.isSafeInteger(qty)&&qty>0);
  if(!items.length){say('El carrito no tiene artículos disponibles para consultar.',true);return}
  let total=0;
  const lines=['Hola, Librería Saber. Quisiera consultar por estos artículos:','','ARTÍCULOS'];
  for(const [code,qty] of items){
   const p=byCode.get(code),sub=p.price*qty;
   total+=sub;lines.push(qty+' × '+p.name+' ('+code+') — '+money(sub));
  }
  lines.push('','TOTAL ORIENTATIVO: '+money(total),'',
   '¿Me confirman disponibilidad y precio final?','El pedido no está reservado ni pagado.');
  const message=lines.join('\n');
  summary.textContent=message;summary.hidden=false;
  wa.setAttribute('href','https://wa.me/5493513110130?text='+encodeURIComponent(message));
  wa.hidden=false;validatedAt=Date.now();
  say('Mensaje actualizado. Tocá «Abrir WhatsApp» para revisarlo; solo vos decidís si lo enviás.');
  summary.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 document.addEventListener('click',async event=>{
  const el=event.target;
  if(!(el instanceof Element))return;
  const add=el.closest('[data-demo-add]');
  if(add){
   if(!live){say('Primero necesitamos verificar los precios de la planilla.',true);return}
   const code=add.getAttribute('data-demo-add');if(!byCode.has(code))return;
   cart[code]=Math.min(99,(cart[code]||0)+1);save();render();open();return;
  }
  const change=el.closest('[data-demo-step]');
  if(change){
   const code=change.getAttribute('data-demo-code'),step=Number(change.getAttribute('data-demo-step'));
   if(!byCode.has(code)||![-1,1].includes(step))return;
   const next=(cart[code]||0)+step;
   if(next<=0)delete cart[code];else cart[code]=Math.min(99,next);
   save();render();return;
  }
  const remove=el.closest('[data-demo-remove]');
  if(remove){delete cart[remove.getAttribute('data-demo-remove')];save();render();return}
  if(el.closest('[data-demo-preview]')){await prepare();return}
  if(el.closest('[data-demo-whatsapp]')){
   if(!validatedAt||Date.now()-validatedAt>60000||!wa.getAttribute('href')){
    event.preventDefault();clearDraft();
    say('El mensaje ya no está vigente. Prepará nuevamente tu consulta.',true);
   }
   return;
  }
  if(el.closest('[data-demo-open],.cart-open,.mcart')){open();return}
  if(el.closest('[data-demo-close],[data-demo-curtain]')){close();return}
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!drawer.hidden)close()});
 render();
 refresh().catch(()=>say('No se pudieron verificar los precios. Esta es una muestra ilustrativa; las consultas están desactivadas.',true));
})();
`;
