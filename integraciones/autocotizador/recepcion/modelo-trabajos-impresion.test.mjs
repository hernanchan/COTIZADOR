import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../../../precios-web.json' with {type:'json'};
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
import {
 crearTrabajo,agregarTrabajo,editarConfiguracionTrabajo,
 duplicarConfiguracionTrabajo,agregarArchivosTrabajo,quitarArchivoTrabajo,
 eliminarTrabajo,aplanarTrabajosParaCotizar
} from './modelo-trabajos-impresion.mjs';

const pages=(count=2)=>Array.from({length:count},(_,i)=>({
 numero:i+1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'
}));
const file=(id,nombre)=>({id,nombre,paginas:pages()});
const work=(id,nombre='Trabajo')=>crearTrabajo({
 id,nombre,servicio:'auto',configuracion:{seleccion:'a4',modo:'bn',caras:'simple'}
});

test('un trabajo comparte configuración entre varios archivos y cotiza con el motor actual',()=>{
 let works=agregarTrabajo([],work('w-1','Apuntes'));
 works=agregarArchivosTrabajo(works,'w-1',[file('f-1','uno.pdf'),file('f-2','dos.pdf')]);
 const flat=aplanarTrabajosParaCotizar(works);
 const quote=cotizarCargaUnica({archivos:flat.archivos,precios});
 assert.equal(flat.archivos.length,2);
 assert.deepEqual(flat.vinculos,[
  {indice:0,trabajoId:'w-1',archivoId:'f-1'},
  {indice:1,trabajoId:'w-1',archivoId:'f-2'}
 ]);
 assert.equal(quote.estado,'PRELIMINAR');
 assert.equal(quote.pendientes.length,0);
 assert.equal(quote.plan.length,2);
 assert.equal(quote.total,quote.subtotalImpresiones);
 assert.equal(Object.hasOwn(flat.archivos[0],'trabajoId'),false);
});

test('las excepciones individuales reemplazan solo el archivo elegido',()=>{
 let works=agregarTrabajo([],work('w-1'));
 works=agregarArchivosTrabajo(works,'w-1',[
  file('f-1','bn.pdf'),{...file('f-2','color.pdf'),excepciones:{modo:'color',materialColor:'obra70'}}
 ]);
 const flat=aplanarTrabajosParaCotizar(works);
 assert.equal(flat.archivos[0].modo,'bn');
 assert.equal(flat.archivos[1].modo,'color');
 assert.equal(flat.archivos[1].materialColor,'obra70');
 assert.equal(cotizarCargaUnica({archivos:flat.archivos,precios}).pendientes.length,0);
});

test('duplicar configuración crea otro trabajo sin arrastrar archivos',()=>{
 let works=agregarTrabajo([],work('w-1','Original'));
 works=agregarArchivosTrabajo(works,'w-1',[file('f-1','original.pdf')]);
 works=duplicarConfiguracionTrabajo(works,'w-1','w-2','Copia');
 assert.equal(works.length,2);
 assert.equal(works[1].nombre,'Copia');
 assert.deepEqual(works[1].configuracion,works[0].configuracion);
 assert.deepEqual(works[1].archivos,[]);
});

test('editar trabajo conserva originales y quitar/eliminar no afecta otros trabajos',()=>{
 let works=agregarTrabajo([],work('w-1','Uno'));
 works=agregarTrabajo(works,work('w-2','Dos'));
 works=agregarArchivosTrabajo(works,'w-1',[file('f-1','a.pdf'),file('f-2','b.pdf')]);
 works=agregarArchivosTrabajo(works,'w-2',[file('f-3','c.pdf')]);
 works=editarConfiguracionTrabajo(works,'w-1',{configuracion:{copias:4}});
 assert.deepEqual(works[0].archivos.map(f=>f.id),['f-1','f-2']);
 assert.equal(works[0].configuracion.copias,4);
 works=quitarArchivoTrabajo(works,'w-1','f-1');
 works=eliminarTrabajo(works,'w-1');
 assert.deepEqual(aplanarTrabajosParaCotizar(works).vinculos,[
  {indice:0,trabajoId:'w-2',archivoId:'f-3'}
 ]);
});

test('rechaza servicios, IDs y archivos inválidos antes de cotizar',()=>{
 for(const args of [
  {id:'w-1',servicio:'polaroids'},
  {id:'mal id',servicio:'auto'}
 ])assert.throws(()=>crearTrabajo(args),/inválido|habilitado/);
 const works=agregarTrabajo([],work('w-1'));
 assert.throws(()=>agregarArchivosTrabajo(works,'w-1',[file('f-1','a.pdf'),file('f-1','b.pdf')]),/repetido/);
 assert.throws(()=>aplanarTrabajosParaCotizar(works),/sin archivos/);
});