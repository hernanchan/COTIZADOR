import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarEvento, resumenPorPeriodo } from '../integraciones/estadisticas/d1.mjs';
const id='sesion_123456789012345';
function dbFalsa() {
  const calls=[];
  return {
    calls,
    prepare(sql) {
      const entry={sql,args:null};
      calls.push(entry);
      return {
        bind(...args) { entry.args=args; return this; },
        async run() { return {success:true}; },
        async first() { return {visitas:3,iniciadas:2,cotizadas:2,checkout:1,pagadas:1}; }
      };
    }
  };
}
test('D1 rechaza pago reportado desde navegador y datos adicionales',async()=>{
  const db=dbFalsa(), now=1763000000000;
  assert.equal((await guardarEvento(db,{type:'payment_confirmed',sessionId:id,at:now},'cliente',now)).status,400);
  assert.equal((await guardarEvento(db,{type:'page_view',sessionId:id,at:now,email:'a@b.com'},'cliente',now)).status,400);
  assert.equal(db.calls.length,0);
});
test('D1 guarda evento permitido sin datos personales',async()=>{
  const db=dbFalsa(),now=1763000000000;
  assert.equal((await guardarEvento(db,{type:'quote_viewed',sessionId:id,at:now},'cliente',now)).status,202);
  assert.deepEqual(db.calls[0].args,['quote_viewed',id,now,null,'cliente']);
});
test('consulta agregada acotada',async()=>{
  const db=dbFalsa();
  assert.equal((await resumenPorPeriodo(db,1000,2000)).pagadas,1);
  await assert.rejects(resumenPorPeriodo(db,1000,1000),RangeError);
  await assert.rejects(resumenPorPeriodo(db,0,100*86400000),RangeError);
});
