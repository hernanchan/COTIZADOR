-- R2 LIVE: auditoría de informe local previo a marcar original recibido.
-- Sólo estructura; sin precios, pedidos, pagos ni documentos.
CREATE TABLE IF NOT EXISTS central_r2_live_inspections (
 web_order_id TEXT NOT NULL,
 file_id TEXT NOT NULL,
 commercial_order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 receipt_id TEXT NOT NULL UNIQUE,
 quote_hash TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>41943040 AND bytes<=209715200),
 report_hash TEXT NOT NULL,
 operator TEXT NOT NULL,
 measured_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(web_order_id,file_id),
 FOREIGN KEY(web_order_id,file_id)
 REFERENCES central_r2_universal_files(web_order_id,file_id) ON DELETE RESTRICT
);
