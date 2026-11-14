/**
 * VISTA PREVIA VISUAL (NO cotizador): Worker aislado, sin imports de LIVE,
 * sin bind de D1/R2/TUS/MP, sin APIs ni transferencias de archivos.
 * Probar la usabilidad desde cualquier celular antes de habilitar la UI LIVE.
 */
const html = String.raw\`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#113d62">
<title>Vista previa móvil · Librería Saber</title>
<style>
:root{color-scheme:light;--navy:#103b60;--blue:#155c8a;--orange:#f19830;--pale:#f3f7fb;--stroke:#d8e3ee;--ink:#20394d;--muted:#63798c;--success:#0c6847}
*{box-sizing:border-box}
body{margin:0;background:#eaf0f5;color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
button,input,select{font:inherit}
button{cursor:pointer;min-height:48px;border-radius:12px;border:0;font-weight:750;transition:background-color .1s}
button:disabled{opacity:.45;cursor:not-allowed}
button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #f4b25d;outline-offset:2px}
.shell{max-width:470px;margin:24px auto;background:#f9fbfd;min-height:740px;box-shadow:0 14px 60px #123b5b24;overflow:hidden;border-radius:22px}
header{background:var(--navy);color:white;padding:16px 19px 15px;display:flex;gap:12px;align-items:center}
.logo{width:47px;height:47px;border-radius:50%;display:grid;place-items:center;background:var(--orange);color:var(--navy);font-size:17px;font-weight:1000;border:3px solid white}
.brand{min-width:0;flex:1}.brand strong{display:block;font-size:19px;letter-spacing:-.02em}.brand small{display:block;color:#c8dcea;font-size:12px}
.demo{display:block;margin:0;background:#fff5e8;color:#764409;padding:10px 19px;font-size:13px;border-bottom:1px solid #f2dabc;font-weight:600}
main{padding:18px 16px 115px}
.headline{display:flex;justify-content:space-between;align-items:center;gap:8px}
.overline{color:var(--blue);font-size:13px;font-weight:850;letter-spacing:.03em}
.stepnum{color:#53748a;font-size:13px;font-weight:750}
.meter{height:6px;border-radius:9px;background:#d9e5ef;margin:13px 0 24px;overflow:hidden}
.meter span{display:block;background:var(--orange);width:25%;height:100%;transition:width .15s}
h1{font-size:26px;color:var(--navy);letter-spacing:-.035em;line-height:1.15;margin:0 0 9px}
.lead{color:#5d7388;font-size:15px;margin:0 0 23px}
.card{background:white;border:1px solid var(--stroke);border-radius:15px;padding:17px;margin:13px 0;box-shadow:0 2px 6px #0a284610}
.upload{border:2px dashed #91b8d5;background:#eff8ff;padding:25px 16px;text-align:center;border-radius:15px;display:grid;gap:9px}
.upload-icon{display:grid;place-items:center;border-radius:15px;background:white;color:var(--blue);font-size:31px;width:56px;height:56px;margin:0 auto 4px}
.upload strong{font-size:18px;color:var(--navy)}
.upload p{font-size:13px;color:var(--muted);margin:0}
.pick{display:block;background:var(--blue);color:white;border-radius:11px;padding:13px;margin-top:9px;font-size:16px;font-weight:800;min-height:49px;cursor:pointer}
.pick input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.tip{display:flex;gap:10px;font-size:13px;color:#426078;padding:13px 3px}
.file{display:flex;gap:11px;align-items:flex-start;padding:13px 0;border-bottom:1px solid #e3eaf0;min-width:0}
.file:last-child{border-bottom:0}
.file-icon{background:#e9f2f9;color:var(--blue);width:35px;height:39px;border-radius:8px;display:grid;place-items:center;font-weight:850;font-size:12px;flex:none}
.file-body{flex:1;min-width:0}.file-body strong{display:block;font-size:14px;overflow-wrap:anywhere}.file-body small{display:block;color:var(--muted)}
.remove{background:#edf3f8;color:var(--blue);min-height:34px;padding:4px 9px;font-size:12px}
.mini{font-size:13px;color:var(--muted);font-weight:650}
.group-title{font-size:13px;font-weight:850;color:#48647a;text-transform:uppercase;letter-spacing:.055em;margin:20px 0 9px}
.choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.choice{min-width:0;min-height:65px;text-align:left;background:#fff;border:1.5px solid #becfdc;padding:12px 13px;color:#294760;font-weight:750}
.choice small{display:block;font-size:12px;color:#6a7f90;font-weight:500;margin-top:3px}
.choice.on{border-color:var(--blue);background:#e9f4fc;box-shadow:inset 0 0 0 1px var(--blue);color:#0d4a74}
.choice.on:before{content:"✓";font-size:12px;margin-right:6px;color:#087047}
.field{display:grid;gap:7px;font-weight:700;font-size:15px}
.field input{width:100%;height:48px;border-radius:10px;border:1.5px solid #b7cbdc;padding:0 13px;background:white;color:var(--ink)}
.tabs{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0}
.tabs strong{font-size:14px}
.subtle{background:#e9f0f6;color:#22577a;padding:10px 13px;min-height:43px}
.summary{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #e0e8ee}
.summary:last-child{border:0}
.summary strong{font-size:15px}.summary small{display:block;color:var(--muted);font-size:12px}
.estimate{background:#ebf5fc;border:1px solid #b8d7ec;border-radius:14px;padding:18px}
.estimate strong{font-size:20px;color:var(--navy)}
.estimate p{font-size:13px;margin:5px 0 0;color:#4f6f85}
.label{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#5b7387;font-weight:850}
.bottom{position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;gap:12px;background:white;border-top:1px solid var(--stroke);padding:13px 17px max(14px,env(safe-area-inset-bottom));z-index:3}
.bottom .money{min-width:0}.bottom .money small{display:block;color:#637a8a;font-size:12px;font-weight:750}.bottom .money strong{font-size:17px;color:var(--navy);display:block}
.primary{background:var(--blue);color:white;padding:13px 15px;min-width:136px}
.secondary{background:#e8f1f7;color:var(--blue);padding:13px 14px}
.actions{display:flex;gap:10px;margin:15px 0}
.actions button{flex:1}
.notice{background:#fff7e9;border:1px solid #f0d8b5;border-radius:11px;padding:12px;color:#805319;font-size:13px;margin:12px 0}
.empty{color:#59718a;text-align:center;padding:18px}
[hidden]{display:none!important}
@media(max-width:520px){body{background:#f9fbfd}.shell{border-radius:0;box-shadow:none;margin:0;max-width:none;min-height:100dvh}main{padding:18px 16px 100px}.bottom{position:fixed;left:0;right:0;bottom:0}}
@media(min-width:521px){.bottom{position:sticky;bottom:0}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="shell">
<header><div class="logo">SVR</div><div class="brand"><strong>Librería Saber</strong><small>Impresiones, ploteos y gráfica</small></div><span aria-hidden="true">☰</span></header>
<p class="demo">VISTA PREVIA · Solo diseño. No se suben archivos, no se calculan precios y no hay pagos.</p>
<main>
<div class="headline"><span class="overline">PREPARÁ TU PEDIDO</span><span class="stepnum" id="step-label">Paso 1 de 4</span></div>
<div class="meter" aria-hidden="true"><span id="meter"></span></div>
<section id="step1">
<h1>Elegí tus archivos</h1><p class="lead">Empezá por lo que querés imprimir. Podés elegir varios juntos.</p>
<div class="upload"><span class="upload-icon" aria-hidden="true">↑</span><strong>Seleccioná tus PDF o fotos</strong>
<p>PDF, JPG o PNG. Hasta 10 archivos para esta demostración.</p>
<label class="pick" for="file-picker">Elegir archivos<input id="file-picker" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple></label></div>
<div class="card" id="file-list"><p class="empty">Podés elegir tus propios archivos o usar el ejemplo de abajo.</p></div>
<button id="example" class="subtle" style="width:100%">Usar archivo de ejemplo</button>
<div class="tip"><span>🔒</span><span>Los archivos que elijas se muestran solo en este dispositivo. Esta demo no lee su contenido ni los envía a ningún servidor.</span></div>
</section>
<section id="step2" hidden>
<h1>¿Cómo querés imprimir?</h1><p class="lead">Las medidas se detectarán en el cotizador real. Acá podés probar la forma de elegir las opciones.</p>
<div class="card"><div class="tabs"><div><div class="mini" id="file-position">ARCHIVO 1 DE 1</div><strong id="file-name">Documento.pdf</strong></div><span class="file-icon">PDF</span></div></div>
<div class="group-title">Color</div>
<div class="choice-grid" data-key="color"><button class="choice on" data-value="bn" type="button">Blanco y negro<small>Escala de grises</small></button><button class="choice" data-value="color" type="button">A color<small>Impresión color</small></button></div>
<div class="group-title">Caras</div>
<div class="choice-grid" data-key="faces"><button class="choice on" data-value="simple" type="button">Simple faz<small>Una cara por hoja</small></button><button class="choice" data-value="double" type="button">Doble faz<small>Ambas caras</small></button></div>
<div class="group-title">Páginas por cara</div>
<div class="choice-grid" data-key="nup"><button class="choice on" data-value="1" type="button">1 página<small>Tamaño normal</small></button><button class="choice" data-value="2" type="button">2 páginas<small>Ahorrá papel</small></button></div>
<div class="group-title">Terminación</div>
<div class="choice-grid" data-key="binding"><button class="choice on" data-value="no" type="button">Sin anillado</button><button class="choice" data-value="yes" type="button">Con anillado</button></div>
<div class="card"><label class="field" for="copies">Cantidad de copias<input id="copies" type="number" min="1" max="200" value="1" inputmode="numeric"></label></div>
<div class="notice">Los tamaños A4, Legal, A3 y ploteos se determinarán por el contenido del archivo real. Esta vista no analiza el PDF.</div>
<div class="actions"><button class="secondary" id="previous-file" type="button">Archivo anterior</button><button class="secondary" id="next-file" type="button">Archivo siguiente</button></div>
</section>
<section id="step3" hidden>
<h1>Revisá tu pedido</h1><p class="lead">Este es el resumen que verías antes de completar tus datos y pagar.</p>
<div class="card" id="review"></div>
<div class="estimate"><div class="label">Tu precio a pagar</div><strong>Se calculará en el cotizador real</strong><p>La versión comercial mostrará aquí el total exacto y la fecha máxima estimada de entrega.</p></div>
</section>
<section id="step4" hidden>
<h1>Datos y pago</h1><p class="lead">Última pantalla antes de confirmar un pedido.</p>
<div class="card"><label class="field">Nombre o responsable<input type="text" placeholder="Nombre y apellido" disabled></label><br>
<label class="field">Teléfono<input type="tel" placeholder="351 555 5555" disabled></label><br>
<label class="field">Dirección (opcional)<input type="text" placeholder="Calle y número" disabled></label></div>
<div class="estimate"><div class="label">Medios de pago</div><strong>Mercado Pago o transferencia</strong><p>Desactivados en esta demo. En la web comercial el pago se realiza únicamente tras confirmar el presupuesto.</p></div>
<button class="primary" disabled style="width:100%;margin-top:16px">Confirmar y pagar (no disponible en demo)</button>
</section>
</main>
<footer class="bottom" aria-label="Navegación del asistente">
<div class="money"><small id="bottom-label">PRECIO</small><strong id="bottom-amount">Por calcular</strong></div>
<button class="primary" id="next" type="button" disabled>Continuar →</button>
</footer>
</div>
<script>
(() => {
 'use strict';
 const $=x=>document.getElementById(x);
 const all = ['step1','step2','step3','step4'];
 const state = {step:1,idx:0,files:[],settings:[]};
 const defaults = () => ({color:'bn',faces:'simple',nup:'1',binding:'no',copies:1});
 const nameFrom = file => file.name.slice(0,130);
 function text(tag,value,cls=''){
   const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;
 }
 function fileRow(file,i){
   const row=text('div','', 'file');
   const ico=text('span',file.name.toLowerCase().endsWith('.pdf')?'PDF':'IMG','file-icon');
   const body=text('div','','file-body');
   body.append(text('strong',nameFrom(file)));
   body.append(text('small',file.demo?'Archivo ilustrativo':(file.size/1048576).toFixed(1).replace('.',',')+' MB · No se transmite'));
   const remove=text('button','Quitar','remove');remove.type='button';remove.onclick=()=>{
     state.files.splice(i,1);state.settings.splice(i,1);state.idx=0;refresh();
   };
   row.append(ico,body,remove);return row;
 }
 function renderFiles(){
   $('file-list').replaceChildren();
   if(!state.files.length){$('file-list').append(text('p','No hay archivos seleccionados.','empty'));return}
   for(let i=0;i<state.files.length;i++)$('file-list').append(fileRow(state.files[i],i));
 }
 function renderOptions(){
   const file=state.files[state.idx];
   if(!file)return;
   $('file-position').textContent='ARCHIVO '+(state.idx+1)+' DE '+state.files.length;
   $('file-name').textContent=nameFrom(file);
   const setting=state.settings[state.idx];
   for(const group of document.querySelectorAll('[data-key]')){
     const key=group.dataset.key;
     group.querySelectorAll('button').forEach(btn=>{
       const selected=btn.dataset.value===String(setting[key]);
       btn.classList.toggle('on',selected);
       btn.setAttribute('aria-pressed',String(selected));
     });
   }
   $('copies').value=String(setting.copies);
   $('previous-file').disabled=state.idx===0;
   $('next-file').disabled=state.idx===state.files.length-1;
 }
 function renderReview(){
   $('review').replaceChildren();
   state.files.forEach((f,i)=>{
     const s=state.settings[i],r=text('div','','summary');
     const left=text('div','');left.append(text('strong',nameFrom(f)));
     const color=s.color==='bn'?'B/N':'Color';
     const faces=s.faces==='simple'?'Simple faz':'Doble faz';
     left.append(text('small',color+' · '+faces+' · '+s.nup+' por cara · '+s.copies+' copia(s) · '+(s.binding==='yes'?'Con anillado':'Sin anillado')));
     r.append(left,text('span','✓'));$('review').append(r);
   });
 }
 function refresh(){
   renderFiles();
   all.forEach((id,i)=>$(id).hidden=i!==state.step-1);
   $('step-label').textContent='Paso '+state.step+' de 4';
   $('meter').style.width=(state.step*25)+'%';
   $('next').textContent=state.step===4?'Volver al inicio':state.step===3?'Tus datos →':'Continuar →';
   $('next').disabled=state.step===1&&!state.files.length;
   if(state.step===2)renderOptions();
   if(state.step===3)renderReview();
   $('bottom-label').textContent=state.step===4?'SOLO DEMOSTRACIÓN':'PRECIO';
   $('bottom-amount').textContent=state.step===4?'Sin cobros':'Por calcular';
 }
 $('file-picker').addEventListener('change',event=>{
   const items=Array.from(event.target.files||[]).slice(0,10);
   state.files=items.map(f=>({name:f.name,size:f.size,demo:false}));
   state.settings=items.map(defaults);state.idx=0;refresh();
   event.target.value='';
 });
 $('example').addEventListener('click',()=>{
   state.files=[{name:'Apunte de Matemática.pdf',size:0,demo:true}];
   state.settings=[defaults()];state.idx=0;refresh();
 });
 for(const group of document.querySelectorAll('[data-key]')){
   group.addEventListener('click',event=>{
     const btn=event.target.closest('button[data-value]');if(!btn||!state.settings[state.idx])return;
     state.settings[state.idx][group.dataset.key]=btn.dataset.value;
     renderOptions();
   });
 }
 $('copies').addEventListener('change',event=>{
   const n=Number(event.target.value);
   const x=Number.isSafeInteger(n)?Math.min(200,Math.max(1,n)):1;
   event.target.value=String(x);
   if(state.settings[state.idx])state.settings[state.idx].copies=x;
 });
 $('previous-file').addEventListener('click',()=>{if(state.idx>0){state.idx--;renderOptions()}});
 $('next-file').addEventListener('click',()=>{if(state.idx<state.files.length-1){state.idx++;renderOptions()}});
 $('next').addEventListener('click',()=>{
   if(state.step===1&&!state.files.length)return;
   state.step=state.step===4?1:state.step+1;
   window.scrollTo({top:0,behavior:'instant'});
   refresh();
 });
 refresh();
})();
</script>
</body></html>\`;

export default {
 async fetch(request) {
  const url=new URL(request.url);
  if(request.method!=='GET'||!['/','/index.html'].includes(url.pathname))
   return new Response('No disponible',{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(html,{status:200,headers:{
   'Content-Type':'text/html; charset=utf-8',
   'Cache-Control':'no-store',
   'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",
   'X-Robots-Tag':'noindex,nofollow,noarchive','X-Content-Type-Options':'nosniff',
   'Referrer-Policy':'no-referrer'
  }});
 }
};
