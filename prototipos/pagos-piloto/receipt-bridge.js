// Puente opcional EXCLUSIVO del piloto de pagos. Sin claves en URL ni almacenamiento.
window.saberPaymentReceipt=async function(receipt){
 const nonce=new URLSearchParams(location.search).get('pagosNonce');
 if(!nonce)return;
 if(!/^[a-f0-9-]{36}$/i.test(nonce)||!window.opener)throw Error('Abrí este ensayo desde el panel de pagos.');
 const origin='https://saber-pagos-pruebas.libreriasaber.workers.dev';
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(Error('La verificación del pago no respondió. Volvé al panel y reintentá el envío.'));},45000);
  function cleanup(){clearTimeout(timer);window.removeEventListener('message',onMessage)}
  function onMessage(event){if(event.origin!==origin||event.source!==window.opener||event.data?.nonce!==nonce||event.data?.type!=='SABER_PAYMENT_PROOF_RESULT')return;
   cleanup();event.data.ok?resolve():reject(Error(event.data.error||'No se confirmó la recepción para el pago.'));}
  window.addEventListener('message',onMessage);
  window.opener.postMessage({type:'SABER_PAYMENT_RECEIPT',nonce,...receipt},origin);
 });
};

