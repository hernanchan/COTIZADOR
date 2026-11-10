/**
 * Fallback visual LOCAL para PDF grandes de pocas páginas.
 * Evita cargar en memoria cualquier archivo de 48 MiB o más.
 * No usa nombres de archivo para inferir CAD/Pleno y nunca envía el original.
 * Solo devuelve una clase cuando el analizador visual valida TODAS las páginas.
 */
import {clasificarPaginasPloteo} from './clasificar-paginas-ploteo.mjs';
export const MAX_VISUAL_GRANDE_BYTES=48*1024*1024;
export const MAX_VISUAL_GRANDE_PAGINAS=4;
const MIN_GRANDE_BYTES=40*1024*1024;
export async function clasificarPloteoGrandeVisualLimitado(file,{
 paginas,analizador=clasificarPaginasPloteo
}={}){
 if(!file||typeof file.arrayBuffer!=='function'||
    !Number.isSafeInteger(file.size)||
    file.size<=MIN_GRANDE_BYTES||file.size>MAX_VISUAL_GRANDE_BYTES||
    !/\.pdf$/i.test(String(file.name||''))||
    !Array.isArray(paginas)||paginas.length<1||
    paginas.length>MAX_VISUAL_GRANDE_PAGINAS||
    paginas.some(p=>!Number.isSafeInteger(p.numero)||p.numero<1||
      !Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||
      p.anchoCm<=0||p.altoCm<=0)||
    typeof analizador!=='function')return null;
 let clases;
 try{clases=await analizador(file,{maxPaginas:MAX_VISUAL_GRANDE_PAGINAS})}
 catch{return null}
 if(!Array.isArray(clases)||clases.length!==paginas.length)return null;
 const vistas=new Map();
 for(const c of clases){
  if(!c||!Number.isSafeInteger(c.numero)||c.numero<1||
     !['cad','poster'].includes(c.modo)||vistas.has(c.numero))return null;
  vistas.set(c.numero,c.modo);
 }
 if(paginas.some(p=>!vistas.has(p.numero)))return null;
 return Object.freeze({altaConfianza:true,metodo:'VISUAL_PDFJS_LIMITADO',
  originalSubido:false,permiteImprimirSinRevisar:false,
  paginas:Object.freeze(paginas.map(p=>Object.freeze({numero:p.numero,modo:vistas.get(p.numero)})))});
}
