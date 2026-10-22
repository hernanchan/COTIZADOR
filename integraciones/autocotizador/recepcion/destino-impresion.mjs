/** Selección del tamaño final: nunca confundir dimensiones del PDF con pedido comercial. */
const FORMATOS={a5:[14.8,21],a4:[21,29.7],a3:[29.7,42]};
export function clasificarDestino(paginas,seleccion='sin-confirmar'){
 if(!Array.isArray(paginas)||!paginas.length||paginas.some(p=>!Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||p.anchoCm<=0||p.altoCm<=0))throw Error('Dimensiones PDF inválidas');
 const opciones=['sin-confirmar','original','a5','a4','a3'];
 if(!opciones.includes(seleccion))throw Error('Destino de impresión desconocido');
 const superaA3=paginas.some(p=>Math.max(p.anchoCm,p.altoCm)>42.03||Math.min(p.anchoCm,p.altoCm)>29.73);
 const mixtas=paginas.some(p=>Math.abs(p.anchoCm-paginas[0].anchoCm)>0.1||Math.abs(p.altoCm-paginas[0].altoCm)>0.1);
 if(seleccion==='sin-confirmar')return {confirmado:false,superaA3,mixtas,destino:null,requiereConfirmacion:superaA3||mixtas};
 if(seleccion==='original')return {confirmado:true,superaA3,mixtas,destino:superaA3?'ploteo':'documentos',tamanoFinal:'original',cambioEscala:false};
 return {confirmado:true,superaA3,mixtas,destino:'documentos',tamanoFinal:seleccion,medidasFinalesCm:FORMATOS[seleccion],cambioEscala:paginas.some(p=>{const a=Math.min(p.anchoCm,p.altoCm),b=Math.max(p.anchoCm,p.altoCm),[x,y]=FORMATOS[seleccion];return Math.abs(a-x)>0.1||Math.abs(b-y)>0.1}),ajuste:'proporcional_sin_recorte'};
}
