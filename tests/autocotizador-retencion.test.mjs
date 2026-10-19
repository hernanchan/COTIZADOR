import assert from 'node:assert/strict';
import {evaluarRetencionPedido,planificarRetencion,POLITICA_PROPUESTA} from '../integraciones/autocotizador/retencion/plan-retencion.mjs';
const roots={documentos:'root_doc_folder_123456',polaroids:'root_pol_folder_123456',
 imagenes:'root_img_folder_123456',ploteos:'root_plot_folder_123456'};
const now='2026-10-19T12:00:00.000Z';
const doc={orderId:'WEB-123456',servicio:'documentos',rootFolderId:roots.documentos,
 versionRegistro:'web-orders-v1',legacy:false,retenido:false,reclamoAbierto:false,
 reimpresionPendiente:false,paymentStatus:'confirmed',filesStatus:'verified',
 productionStatus:'completed',deliveryStatus:'delivered',
 deliveredAt:'2026-09-10T12:00:00.000Z',
 files:[{id:'doc_file_id_12345678',orderId:'WEB-123456',rootFolderId:roots.documentos,
  managedBy:'saber-web-orders-v1',state:'active'}]};
const evaluate=p=>evaluarRetencionPedido(p,{now,roots});
assert.equal(POLITICA_PROPUESTA.modo,'simulacion');
assert.equal(evaluate(doc).accion,'papelera');
assert.equal(evaluate({...doc,deliveryStatus:'pending'}).accion,'conservar');
assert.equal(evaluate({...doc,productionStatus:'printing'}).accion,'conservar');
assert.equal(evaluate({...doc,paymentStatus:'pending'}).accion,'conservar');
assert.equal(evaluate({...doc,filesStatus:'receiving'}).accion,'conservar');
assert.equal(evaluate({...doc,reclamoAbierto:true}).accion,'conservar');
assert.equal(evaluate({...doc,reimpresionPendiente:true}).accion,'conservar');
assert.equal(evaluate({...doc,retenido:true}).accion,'conservar');
assert.equal(evaluate({...doc,legacy:true}).accion,'conservar');
assert.equal(evaluate({...doc,versionRegistro:'polaroids-antiguos'}).accion,'conservar');
assert.equal(evaluate({...doc,rootFolderId:'another_root_folder_1234'}).accion,'conservar');
assert.equal(evaluate({...doc,deliveredAt:'2026-10-15T12:00:00.000Z'}).accion,'conservar');
assert.equal(evaluate({...doc,files:[{...doc.files[0],id:'something_else_1234567',rootFolderId:'another_root_folder_1234'}]}).accion,'conservar');
const trashed={...doc,files:[{...doc.files[0],state:'trashed',trashedAt:'2026-10-10T12:00:00.000Z'}]};
assert.equal(evaluate(trashed).accion,'borrado_definitivo');
assert.equal(evaluate({...trashed,files:[{...trashed.files[0],trashedAt:'2026-10-17T12:00:00.000Z'}]}).accion,'conservar');
assert.equal(evaluate({...trashed,files:[{...trashed.files[0],trashedAt:'2026-10-11T12:00:00.000Z'}],reclamoAbierto:true}).accion,'conservar');
const pol={...doc,servicio:'polaroids',rootFolderId:roots.polaroids,
 files:[{...doc.files[0],id:'pol_file_id_12345678',rootFolderId:roots.polaroids}]};
const plan=planificarRetencion([doc,pol,trashed].filter((x,i)=>i!==2),{now,roots});
assert.equal(plan.modo,'simulacion');
assert.equal(plan.resumen.papelera,2);
assert.equal(plan.resumen.archivosPotenciales,2);
assert.throws(()=>planificarRetencion([doc,{...pol,files:[{...pol.files[0],id:doc.files[0].id}]}],{now,roots}),/Archivo asignado/);
assert.throws(()=>planificarRetencion([doc,doc],{now,roots}),/Pedido y servicio duplicados/);
assert.throws(()=>evaluarRetencionPedido(doc,{now,roots,policy:{diasTrasEntrega:0,diasRecuperacion:7}}),/Plazos/);
console.log('PASS retención: nunca históricos/pendientes; 30+7, identidad, carpetas, reclamos y simulación.');
