Activar solamente la compuerta DOCS_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY en saber-pagos-pruebas, tras pruebas y comprobación de credenciales sandbox. No habilitar checkout comercial, no crear preferencias automáticamente. Exigir HTTP401 administrativo, health con pagos comerciales deshabilitados y rollback.

2026-11-02 — Reintento privado con espera de propagación Cloudflare y diagnóstico limitado a códigos HTTP; rollback y bloqueo comercial conservados.

2026-11-02 — Actualizar exclusivamente Worker privado saber-pagos-pruebas con corrección Checkout Pro init_point + vendedor test_user (commit 8c452bb, CI 41461600220 success). Conservar pagos comerciales cerrados, HMAC, estado D1, barrera seller test; verificación y rollback automático. No generar preferencias ni realizar pagos en despliegue.

2026-11-02 — Desplegar SOLO en saber-pagos-pruebas diagnóstico privado de intentos Mercado Pago por referencia de pedido, totalmente de lectura; sin datos del comprador, sin modificar D1, sin habilitar cobros comerciales. CI 41463211999 aprobado. Rollback y HTTP 401 obligatorios.

2026-11-02 — Actualizar exclusivamente saber-pagos-pruebas para ficha pagada con instrucciones por PDF y descarga privada de originales desde Worker documental (CI 41476065397 aprobado). Conservar flag sandbox, checkout comercial deshabilitado, D1, webhook, rollback automático y HTTP401/health. Sin alterar entorno de producción.

2026-11-02 — Habilitar SOLO en Central privada botón ZIP de PDF originales + orden de trabajo PDF A4 para pedidos pagados D1 review verified. Worker documental privado actualizado run 41481276667 success; pruebas paquete/ZIP 41481392584 success. No habilitar producción automática ni checkout comercial. Exigir HTTP401, health, rollback sin tocar libreriasaber.com.ar.

2026-11-02 — ACTIVAR seguimiento de producción solo en Central privada: CENTRAL_PRODUCTION_TRACKING_ENABLED=PRIVATE_TEST_ONLY, 4 estados + en espera, historial D1, responsable obligatorio y concurrencia por versión. CI 41526381673 aprobado. Mantener sandbox de MP y pagos comerciales deshabilitados; rollback y HTTP401 para endpoints privados. No web pública.

2026-11-02 — Activar tablero privado Kanban de producción: cuatro columnas (pendientes, preparación, listos, en espera), avance desde tarjetas con responsable registrado y control de versión D1, entregados en historial, ZIP directo y autoactualización de 30 s. Validación CI 41539964445 success. Solo saber-pagos-pruebas, resguardos HTTP401 + health y rollback; pagos comerciales y web pública intactos.

2026-11-02 — CORRECCIÓN de botón Iniciar preparación: si falta responsable, solicitarlo desde la propia tarjeta y conservarlo durante la sesión. Mostrar errores de validación o D1 junto al botón, sin ocultarlos al refrescar; forzar recarga después de transición confirmada. CI 41543922486 success, test de clic DOM incluido en workflow predeploy. Solo Worker privado saber-pagos-pruebas, conservar rollback HTTP401/health y producción intacta.

2026-11-03 — Registrar teléfono de contacto de comprador por pedido privado; tabla D1 central_order_contacts, visible únicamente en tarjetas y detalle admin con pago verificado. HMAC valida formato, sin números en URLs ni Storage. CI general 41621750472 y validación de teléfono aprobadas. Desplegar Central privado saber-pagos-pruebas con rollback, 401 y sin pagos reales, antes de desplegar formulario de documentos.
