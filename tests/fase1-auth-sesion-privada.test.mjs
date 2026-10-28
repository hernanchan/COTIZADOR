import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
const start=source.indexOf('const V2_SESSION_COOKIE=');
const end=source.indexOf('async function v2PrivateBrowserResponse(',start);
assert.ok(start>0&&end>start);
const ctx=vm.createContext({crypto:webcrypto,TextEncoder,Date,URL,Response,Request});
vm.runInContext(source.slice(start,end),ctx);
const env={DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_SECRET:'a'.repeat(45)};
test('cookie firmada autoriza registro sin enviar Basic por JavaScript',async()=>{
 const cookie=await ctx.v2SessionCookie(env);
 assert.match(cookie,/Secure; HttpOnly; SameSite=Strict; Max-Age=1800/);
 assert.match(cookie,/Path=\/api\/ensayo-preparar-documentos-v2-lote/);
 const raw=cookie.split(';')[0];
 const request=new Request('https://example.test/api/ensayo-preparar-documentos-v2-lote',
  {method:'POST',headers:{Cookie:'otro=abc; '+raw+'; item=2'}});
 assert.equal(await ctx.v2SessionAuthorized(request,env),true);
});
test('rechaza cookie alterada, vencida, secreta diferente y bandera desactivada',async()=>{
 const signed=(await ctx.v2SessionCookie(env)).split(';')[0];
 const make=value=>new Request('https://example.test/',{headers:{Cookie:value}});
 assert.equal(await ctx.v2SessionAuthorized(make(signed.slice(0,-1)+(signed.endsWith('f')?'e':'f')),env),false);
 assert.equal(await ctx.v2SessionAuthorized(make(signed),{...env,DOCS_V2_PRIVATE_UI_SECRET:'b'.repeat(45)}),false);
 assert.equal(await ctx.v2SessionAuthorized(make(signed),{...env,DOCS_V2_PRIVATE_UI_ENABLED:'OFF'}),false);
 const timestamp=String(Math.floor(Date.now()/1000)-3600);
 const mac=await ctx.v2SessionMac(env.DOCS_V2_PRIVATE_UI_SECRET,timestamp);
 assert.equal(await ctx.v2SessionAuthorized(make('saber_v2_session='+timestamp+'.'+mac),env),false);
 assert.equal(await ctx.v2SessionAuthorized(make('foo=bar'),env),false);
});
test('la cookie solo se entrega al GET privado autenticado y habilita control POST',()=>{
 assert.match(source,/if\(path==='\/prueba-v2\/'\)\{[\s\S]{0,230}Set-Cookie':await v2SessionCookie\(env\)/);
 assert.match(source,/if\(difference&&v2PrivateBrowserAuthorized\(request,env\)!=='allow'&&\s*!\(await v2SessionAuthorized\(request,env\)\)\)/);
});
