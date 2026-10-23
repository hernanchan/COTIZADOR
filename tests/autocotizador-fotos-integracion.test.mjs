import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
const a=(servicio,productoFoto)=>({nombre:'x.pdf',paginas:[{numero:1,altoCm:29.7,anchoCm:21,modo:'cad'}],paginasSeleccionadas:'',seleccion:'a4',servicio,productoFoto,copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',materialColor:''});
test('suma foto y sticker',()=>{
 const x=cotizarCargaUnica({archivos:[a('fotos','foto_10x15'),a('stickers','')],precios});
 assert.equal(x.subtotalFotos,500);
 assert.equal(x.subtotalStickers,3000);
 assert.equal(x.total,3500);
});

test('polaroid separado del servicio de fotos',()=>{
 const x=cotizarCargaUnica({archivos:[a('fotos','foto_polaroid')],precios});
 assert.equal(x.total,null);
 assert.equal(x.estado,'INCOMPLETO');
});
