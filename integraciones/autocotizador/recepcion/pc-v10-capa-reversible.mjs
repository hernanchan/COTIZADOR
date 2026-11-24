// Capa reversible V10. No importa ni modifica el motor comercial.
// Uso exclusivo con la copia verificada de la versión activa, no con un dist histórico.
// El gate apagado devuelve EXACTAMENTE la respuesta original.
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const GATE='GO_COMERCIAL_CONFIRMADO';
const anchors=['zonaArchivos','archivos','modoConfiguracion','configComunGlobal','estado','presupuesto','prepararPedido','resumenPedido','anilladosConjuntos','lista'];
export function crearCapaPcV10(base,{css,js}){
 if(typeof base?.fetch!=='function'||typeof css!=='string'||typeof js!=='string'||
    !css.trim()||!js.trim()||/<\/style/i.test(css)||/<\/script/i.test(js))
  throw Error('PC_V10_RECURSOS_INVALIDOS');
 const style='<style id="saber-pc-v10-layer-css">'+css+'</style>';
 const script='<script id="saber-pc-v10-layer-js">document.addEventListener("DOMContentLoaded",()=>{'+js+'},{once:true});</script>';
 return {...base,async fetch(request,env,ctx){
  const original=await base.fetch.call(base,request,env,ctx);
  const u=new URL(request.url);
  // Única ruta modificada. Sin cambios de sesión, precio, pagos, Central ni originales.
  if(env?.DOCS_LIVE_PC_V10_GATE!==GATE||request.method!=='GET'||
     u.origin!==ORIGIN||u.pathname!=='/cotizar/archivos'||
     u.searchParams.get('vista')==='movil'||original.status!==200||
     !/^text\/html\b/i.test(original.headers.get('Content-Type')||''))
   return original;
  try{
   // Solo se decora una respuesta autorizada del motor original.
   // No se modifica CSP ni se agregan rutas que puedan eludir autenticación.
   const csp=original.headers.get('Content-Security-Policy')||'';
   const policy=key=>csp.split(';').map(s=>s.trim().split(/\s+/)).find(p=>p[0]===key)||[];
   const permitsInline=key=>policy(key).includes("'unsafe-inline'")&&!policy(key).some(x=>/^'(nonce-|sha(256|384|512)-)/.test(x));
   if(!permitsInline('script-src')||!permitsInline('style-src')||
      policy('script-src-elem').length||policy('style-src-elem').length||
      original.headers.has('Content-Security-Policy-Report-Only'))return original;
   const html=await original.clone().text();
   if(html.length>250000||html.includes('saber-pc-v10-layer-')||
      html.split('</head>').length!==2||html.split('</body>').length!==2||
      anchors.some(id=>!html.includes('id="'+id+'"'))||
      ['/cotizar/archivos.js','/cotizar/movil.js','SABER_SMART_RESIZE'].some(s=>!html.includes(s)))
    return original;
   const modified=html.replace('</head>',style+'</head>').replace('</body>',script+'</body>');
   if(modified.replace(style,'').replace(script,'')!==html)return original;
   const headers=new Headers(original.headers);
   for(const name of ['Content-Length','Content-Encoding','ETag','Digest','Content-Digest','Repr-Digest'])headers.delete(name);
   headers.set('Cache-Control','no-store, private');
   return new Response(modified,{status:original.status,statusText:original.statusText,headers});
  }catch{return original;}
 }};
}
