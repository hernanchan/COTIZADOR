-- R2 producción: exclusivamente esquema de reservas y recibos preliminares.
-- No importa precios, pedidos, pagos ni archivos.
CREATE TABLE IF NOT EXISTS central_r2_large_reservations (
 object_key TEXT PRIMARY KEY,
 web_order_id TEXT NOT NULL,
 file_id TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','released')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(web_order_id,file_id)
);
CREATE TABLE IF NOT EXISTS central_r2_large_pending (
 receipt_id TEXT PRIMARY KEY,
 web_order_id TEXT NOT NULL,
 file_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL,
 etag TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 name TEXT NOT NULL,
 pages_claimed INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'awaiting_pdf_analysis'
   CHECK(status='awaiting_pdf_analysis'),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(web_order_id,file_id)
);
