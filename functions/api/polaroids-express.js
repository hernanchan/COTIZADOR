/** Polaroids Express sólo en pruebas. Falta habilitación explícita del negocio.
 * Cloudflare Pages compila la dependencia pdf-lib desde el paquete Express.
 */
export {onRequestGet,onRequestPost} from '../../integraciones/polaroids/express/worker-express.mjs';
