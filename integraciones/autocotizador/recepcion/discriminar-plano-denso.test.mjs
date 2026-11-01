import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 evidenciaPlanoTecnico,esCadVectorialDenso
} from './discriminar-plano-denso.mjs';

// Mediciones de preflight local del plano real ya facilitado por el
// usuario (SUM/cocheras 97,01 x 61,49 cm), SIN incluir su PDF en GitHub.
// 360px: ocupación 0,5054, color 0,4771.
// 720px: ocupación 0,3486. La textura roja de líneas se fusiona a baja resolución.
const plano='Planta Baja SUM ESC.1.100 Fachada Sur SUM Corte A-A SUM PLANIMETRIA MODIFICACION DE PROYECTO';
test('plano municipal rojo con líneas densas conserva CAD, no se confunde con Póster',()=>{
 assert.equal(evidenciaPlanoTecnico(plano),true);
 assert.equal(esCadVectorialDenso({texto:plano,
  miniatura:{modo:'poster',cobertura:0.5054,coberturaColor:0.4771,plenoContinuo:0.2312},
  detalle:{modo:'poster',cobertura:0.3486,coberturaColor:0.3134}
 }),true);
});
test('póster de color sólido no se transforma en CAD, aunque lleve un rótulo técnico',()=>{
 assert.equal(esCadVectorialDenso({texto:plano,
  miniatura:{modo:'poster',cobertura:0.6,coberturaColor:0.4},
  detalle:{modo:'poster',cobertura:0.59}
 }),false);
});
test('página de arte con mucho texto genérico nunca activa la corrección técnica',()=>{
 for(const texto of ['PROMOCIÓN GRAN OFERTA 50% DESCUENTO',
  'FOTOGRAFÍA A COLOR ESCALA REAL 1:1',
  'FOLLETO CON PROYECTO NUEVO',
  'COBERTURA COMPLETA DE ESTACIONAMIENTOS']){
  assert.equal(evidenciaPlanoTecnico(texto),false,texto);
  assert.equal(esCadVectorialDenso({texto,
   miniatura:{modo:'poster',cobertura:0.55,coberturaColor:0.4},
   detalle:{modo:'poster',cobertura:0.22}
  }),false,texto);
 }
});
test('clasificador no interviene ante diferencia marginal o falta de color',()=>{
 const base={texto:plano,miniatura:{modo:'poster',cobertura:0.5,coberturaColor:0.45}};
 for(const cobertura of [0.5,0.49,0.46,0.40,0.36]){
  const expected=cobertura===0.36;
  assert.equal(esCadVectorialDenso({...base,detalle:{modo:'poster',cobertura}}),
   expected,'cobertura '+cobertura);
 }
 assert.equal(esCadVectorialDenso({
  ...base,miniatura:{...base.miniatura,coberturaColor:0.03},
  detalle:{modo:'poster',cobertura:0.2}
 }),false);
 assert.equal(esCadVectorialDenso({
  ...base,miniatura:{...base.miniatura,modo:'cad'},
  detalle:{modo:'poster',cobertura:0.2}
 }),false);
});
test('se ejecuta el segundo raster SOLO para Póster con evidencia textual técnica',()=>{
 const code=readFileSync(
  new URL('./clasificar-paginas-ploteo.mjs',import.meta.url),'utf8');
 assert.match(code,/clasificacion\.modo==='poster'&&clasificacion\.cobertura>=0\.30&&\s*evidenciaPlanoTecnico\(texto\)/);
 assert.match(code,/scale:720\/Math\.max\(v\.width,v\.height\)/);
 assert.match(code,/esCadVectorialDenso\(/);
 assert.match(code,/cAlta\.width=0;cAlta\.height=0/);
});
