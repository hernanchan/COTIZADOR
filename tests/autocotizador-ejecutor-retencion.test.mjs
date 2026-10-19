import assert from 'node:assert/strict';
import {ejecutarRetencionProtegida} from '../integraciones/autocotizador/retencion/ejecutor-seguro.mjs';
const root='root_documents_12345678',folder='folder_order_123456789';
const order={
 orderId:'WEB-123456',servicio:'documentos',rootFolderId:root,orderFolderId:folder,
 versionRegistro:'web-orders-v1',legacy:false,
 paymentStatus:'confirmed',filesStatus:'verified',productionStatus:'completed',
 deliveryStatus:'delivered',deliveredAt:'2026-09-10T12:00:00.000Z',
 files:[{id:'file_doc_id_12345678',logicalFileId:'pdf-1',orderId:'WEB-123456',
  rootFolderId:root,managedBy:'saber-web-orders-v1',state:'active'}]
};
let trashed=false,deleted=false,changed=0;
const adapter={
 getOrder:async()=>order,
 getFolder:async()=>({id:folder,trashed:false,parents:[root]}),
 getFile:async id=>({id,trashed,parents:[folder],
  appProperties:{source:'SABER_WEB_DOCUMENTS',orderId:'WEB-123456',fileId:'pdf-1'}}),
 trashFile:async()=>{trashed=true;changed++},
 deleteFileForever:async()=>{deleted=true;changed++},
 saveFileState:async(_order,_service,id,state,now)=>{
  assert.equal(order.files[0].id,id);order.files[0].state=state;
  if(state==='trashed')order.files[0].trashedAt=now;
 },
 audit:async()=>{}
};
const base={pedido:order.orderId,servicio:'documentos',roots:{documentos:root},
 adapter,now:Date.parse('2026-10-19T12:00:00.000Z')};
const off=await ejecutarRetencionProtegida(base);
assert.equal(off.razon,'LIMPIEZA_APAGADA');assert.equal(changed,0);
const enabled={...base,config:{enabled:true,mode:'execute'}};
const trash=await ejecutarRetencionProtegida(enabled);
assert.equal(trash.accion,'papelera');assert.equal(changed,1);assert.equal(trashed,true);
const guarded=await ejecutarRetencionProtegida({...enabled,now:Date.parse('2026-10-30T12:00:00.000Z')});
assert.equal(guarded.razon,'BORRADO_DEFINITIVO_APAGADO');assert.equal(changed,1);
const purged=await ejecutarRetencionProtegida({...enabled,
 now:Date.parse('2026-10-30T12:00:00.000Z'),
 config:{enabled:true,mode:'execute',allowPermanentDelete:true}});
assert.equal(purged.accion,'borrado_definitivo');assert.equal(deleted,true);
assert.equal(order.files[0].state,'purged');assert.equal(changed,2);
// Protección de carpeta distinta: si el metadato no corresponde, no borrar.
order.files[0].state='active';delete order.files[0].trashedAt;
trashed=false;deleted=false;changed=0;
adapter.getFile=async id=>({id,trashed:false,parents:['different_parent_12345'],
 appProperties:{source:'SABER_WEB_DOCUMENTS',orderId:'WEB-123456',fileId:'pdf-1'}});
await assert.rejects(()=>ejecutarRetencionProtegida(enabled),/no pertenece/);
assert.equal(changed,0);
console.log('PASS limpieza protegida: apagada, papelera, demora, purga y bloqueo por carpeta distinta.');
