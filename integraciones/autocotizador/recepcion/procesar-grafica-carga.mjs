import {cotizarGrafica} from './cotizar-grafica.mjs';
export function procesarGraficaCarga(a,i,paginas,graficas,plan,pendientes){
 if(a.anillado!=='ninguno'||paginas.length!==1||!a.productoGrafica){pendientes.push({indice:i,nombre:a.nombre,motivo:'Elegí una página, variante y sin anillado'});return;}
 const calc=cotizarGrafica({productoId:a.productoGrafica,lotes:a.copias});
 const id='graf'+(graficas.length+1);
 graficas.push({...calc,productoId:calc.id,id,nombre:a.nombre});
 plan.push({indice:i,nombre:a.nombre,destino:'grafica',id,paginasElegidas:paginas.map(p=>p.numero),productoId:calc.id,lotes:calc.lotes,nota:'Sin diseño; producción sujeta a revisión técnica'});
}

