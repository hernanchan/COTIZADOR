/** Archivo QA sintético, inmutable y reconstruible para recepción POSTPAGO.
 * Sin metadatos de fecha, sin aleatorios, sin datos de compradores.
 * Cada ejecución devuelve los mismos bytes, SHA256 y dos páginas 10 × 15 cm.
 * Prohibido usar en producción como un original real del cliente.
 */
export function pdfFotosEnsayoReproducible(){
 const enc=new TextEncoder();
 let body='%PDF-1.4\n%SABER-QA\n';
 const offsets=[0];
 function add(id,content){
  offsets[id]=enc.encode(body).length;
  body+=id+' 0 obj\n'+content+'\nendobj\n';
 }
 const page=(streamNumber)=>'<< /Type /Page /Parent 2 0 R '+
  '/MediaBox [0 0 283.46 425.20] /Contents '+streamNumber+' 0 R /Resources << >> >>';
 const stream=(color)=>[
  'q',
  color+' rg',
  '0 0 283.46 425.20 re f',
  '1 1 1 rg',
  '26 34 230 360 re f',
  'Q',''
 ].join('\n');
 const contents=(data)=>'<< /Length '+enc.encode(data).length+' >>\nstream\n'+data+'endstream';
 add(1,'<< /Type /Catalog /Pages 2 0 R >>');
 add(2,'<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>');
 add(3,page(4)+' >>');
 add(4,contents(stream('0.18 0.46 0.71')));
 add(5,page(6)+' >>');
 add(6,contents(stream('0.73 0.30 0.20')));
 const start=enc.encode(body).length;
 body+='xref\n0 7\n0000000000 65535 f \n';
 for(let id=1;id<=6;id++)
  body+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';
 body+='trailer\n<< /Root 1 0 R /Size 7 >>\nstartxref\n'+start+'\n%%EOF\n';
 return enc.encode(body);
}
