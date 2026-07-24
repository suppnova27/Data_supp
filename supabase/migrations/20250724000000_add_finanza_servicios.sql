-- ============================================
-- Migración: Soporte multi-proyecto (servicios) por movimiento financiero
-- ============================================

-- Tabla pivote finanza <-> servicios
CREATE TABLE IF NOT EXISTS finanza_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finanza_id UUID REFERENCES finanzas(id) ON DELETE CASCADE,
  servicio_id UUID REFERENCES servicios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(finanza_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_finanza_servicios_finanza ON finanza_servicios(finanza_id);
CREATE INDEX IF NOT EXISTS idx_finanza_servicios_servicio ON finanza_servicios(servicio_id);

-- RLS permisivo
ALTER TABLE finanza_servicios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo finanza_servicios" ON finanza_servicios;
CREATE POLICY "Acceso completo finanza_servicios" ON finanza_servicios
  FOR ALL USING (true) WITH CHECK (true);
