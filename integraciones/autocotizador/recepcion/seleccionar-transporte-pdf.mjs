/** Transporte, independiente del servicio A4/A3/CAD/Póster.
 * Esta decisión NO autoriza cargar en R2 sin pago acreditado ni verifica PDF.
 */
const MIB=1024*1024;
export const LIMITE_TUS_PDF_BYTES=40*MIB;
export const LIMITE_R2_PDF_BYTES=200*MIB; // Cota actual de interfaz, no de R2
export function decidirTransportePDF(bytes){
 if(!Number.isSafeInteger(bytes)||bytes<5)return Object.freeze({ruta:'invalido',pagoPrevio:false});
 if(bytes<=LIMITE_TUS_PDF_BYTES)return Object.freeze({ruta:'tus',pagoPrevio:false});
 if(bytes<=LIMITE_R2_PDF_BYTES)return Object.freeze({ruta:'r2',pagoPrevio:true});
 return Object.freeze({ruta:'supera_cupo',pagoPrevio:false});
}
