// Verificación reproducible sin servicios externos ni cobros. Node 24+ (node:sqlite).
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const cwd=resolve(import.meta.dirname,'..');
for(const file of ['tools/build-checkout-preview.mjs','tests/mercadopago-carrito.test.mjs','tests/polaroids-carrito.test.mjs','tests/polaroids-preparacion.test.mjs','tests/pagos-integral.test.mjs','tests/checkout-cliente.test.mjs'])
 execFileSync(process.execPath,[file],{cwd,stdio:'inherit'});
execFileSync('git',['diff','--exit-code','origin/pagos/mercadopago-checkout-pro-pruebas-20261017','--','vidriera','index.html','cotizador-web-v2.html','functions/api/polaroids-receiver.js','functions/api/polaroids-ping.js','integraciones/mercadopago/pruebas/wrangler.toml'],{cwd,stdio:'inherit'});
console.log('PASS: fuentes públicas, recepción existente y despliegue conservados sin cambios.');
