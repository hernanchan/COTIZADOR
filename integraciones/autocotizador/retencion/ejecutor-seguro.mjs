/**
 * Librería Saber — motor de ejecución deliberadamente DESACTIVADO.
 * No importa Google Drive ni instala tareas; requiere un adaptador interno
 * autenticado con Drive y la base de pedidos (inexistente en esta fase).
 */
import {evaluarRetencionPedido,POLITICA_PROPUESTA} from './plan-retencion.mjs';
const SOURCES=Object.freeze({
 documentos:'SABER_WEB_DOCUMENTS',
 polaroids:'SABER_WEB_POLAROIDS_V2',
 imagenes:'SABER_WEB_IMAGES_V1',
 ploteos:'SABER_WEB_PLOTS_V1'
});
const VALID_ID=/^[A-Za-z0-9_-]{12,150}$/;
function adapterReady(adapter){
 return adapter&&['getOrder','getFolder','getFile','trashFile','deleteFileForever','saveFileState','audit']
  .every(n=>typeof adapter[n]==='function');
}
function assertPreflight(latest,plan,roots){
 const root=roots[latest.servicio];
 if(!VALID_ID.test(root||'')||latest.rootFolderId!==root||
    typeof latest.orderFolderId!=='string'||!VALID_ID.test(latest.orderFolderId))
  throw Error('Pedido sin carpeta de producción autorizada.');
 if(plan.pedido!==latest.orderId||plan.servicio!==latest.servicio)
  throw Error('Pedido o servicio no coinciden.');
}
export async function ejecutarRetencionProtegida({
 pedido,servicio,roots,policy=POLITICA_PROPUESTA,
 now=Date.now(),config={},adapter
}){
 // Habilitación explícita por servidor; imposible borrar accidentalmente
 // tras importar el módulo o activar un trigger sin configurar el backend.
 if(config.enabled!==true||config.mode!=='execute')return {
  ejecutado:false,razon:'LIMPIEZA_APAGADA',archivosModificados:0
 };
 if(!adapterReady(adapter))throw Error('Falta controlador privado de pedidos/Drive.');
 const latest=await adapter.getOrder(pedido,servicio);
 const plan=evaluarRetencionPedido(latest,{now,policy,roots});
 if(plan.accion==='conservar')return {
  ejecutado:false,razon:plan.razon,archivosModificados:0
 };
 if(plan.accion==='borrado_definitivo'&&config.allowPermanentDelete!==true)
  return {ejecutado:false,razon:'BORRADO_DEFINITIVO_APAGADO',archivosModificados:0};
 assertPreflight(latest,plan,roots);
 const folder=await adapter.getFolder(latest.orderFolderId);
 if(folder?.id!==latest.orderFolderId||folder?.trashed!==false||
    !Array.isArray(folder.parents)||!folder.parents.includes(roots[servicio]))
  throw Error('Carpeta de pedido no pertenece a la zona autorizada.');
 const source=SOURCES[servicio];
 // Todos los archivos deben pasar preflight ANTES de modificar el primero.
 for(const id of plan.archivos){
  const actual=await adapter.getFile(id);
  if(actual?.id!==id||!Array.isArray(actual.parents)||
    !actual.parents.includes(latest.orderFolderId)||
    actual.appProperties?.source!==source||
    actual.appProperties?.orderId!==latest.orderId||
    actual.appProperties?.fileId!==latest.files.find(f=>f.id===id)?.logicalFileId||
    actual.trashed!==(plan.accion==='borrado_definitivo')){
   throw Error('El archivo no pertenece al pedido o cambió su estado.');
  }
 }
 await adapter.audit({pedido,servicio,accion:plan.accion,
  fase:'preflight_aprobado',cantidad:plan.archivos.length});
 let changed=0;
 for(const id of plan.archivos){
  // En un entorno real, el adaptador debe usar operaciones idempotentes y
  // auditoría transaccional, y bloquear pedidos modificados concurrentemente.
  if(plan.accion==='papelera'){
   await adapter.trashFile(id);
   await adapter.saveFileState(pedido,servicio,id,'trashed',new Date(now).toISOString());
  }else{
   await adapter.deleteFileForever(id);
   await adapter.saveFileState(pedido,servicio,id,'purged',new Date(now).toISOString());
  }
  changed++;
  await adapter.audit({pedido,servicio,accion:plan.accion,
   fase:'archivo_confirmado',id});
 }
 return {ejecutado:true,accion:plan.accion,archivosModificados:changed};
}
