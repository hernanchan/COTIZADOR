import test from 'node:test';
import assert from 'node:assert/strict';
import {archivosProtegidos,esArchivoProtegido,fraseAprobacion,
 hayAprobacionTitular,descripcionCompleta,comprobarCambioPr
} from '../tools/control-cambios-saber.mjs';

const owner='hernanchan',sha='0123456789abcdef0123456789abcdef01234567';
const base='89abcdef0123456789abcdef0123456789abcdef';
const numero=123;
const pr={
 number:numero,head:{sha},base:{sha:base,ref:'integracion/tus-pedido-privado-20261101'},
 body:'Motivo: corregir funcionamiento documentado\n'+
      'Alcance: solo ajuste de interfaz móvil\n'+
      'Pruebas: pruebas automatizadas y manuales\n'+
      'Retroceso: volver a version anterior comprobada'
};
const approved={user:{login:owner,type:'User'},body:fraseAprobacion(numero,sha)};

test('código, pagos, precios, pruebas, workflow y contrato requieren autorización',()=>{
 const protectedList=[
  'integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',
  'integraciones/mercadopago/produccion/webhook-edge.mjs',
  '.github/workflows/saber-publicar-cotizador-movil-comercial-20261114.yml',
  'tools/control-cambios-saber.mjs','tests/control-cambios-saber.test.mjs',
  'docs/GOBERNANZA/CONTRATO_CONTROL_CAMBIOS.md',
  'precios-web.json','promos.json','vidriera/index.html','config.json'];
 for(const p of protectedList)assert.equal(esArchivoProtegido(p),true,p);
 assert.deepEqual(archivosProtegidos(['docs/nota-historica.md','precios-web.json']),['precios-web.json']);
 assert.equal(esArchivoProtegido('docs/notas-de-sesion.md'),false);
});
test('revisión exige descripción no vacía de motivos, alcance, pruebas y retroceso',()=>{
 assert.equal(descripcionCompleta(pr.body),true);
 assert.equal(descripcionCompleta('Motivo: \nAlcance: \nPruebas: \nRetroceso: '),false);
 assert.equal(descripcionCompleta('Motivo: test rapido'),false);
});
test('solo aprueba comentario del propietario exacto y SHA exacto',()=>{
 assert.equal(hayAprobacionTitular([approved],numero,sha),true);
 assert.equal(hayAprobacionTitular([{...approved,user:{login:'otra-persona',type:'User'}}],numero,sha),false);
 assert.equal(hayAprobacionTitular([{...approved,user:{login:owner,type:'Bot'}}],numero,sha),false);
 assert.equal(hayAprobacionTitular([approved],numero,'a'.repeat(40)),false);
 assert.equal(hayAprobacionTitular([approved],numero+1,sha),false);
 assert.equal(hayAprobacionTitular([{...approved,body:'AUTORIZADO EN EL CHAT'}],numero,sha),false);
});
test('cambio crítico sin aprobación debe fallar aunque funcione el código',async()=>{
 await assert.rejects(()=>comprobarCambioPr({
  pr,repository:'hernanchan/COTIZADOR',token:'mock',
  files:['integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs'],
  fetchComments:async()=>[]
 }),/FALTA_AUTORIZACION_TITULAR/);
});
test('cambio crítico aprobado por titular y SHA exacto pasa sin mutaciones',async()=>{
 const res=await comprobarCambioPr({
  pr,repository:'hernanchan/COTIZADOR',token:'mock',files:['precios-web.json'],
  fetchComments:async()=>[approved]
 });
 assert.equal(res.ok,true);
 assert.equal(res.reason,'TITULAR_AUTORIZO_SHA_EXACTO');
});
test('cambio documental histórico no exige autorización de código',async()=>{
 const res=await comprobarCambioPr({pr,repository:'hernanchan/COTIZADOR',
  files:['docs/ENSAYO-HISTORICO.md'],
  fetchComments:async()=>{throw Error('No debe consultar aprobación')}}
 );
 assert.equal(res.reason,'SIN_ARCHIVOS_PROTEGIDOS');
});
test('cambio a las reglas requiere la misma aprobación; no hay excepción autorreferencial',async()=>{
 await assert.rejects(()=>comprobarCambioPr({
  pr,repository:'hernanchan/COTIZADOR',
  files:['tools/control-cambios-saber.mjs','.github/workflows/saber-control-cambios.yml'],
  fetchComments:async()=>[]
 }),/FALTA_AUTORIZACION_TITULAR/);
});
