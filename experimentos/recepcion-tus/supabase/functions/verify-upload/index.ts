/** Función de comprobación posterior a TUS; SOLO laboratorio, sin D1 ni cobros. */
import {createClient} from 'npm:@supabase/supabase-js@2'
import {PDFDocument} from 'npm:pdf-lib@1.17.1'
import {verifyPrivatePdf} from '../_shared/verification.mjs'

const ORIGIN = Deno.env.get('LAB_ALLOWED_ORIGIN') || 'http://localhost:4173'
const cors = {'Access-Control-Allow-Origin':ORIGIN,
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Vary':'Origin', 'Cache-Control':'no-store'}
const json = (body:Record<string,unknown>, status=200)=>new Response(JSON.stringify(body),
 {status,headers:{...cors,'content-type':'application/json; charset=utf-8'}})
Deno.serve(async request => {
 if(request.headers.get('origin')!==ORIGIN) return json({error:'Origen de laboratorio no autorizado'},403)
 if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
 if(request.method!=='POST') return json({error:'Método no permitido'},405)
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),
  service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!anon||!service) return json({error:'Laboratorio no configurado'},503)
 const authorization=request.headers.get('authorization')||''
 const match=/^Bearer (\S+)$/.exec(authorization)
 if(!match) return json({error:'Sesión obligatoria'},401)
 try {
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:authError}=await auth.auth.getUser(match[1])
  if(authError||!user) return json({error:'Sesión no autorizada'},401)
  const payload=await request.json()
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).sort().join(',')!=='expectedSha256,objectName')
    return json({error:'Datos inválidos'},400)
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const receipt=await verifyPrivatePdf({
   userId:user.id,objectName:payload.objectName,expectedSha256:payload.expectedSha256,
   readObject:async objectName=>{
    const {data,error}=await admin.storage.from('saber-tus-lab').download(objectName)
    if(error||!data) throw Error('Almacenamiento privado no disponible')
    return data
   },
   parsePages:async bytes=>{
    const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true})
    return pdf.getPageCount()
   },
  })
  return json(receipt)
 }catch(_){
  return json({verified:false,error:'El servidor no pudo confirmar el PDF privado'},422)
 }
})