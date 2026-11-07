import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluarRiesgoPreprensaPloteo,PREPRENSA_UMBRAL_BYTES}
 from '../integraciones/autocotizador/recepcion/riesgo-preprensa-ploteo.mjs';
const mib=1024*1024;
const a1=[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'poster'}];
test('PDF de 150 MiB en una sola pagina A1: se recibe pero exige preprensa separada',()=>{
 const risk=evaluarRiesgoPreprensaPloteo({bytes:150*mib,paginas:a1});
 assert.equal(risk.estado,'PREPRENSA_A_REVISAR');
 assert.equal(risk.medidaA1Detectada,true);
 assert.equal(risk.revisionOperadorRecomendada,true);
 assert.equal(risk.requiereCopiaPreparada,true);
 assert.equal(risk.impresionAutomaticaAutorizada,false);
 assert.equal(risk.originalDebeConservarse,true);
 assert.equal(risk.tratamiento,'SEGUN_CONTENIDO_VERIFICADO');
 assert.ok(risk.motivos.includes('PAGINA_A1_PDF_PESADO'));
});
test('un plano A1 liviano no se diagnostica erroneamente como complejo por tamaño',()=>{
 const risk=evaluarRiesgoPreprensaPloteo({bytes:4*mib,paginas:a1});
 assert.equal(risk.estado,'SIN_ALERTA_DE_TAMANO');
 assert.equal(risk.revisionOperadorRecomendada,false);
 assert.equal(risk.requiereCopiaPreparada,false);
 assert.equal(risk.impresionAutomaticaAutorizada,false);
});
test('el aviso tambien se aplica a 60 MiB de ploteo fuera de A1',()=>{
 assert.equal(PREPRENSA_UMBRAL_BYTES,60*mib);
 const risk=evaluarRiesgoPreprensaPloteo({bytes:60*mib,
  paginas:[{numero:1,anchoCm:90,altoCm:120,modo:'cad'}]});
 assert.equal(risk.medidaA1Detectada,false);
 assert.equal(risk.revisionOperadorRecomendada,true);
 assert.deepEqual(risk.motivos,['PDF_PESADO_MAYOR_IGUAL_60_MIB']);
});
test('no se crean alertas sobre tamaños o metadatos no verificados',()=>{
 for(const input of [
  {bytes:NaN,paginas:a1},{bytes:0,paginas:a1},
  {bytes:257*mib,paginas:a1},
  {bytes:150*mib,paginas:[]},
  {bytes:150*mib,paginas:[{anchoCm:0,altoCm:84.1}]}
 ])assert.throws(()=>evaluarRiesgoPreprensaPloteo(input),/PREPRENSA_DATOS_NO_VERIFICADOS/);
});
