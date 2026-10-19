// Regresión del cálculo de caras, hojas y salto automático a plotter.
// Node >= 20: node tests/autocotizador-imagenes.test.mjs
import assert from 'node:assert/strict';
import {classifyPrintSize,planImageSheets} from '../integraciones/autocotizador/pruebas/plan-impresion-imagenes.mjs';

assert.deepEqual(classifyPrintSize({widthCm:21,heightCm:29.7}),{route:'sheet',sheet:'A4'});
assert.deepEqual(classifyPrintSize({widthCm:42,heightCm:29.7}),{route:'sheet',sheet:'A3'});
assert.deepEqual(classifyPrintSize({widthCm:42,heightCm:59.4}),{route:'plotter',widthCm:42,heightCm:59.4,requiresPaperAndKind:true});
assert.deepEqual(classifyPrintSize({widthCm:60,heightCm:160}),{route:'plotter',widthCm:60,heightCm:160,requiresPaperAndKind:true});
assert.equal(classifyPrintSize({widthCm:120,heightCm:150}).route,'review');
assert.throws(()=>classifyPrintSize({widthCm:0,heightCm:30}),RangeError);

const a=planImageSheets({imageCount:9,perFace:9,orientation:'portrait'});
assert.equal(a.totalPhysicalSheets,1);assert.equal(a.totalPrintedFaces,1);
assert.deepEqual(a.grid,{rows:3,columns:3});
const b=planImageSheets({imageCount:10,perFace:9,copies:2});
assert.equal(b.printedFacesPerSet,2);assert.equal(b.physicalSheetsPerSet,2);
assert.equal(b.totalPhysicalSheets,4);assert.equal(b.lastFaceImages,1);
const c=planImageSheets({imageCount:10,perFace:9,copies:2,duplex:true});
assert.equal(c.totalPhysicalSheets,2);assert.equal(c.totalPrintedFaces,4);
const d=planImageSheets({imageCount:5,perFace:2,sheet:'A3',orientation:'landscape'});
assert.deepEqual(d.grid,{rows:1,columns:2});assert.equal(d.totalPhysicalSheets,3);
const e=planImageSheets({imageCount:19,perFace:4,copies:3,duplex:true});
assert.equal(e.printedFacesPerSet,5);assert.equal(e.totalPhysicalSheets,9);
assert.throws(()=>planImageSheets({imageCount:5,perFace:3}),RangeError);
assert.throws(()=>planImageSheets({imageCount:5,perFace:9,copies:0}),RangeError);
console.log('PASS: imposición 1/2/4/9 por hoja, copias, doble faz y transición A4 → A3 → plotter.');
