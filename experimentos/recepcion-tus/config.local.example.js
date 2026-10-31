// Copiar a config.local.js. NUNCA colocar service_role ni secretos aquí.
// Solo la clave pública/publishable del proyecto SUPABASE FREE de laboratorio.
export const LAB_CONFIG = {
  projectUrl: '', // https://<project-ref>.supabase.co
  projectId: '',  // <project-ref>
  publishableKey: '', // sb_publishable_... o anon key pública
  bucket: 'saber-tus-lab',
  maxBytes: 20 * 1024 * 1024,
};