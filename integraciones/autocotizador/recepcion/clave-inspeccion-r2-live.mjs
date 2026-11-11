/** Subclave HMAC exclusiva de inspección R2 LIVE derivada de la contraseña
 * privada del operador; nunca registrar ni mostrar la subclave en logs.
 * No importar este módulo Node al Worker. */
import {createHmac} from 'node:crypto';
export function derivarClaveInspeccionR2Live(operatorSecret){
 if(typeof operatorSecret!=='string'||operatorSecret.length<32)
  throw Error('R2_LIVE_CLAVE_OPERADOR_NO_CONFIGURADA');
 return createHmac('sha256',operatorSecret)
  .update('libreria-saber/central/r2/inspeccion-live/v1','utf8')
  .digest('hex');
}
