import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
test('ploteo informa al cliente CAD/Postér y las medidas detectadas en centímetros',()=>{
 assert.match(client,/TIPO DETECTADO:/);
 assert.match(client,/MEDIDA DETECTADA:/);
 assert.match(client,/medida-ploteo-visible/);
 assert.match(client,/p\.anchoCm/);
 assert.match(client,/p\.altoCm/);
 assert.match(client,/Pág\. /);
});
