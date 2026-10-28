import test from 'node:test';
import assert from 'node:assert/strict';
import {conciliarManifiestoV2ConServidor} from '../integraciones/autocotizador/recepcion/registrar-manifiesto-v2-central.mjs';

const R='DOC-00000000-0000-4000-8000-000000000001', SHA='a'.repeat(64);
const orderId='WEB-ENSAYO-BIND20261028';
function fixture({binding='individual',group='',serverBinding=binding}={}){
 const item={reciboPrivado:R,sha256:SHA,paginas:12,
  estado:'REQUIERE_REVALIDACION_DE_BACKEND',
  opciones:{formato:'a4',caras:'double',copias:1,anillado:binding,grupoAnillado:group}};
 const m={schema:'saber-v2-manifiesto-preliminar-v1',orderId,
  items:[item],registeredInD1:false,paymentAuthorized:false,
  checkoutEnabled:false,pricesRecalculatedByBackend:false,receiptsRecheckedByBackend:false};
 const ficha={schema:'saber-central-ficha-produccion-v1',
  trabajos:[{idTrabajo:'pdf1',servicio:'documentos',reciboPrivado:R,
   sha256:SHA,paginasOriginales:12,formatoFinal:'a4',
   carasPresupuestadas:'double',copias:1,tipoAnillado:serverBinding,
   pdfImprimibleVerificado:false}],
  gruposAnillado:group?[{grupo:group,archivos:['pdf1'],hojasPorJuego:6,juegos:1}]:[]};
 const v={schema:'saber-central-recepcion-verificada-v1',orderId,
  filesReceived:true,paymentAuthorized:false,listoParaProducir:false,
  pagoConfirmado:false,importeVerificado:3290,
  recibos:[{receiptId:R,sha256:SHA,pages:12,bytes:7000,fileId:'pdf-one'}],
  ficha};
 return {m,v};
}
test('individual debe ser idéntico al anillado de la ficha privada',()=>{
 assert.equal(conciliarManifiestoV2ConServidor(
  {manifiesto:fixture().m,verificacion:fixture().v}).importeServidor,3290);
 assert.throws(()=>{const {m,v}=fixture({binding:'individual',serverBinding:'ninguno'});
  conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v});
 },/anillado u opciones/);
});
test('no se puede quitar un anillado ya contratado en el servidor',()=>{
 const {m,v}=fixture({binding:'ninguno',serverBinding:'individual'});
 assert.throws(()=>conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v}),/anillado u opciones/);
});
test('grupo requiere 2 PDFs, identidad y membresía completa comprobada',()=>{
 const {m,v}=fixture({binding:'grupo',group:'2'});
 assert.throws(()=>conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v}),/armado conjunto/);
 const receipt2='DOC-00000000-0000-4000-8000-000000000002',hash2='b'.repeat(64);
 m.items.push({reciboPrivado:receipt2,sha256:hash2,paginas:8,
  estado:'REQUIERE_REVALIDACION_DE_BACKEND',
  opciones:{formato:'a4',caras:'double',copias:1,anillado:'grupo',grupoAnillado:'2'}});
 v.recibos.push({receiptId:receipt2,sha256:hash2,pages:8,bytes:6000,fileId:'pdf-two'});
 v.ficha.trabajos.push({idTrabajo:'pdf2',servicio:'documentos',reciboPrivado:receipt2,
  sha256:hash2,paginasOriginales:8,formatoFinal:'a4',carasPresupuestadas:'double',
  copias:1,tipoAnillado:'grupo',pdfImprimibleVerificado:false});
 v.ficha.gruposAnillado=[{grupo:'2',archivos:['pdf1','pdf2'],
  hojasPorJuego:10,juegos:1,subtotal:2035}];
 assert.equal(conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v}).cantidadArchivos,2);
 v.ficha.gruposAnillado[0].archivos=['pdf1'];
 assert.throws(()=>conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v}),/armado conjunto/);
});
test('rechaza inconsistencias de formato, copias y caras',()=>{
 for(const field of ['formato','caras','copias']){
  const {m,v}=fixture();
  m.items[0].opciones[field]=field==='copias'?2:'falso';
  assert.throws(()=>conciliarManifiestoV2ConServidor({manifiesto:m,verificacion:v}),/anillado u opciones/);
 }
});
