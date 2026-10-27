import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs',import.meta.url),'utf8');
const ctx=createContext({});
runInContext(source,ctx);
const code=message=>ctx.docsReceptionReasonCode(new Error(message));
test('distingue cupo global, por pedido y estado de índice',()=>{
 assert.equal(code('Cupo global de ensayo agotado'),'GLOBAL_CAP');
 assert.equal(code('Límite de 30 archivos o 60 MiB por pedido excedido'),'ORDER_CAP');
 assert.equal(code('Índice sin estado de sesión'),'INDEX_INVALID');
 assert.equal(code('Identificador de ensayo en uso'),'FILE_ID_CONFLICT');
 assert.equal(code('Metadatos de ensayo incorrectos'),'BAD_META');
 assert.equal(code('Piloto ocupado'),'BUSY');
});
test('nunca expone secretos ni errores internos al usuario',()=>{
 assert.equal(code('GoogleDrive ERROR bearer=secret'),'RECEPTOR_ERROR');
 assert.match(source,/errorCode:signed\?docsReceptionReasonCode\(err\):'UNAUTHORIZED'/);
 assert.doesNotMatch(source,/error:err\.message/);
});
test('diagnóstico de cupo solo cuenta sesiones y no elimina archivos',()=>{
 ctx.DOCS_MULTI_GLOBAL_CAP=120;
 ctx.DOCS_MULTI_CAP=30;
 ctx.DOCS_TTL=6*86400000;
 ctx.docsMultiIds=()=>['one','two'];
 ctx.docsRead=id=>({orderId:id==='one'?'WEB-uno':'WEB-dos'});
 const result=ctx.docsMultiCapacityDiagnostico();
 assert.equal(result.used,2);
 assert.equal(result.globalLimit,120);
 assert.equal(result.activeOrders,2);
 assert.equal(result.expiryDays,6);
 assert.equal(result.status,'AVAILABLE');
});
