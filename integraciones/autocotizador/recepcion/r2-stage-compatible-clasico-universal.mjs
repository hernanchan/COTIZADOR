/**
 * Compatibilidad de la recepcion R2 privada: una orden historica aprobada
 * por Central NO debe re-registrarse como lote universal.
 *
 * Ninguna de estas consultas habilita pago, crea orden ni elude la
 * comprobacion previa de R2. La identidad es (orderId,fileId,SHA,bytes).
 */
import {enviarPreRecepcionR2Central} from './r2-grandes-enviar-central.mjs';
import {comprobarPagoR2EnCentral} from './r2-confirmar-pago-central.mjs';
import {registrarOriginalUniversalR2} from './r2-universal-recibido-documentos.mjs';

export async function stageR2Compatible(args,{
 stageHistorico=enviarPreRecepcionR2Central,
 verificarPagoHistorico=comprobarPagoR2EnCentral,
 registrarUniversal=registrarOriginalUniversalR2
}={}){
 const resultado=await stageHistorico(args);
 if(resultado?.stagedForCentral!==true)return resultado;
 const {env,claim}=args||{};
 if(env?.DOCS_R2_UNIVERSAL_POSTPAY_ENABLED!=='PRIVATE_TEST_ONLY')
  return resultado;
 const clasico=env?.DOCS_R2_POSTPAY_REQUIRED==='PRIVATE_TEST_ONLY'?
  await verificarPagoHistorico({env,orderId:claim?.orderId,meta:{
   fileId:claim?.fileId,sha256:claim?.sha256,bytes:claim?.bytes
  }}):null;
 // Una aprobacion clasica requiere firma HMAC exacta, pago conciliado y
 // hash/tamano concordantes. Una respuesta no validada es null.
 if(clasico)return resultado;
 // Solo pedidos realmente universales deben pasar por la cola universal;
 // cualquier fallo sigue bloqueando la confirmacion del original.
 await registrarUniversal(args);
 return resultado;
}
