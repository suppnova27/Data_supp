-- ============================================
-- Migración defensiva: Asegurar columnas activa
-- ============================================

-- Asegurar que la columna activa exista en etiquetas
ALTER TABLE etiquetas ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- Asegurar que la columna activa exista en servicios
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- Asegurar que todas las filas existentes tengan activa = true
UPDATE etiquetas SET activa = true WHERE activa IS NULL;
UPDATE servicios SET activa = true WHERE activa IS NULL;

-- Asegurar que RLS permita acceso completo (anon y authenticated)
ALTER TABLE etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes y recrearlas de forma permisiva
DROP POLICY IF EXISTS "Acceso completo etiquetas" ON etiquetas;
DROP POLICY IF EXISTS "Acceso completo servicios" ON servicios;

CREATE POLICY "Acceso completo etiquetas" ON etiquetas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso completo servicios" ON servicios
  FOR ALL USING (true) WITH CHECK (true);
