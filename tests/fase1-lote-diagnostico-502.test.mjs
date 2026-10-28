import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(
 new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function fase4BatchStart(');
const end=source.indexOf('async function fase4Transfer(',start);
const body=source.slice(start,end);

test('inicio de lote conserva turno único, HMAC y precio nunca autorizado',()=>{
 assert.ok(start>0&&end>start);
 assert.match(body,/pilotVerifyTurnstile\(body.turnstileToken,env\)/);
 assert.match(body,/postToScript\(env,\{op:'multiStartBatch',metas:body.metas\},fetch,12000\)/);
 assert.match(body,/paymentAuthorized:false/);
 assert.match(body,/maxParallelUploads:2/);
});
test('502 distingue etapas sin revelar mensajes ni tokens internos',()=>{
 assert.match(body,/reasonCode:safeReason,retrySafe:true,paymentAuthorized:false/);
 assert.match(body,/GOOGLE_POST/);
 assert.match(body,/GOOGLE_REDIRECT_GET/);
 assert.match(body,/RESPUESTA_INCOMPATIBLE/);
 assert.match(body,/RECHAZO_RECEPTOR/);
 assert.match(body,/console.warn\('saber_batch_start_failure',safeReason\)/);
 assert.doesNotMatch(body,/reasonCode:err\.message/);
 assert.doesNotMatch(body,/error:err\.message/);
 assert.doesNotMatch(body,/token:err/);
});
test('rechazo de Apps Script no se confunde con falta de sesiones',()=>{
 assert.match(body,/if\(!reply.ok\)\{/);
 assert.match(body,/reply.errorCode/);
 assert.match(body,/if\(!Array.isArray\(reply.sessions\)/);
});
