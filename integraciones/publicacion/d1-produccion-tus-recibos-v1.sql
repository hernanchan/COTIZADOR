-- Librería Saber: esquema de recibos TUS verificados para D1 PRODUCCIÓN.
-- SOLO DDL: sin originales, pagos, preferencias ni datos de ensayo.
-- El servidor rechaza subida si esta tabla no está disponible.
CREATE TABLE IF NOT EXISTS central_r2_universal_tus_receipts (
 web_order_id TEXT NOT NULL,
 file_id TEXT NOT NULL,
 receipt_id TEXT NOT NULL UNIQUE,
 object_name TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 page_count INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(web_order_id,file_id),
 FOREIGN KEY(web_order_id,file_id)
 REFERENCES central_r2_universal_files(web_order_id,file_id) ON DELETE RESTRICT
);
