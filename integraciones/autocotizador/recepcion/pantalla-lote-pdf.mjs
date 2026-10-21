/**
 * Interfaz de ensayo multifichero. NO es un checkout.
 * El archivo sólo se incorpora a la lista una vez que finish confirma recepción.
 * El presupuesto siempre se recalcula con recibos privados en el Worker.
 */
export function paginaLotePdf(sitekey) {
  if(!/^[a-zA-Z0-9._-]{10,200}$/.test(sitekey||''))throw Error('Turnstile ausente');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Librería Saber — Prueba de varios PDF</title>
<style>
*{box-sizing:border-box}body{font:16px system-ui,Arial;background:#edf3f7;color:#183047;margin:0}
main{max-width:800px;margin:4vh auto;background:white;padding:24px;border-radius:14px}
h1{font-size:25px}.note{padding:12px;background:#e7f2fb;border-left:4px solid #2773aa}
.row{display:flex;gap:12px;flex-wrap:wrap}.row>div{flex:1 1 190px}
label{display:block;margin:12px 0 6px;font-weight:600}select,input{width:100%;font:inherit;padding:10px;border:1px solid #b9c7d3;border-radius:6px}
button{padding:11px 16px;border:0;border-radius:7px;background:#16618d;color:white;font:inherit;cursor:pointer;margin:12px 7px 12px 0}
button:disabled{opacity:.5}button.secondary{background:#566b7b}
li{margin:9px 0;overflow-wrap:anywhere}#out{white-space:pre-wrap;line-height:1.6;overflow-wrap:anywhere}
small{color:#586b79}.drop{border:2px dashed #9aaebf;padding:18px;text-align:center;margin:12px 0;border-radius:8px;background:#f6fbff}.drop.over{border-color:#17618e;background:#e9f4ff}#pending li{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#pending select{max-width:200px}#pending button{margin:0}
</style></head><body><main>
<h1>Presupuesto conjunto de varios PDF</h1>
<p class="note">Prueba privada: agregá PDF de uno en uno (hasta cinco sesiones disponibles en total), de hasta 1 MB por archivo. Se acumulan las impresiones compatibles para conseguir mejores precios unitarios. Sin compras ni pagos.</p>
<label for="file">Elegí varios archivos PDF de una sola vez</label>
<input id="file" type="file" accept=".pdf,application/pdf" multiple>
<div id="drop" class="drop" tabindex="0">También podés arrastrar tus PDF hasta acá</div>
<h2>Preparados para enviar</h2><ol id="pending"></ol>
<p><small>Antes de enviar, podés cambiar B/N o Color en cada archivo, quitarlo o agregar otros. Para este piloto, Turnstile debe renovarse antes de cada envío individual.</small></p>
<label>Verificación para enviar el próximo PDF</label>
<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="documentos"></div>
<button id="add" type="button" disabled>Enviar próximo PDF preparado</button>
<h2>Archivos recibidos y listos para cotizar</h2><ol id="files"></ol>
<p><small>Quitar un documento de la cotización no lo elimina del Drive privado ni devuelve el cupo de la sesión piloto.</small></p>
<div class="row"><div><label>Formato común</label><select id="format"><option value="a4">A4</option><option value="a3">A3</option></select></div>
<div><label>Caras</label><select id="faces"><option value="simple">Simple faz</option><option value="double">Doble faz</option></select></div>
<div><label>Copias de cada PDF</label><input id="copies" type="number" value="1" min="1" max="200"></div>
<div><label>Anillado</label><select id="binding"><option value="ninguno">Sin anillado</option><option value="juntos">Todos juntos</option><option value="separados">Por separado</option></select></div></div>
<button id="quote" type="button" disabled>Calcular presupuesto conjunto</button>
<div id="out" role="status" aria-live="polite">Agregá un PDF para comenzar.</div>
<p><small>Precios orientativos de agosto de 2026, no aprobados para cobro. La pestaña debe permanecer abierta durante el ensayo. El piloto no admite compras.</small></p>
</main><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
const $=id=>document.getElementById(id);
const recibidos=[];const pendientes=new Map();const preparados=[];let ocupado=false;
const add=$('add'),quote=$('quote'),out=$('out'),list=$('files'),porEnviar=$('pending');
const say=s=>{out.textContent=s};
const fmt=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
async function hash(b){const a=new Uint8Array(await crypto.subtle.digest('SHA-256',b));return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')}
function base64(b){let s='';for(let i=0;i<b.length;i+=12288)s+=btoa(String.fromCharCode(...b.subarray(i,i+12288)));return s}
async function rpc(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const v=await r.json().catch(()=>null);
 if(!v||!r.ok||v.ok!==true)throw Error(v?.error||'El servidor no confirmó la operación');return v}
function redraw(){
 porEnviar.replaceChildren();
 preparados.forEach((r,i)=>{
  const li=document.createElement('li'),name=document.createElement('span');
  name.textContent=r.file.name+' ('+Math.ceil(r.file.size/1024)+' KB)';
  const mode=document.createElement('select');
  for(const [value,label] of [['bn','Blanco y negro'],['color','Color']]){
   const option=document.createElement('option');option.value=value;option.textContent=label;
   mode.appendChild(option);
  }
  mode.value=r.mode;mode.setAttribute('aria-label','Modo de impresión de '+r.file.name);
  mode.addEventListener('change',()=>{r.mode=mode.value;say('Modo actualizado.');});
  const remove=document.createElement('button');
  remove.type='button';remove.className='secondary';remove.textContent='Quitar';
  remove.addEventListener('click',()=>{preparados.splice(i,1);redraw()});
  li.append(name,mode,remove);porEnviar.appendChild(li);
 });
 list.replaceChildren();recibidos.forEach((r,i)=>{
 const li=document.createElement('li');li.appendChild(document.createTextNode(r.name+' — '+(r.mode==='bn'?'B/N':'Color')+' '));
 const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='Quitar de la cotización';
 b.addEventListener('click',()=>{recibidos.splice(i,1);redraw();say('Lista modificada. Volvé a calcular el presupuesto.')});
 li.appendChild(b);list.appendChild(li)});
 quote.disabled=ocupado||recibidos.length===0;
 add.disabled=ocupado||preparados.length===0||recibidos.length>=5;
}
function enqueue(files){
 const items=Array.from(files||[]);
 for(const file of items){
  if(preparados.length+recibidos.length>=5){say('El ensayo admite hasta cinco archivos en la lista.');break;}
  if(!/\\.pdf$/i.test(file.name)||file.size<5||file.size>1048576){
   say('Archivo no admitido: '+file.name+'. Usá PDF de hasta 1 MB.');continue;
  }
  if(preparados.some(r=>r.file===file||r.file.name===file.name&&r.file.size===file.size)){
   continue;
  }
  preparados.push({file,mode:'bn'});
 }
 $('file').value='';redraw();
}
$('file').addEventListener('change',e=>enqueue(e.target.files));
const drop=$('drop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over')});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');enqueue(e.dataTransfer.files)});
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click()}});
}
add.addEventListener('click',async()=>{
 const selected=preparados[0];
 const file=selected?.file,mode=selected?.mode;
 const token=window.turnstile?.getResponse();
 if(!file||!token){say('Prepará un PDF y completá la verificación antes de enviarlo.');return}
 if(!/\\.pdf$/i.test(file.name)||file.size<5||file.size>1048576){say('Cada PDF debe tener entre 5 bytes y 1 MB.');return}
 if(recibidos.length>=5){say('Se alcanzó el límite de cinco PDF en este ensayo.');return}
 ocupado=true;redraw();
 try {
  const inicioCarga=performance.now();
  const buf=await file.arrayBuffer(),bytes=new Uint8Array(buf);
  if(String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw Error('No es un PDF válido.');
  const sha=await hash(buf);if(recibidos.some(r=>r.sha===sha))throw Error('Ese mismo PDF ya fue incorporado.');
  const key=sha+':'+mode+':'+file.name;let state=pendientes.get(key);
  const parts=Math.ceil(file.size/524288);
  if(!state){
   const rand=new Uint8Array(8);crypto.getRandomValues(rand);
   const orderId='WEB-ENSAYO-'+Array.from(rand,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
   say('Iniciando recepción protegida de '+file.name+'...');
   const session=await rpc('/api/ensayo-pdf',{op:'start',turnstileToken:token,
     meta:{orderId,fileId:'documento',name:file.name,mode,bytes:file.size,sha256:sha,
       partBytes:524288,parts}});
   state={uploadId:session.uploadId,token:session.token,sha,mode,name:file.name};
   pendientes.set(key,state);
  }
  const tTransferencia=performance.now();
  const progress=await rpc('/api/ensayo-pdf',{op:'status',uploadId:state.uploadId,token:state.token});
  const accepted=new Set(progress.acceptedParts||[]);
  for(let i=0;i<parts;i++){
   if(accepted.has(i))continue;
   const part=bytes.subarray(i*524288,Math.min(bytes.length,(i+1)*524288));
   say('Enviando '+file.name+': fragmento '+(i+1)+' de '+parts);
   await rpc('/api/ensayo-pdf',{op:'part',uploadId:state.uploadId,token:state.token,
      index:i,bytes:part.length,sha256:await hash(part),dataBase64:base64(part)});
  }
  const tConfirmacion=performance.now();
  const result=await rpc('/api/ensayo-pdf',{op:'finish',uploadId:state.uploadId,
    token:state.token,sha256:sha,bytes:file.size,parts});
  if(!result.received)throw Error('La recepción no fue confirmada.');
  recibidos.push(state);pendientes.delete(key);preparados.shift();
  const finCarga=performance.now();
  $('file').value='';redraw();
  say('Recibido: '+file.name+'. Podés agregar otro PDF o calcular el total.'+
    '\\nTiempo total de carga: '+Math.round(finCarga-inicioCarga)+' ms'+
    '\\nFragmentos y estado: '+Math.round(tConfirmacion-tTransferencia)+' ms'+
    '\\nConfirmación Drive: '+Math.round(finCarga-tConfirmacion)+' ms');
 }catch(e){say('No se pudo terminar: '+String(e.message||e)+'. Si ya comenzó la subida, reintentá con el mismo archivo sin cerrar esta pestaña.')}
 finally{ocupado=false;redraw();window.turnstile?.reset()}
});
quote.addEventListener('click',async()=>{
 if(!recibidos.length)return;
 quote.disabled=true;
 try {
  const copies=Number($('copies').value);
  if(!Number.isSafeInteger(copies)||copies<1||copies>200)throw Error('Copias fuera del rango de prueba.');
  say('Consultando los recibos privados y verificando páginas. Puede demorar...');
  const t=performance.now();
  const result=await rpc('/api/ensayo-cotizar-lote',{
    sesiones:recibidos.map(r=>({uploadId:r.uploadId,token:r.token})),
    formato:$('format').value,caras:$('faces').value,copias:copies,
    anillado:$('binding').value
  });
  const lines=result.documentos.map(x=>'- '+x.nombre+': '+x.paginas+' página(s) '+(x.modo==='bn'?'B/N':'Color'));
  const msg=['LOTE VERIFICADO POR SERVIDOR',...lines,
    'Impresiones B/N: '+result.cantidadBN+' — '+fmt.format(result.precioUnitarioBN)+' unitario',
    'Impresiones color: '+result.cantidadColor+' — '+fmt.format(result.precioUnitarioColor)+' unitario',
    'Impresiones: '+fmt.format(result.subtotalImpresiones),
    'Anillados: '+fmt.format(result.anillados),
    'TOTAL ORIENTATIVO: '+fmt.format(result.total),
    'Tiempo en servidor: '+result.tiempoServidorMs+' ms',
    'Pagos: DESACTIVADOS'];
  if(result.siguienteDescuentoBN)msg.push('Próximo tramo B/N: faltan '+result.siguienteDescuentoBN.faltan+' impresiones para '+fmt.format(result.siguienteDescuentoBN.precioUnitario)+' unitario.');
  if(result.siguienteDescuentoColor)msg.push('Próximo tramo color: faltan '+result.siguienteDescuentoColor.faltan+' impresiones para '+fmt.format(result.siguienteDescuentoColor.precioUnitario)+' unitario.');
  msg.push('Tiempo total desde navegador: '+Math.round(performance.now()-t)+' ms');
  say(msg.join('\\n'));
 }catch(e){say('No se pudo verificar el lote: '+String(e.message||e))}
 finally{quote.disabled=recibidos.length===0}
});
</script></body></html>`;
}
