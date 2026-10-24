-- Migración aditiva exclusiva de D1 de ensayos.
-- No elimina, vacía ni modifica tablas preexistentes.
-- Ejecutar únicamente tras comprobar el destino DB=saber-pagos-pruebas.
-- Se puede repetir gracias a IF NOT EXISTS.

-- Central de Pedidos: manifiestos de PDFs verificados por el backend privado.
-- Se conserva aparte del pago hasta que un pedido comercial coincidente
-- pueda vincularse sin ambigüedad. Nada de blobs, enlaces públicos o claves.
CREATE TABLE IF NOT EXISTS central_document_manifests (
 web_order_id TEXT PRIMARY KEY,
 commercial_order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
 amount_ars INTEGER NOT NULL CHECK(amount_ars>0 AND amount_ars<=50000000),
 file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 30),
 manifest_hash TEXT NOT NULL,
 manifest_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'verified_waiting_order'
  CHECK(status IN ('verified_waiting_order','linked_waiting_payment','linked_paid_pending_preparation')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 linked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_central_manifests_commercial_order
 ON central_document_manifests(commercial_order_id);
CREATE TABLE IF NOT EXISTS central_bridge_requests (
 request_id TEXT PRIMARY KEY,
 request_hash TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('stage','link')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- El mismo archivo/recibo privado jamás se asigna a dos pedidos.
CREATE TABLE IF NOT EXISTS central_document_receipts (
 receipt_id TEXT PRIMARY KEY,
 web_order_id TEXT NOT NULL REFERENCES central_document_manifests(web_order_id) ON DELETE CASCADE,
 file_id TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 UNIQUE(web_order_id,file_id)
);

-- Polaroids Express: un solo PDF imprimible verificado por pedido.
-- Es un manifiesto, NO un archivo: nada de datos originales o Drive compartido.
CREATE TABLE IF NOT EXISTS central_polaroids_express (
 reference TEXT PRIMARY KEY,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 bytes INTEGER NOT NULL CHECK(bytes BETWEEN 100 AND 12582912),
 photos INTEGER NOT NULL CHECK(photos BETWEEN 1 AND 24),
 sheets INTEGER NOT NULL CHECK(sheets BETWEEN 1 AND 4),
 amount_ars INTEGER NOT NULL CHECK(amount_ars IN (3000,6000,9000,12000)),
 commercial_order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 linked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_central_express_order
 ON central_polaroids_express(commercial_order_id);
