/** Ploteo de corte: reproduce minimo y redondeo del cotizador comercial vigente.
 * Los metros se declaran expresamente: no se infieren de un PDF.
 */
export function cotizarCorte({variante,metros,precios}){
 if(typeof variante!=='string'||!Number.isFinite(metros)||metros<0.1||metros>1000)
  throw Error('Metros o variante de corte invalidos');
 const config=precios?.cutPlotter;
 const tipo=config?.variants?.find(v=>v.id===variante);
 if(!tipo||!Number.isFinite(tipo.pricePerMeter)||tipo.pricePerMeter<=0)
  throw Error('Variante de corte no disponible');
 const bruto=Math.max(Number(config.minimumPrice)||0,metros*tipo.pricePerMeter);
 const paso=Number(config.roundTo)||100;
 const subtotal=Math.round(bruto/paso)*paso;
 return {variante,metros,descripcion:tipo.name,precioPorMetro:tipo.pricePerMeter,
  minimo:Number(config.minimumPrice)||0,subtotal};
}
