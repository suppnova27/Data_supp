-- ============================================
-- Migración: Crear tablas de Etiquetas y Servicios
-- ============================================

-- Tabla de etiquetas (categorías para filtrar servicios)
CREATE TABLE IF NOT EXISTS etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#0055af',
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de servicios (reemplaza el array hardcodeado)
CREATE TABLE IF NOT EXISTS servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  etiqueta_id UUID REFERENCES etiquetas(id) ON DELETE SET NULL,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_etiquetas_activa ON etiquetas(activa);
CREATE INDEX IF NOT EXISTS idx_servicios_activa ON servicios(activa);
CREATE INDEX IF NOT EXISTS idx_servicios_etiqueta ON servicios(etiqueta_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (permitir todo para usuarios autenticados)
CREATE POLICY "Acceso completo etiquetas" ON etiquetas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Acceso completo servicios" ON servicios
  FOR ALL USING (auth.role() = 'authenticated');

-- Insertar datos iniciales (los servicios actuales hardcodeados)
INSERT INTO etiquetas (nombre, color, activa) VALUES
  ('Limpieza', '#10b981', true),
  ('Desinfección', '#f59e0b', true),
  ('Corporativo', '#6366f1', true),
  ('Muebles', '#ec4899', true),
  ('General', '#64748b', true)
ON CONFLICT (nombre) DO NOTHING;

-- Servicios iniciales (los del array SERVICIOS_REALES)
INSERT INTO servicios (nombre, etiqueta_id, activa) 
SELECT '🧹 Limpieza Rutinaria', e.id, true FROM etiquetas e WHERE e.nombre = 'Limpieza'
UNION ALL
SELECT '🏠 Limpieza Profunda Integral', e.id, true FROM etiquetas e WHERE e.nombre = 'Limpieza'
UNION ALL
SELECT '🏗️ Limpieza Post Obra', e.id, true FROM etiquetas e WHERE e.nombre = 'Limpieza'
UNION ALL
SELECT '🛋️ Desinfección de Muebles y Alfombras', e.id, true FROM etiquetas e WHERE e.nombre = 'Desinfección'
UNION ALL
SELECT '🏢 Servicios Corporativos', e.id, true FROM etiquetas e WHERE e.nombre = 'Corporativo'
UNION ALL
SELECT '✨ Otro (Especificar)', e.id, true FROM etiquetas e WHERE e.nombre = 'General'
ON CONFLICT DO NOTHING;

-- Vista útil para obtener servicios activos con su etiqueta
CREATE OR REPLACE VIEW servicios_activos AS
SELECT 
  s.id,
  s.nombre,
  s.etiqueta_id,
  e.nombre AS etiqueta_nombre,
  e.color AS etiqueta_color,
  s.activa,
  s.created_at
FROM servicios s
LEFT JOIN etiquetas e ON s.etiqueta_id = e.id
WHERE s.activa = true AND (e.activa = true OR e.id IS NULL);