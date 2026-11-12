/** Prueba LIVE R2 para una sola orden. NUNCA abre las compuertas generales.
 * Los tres gates de cobro R2 permanecen NO_GO. No autoriza pagos por sí mismo:
 * las rutas existentes siguen conciliando MP, D1, HMAC, cuota e integridad.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const OFF='NO_GO';
const MODE='SOLO_PEDIDO_R2_CONTROLADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const MAX=200*1048576;
const CLOSURES=['CENTRAL_LIVE_R2_GATE','CENTRAL_LIVE_R2_QUOTA_GATE',
 'CENTRAL_LIVE_R2_STAGING_GATE'];
const GATES=['MP_LIVE_GATE','CENTRAL_LIVE_BRIDGE_ENABLED',
 'CENTRAL_LIVE_POSTPAY_GATE','CENTRAL_LIVE_ORDER_GATE',
 'CENTRAL_LIVE_PRICING_GATE'];
/** @returns boolean. No registra órdenes ni crea permisos de subida. */
export function r2CanaryPedidoAutorizado(env,webOrderId,{
 now=()=>Date.now()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.CENTRAL_R2_CANARY_MODE!==MODE||
    !GATES.every(k=>env?.[k]===GO)||
    !CLOSURES.every(k=>env?.[k]===OFF)||
    !WEB.test(webOrderId||'')||
    env?.CENTRAL_R2_CANARY_ORDER_ID!==webOrderId||
    !/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(env?.CENTRAL_R2_CANARY_EXPIRES_AT||''))
  return false;
 const expires=Date.parse(env.CENTRAL_R2_CANARY_EXPIRES_AT);
 const current=now();
 return Number.isFinite(expires)&&Number.isFinite(current)&&
  current<expires&&expires-current<=48*60*60*1000;
}
/** En modalidad restringida sólo una orden y un archivo PDF grande. */
export function r2CanaryArchivoUnico(env,webOrderId,rows,options={}){
 return r2CanaryPedidoAutorizado(env,webOrderId,options)&&
  Array.isArray(rows)&&rows.length===1&&rows[0]?.transport==='r2'&&
  Number.isSafeInteger(rows[0].bytes)&&rows[0].bytes>40*1048576&&
  rows[0].bytes<=MAX;
}
/** Conveniente para gate, reserva y staging. */
export function r2GateGeneralOCanary(env,webOrderId,required=[],options={}){
 if(required.every(k=>env?.[k]===GO))return true;
 return r2CanaryPedidoAutorizado(env,webOrderId,options);
}
