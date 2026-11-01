# Activación automatizada y aislada — Librería Saber
# Exclusivamente Worker saber-documentos-pruebas.
# Pruebas TUS y compilación obligatorias, secrets existentes heredados, 100% del tráfico SOLO al Worker de pruebas.
# Portal privado protegido con HTTP Basic, revertir automáticamente si falla la comprobación HTTP 401.
# Sin cambios a main, web comercial o cobros. Autorización: instrucciones reiteradas del propietario de activar ensayo TUS.
trigger=2026-11-01-tus-private-only

2026-11-01 - Revalidar despliegue exclusivamente privado con preflight SIN SUBIR archivos y codigos de etapa antes de recibir pedidos. Ultimos commits b8d67e71 6f13ef9c 749aa845 04a45a1a c134a908 bf04446e 2b53da19. Ejecucion obligatoria: pruebas integracion, compilacion y rollback si la proteccion privada falla. Sin pagos ni web comercial.

2026-11-01: corregir alcance Basic para llamadas TUS en /prueba-v2/api/ con cookie HttpOnly dedicada al nuevo prefijo; distinguir SESION_PRIVADA vs ORIGEN_SOLICITUD. Ejecución privada, rollback y CI obligatorios. Commits 8106e38b, 22479550, 4d7bf9b4, 9c205071, 80023ef6. No realizar cambios en web pública ni activar cobros.

2026-11-01 — Reintento CI tras identificar en logs run 41314740662 el único fallo: test esperaba AUTORIZACION_PORTAL pero la respuesta correcta ya es SESION_PRIVADA. Prueba ajustada commit d362dfdc. Activación solamente Worker privado con rollback y sitio comercial intacto.
