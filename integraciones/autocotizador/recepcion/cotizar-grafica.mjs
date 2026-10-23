/** Snapshot de las variantes visibles en main:cotizador-web-v2.html (23/10/2026).
 * No forman parte de precios-web.json; verificar paridad al actualizar la web vigente.
 * Lote: cantidad exacta indicada en descripcion. NO equivalen a unidades sueltas.
 */
export const GRAFICA_COMERCIAL=Object.freeze([
 {id:'tarjetas-0',familia:'Tarjetas personales',descripcion:'100 unidades · simple faz',precioLote:18000},
 {id:'tarjetas-1',familia:'Tarjetas personales',descripcion:'100 unidades · doble faz',precioLote:30000},
 {id:'tarjetas-2',familia:'Tarjetas personales',descripcion:'1.000 unidades · barniz UV',precioLote:41000},
 {id:'tarjetas-3',familia:'Tarjetas personales',descripcion:'1.000 unidades · OPP mate doble faz',precioLote:54000},
 {id:'recetarios-0',familia:'Recetarios',descripcion:'15×21 B/N · 100 unidades',precioLote:5000},
 {id:'recetarios-1',familia:'Recetarios',descripcion:'15×21 B/N · 400 unidades',precioLote:15000},
 {id:'recetarios-2',familia:'Recetarios',descripcion:'10×15 B/N · 100 unidades',precioLote:3000},
 {id:'recetarios-3',familia:'Recetarios',descripcion:'10×15 B/N · 400 unidades',precioLote:10000},
 {id:'recetarios-4',familia:'Recetarios',descripcion:'10×15 color · 400 unidades',precioLote:18000},
 {id:'folletos-0',familia:'Folletos',descripcion:'B/N 10×15 · 100 unidades',precioLote:4800},
 {id:'folletos-1',familia:'Folletos',descripcion:'B/N 10×15 · 400 unidades',precioLote:13000},
 {id:'folletos-2',familia:'Folletos',descripcion:'Color 10×15 frente · 1.000 unidades',precioLote:37000},
 {id:'folletos-3',familia:'Folletos',descripcion:'Color 10×15 frente · 5.000 unidades',precioLote:110000},
 {id:'folletos-4',familia:'Folletos',descripcion:'Color 10×15 doble faz · 2.000 unidades',precioLote:87000}
]);
export function cotizarGrafica({productoId,lotes}){
 if(typeof productoId!=='string'||!Number.isSafeInteger(lotes)||lotes<1||lotes>500)
  throw Error('Producto o cantidad de lotes inválidos');
 const producto=GRAFICA_COMERCIAL.find(x=>x.id===productoId);
 if(!producto)throw Error('Variante gráfica no disponible');
 return {...producto,lotes,subtotal:producto.precioLote*lotes};
}
