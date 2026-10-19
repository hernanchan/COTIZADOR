/*
 * Librería Saber | solo cálculo de distribución y ruta de impresora.
 * Preparación aislada: no procesa archivos, no genera PDF, no cotiza ni cobra.
 * Los importes deberán venir del motor de precios verificado en servidor.
 */
const layoutOptions=new Set([1,2,4,9]);
const dimensions={A4:[21,29.7],A3:[29.7,42]};
const tolerance=0.0001;
function positiveInteger(n,label,max){
 if(!Number.isSafeInteger(n)||n<1||n>max)throw new RangeError(label+" fuera de rango");
 return n;
}
function fits(width,height,format){
 const [short,long]=dimensions[format];
 return Math.min(width,height)<=short+tolerance&&Math.max(width,height)<=long+tolerance;
}
export function classifyPrintSize({widthCm,heightCm}){
 if(!Number.isFinite(widthCm)||!Number.isFinite(heightCm)||widthCm<=0||heightCm<=0)
  throw new RangeError("Las medidas de impresión deben ser positivas");
 if(fits(widthCm,heightCm,"A4"))return {route:"sheet",sheet:"A4"};
 if(fits(widthCm,heightCm,"A3"))return {route:"sheet",sheet:"A3"};
 // El rollo más ancho de la configuración conocida tiene 90 cm.
 const possibleWidth=Math.min(widthCm,heightCm);
 if(possibleWidth>90+tolerance)return {route:"review",reason:"Ninguna orientación cabe en el rollo de 90 cm"};
 return {route:"plotter",widthCm,heightCm,requiresPaperAndKind:true};
}
export function planImageSheets({imageCount,perFace=1,copies=1,duplex=false,sheet="A4",orientation="portrait"}){
 positiveInteger(imageCount,"Cantidad de imágenes",500);
 positiveInteger(copies,"Cantidad de juegos",500);
 if(!layoutOptions.has(perFace))throw new RangeError("Usar 1, 2, 4 o 9 imágenes por cara");
 if(!Object.hasOwn(dimensions,sheet))throw new RangeError("Elegir formato A4 o A3");
 if(!["portrait","landscape"].includes(orientation))throw new RangeError("Orientación inválida");
 if(typeof duplex!=="boolean")throw new TypeError("Doble faz debe ser verdadero o falso");
 const grid=perFace===1?{rows:1,columns:1}:perFace===2?
  (orientation==="portrait"?{rows:2,columns:1}:{rows:1,columns:2}):
  perFace===4?{rows:2,columns:2}:{rows:3,columns:3};
 const printedFacesPerSet=Math.ceil(imageCount/perFace);
 const physicalSheetsPerSet=Math.ceil(printedFacesPerSet/(duplex?2:1));
 return Object.freeze({
  route:"sheet",sheet,orientation,grid,perFace,imageCount,copies,duplex,
  printedFacesPerSet,physicalSheetsPerSet,
  totalPrintedFaces:printedFacesPerSet*copies,
  totalPhysicalSheets:physicalSheetsPerSet*copies,
  // El último juego no comparte hoja con el siguiente.
  lastFaceImages:imageCount%perFace||perFace
 });
}
