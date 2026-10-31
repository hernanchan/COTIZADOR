/**
 * LABORATORIO PRIVADO: dos PDF sintéticos, una invitación de un solo uso.
 * No hay autorización por usuario anónimo ni acceso directo a service_role.
 * NO importar a la web comercial. No integrar a D1, GAS ni pagos.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.49.4';
import {PDFDocument} from 'npm:pdf-lib@1.17.1';
import {verifyPrivatePdf} from './verification.mjs';
import {pageHtml} from './page.ts';

const PROJECT='qkbbqzbannyhuanngjpw';
const BUCKET='saber-tus-lab';
const MAX_AGE_MINUTES=90;
const RESPONSE_HEADERS={
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:RESPONSE_HEADERS});
const code=/^[0-9a-f]{64}$/;
const pagesExpected=[16,94];
async function shaHex(s:string) {
 const v=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 return Array.from(v).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function adminClient(){
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key) throw Error('LAB_BACKEND_UNAVAILABLE');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function invitation(admin:ReturnType<typeof createClient>,token:string){
 if(!code.test(token))return null;
 const hash=await shaHex(token);
 const {data,error}=await admin.from('lab_tus_invites')
   .select('id,expires_at,consumed_at,session_id,object_a,object_b')
   .eq('token_hash',hash).maybeSingle();
 if(error||!data||new Date(data.expires_at).getTime()<Date.now())return null;
 return data;
}
Deno.serve(async req=>{
 const url=new URL(req.url);
 const path=url.pathname;
 if(req.method==='OPTIONS')return respond({error:'No CORS'},403);
 if(req.method==='GET'&&!path.endsWith('/start')&&!path.endsWith('/verify')){
  const token=url.searchParams.get('k')||'';
  const admin=adminClient();
  const item=await invitation(admin,token);
  if(!item)return respond({error:'Enlace de ensayo ausente o vencido'},403);
  return new Response(pageHtml,{
    status:200,
    headers:{
     'Content-Type':'text/html; charset=utf-8',
     'Referrer-Policy':'no-referrer','Cache-Control':'no-store',
     'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff',
     'Content-Security-Policy':[
      "default-src 'none'",
      "script-src 'self' 'unsafe-inline' https://releases.transloadit.com https://esm.sh",
      "style-src 'self' 'unsafe-inline' https://releases.transloadit.com",
      "connect-src 'self' https://"+PROJECT+".storage.supabase.co https://esm.sh https://releases.transloadit.com",
      "img-src 'self' data: blob:","font-src 'self' data:",
     ].join('; '),
    },
  });
 }
 if(req.method!=='POST')return respond({error:'Método no permitido'},405);
 const token=req.headers.get('x-lab-token')||'';
 try{
  const admin=adminClient();
  const row=await invitation(admin,token);
  if(!row)return respond({error:'Invitación inexistente o vencida'},403);
  if(path.endsWith('/start')){
   if(row.consumed_at)return respond({error:'Prueba ya iniciada. No repetir.'},409);
   const sessionId=crypto.randomUUID();
   const paths=[0,1].map(()=>sessionId+'/'+crypto.randomUUID()+'.pdf');
   const signatures=[];
   for(const objectName of paths){
    const {data,error}=await admin.storage.from(BUCKET).createSignedUploadUrl(objectName);
    if(error||!data?.token)throw Error('LAB_SIGNING_FAILED');
    signatures.push({objectName,signature:data.token});
   }
   const {data:claimed,error:claimError}=await admin.from('lab_tus_invites')
    .update({consumed_at:new Date().toISOString(),session_id:sessionId,
      object_a:paths[0],object_b:paths[1]})
    .eq('id',row.id).is('consumed_at',null)
    .gt('expires_at',new Date().toISOString()).select('id').maybeSingle();
   if(claimError||!claimed)return respond({error:'Invitación ya utilizada'},409);
   return respond({ok:true,uploads:signatures,projectRef:PROJECT,bucket:BUCKET});
  }
  if(path.endsWith('/verify')){
   if(!row.consumed_at||!row.session_id||!row.object_a||!row.object_b)
    return respond({error:'La prueba no se inició correctamente'},409);
   const payload=await req.json().catch(()=>null);
   if(!payload||!Array.isArray(payload.files)||payload.files.length!==2)
    return respond({error:'Se necesitan exactamente dos PDF'},400);
   const acceptedPaths=[row.object_a,row.object_b];
   const result=[];
   for(let i=0;i<2;i++){
    const item=payload.files[i];
    if(!item||item.objectName!==acceptedPaths[i]||!code.test(item.expectedSha256))
     return respond({error:'Documento fuera de esta sesión'},403);
    const verified=await verifyPrivatePdf({
     userId:row.session_id,objectName:item.objectName,
     expectedSha256:item.expectedSha256,
     readObject:async name=>{
      const {data,error}=await admin.storage.from(BUCKET).download(name);
      if(error||!data)throw Error('LAB_OBJECT_MISSING');
      return data;
     },
     parsePages:async bytes=>{
      const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true});
      return pdf.getPageCount();
     },
    });
    if(verified.pages!==pagesExpected[i])throw Error('LAB_PAGE_COUNT_MISMATCH');
    result.push({pages:verified.pages,bytes:verified.bytes,sha256Match:true});
   }
   return respond({ok:true,files:result,verified:2,ordersCreated:0,paymentsEnabled:false});
  }
  return respond({error:'Operación no encontrada'},404);
 }catch(_){
  return respond({ok:false,error:'El laboratorio no pudo confirmar la operación'},422);
 }
});