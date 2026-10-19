/**
 * API de cliente para el receptor PRIVADO de documentos.
 * No contiene endpoints configurados, credenciales ni despliegue.
 * "getTurnstileToken" debe obtener un token NUEVO en cada start (uso único).
 */
export function crearGatewayDocumentos({endpoint,getTurnstileToken,fetcher=fetch}){
 if(typeof endpoint!=='string'||!endpoint.startsWith('/')||endpoint.startsWith('//')||
  !/^\/api\/documentos-receiver(?:\?|$)/.test(endpoint))
  throw Error('La recepción debe ser una ruta relativa protegida del mismo sitio.');
 if(typeof getTurnstileToken!=='function'||typeof fetcher!=='function')
  throw Error('Faltan los controles de inicio seguro o conexión.');
 const request=async payload=>{
  const r=await fetcher(endpoint,{
   method:'POST',cache:'no-store',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload)
  });
  let data;
  try{data=await r.json()}catch(_){throw Error('Recepción no disponible: respuesta ilegible.')}
  if(!r.ok||!data||data.ok!==true)
   throw Error(data?.error||'No se pudo confirmar el archivo.');
  return data;
 };
 return {
  start:async meta=>{
   const token=await getTurnstileToken();
   if(typeof token!=='string'||token.length<10)throw Error('No se pudo verificar el inicio de la carga.');
   return request({op:'start',meta,turnstileToken:token});
  },
  status:session=>request({op:'status',...session}),
  part:payload=>request({op:'part',...payload}),
  finish:payload=>request({op:'finish',...payload})
 };
}
