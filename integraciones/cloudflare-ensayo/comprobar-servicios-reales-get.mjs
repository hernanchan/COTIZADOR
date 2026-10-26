/** Diagnóstico GET de Workers aislados, sin tocar D1 ni emitir pagos. */
const probes=[
 {service:'central',url:'https://saber-pagos-pruebas.libreriasaber.workers.dev/health'},
 {service:'documentos',url:'https://saber-documentos-pruebas.libreriasaber.workers.dev/'}
];
let errors=0;
for(const probe of probes){
 try{
  const response=await fetch(probe.url,{method:'GET',redirect:'manual',
   signal:AbortSignal.timeout(12000)});
  let payload=null;
  if(probe.service==='central'&&response.ok){
   const t=await response.text();
   try{const data=JSON.parse(t);
    payload={environment:data?.environment,databaseReady:data?.databaseReady,
     configured:data?.configured,paymentsEnabled:data?.paymentsEnabled};
   }catch{payload={invalidJson:true}}
  }
  console.log('READ_ONLY_LIVE_CHECK',JSON.stringify({service:probe.service,
   status:response.status,health:payload}));
  if(probe.service==='central'&&(response.status!==200||payload?.environment!=='test'||
    payload?.databaseReady!==true||payload?.paymentsEnabled!==false))errors++;
 }catch(e){
  errors++;
  console.log('READ_ONLY_LIVE_CHECK',JSON.stringify({service:probe.service,
   error:e?.name||'NetworkError'}));
 }
}
console.log('READ_ONLY_NO_PAYMENTS_NO_WRITES');
if(errors)process.exitCode=1;
