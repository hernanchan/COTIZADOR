import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEvento, resumirEmbudo } from '../integraciones/estadisticas/embudo.mjs';
const id = 'sesion_123456789012345';
test('rechaza datos personales y eventos de pago falsificados por navegador', () => {
  const base = {type:'quote_viewed',sessionId:id,at:Date.now()};
  assert.equal(validarEvento(base,'cliente'),true);
  assert.equal(validarEvento({...base,phone:'3511234567'},'cliente'),false);
  assert.equal(validarEvento({...base,type:'payment_confirmed'},'cliente'),false);
  assert.equal(validarEvento({...base,type:'payment_confirmed'},'servidor'),true);
});
test('deduplica eventos por sesión y separa abandono de ventas', () => {
  const e = [
    {type:'page_view',sessionId:id},{type:'page_view',sessionId:id},
    {type:'quote_viewed',sessionId:id},{type:'checkout_started',sessionId:id},
    {type:'page_view',sessionId:'sesion_987654321098765'},
    {type:'payment_confirmed',sessionId:'sesion_987654321098765'}
  ];
  assert.deepEqual(resumirEmbudo(e),{
    sesiones:2,vistas:2,cotizaciones:1,checkout:1,pagos:1,
    cotizacionesSinPago:1,checkoutSinPago:1,conversionPorcentaje:null
  });
});
