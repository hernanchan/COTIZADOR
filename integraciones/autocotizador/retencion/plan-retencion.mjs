/**
 * Librería Saber — retención y eliminación segura de archivos web.
 * NO hace solicitudes de red ni borra archivos.
 *
 * Solo órdenes NUEVAS registradas expresamente en el manifiesto;
 * jamás escanear Drive entero ni carpetas históricas de Polaroids.
 */
export const POLITICA_PROPUESTA=Object.freeze({
 diasTrasEntrega:30,
 diasRecuperacion:7,
 modo:'simulacion',
 version:'borrador-20261019'
});
const ID=/^[A-Za-z0-9_-]{6,128}$/;
const DRIVE_ID=/^[A-Za-z0-9_-]{12,150}$/;
function epoch(iso){
 if(typeof iso!=='string'||!iso||!/^\d{4}-\d{2}-\d{2}T/.test(iso))return NaN;
 const t=Date.parse(iso);
 return Number.isFinite(t)?t:NaN;
}
function validDays(n){return Number.isSafeInteger(n)&&n>=1&&n<=3650;}
function timeStamp(now){
 const t=typeof now==='number'?now:now instanceof Date?now.getTime():epoch(now);
 if(!Number.isFinite(t)||t<0)throw Error('Fecha de evaluación inválida.');
 return t;
}
function noBorrar(razon,pedido){return {pedido,accion:'conservar',razon,archivos:[]}}
export function evaluarRetencionPedido(p,{now=Date.now(),policy=POLITICA_PROPUESTA,roots}={}){
 const nowMs=timeStamp(now);
 if(!validDays(policy?.diasTrasEntrega)||!validDays(policy?.diasRecuperacion))
  throw Error('Plazos de conservación inválidos.');
 // roots es una lista confiable de subcarpetas autorizadas administrativamente.
 if(!roots||typeof roots!=='object')throw Error('Faltan carpetas autorizadas.');
 if(!p||typeof p!=='object'||!ID.test(p.orderId||''))
  return noBorrar('pedido_no_identificado',p?.orderId||null);
 if(!['polaroids','documentos','imagenes','ploteos'].includes(p.servicio))
  return noBorrar('servicio_desconocido',p.orderId);
 const root=roots[p.servicio];
 if(!DRIVE_ID.test(root||'')||p.rootFolderId!==root)
  return noBorrar('carpeta_fuera_del_alcance',p.orderId);
 if(p.versionRegistro!=='web-orders-v1'||p.legacy===true)
  return noBorrar('historico_no_migrado',p.orderId);
 if(p.retenido===true||p.reclamoAbierto===true||p.reimpresionPendiente===true)
  return noBorrar('retencion_manual_o_reclamo',p.orderId);
 if(p.paymentStatus!=='confirmed'||p.filesStatus!=='verified'||
    p.productionStatus!=='completed'||p.deliveryStatus!=='delivered')
  return noBorrar('trabajo_no_entregado_o_sin_pago',p.orderId);
 const entregado=epoch(p.deliveredAt);
 if(!Number.isFinite(entregado)||entregado>nowMs)
  return noBorrar('fecha_de_entrega_invalida',p.orderId);
 if(!Array.isArray(p.files)||!p.files.length)
  return noBorrar('sin_archivos_registrados',p.orderId);
 const IDs=new Set();
 for(const f of p.files){
  if(!f||!DRIVE_ID.test(f.id||'')||IDs.has(f.id)||
     f.orderId!==p.orderId||f.rootFolderId!==root||
     f.managedBy!=='saber-web-orders-v1'||!['active','trashed','purged'].includes(f.state)||
     (f.state==='trashed'&&!Number.isFinite(epoch(f.trashedAt||'')))){
   return noBorrar('registro_de_archivos_incompleto',p.orderId);
  }
  IDs.add(f.id);
 }
 const trashed=p.files.filter(f=>f.state==='trashed');
 const active=p.files.filter(f=>f.state==='active');
 const purged=p.files.filter(f=>f.state==='purged');
 // Prohibición de purgar un grupo incompleto: si hay activos, no ejecutar purga.
 if(active.length&&trashed.length)return noBorrar('eliminacion_parcial_requiere_revision',p.orderId);
 if(active.length){
  const due=entregado+policy.diasTrasEntrega*86400000;
  if(nowMs<due)return noBorrar('periodo_de_conservacion',p.orderId);
  if(purged.length)return noBorrar('estado_de_archivos_inconsistente',p.orderId);
  return {pedido:p.orderId,servicio:p.servicio,accion:'papelera',razon:'entregado_y_plazo_cumplido',
          archivos:active.map(f=>f.id),fechaReferencia:p.deliveredAt};
 }
 if(trashed.length){
  if(purged.length)return noBorrar('eliminacion_parcial_requiere_revision',p.orderId);
  const fechas=trashed.map(f=>epoch(f.trashedAt));
  if(fechas.some(t=>t<entregado||t>nowMs))
   return noBorrar('fechas_de_papelera_invalidas',p.orderId);
  if(fechas.some(t=>nowMs<t+policy.diasRecuperacion*86400000))
   return noBorrar('periodo_de_recuperacion',p.orderId);
  return {pedido:p.orderId,servicio:p.servicio,accion:'borrado_definitivo',razon:'plazo_de_resguardo_cumplido',
          archivos:trashed.map(f=>f.id),fechaReferencia:p.deliveredAt};
 }
 return noBorrar('sin_archivos_que_eliminar',p.orderId);
}
export function planificarRetencion(pedidos,{now=Date.now(),policy=POLITICA_PROPUESTA,roots}={}){
 if(!Array.isArray(pedidos)||pedidos.length>10000)throw Error('Cantidad de pedidos inválida.');
 const ids=new Set(),archivos=new Set(),acciones=[];
 for(const p of pedidos){
  const r=evaluarRetencionPedido(p,{now,policy,roots});
  const groupId=r.pedido+':'+String(p?.servicio||'desconocido');
  if(r.pedido&&ids.has(groupId))throw Error('Pedido y servicio duplicados en inventario.');
  if(r.pedido)ids.add(groupId);
  for(const id of p?.files||[]){
   if(typeof id?.id!=='string')continue;
   if(archivos.has(id.id))throw Error('Archivo asignado a más de un pedido.');
   archivos.add(id.id);
  }
  acciones.push(r);
 }
 return Object.freeze({
  modo:'simulacion',fecha:new Date(timeStamp(now)).toISOString(),
  resumen:{conservar:acciones.filter(a=>a.accion==='conservar').length,
           papelera:acciones.filter(a=>a.accion==='papelera').length,
           definitivo:acciones.filter(a=>a.accion==='borrado_definitivo').length,
           archivosPotenciales:acciones.reduce((n,a)=>n+a.archivos.length,0)},
  acciones
 });
}
