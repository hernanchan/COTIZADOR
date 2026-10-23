import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
const base=()=>({nombre:'corte.pdf',paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'cad'}],
 paginasSeleccionadas:'',seleccion:'sin-confirmar',servicio:'corte',productoFoto:'',
 corteVariante:'gt3',corteMetros:1,copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',
 anillado:'ninguno',grupoAnillado:'',materialColor:''});
test('corte se agrega a total aunque no se confirme tamaño de hoja',()=>{
 const result=cotizarCargaUnica({archivos:[base()],precios});
 assert.equal(result.total,31200);
 assert.equal(result.subtotalCortes,31200);
 assert.equal(result.detalleCortes.length,1);
});
test('corte bajo mínimo comercial',()=>{
 const a=base();a.corteMetros=.1;
 assert.equal(cotizarCargaUnica({archivos:[a],precios}).total,5000);
});
