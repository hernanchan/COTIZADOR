# Activación automatizada y aislada — Librería Saber
# Exclusivamente Worker saber-documentos-pruebas.
# Pruebas TUS y compilación obligatorias, secrets existentes heredados, 100% del tráfico SOLO al Worker de pruebas.
# Portal privado protegido con HTTP Basic, revertir automáticamente si falla la comprobación HTTP 401.
# Sin cambios a main, web comercial o cobros. Autorización: instrucciones reiteradas del propietario de activar ensayo TUS.
trigger=2026-11-01-tus-private-only

2026-11-01 - Revalidar despliegue exclusivamente privado con preflight SIN SUBIR archivos y codigos de etapa antes de recibir pedidos. Ultimos commits b8d67e71 6f13ef9c 749aa845 04a45a1a c134a908 bf04446e 2b53da19. Ejecucion obligatoria: pruebas integracion, compilacion y rollback si la proteccion privada falla. Sin pagos ni web comercial.
