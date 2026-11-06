# R2 — Ensayos PDF grandes | 06/11/2026

## Intentos efectivamente ejecutados
- https://github.com/hernanchan/COTIZADOR/actions/runs/42247706791
  - `SABER_CF_DEPLOY_TOKEN`: Cloudflare REST R2 GET buckets -> HTTP **403**, código **10000**, `Authentication error`.
- https://github.com/hernanchan/COTIZADOR/actions/runs/42247890803
  - `SABER_CF_EDITOR_TOKEN`: Cloudflare REST R2 GET buckets -> HTTP **401**, código **10000**, `Authentication error`.
- **No se creó bucket** y no se modificaron Workers, Supabase, D1, pagos, `main` ni libreriasaber.com.ar.
- Docs Cloudflare oficial: https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/create/  requiere `Workers R2 Storage Write`.
- Suscripción R2: https://developers.cloudflare.com/r2/get-started/ ; puede exigir activar facturación. Tier gratuito Standard: https://developers.cloudflare.com/r2/pricing/ (10 GB-mes, 1M operaciones clase A, 10M clase B; excedentes facturables).

## Automatización lista en Github
- Workflow `.github/workflows/r2-habilitar-bucket-ensayo.yml`; al modificar `docs/HABILITAR-R2-ENSAYO.trigger` consulta y crea idempotentemente `saber-documentos-grandes-ensayo-20261106` con clase Standard y sin dominio público; verifica existencia. No añade todavía binding a Worker ni expone archivos.
- Seguridad: usar secreto GitHub de cuenta exclusivo `SABER_CF_R2_ADMIN_TOKEN` con API Token Cloudflare que tenga permiso de cuenta `Workers R2 Storage Write`; no sobreescribir `SABER_CF_DEPLOY_TOKEN` ni `SABER_CF_EDITOR_TOKEN`. No guardar tokens en código ni en chat.
- Usuario debe habilitar la suscripción R2 en Cloudflare y crear el token/registrarlo en GitHub. Son acciones inaccesibles desde las herramientas actuales; después el asistente puede volver a ejecutar workflow desde Github actualizando el trigger.
- Una vez exista bucket, falta integrar subida multipart privada de PDF grande, validación con streaming/partes, misma Central D1, descarga y borrado de entregados. No declarar recepción de archivos grandes lista por el simple alta de R2.
