/**
 * Etapa 1 del futuro carrito único (solo preparación; NO crear pedidos ni cobros).
 * La única fuente de precios es el CSV publicado de Google Sheets, validado en servidor.
 * Un stock no informado jamás se interpreta como disponibilidad confirmada.
 */
import {productosDesdeCsv} from './catalogo-productos-publicos.mjs';

const MAX_ITEMS=50,MAX_QTY=99,MAX_TOTAL_ARS=50_000_000;
const SKU=/^[a-zA-Z0-9_-]{1,48}$/;
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);

export function cotizarArticulosCarritoUnico({items,csv,inventario=null}={}){
 if(!Array.isArray(items)||items.length<1||items.length>MAX_ITEMS)
  throw Error('El carrito debe contener entre 1 y 50 artículos distintos.');
 if(typeof csv!=='string'||!csv)
  throw Error('Catálogo actualizado no disponible.');
 if(inventario!==null&&(typeof inventario!=='object'||Array.isArray(inventario)))
  throw Error('Inventario no válido.');
 const actuales=productosDesdeCsv(csv);
 const catalogo=new Map(actuales.map(p=>[p.code.toUpperCase(),p]));
 const usados=new Set(),lineas=[];
 let totalArs=0,stockConfirmado=true,bloqueadoPorStock=false;
 for(const item of items){
  if(!item||typeof item!=='object'||Array.isArray(item)||
     Object.keys(item).sort().join(',')!=='code,qty'||
     typeof item.code!=='string'||!SKU.test(item.code)||
     !Number.isSafeInteger(item.qty)||item.qty<1||item.qty>MAX_QTY)
   throw Error('Artículo o cantidad inválidos.');
  const clave=item.code.toUpperCase();
  if(usados.has(clave))throw Error('El carrito contiene artículos repetidos.');
  usados.add(clave);
  const p=catalogo.get(clave);
  if(!p)throw Error('Un producto ya no está disponible en el catálogo.');
  const unitario=p.finalPrice;
  const subtotal=unitario*item.qty;
  if(!Number.isSafeInteger(unitario)||unitario<=0||
     !Number.isSafeInteger(subtotal)||subtotal>MAX_TOTAL_ARS||
     totalArs+subtotal>MAX_TOTAL_ARS)
   throw Error('El importe del pedido supera el máximo permitido.');
  totalArs+=subtotal;
  let estadoStock='sin_confirmar';
  if(inventario!==null&&own(inventario,clave)){
   const existencias=inventario[clave];
   if(!Number.isSafeInteger(existencias)||existencias<0)
    throw Error('Existencias de artículo inválidas.');
   estadoStock=existencias>=item.qty?'disponible':'insuficiente';
  }
  if(estadoStock==='sin_confirmar')stockConfirmado=false;
  if(estadoStock==='insuficiente')bloqueadoPorStock=true;
  lineas.push(Object.freeze({
   tipo:'producto',codigo:p.code,nombre:p.name,
   cantidad:item.qty,precioUnitarioArs:unitario,
   subtotalArs:subtotal,ofertaAplicada:p.offer!==null,
   estadoStock
  }));
 }
 // NO habilitar checkout aunque todos tengan stock hasta integrar
 // reserva transaccional, pedido mixto, MP/transferencia LIVE y la Central.
 return Object.freeze({
  esquema:'saber-carrito-unico-articulos-fase1',
  moneda:'ARS',lineas:Object.freeze(lineas),
  totalArticulosArs:totalArs,stockConfirmado,bloqueadoPorStock,
  requiereConfirmarStock:!stockConfirmado,
  checkoutEnabled:false,paymentAuthorized:false
 });
}
