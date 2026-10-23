import test from 'node:test';
import assert from 'node:assert/strict';
import {contieneRotuloTecnico,refinarTipoPlano} from '../integraciones/autocotizador/recepcion/refinar-tipo-plano.mjs';
const p=(modo,rotuloTecnico=true,cobertura=.2)=>({modo,rotuloTecnico,cobertura});
test('detecta titulo CAD con referencia DWG',()=>{assert.equal(contieneRotuloTecnico('PROYECTO PLANO: Planimetria de Montantes ARCHIVO: 628-MNT-PB-CASA MORE.dwg ESCALAS: 1:75'),true);});
test('24 laminas tecnicas sin falsos posters',()=>{const pages=[p('poster',true,.304),...Array.from({length:20},(_,i)=>p(i===2||i===4?'revision':'cad',true,.22)),p('revision',true,.191),p('cad'),p('cad')];assert.equal(pages.length,24);const actual=refinarTipoPlano(pages);assert.equal(actual.every(x=>x.modo==='cad'),true);});
test('dos laminas mixtas no cambian',()=>{const pages=[p('cad'),p('poster')];assert.deepEqual(refinarTipoPlano(pages),pages);});
test('poster pleno no se convierte',()=>{const pages=[...Array.from({length:8},()=>p('cad')),p('poster',true,.68),p('revision',false,.2)];const a=refinarTipoPlano(pages);assert.equal(a[8].modo,'poster');assert.equal(a[9].modo,'revision');});