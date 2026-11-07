/**
 * Guardrail de costos: un R2 grande no puede almacenar bytes si la Central
 * no confirma pago real (MP conciliado o transferencia acreditada).
 *
 * No acepta redirects, comprobantes del navegador ni booleanos del cliente.
 * La función que devuelve esta constancia DEBE consultar Central D1 desde el
 * Worker servidor y obtener datos reconciliados (HMAC/Service Binding).
 *
 * En pruebas se inyecta un objeto sintético, nunca se habilitan cobros.
 */
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const PAID_METHODS=new Set(['mercadopago','transferencia']);
const AUTHORITIES=new Map([
 ['mercadopago','MERCADOPAGO_API_RECONCILED'],
 ['transferencia','BANK_CREDIT_CONFIRMED_BY_STAFF']
]);
export const R2_PAID_GATE=Object.freeze({
 flag:'DOCS_R2_POSTPAY_REQUIRED',value:'PRIVATE_TEST_ONLY',
 maxAgeSeconds:300
});
export function pagoAprobadoParaR2(comprobante,orderId,nowSeconds=Math.floor(Date.now()/1000)){
 if(!ORDER.test(orderId||'')||!comprobante||typeof comprobante!=='object'||
  Array.isArray(comprobante)||comprobante.orderId!==orderId||
  comprobante.source!=='CENTRAL_D1_RECONCILED'||
  !PAID_METHODS.has(comprobante.method)||
  comprobante.authority!==AUTHORITIES.get(comprobante.method)||
  comprobante.paymentState!=='PAID_CONFIRMED'||
  comprobante.providerVerified!==true||
  comprobante.reversed!==false||
  comprobante.refunded!==false||
  comprobante.currency!=='ARS'||
  !Number.isSafeInteger(comprobante.amountArs)||comprobante.amountArs<1||
  comprobante.amountArs>50000000||
  typeof comprobante.paymentReference!=='string'||
  !/^[A-Za-z0-9_.:-]{5,160}$/.test(comprobante.paymentReference)||
  !Number.isSafeInteger(comprobante.verifiedAt)||
  !Number.isSafeInteger(nowSeconds)||
  comprobante.verifiedAt>nowSeconds+30||
  comprobante.verifiedAt<nowSeconds-R2_PAID_GATE.maxAgeSeconds)
  return false;
 return true;
}
