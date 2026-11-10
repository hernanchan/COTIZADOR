/**
 * Contrato de conciliación Mercado Pago LIVE de Librería Saber.
 * Es una función pura de comparación, NO una pasarela ni un endpoint.
 * El llamador FUTURO deberá consultar payment, merchantOrder y seller por
 * API autenticada de MP y después persistir el pago atómicamente en D1.
 * Nunca aceptar estas estructuras proporcionadas por el navegador.
 */
const safeId=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value||''));
const numericId=value=>/^[1-9]\d{3,19}$/.test(String(value??''));

export function compuertaMPProduccion(env){
 return env?.SABER_ENTORNO==='produccion'&&
  env?.MP_LIVE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
  env?.CENTRAL_DB_ENV==='produccion'&&
  typeof env?.MP_LIVE_ACCESS_TOKEN==='string'&&
  env.MP_LIVE_ACCESS_TOKEN.length>=25&&
  !env.MP_LIVE_ACCESS_TOKEN.startsWith('TEST-')&&
  numericId(env?.MP_LIVE_SELLER_ID)&&
  String(env.MP_LIVE_SELLER_ID)!==String(env?.MP_TEST_SELLER_ID||'')&&
  typeof env?.MP_LIVE_WEBHOOK_SECRET==='string'&&
  env.MP_LIVE_WEBHOOK_SECRET.length>=32;
}

const fail=reason=>({verified:false,reason});

/**
 * Compara datos YA recuperados de 3 GET de backend autenticados (orden D1,
 * /v1/payments/:id, /merchant_orders/:id, /users/me).
 *
 * No alcanza el GET /users/me ni live_mode por separado. No crea preferencias,
 * no escribe D1, no recibe webhooks, no permite subir ni producir documentos.
 */
export function cotejarPagoRealMP({payment,merchantOrder,seller,order,sellerId}={}){
 if(!payment||!merchantOrder||!seller||!order)return fail('fuente_incompleta');
 if(!safeId(order.id)||order.status!=='awaiting_payment'&&
    !(order.status==='paid'&&String(order.payment_id)===String(payment.id)))
  return fail('orden_no_pendiente');
 if(order.review_state==='revoked')return fail('pago_revocado');
 if(!numericId(sellerId)||!numericId(seller.id)||!numericId(payment.collector_id)||
    String(seller.id)!==String(sellerId)||
    String(payment.collector_id)!==String(seller.id)||
    seller.test_user===true||(Array.isArray(seller.tags)&&seller.tags.includes('test_user')))
  return fail('vendedor_incorrecto');
 if(payment.live_mode!==true||payment.status!=='approved'||
    payment.currency_id!=='ARS'||Number(payment.transaction_amount_refunded||0)!==0)
  return fail('pago_no_live_o_no_aprobado');
 if(!Number.isSafeInteger(order.amount_ars)||order.amount_ars<=0||
    order.deposit_ars!==order.amount_ars||
    !Number.isSafeInteger(payment.transaction_amount)||
    payment.transaction_amount!==order.amount_ars)
  return fail('importe_no_coincide');
 if(!numericId(payment.id)||!numericId(payment.order?.id)||
    !numericId(merchantOrder.id)||
    String(merchantOrder.id)!==String(payment.order.id)||
    String(payment.external_reference)!==String(order.id)||
    !order.preference_id||
    String(merchantOrder.preference_id)!==String(order.preference_id)||
    String(merchantOrder.external_reference)!==String(order.id)||
    payment.preference_id!==undefined&&payment.preference_id!==null&&
      String(payment.preference_id)!==String(order.preference_id))
  return fail('referencias_no_coinciden');
 if(!Array.isArray(merchantOrder.payments)||
    !merchantOrder.payments.some(p=>String(p?.id)===String(payment.id)&&p.status==='approved'))
  return fail('orden_comerciante_no_valida');
 return {verified:true,orderId:order.id,paymentId:String(payment.id)};
}
