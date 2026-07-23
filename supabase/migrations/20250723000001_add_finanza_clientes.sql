-- ============================================
-- Migración: Soporte multi-cliente por movimiento financiero
-- ============================================

-- Tabla pivote finanza <-> clientes
CREATE TABLE IF NOT EXISTS finanza_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finanza_id UUID REFERENCES finanzas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(finanza_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_finanza_clientes_finanza ON finanza_clientes(finanza_id);
CREATE INDEX IF NOT EXISTS idx_finanza_clientes_cliente ON finanza_clientes(cliente_id);

-- RLS permisivo
ALTER TABLE finanza_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo finanza_clientes" ON finanza_clientes;
CREATE POLICY "Acceso completo finanza_clientes" ON finanza_clientes
  FOR ALL USING (true) WITH CHECK (true);

-- Migrar datos existentes de finanzas.cliente_id hacia la tabla pivote
INSERT INTO finanza_clientes (finanza_id, cliente_id)
SELECT id, cliente_id
FROM finanzas
WHERE cliente_id IS NOT NULL
ON CONFLICT DO NOTHING;
