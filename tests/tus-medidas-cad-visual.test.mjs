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

test('receptor TUS privado anuncia y controla el maximo de 10 PDF antes de subir',()=>{
 const portal=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
 assert.match(portal,/const MAX_PDF_PRIVADOS=TUS_ENABLED\?10:30/);
 assert.match(portal,/existing\+payload\.files\.length>MAX_PDF_PRIVADOS/);
 assert.match(portal,/allEntries\.length>MAX_PDF_PRIVADOS/);
});
