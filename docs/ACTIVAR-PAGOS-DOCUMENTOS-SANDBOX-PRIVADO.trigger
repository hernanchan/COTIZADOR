Activar solamente la compuerta DOCS_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY en saber-pagos-pruebas, tras pruebas y comprobación de credenciales sandbox. No habilitar checkout comercial, no crear preferencias automáticamente. Exigir HTTP401 administrativo, health con pagos comerciales deshabilitados y rollback.

2026-11-02 — Reintento privado con espera de propagación Cloudflare y diagnóstico limitado a códigos HTTP; rollback y bloqueo comercial conservados.

2026-11-02 — Actualizar exclusivamente Worker privado saber-pagos-pruebas con corrección Checkout Pro init_point + vendedor test_user (commit 8c452bb, CI 41461600220 success). Conservar pagos comerciales cerrados, HMAC, estado D1, barrera seller test; verificación y rollback automático. No generar preferencias ni realizar pagos en despliegue.

2026-11-02 — Desplegar SOLO en saber-pagos-pruebas diagnóstico privado de intentos Mercado Pago por referencia de pedido, totalmente de lectura; sin datos del comprador, sin modificar D1, sin habilitar cobros comerciales. CI 41463211999 aprobado. Rollback y HTTP 401 obligatorios.

2026-11-02 — Actualizar exclusivamente saber-pagos-pruebas para ficha pagada con instrucciones por PDF y descarga privada de originales desde Worker documental (CI 41476065397 aprobado). Conservar flag sandbox, checkout comercial deshabilitado, D1, webhook, rollback automático y HTTP401/health. Sin alterar entorno de producción.

2026-11-02 — Habilitar SOLO en Central privada botón ZIP de PDF originales + orden de trabajo PDF A4 para pedidos pagados D1 review verified. Worker documental privado actualizado run 41481276667 success; pruebas paquete/ZIP 41481392584 success. No habilitar producción automática ni checkout comercial. Exigir HTTP401, health, rollback sin tocar libreriasaber.com.ar.
