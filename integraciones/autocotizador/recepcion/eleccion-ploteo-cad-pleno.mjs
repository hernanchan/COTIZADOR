import {clasificarDestino} from './destino-impresion.mjs';

/**
 * CAD/pleno es una decisión comercial. Las medidas físicas llevan a plotter
 * pero no permiten deducir si hay líneas técnicas o cobertura plena.
 */
export function opcionesTipoPloteo(paginas,seleccion='original'){
 const d=clasificarDestino(paginas,seleccion);
 if(d.destino!=='ploteo'||!d.superaA3||seleccion!=='original')
  return Object.freeze({mostrar:false,tipo:null,confirmado:false});
 const modos=new Set(paginas.map(p=>p.modo));
 const tipo=modos.size===1&&['cad','poster'].includes([...modos][0])?[...modos][0]:null;
 return Object.freeze({mostrar:true,tipo,confirmado:Boolean(tipo),
  dimensiones:paginas.map(p=>[p.anchoCm,p.altoCm]),
  variasClases:modos.has('cad')&&modos.has('poster')});
}
/** Aplica la elección del comprador a todas las páginas de ese PDF. */
export function elegirTipoPloteo(paginas,seleccion,tipo){
 if(!['cad','poster'].includes(tipo))
  throw Error('Elegí Plano CAD o Pleno');
 if(!opcionesTipoPloteo(paginas,seleccion).mostrar)
  throw Error('La elección CAD/pleno corresponde solamente al ploteo original mayor a A3');
 for(const pagina of paginas)pagina.modo=tipo;
 return opcionesTipoPloteo(paginas,seleccion);
}
