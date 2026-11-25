import test from 'node:test';
import assert from 'node:assert/strict';
import {
 aplicarConfiguracionCompartida,aplicarValorCompartido,
 establecerExcepcionDeArchivo,limpiarExcepcionDeArchivo,excepcionesDeArchivo
} from './configuracion-compartida-trabajos.mjs';

test('la configuración de trabajo aplica sobre cada archivo sin duplicar datos auxiliares',()=>{
 const file={modo:'bn',caras:'simple',copias:1,paginasPorHoja:1,anillado:'ninguno',grupoAnillado:''};
 aplicarConfiguracionCompartida(file,{modo:'color',caras:'double',copias:3,paginasPorHoja:2,anillado:'grupo:1'});
 assert.deepEqual({...file},{modo:'color',caras:'double',copias:3,paginasPorHoja:2,anillado:'grupo',grupoAnillado:'1'});
 assert.equal(Object.keys(file).some(k=>k.includes('Excepciones')),false);
});

test('una excepción por archivo sobrevive a cambios posteriores del valor compartido',()=>{
 const file={modo:'bn',caras:'simple',copias:1,paginasPorHoja:1,anillado:'ninguno',grupoAnillado:''};
 establecerExcepcionDeArchivo(file,'modo','color');
 establecerExcepcionDeArchivo(file,'anillado','grupo:2');
 aplicarConfiguracionCompartida(file,{modo:'bn',caras:'double',copias:4,anillado:'ninguno'});
 assert.equal(file.modo,'color');
 assert.equal(file.caras,'double');
 assert.equal(file.copias,4);
 assert.equal(file.anillado,'grupo');
 assert.equal(file.grupoAnillado,'2');
 assert.deepEqual(excepcionesDeArchivo(file),{modo:'color',anillado:'grupo:2'});
});

test('restablecer una excepción hace que tome el valor común en la próxima aplicación',()=>{
 const file={modo:'color'};
 establecerExcepcionDeArchivo(file,'modo','bn');
 limpiarExcepcionDeArchivo(file,'modo');
 aplicarConfiguracionCompartida(file,{modo:'color'});
 assert.equal(file.modo,'color');
 assert.deepEqual(excepcionesDeArchivo(file),{});
});

test('aplicar una opción común reemplaza solo la excepción de ese campo',()=>{
 const file={modo:'bn',anillado:'grupo',grupoAnillado:'2'};
 establecerExcepcionDeArchivo(file,'modo','color');
 establecerExcepcionDeArchivo(file,'anillado','grupo:3');
 aplicarValorCompartido(file,'modo','bn');
 assert.equal(file.modo,'bn');
 assert.equal(file.anillado,'grupo');
 assert.equal(file.grupoAnillado,'3');
 assert.deepEqual(excepcionesDeArchivo(file),{anillado:'grupo:3'});
});

test('rechaza opciones que no forman parte de la configuración compartida',()=>{
 assert.throws(()=>establecerExcepcionDeArchivo({},'seleccion','a4'),/desconocida/);
});
