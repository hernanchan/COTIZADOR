import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../vidriera/polaroids/editor.html',import.meta.url),'utf8');
test('Polaroids Express presenta servicio independiente y recorrido breve',()=>{
 assert.match(html,/<title>Polaroids · Librería Saber<\/title>/);
 assert.match(html,/Servicio independiente/);
 assert.match(html,/aria-label="Pasos del pedido Polaroids"/);
 for(const text of ['Subí tus fotos','Ajustá los encuadres','Confirmá el pedido','6 fotos por hoja A4','$3.000 por hoja','máximo 24'])
  assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/hasta 60 juntas|Seleccioná hasta 60 imágenes/);
 assert.match(html,/id="preview"/);
 assert.match(html,/id="inputPhotos"/);
 assert.match(html,/id="btnPdf" disabled/);
 assert.match(html,/id="secureReceptionNotice"[^>]*hidden/);
 assert.match(html,/id="expressRecovery"[^>]*hidden/);
 assert.match(html,/<section class="panel left">/);
 assert.match(html,/<section class="panel right">/);
});
