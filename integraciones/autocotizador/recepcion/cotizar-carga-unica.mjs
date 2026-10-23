import {clasificarDestino} from './destino-impresion.mjs';
import {cotizarStickersPdf} from './cotizar-stickers.mjs';
import {procesarFotoCarga} from './procesar-foto-carga.mjs';
import {procesarCorteCarga} from './procesar-corte-carga.mjs';
import {procesarGraficaCarga} from './procesar-grafica-carga.mjs';
import {seleccionarPaginas} from './seleccionar-paginas.mjs';
import {cotizarDocumentosIndividuales} from '../pruebas/cotizar-documentos-individuales.mjs';
import {cotizarPloteosRapido,rolloEstandarAutomatico} from '../pruebas/cotizar-ploteos-rapido.mjs';

const PLANO=['cad','poster'];
const VALORACION='PRELIMINAR_SIN_VERIFICAR';
function validarArchivo(a,i){
 if(!a||!['anillado,caras,copias,grupoAnillado,materialColor,modo,nombre,paginas,papelPoster,seleccion','anillado,caras,copias,grupoAnillado,materialColor,modo,nombre,paginas,paginasSeleccionadas,papelPoster,seleccion','anillado,caras,copias,grupoAnillado,materialColor,modo,nombre,paginas,papelPoster,seleccion,servicio','anillado,caras,copias,grupoAnillado,materialColor,modo,nombre,paginas,papelPoster,productoFoto,seleccion,servicio','anillado,caras,copias,grupoAnillado,materialColor,modo,nombre,paginas,paginasSeleccionadas,papelPoster,seleccion,servicio','anillado,caras,copias,grupoAnillado,materialColor,modo,nombre,paginas,paginasSeleccionadas,papelPoster,productoFoto,seleccion,servicio','anillado,caras,copias,corteMetros,corteVariante,grupoAnillado,materialColor,modo,nombre,paginas,paginasSeleccionadas,papelPoster,productoFoto,seleccion,servicio'].includes(Object.keys(a).sort().join(','))||
 typeof a.nombre!=='string'||!a.nombre.trim()||a.nombre.length>160||
 !Array.isArray(a.paginas)||a.paginas.length<1||a.paginas.length>2000||
 !Number.isSafeInteger(a.copias)||a.copias<1||a.copias>500||
 (a.paginasSeleccionadas!==undefined&&(typeof a.paginasSeleccionadas!=='string'||a.paginasSeleccionadas.length>500))||
 !(a.servicio===undefined||['auto','stickers','fotos','corte','grafica'].includes(a.servicio))||
 (a.productoFoto!==undefined&&typeof a.productoFoto!=='string')||
 !['bn','color'].includes(a.modo)||!['simple','double'].includes(a.caras)||
 !['obra80','recubierto'].includes(a.papelPoster)||
 !['ninguno','individual','grupo'].includes(a.anillado)||
 typeof a.materialColor!=='string'||a.materialColor.length>120||
 (a.anillado==='grupo'&&!/^[1-9][0-9]?$/.test(String(a.grupoAnillado||'')))||
 (a.anillado!=='grupo'&&a.grupoAnillado!==''))throw Error('Configuración inválida de archivo '+(i+1));
 for(const [j,p] of a.paginas.entries()){
  if(!p||Object.keys(p).sort().join(',')!=='altoCm,anchoCm,modo,numero'||
   p.numero!==j+1||!Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||
   p.anchoCm<=0||p.altoCm<=0||p.anchoCm>2000||p.altoCm>2000||
   ![...PLANO,'sin-clasificar'].includes(p.modo))throw Error('Página inválida en archivo '+(i+1));
 }
}
function tipoOriginal(paginas){
 const opciones=paginas.map(p=>{
  const ancho=Math.min(p.anchoCm,p.altoCm),largo=Math.max(p.anchoCm,p.altoCm);
  if(Math.abs(ancho-21)<=0.2&&Math.abs(largo-29.7)<=0.2)return 'a4';
  if(Math.abs(ancho-29.7)<=0.2&&Math.abs(largo-42)<=0.2)return 'a3';
  return null;
 });
 return opciones.every(v=>v===opciones[0])?opciones[0]:null;
}
/** Precio provisorio. Las medidas, clases y elecciones se declaran en el navegador;
 * jamás se usa este resultado para cobrar o imprimir sin verificación del PDF real.
 */
export function cotizarCargaUnica({archivos,precios}){
 if(!Array.isArray(archivos)||!archivos.length||archivos.length>30)throw Error('Cantidad de archivos inválida');
 const documentos=[],ploteos=[],stickers=[],fotos=[],cortes=[],graficas=[],pendientes=[],plan=[];
 archivos.forEach((a,i)=>{
  validarArchivo(a,i);
  const seleccionadas=seleccionarPaginas(a.paginas,a.paginasSeleccionadas);
  const d=clasificarDestino(seleccionadas,a.seleccion);
  if(a.servicio==='grafica'){return;}
  if(a.servicio==='corte'){procesarCorteCarga(a,i,seleccionadas,precios,cortes,plan,pendientes);return;}
  if(a.servicio==='fotos'){
   procesarFotoCarga({archivo:a,indice:i,paginas:seleccionadas,precios,fotos,plan,pendientes});
   return;
  }
  if(a.servicio==='stickers'){
   if(a.anillado!=='ninguno'){
    pendientes.push({indice:i,nombre:a.nombre,motivo:'Stickers no admite anillado; quitá el anillado anterior'});return;
   }
   if(!d.confirmado){pendientes.push({indice:i,nombre:a.nombre,motivo:'Confirmar tamaño A4/A3 para stickers'});return}
   const formato=d.tamanoFinal==='original'?tipoOriginal(seleccionadas):d.tamanoFinal;
   if(!['a4','a3'].includes(formato)){
    pendientes.push({indice:i,nombre:a.nombre,motivo:'Stickers con precorte: elegir tamaño A4 o A3'});return;
   }
   const calculo=cotizarStickersPdf({formato,paginas:seleccionadas.length,copias:a.copias,precios});
   const id='stk'+(stickers.length+1);
   stickers.push({id,nombre:a.nombre,...calculo});
   plan.push({indice:i,nombre:a.nombre,origen:seleccionadas.map(p=>({numero:p.numero,anchoCm:p.anchoCm,altoCm:p.altoCm})),
    paginasElegidas:seleccionadas.map(p=>p.numero),formatoFinal:formato,destino:'stickers',id,
    ajuste:d.cambioEscala?'proporcional_sin_recorte':'sin_escalado'});
   return;
  }
  if(!d.confirmado){pendientes.push({indice:i,nombre:a.nombre,motivo:'Confirmar tamaño final'});return}
  if(d.destino==='documentos'){
   const formato=d.tamanoFinal==='original'?tipoOriginal(seleccionadas):d.tamanoFinal;
   if(!['a4','a3'].includes(formato)){
    pendientes.push({indice:i,nombre:a.nombre,motivo:formato==='a5'?'A5 sin tarifa autónoma vigente':'Tamaño original no homogéneo A4/A3'});return;
   }
   const id='pdf'+(documentos.length+1);
   const catalogo=precios[formato==='a4'?'colorA4':'colorA3']?.materials||[];
   if(a.modo==='color'&&!catalogo.some(m=>m.id===a.materialColor)){
    pendientes.push({indice:i,nombre:a.nombre,motivo:'Material incompatible con formato final'});return;
   }
   documentos.push({id,nombre:a.nombre,paginas:seleccionadas.length,copias:a.copias,
    formato,modo:a.modo,caras:a.caras,anillado:a.anillado,grupoAnillado:a.grupoAnillado,
    materialColor:a.modo==='color'?a.materialColor:'estandar',orden:i+1});
   plan.push({indice:i,nombre:a.nombre,origen:seleccionadas.map(p=>({numero:p.numero,anchoCm:p.anchoCm,altoCm:p.altoCm})),
    paginasElegidas:seleccionadas.map(p=>p.numero),formatoFinal:formato,ajuste:d.cambioEscala?'proporcional_sin_recorte':'sin_escalado',destino:'documentos',id});
   return;
  }
  if(seleccionadas.some(p=>!PLANO.includes(p.modo))){
   pendientes.push({indice:i,nombre:a.nombre,motivo:'Clasificación visual CAD/Póster pendiente'});return;
  }
  if(a.anillado!=='ninguno'){
   pendientes.push({indice:i,nombre:a.nombre,motivo:'Anillado incompatible con ploteo'});return;
  }
  const id='pl'+(ploteos.length+1);
  const material=rolloEstandarAutomatico(seleccionadas,precios.plotter.supports).id;
  const paginas=seleccionadas.map((p,j)=>({...p,numero:j+1}));
  ploteos.push({id,nombre:a.nombre,paginas,modo:paginas[0].modo,material,copias:a.copias,papelPoster:a.papelPoster});
  plan.push({indice:i,nombre:a.nombre,origen:a.paginas.map(p=>({numero:p.numero,anchoCm:p.anchoCm,altoCm:p.altoCm})),
   paginasElegidas:seleccionadas.map(p=>p.numero),formatoFinal:'original',ajuste:'sin_escalado',destino:'ploteos',id});
 });
 // Un grupo debe tener dos archivos válidos y coincidir en tamaño/cantidad.
 // Los grupos no cotizables se bloquean completos, sin sumar un anillado parcial.
 const grupos=new Map();
 for(const doc of documentos){
  if(doc.anillado!=='grupo')continue;
  if(!grupos.has(doc.grupoAnillado))grupos.set(doc.grupoAnillado,[]);
  grupos.get(doc.grupoAnillado).push(doc);
 }
 const gruposIncompletos=new Set();
 for(const [id,miembros] of grupos){
  const todos=archivos.filter(a=>a.anillado==='grupo'&&a.grupoAnillado===id);
  const formato=miembros[0].formato,copias=miembros[0].copias;
  if(miembros.length<2||todos.length!==miembros.length||
    miembros.some(a=>a.formato!==formato||a.copias!==copias)){
   gruposIncompletos.add(id);
   for(const a of todos)pendientes.push({indice:archivos.indexOf(a),nombre:a.nombre,
      motivo:'Grupo '+id+' incompleto o con tamaños/copias incompatibles. Revisar anillado conjunto.'});
  }
 }
 const cotizables=documentos.filter(a=>a.anillado!=='grupo'||!gruposIncompletos.has(a.grupoAnillado));
 for(const doc of documentos){
  if(doc.anillado==='grupo'&&gruposIncompletos.has(doc.grupoAnillado)){
   const ix=plan.findIndex(p=>p.id===doc.id&&p.destino==='documentos');
   if(ix>=0)plan.splice(ix,1);
  }
 }
 cotizables.forEach((a,i)=>{a.id='pdf'+(i+1)});
 // No ofrecer un importe aparentemente completo si algún archivo sigue sin precio.
 const c=cotizables.length?cotizarDocumentosIndividuales({archivos:cotizables,precios}):null;
 const p=ploteos.length?cotizarPloteosRapido({trabajos:ploteos,precios}):null;
 const subtotalImpresiones=c?.total||0,subtotalPloteos=p?.total||0;
 const subtotalStickers=stickers.reduce((sum,x)=>sum+x.subtotal,0);
 const subtotalFotos=fotos.reduce((sum,x)=>sum+x.subtotal,0);
 const subtotalCortes=cortes.reduce((sum,x)=>sum+x.subtotal,0);
 return {ok:true,estado:pendientes.length?'INCOMPLETO':'PRELIMINAR',verificacion:VALORACION,
  paymentAuthorized:false,total:pendientes.length?null:subtotalImpresiones+subtotalPloteos+subtotalStickers+subtotalFotos+subtotalCortes,
  subtotalImpresiones,subtotalPloteos,subtotalStickers,subtotalFotos,subtotalCortes,subtotalAnillados:c?.subtotalAnillados||0,
  detalleArmados:c?.detalleArmados||[],pendientes,plan,
  detalleImpresiones:c?.detalles||[],detallePloteos:p?.detalles||[],detalleStickers:stickers,detalleFotos:fotos,detalleCortes:cortes};
}
