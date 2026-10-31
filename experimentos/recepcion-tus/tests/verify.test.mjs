import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {validObjectName,verifyPrivatePdf} from '../supabase/functions/_shared/verification.mjs';
const uid = randomUUID(), name = uid+'/'+randomUUID()+'.pdf';
const bytes = Buffer.from('%PDF-1.7\n% archivo de laboratorio\n');
const sha256=createHash('sha256').update(bytes).digest('hex');
const data=()=>new Blob([bytes],{type:'application/pdf'});
const call=(options={})=>verifyPrivatePdf({userId:uid,objectName:name,expectedSha256:sha256,
 readObject:async()=>data(),parsePages:async()=>16,...options});
test('acepta únicamente ruta UUID del propietario y extensión PDF',()=>{
 assert.equal(validObjectName(uid,name),true);
 assert.equal(validObjectName(randomUUID(),name),false);
 assert.equal(validObjectName(uid,uid+'/../../secret.pdf'),false);
 assert.equal(validObjectName(uid,uid+'/archivo-original.pdf'),false);
 assert.equal(validObjectName(uid,uid+'/'+randomUUID()+'.exe'),false);
});
test('valida integridad SHA-256 y páginas informadas por parser',async()=>{
 const r=await call();assert.deepEqual(r,{verified:true,bytes:bytes.length,pages:16,sha256});
});
test('rechaza hash inventado aunque el navegador lo informe',async()=>{
 await assert.rejects(call({expectedSha256:'f'.repeat(64)}),/SHA-256/);
});
test('rechaza objeto de otro usuario sin descargar su contenido',async()=>{
 let reads=0;
 await assert.rejects(call({userId:randomUUID(),readObject:async()=>{reads++;return data()}}),/inválida/);
 assert.equal(reads,0);
});
test('rechaza cabecera distinta de PDF y tamaños fuera de límite',async()=>{
 await assert.rejects(call({readObject:async()=>new Blob(['falso'])}),/PDF/);
 await assert.rejects(call({readObject:async()=>new Blob([new Uint8Array(20*1024*1024+1)])}),/límite/);
});
test('rechaza conteo de páginas cero, incongruente o error del analizador',async()=>{
 for(const pages of [0,-1,2001,3.14])
  await assert.rejects(call({parsePages:async()=>pages}),/páginas/);
 await assert.rejects(call({parsePages:async()=>{throw Error('PDF ilegible')}}),/PDF ilegible/);
});
test('dos PDF independientes comprueban SHA y páginas, sin implicar almacenamiento real',async()=>{
 const objects=[16,94];const out=[];
 for(const pages of objects)out.push(await call({parsePages:async()=>pages}));
 assert.deepEqual(out.map(r=>r.pages),[16,94]);
 assert.ok(out.every(r=>r.verified));
});