/** Diagnóstico de los Workers de ensayo. GET únicamente; nunca crear pedidos ni pagos. */
const hosts=[
 {name:'central',host:'saber-pagos-pruebas.hernanchan.workers.dev',path:'/'},
 {name:'documentos',host:'saber-documentos-pruebas.hernanchan.workers.dev',path:'/'},
 {name:'polaroids',host:'saber-polaroids-express-pruebas.hernanchan.workers.dev',path:'/'}
];
const results=[];
for(const t of hosts){
 let result={service:t.name,reachable:false,http:null};
 try{
  const url='https://'+t.host+t.path;
  const response=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000)});
  result={service:t.name,reachable:true,http:response.status};
 }catch(err){result.error=err?.name||'NetworkError'}
 results.push(result);
}
for(const r of results)console.log('LIVE_GET_DIAGNOSTIC',JSON.stringify(r));
console.log('READ_ONLY_NO_PAYMENTS_NO_WRITES');
