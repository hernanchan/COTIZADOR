-- Migración aditiva. Aplicar primero en D1 de pruebas; producción requiere autorización.
-- Guarda únicamente eventos de navegación sin PII, con idempotencia por event_id.
CREATE TABLE IF NOT EXISTS saber_analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE CHECK (length(event_id) BETWEEN 16 AND 64),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'page_view','quote_started','upload_started','upload_completed',
    'quote_viewed','checkout_started','payment_method_selected')),
  session_id TEXT NOT NULL CHECK (length(session_id) BETWEEN 16 AND 64),
  event_time_ms INTEGER NOT NULL,
  stage TEXT CHECK (stage IS NULL OR stage IN ('inicio','archivo','precio','confirmacion','pago')),
  source TEXT NOT NULL DEFAULT 'cliente' CHECK (source='cliente'),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saber_analytics_time ON saber_analytics_events(event_time_ms);
CREATE INDEX IF NOT EXISTS idx_saber_analytics_session ON saber_analytics_events(session_id, event_type);
-- Retención: 90 días. La purga debe programarse en el Worker después de revisar la integración.
