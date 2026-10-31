import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const client=read('client.js'),sql=read('supabase/001_lab.sql'),edge=read('supabase/functions/verify-upload/index.ts');
test('UI exige dos PDFs, sin cobro y sin checkout',()=>{
 assert.match(client,/maxNumberOfFiles:\s*2/);
 assert.match(client,/minNumberOfFiles:\s*2/);
 assert.match(client,/allowedFileTypes:\s*\['\.pdf', 'application\/pdf'\]/);
 assert.match(client,/outcome\?\.successful\?\.length !== 2/);
 assert.doesNotMatch(client,/(?:MercadoPago|checkoutEnabled|collectPayment|getPublicUrl)\s*\(/i);
});
test('Uppy TUS usa host directo firmado, seis MiB y dos carriles',()=>{
 assert.match(client,/storage\.supabase\.co\/storage\/v1\/upload\/resumable\/sign/);
 assert.match(client,/'x-signature'/);
 assert.match(client,/createSignedUploadUrl\(objectName\)/);
 assert.match(client,/6 \* 1024 \* 1024/);
 assert.match(client,/limit:\s*2/);
 assert.match(client,/await Promise\.all\(selected\.map\(f => entries\.get\(f\.id\)\?\.pending\)\)/);
});
test('Storage privado; solo ruta del dueño y sin SELECT público',()=>{
 assert.match(sql,/public=false/);
 assert.match(sql,/for insert to authenticated/);
 assert.match(sql,/storage\.foldername\(name\)/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.doesNotMatch(sql,/create policy[^;]*for select/ig);
 assert.doesNotMatch(client,/getPublicUrl|service_role|serviceRole/);
});
test('función verifica usuario servidor y descarga privada antes de devolver resultado',()=>{
 assert.match(edge,/auth\.getUser\(match\[1\]\)/);
 assert.match(edge,/admin\.storage\.from\('saber-tus-lab'\)\.download\(objectName\)/);
 assert.match(edge,/verifyPrivatePdf\(/);
 assert.match(edge,/PDFDocument\.load/);
 assert.doesNotMatch(edge,/getPublicUrl|createSignedUrl\(/);
});