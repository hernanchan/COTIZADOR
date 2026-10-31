import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const sql=read('supabase/001_lab.sql');
const worker=read('supabase/functions/one-time-test/index.ts');
const page=read('supabase/functions/one-time-test/page.ts');
const verify=read('supabase/functions/_shared/verification.mjs');

test('bucket sigue privado y no hay política abierta de subida anónima',()=>{
 assert.match(sql,/public=false/);
 assert.match(sql,/drop policy if exists "saber_tus_lab_upload_own_pdf"/);
 assert.doesNotMatch(sql,/create policy[^;]*for insert/ig);
 assert.doesNotMatch(sql,/create policy[^;]*for select/ig);
});

test('invitaciones guardan sólo un hash y tienen RLS sin acceso del navegador',()=>{
 assert.match(sql,/token_hash text not null unique/);
 assert.match(sql,/expires_at timestamptz not null/);
 assert.match(sql,/consumed_at timestamptz/);
 assert.match(sql,/alter table public\.lab_tus_invites enable row level security/);
 assert.match(sql,/revoke all on public\.lab_tus_invites from anon,authenticated/);
 assert.match(worker,/shaHex\(token\)/);
 assert.match(worker,/new Date\(data\.expires_at\)\.getTime\(\)<Date\.now\(\)/);
});

test('la autorización de dos PDF es de un solo uso y rutas aleatorias',()=>{
 assert.match(worker,/if\(row\.consumed_at\)return respond/);
 assert.match(worker,/sessionId=crypto\.randomUUID\(\)/);
 assert.match(worker,/createSignedUploadUrl\(objectName\)/);
 assert.match(worker,/\.is\('consumed_at',null\)/);
 assert.match(worker,/\.gt\('expires_at',new Date\(\)\.toISOString\(\)\)/);
 assert.match(worker,/signatures\.push\(\{objectName,signature:data\.token\}\)/);
});

test('la verificación vuelve a leer el PDF privado y valida SHA/páginas',()=>{
 assert.match(worker,/verifyPrivatePdf\(/);
 assert.match(worker,/storage\.from\(BUCKET\)\.download\(name\)/);
 assert.match(worker,/PDFDocument\.load/);
 assert.match(worker,/pagesExpected=\[16,94\]/);
 assert.match(worker,/row\.object_a,row\.object_b/);
 assert.match(verify,/subtle\.digest\('SHA-256',bytes\)/);
});

test('interfaz móvil prepara dos PDF automáticamente y usa TUS directo firmado',()=>{
 assert.match(page,/for\(let i=0;i<2;i\+\+\)/);
 assert.match(page,/i===0\?16:94/);
 assert.match(page,/await PDFDocument\.create\(\)/);
 assert.match(page,/uppy\.min\.mjs/);
 assert.match(page,/storage\.supabase\.co\/storage\/v1\/upload\/resumable\/sign/);
 assert.match(page,/x-signature/);
 assert.match(page,/retryDelays:\[0,1200,3000\]/);
 assert.match(page,/limit:2/);
 assert.match(page,/result\.successful\?\.length!==2/);
});

test('ensayo sin cobros ni D1, sin credenciales administrativas en la página',()=>{
 assert.match(worker,/ordersCreated:0,paymentsEnabled:false/);
 assert.doesNotMatch(page,/service_role|SUPABASE_SERVICE_ROLE_KEY|getPublicUrl|MercadoPago|checkoutPro/);
 assert.match(worker,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(page,/no se confirmó la recepción/i);
});
