# Preparación del enlace de limpieza TUS: 6 noviembre 2026.
# Política: sin borrar PDF, sin habilitar cola ni ejecución, sin modificar main o producción.
# Debe terminar con SABER_DOCUMENTOS presente en la Central y tres compuertas OFF.
RUN_PRIVATE_WORKERS_PURGE_LINK_PREFLIGHT_2026_11_06
# Actualización de seguridad: aplicar canaria obligatoria de pedido en ambos Workers.
REDEPLOY_CANARY_GUARD_2026_11_06
# Protección positiva: configurar sólo WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4 en Central y Documentos.
# Las tres compuertas deben permanecer OFF.
DEPLOY_CANARIA_024_FLAGS_OFF_2026_11_06

# SOLO checkout de prueba canaria 024, sin cobros productivos.
# Las 3 compuertas de purga permanecen OFF en ambos Workers.
DEPLOY_CANARY_024_CHECKOUT_PRIVATE_20261106

# Compatibilidad con credencial DEMO_ADMIN_KEY ya existente: seguridad provista por HMAC privado.
REDEPLOY_SANDBOX_CANARY_WITH_EXISTING_ADMIN_VALIDATOR

# 06/11: Supabase Storage HEAD del PDF ya eliminado devuelve HTTP400 NoSuchKey.
# Recompilar Documentos con confirmación adicional /object/info, sin habilitar la purga.
DEPLOY_NO_SUCH_KEY_CONFIRMED_PATCH_FLAGS_OFF_20261106

# Canario 024 eliminado, no permitir iniciar otra preferencia MP.
# Guardar 3 flags de eliminación en OFF al desplegar el bloqueo 410.
DEPLOY_RETIRED_CANARY_024_CHECKOUT_BLOCKED_20261106
