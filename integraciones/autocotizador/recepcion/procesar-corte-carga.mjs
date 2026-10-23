import {cotizarCorte} from './cotizar-corte.mjs';
export function procesarCorteCarga(a,i,paginas,precios,cortes,plan,pendientes){
 if(a.anillado!=='ninguno'){
  pendientes.push({indice:i,nombre:a.nombre,motivo:'Corte no admite anillado'});
  return;
 }
 const c=cotizarCorte({variante:a.corteVariante,metros:a.corteMetros,precios});
 const id='cor'+(cortes.length+1);
 cortes.push({id,nombre:a.nombre,...c});
 plan.push({indice:i,nombre:a.nombre,destino:'corte',id,
  paginasElegidas:paginas.map(p=>p.numero),metros:c.metros,variante:c.variante,
  nota:'Material de corte y contornos sujetos a validación de producción'});
}
