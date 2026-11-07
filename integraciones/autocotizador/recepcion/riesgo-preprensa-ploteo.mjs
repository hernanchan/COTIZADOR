/**
 * Preprensa preventiva para planos grandes.
 * La carga, el pago y la cotizacion no son una orden de enviar directamente
 * el original al controlador de la impresora.
 *
 * Umbral 60 MiB: alerta conservadora a personal, NO afirmacion de PDF corrupto.
 * Tamaño en bytes no mide por sí solo la complejidad de transparencias,
 * fuentes, imagenes o trazados vectoriales. Conservar original verificado.
 */
const MIB=1024*1024;
const UMBRAL_PDF_PESADO=60*MIB;
const A1_CORTO=59.4,A1_LARGO=84.1;
export const PREPRENSA_UMBRAL_BYTES=UMBRAL_PDF_PESADO;
export function evaluarRiesgoPreprensaPloteo({bytes,paginas}={}){
 if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>256*MIB||
   !Array.isArray(paginas)||!paginas.length||paginas.length>2000||
   paginas.some(p=>!p||!Number.isFinite(p.anchoCm)||
    !Number.isFinite(p.altoCm)||p.anchoCm<=0||p.altoCm<=0||
    p.anchoCm>2000||p.altoCm>2000))
  throw Error('PREPRENSA_DATOS_NO_VERIFICADOS');
 const contieneA1=paginas.some(p=>{
  const corto=Math.min(p.anchoCm,p.altoCm);
  const largo=Math.max(p.anchoCm,p.altoCm);
  return Math.abs(corto-A1_CORTO)<=0.7&&Math.abs(largo-A1_LARGO)<=0.7;
 });
 const grande=bytes>=UMBRAL_PDF_PESADO;
 const motivos=grande?['PDF_PESADO_MAYOR_IGUAL_60_MIB']:[];
 if(contieneA1&&grande)motivos.push('PAGINA_A1_PDF_PESADO');
 return Object.freeze({
  estado:grande?'PREPRENSA_A_REVISAR':'SIN_ALERTA_DE_TAMANO',
  revisionOperadorRecomendada:grande,
  // Prohibicion de inferir que se puede imprimir en lote de modo automatico.
  impresionAutomaticaAutorizada:false,
  originalDebeConservarse:true,
  requiereCopiaPreparada:grande,
  medidaA1Detectada:contieneA1,
  // No asignar DPI fijo ni rasterizar sin conocer si es plano CAD o poster.
  tratamiento:'SEGUN_CONTENIDO_VERIFICADO',
  motivos:Object.freeze(motivos)
 });
}
