-- Librería Saber: migración ADITIVA, NO ejecutar sin identificar D1 del Worker productivo.
-- No almacena PII ni archivos. Retención sugerida 90 días, sujeto a aprobación.
CREATE TABLE IF NOT EXISTS saber_analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'page_view','quote_started','upload_started','upload_completed',
    'quote_viewed','checkout_started','payment_method_selected',
    'order_created','payment_confirmed','order_delivered')),
  session_id TEXT NOT NULL CHECK (length(session_id) BETWEEN 16 AND 64),
  event_time_ms INTEGER NOT NULL,
  stage TEXT CHECK (stage IS NULL OR stage IN ('inicio','archivo','precio','confirmacion','pago')),
  source TEXT NOT NULL CHECK (source IN ('cliente','servidor')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saber_analytics_time ON saber_analytics_events(event_time_ms);
CREATE INDEX IF NOT EXISTS idx_saber_analytics_session ON saber_analytics_events(session_id, event_type);
-- No crear índice único global por evento: un cliente puede visitar varias veces.
-- Ejecutar purga con tarea controlada SOLO después de definir retención.
