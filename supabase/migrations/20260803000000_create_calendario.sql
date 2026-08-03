-- ============================================
-- Migración: Crear tabla de Calendario (Visitas y Proyectos)
-- ============================================

CREATE TABLE IF NOT EXISTS calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  hora TEXT,
  tipo TEXT NOT NULL DEFAULT 'Visita',
  titulo TEXT NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  servicio_id UUID REFERENCES servicios(id) ON DELETE SET NULL,
  etiqueta_id UUID REFERENCES etiquetas(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  notas TEXT,
  usuario_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas por fecha y relaciones
CREATE INDEX IF NOT EXISTS idx_calendario_fecha ON calendario(fecha);
CREATE INDEX IF NOT EXISTS idx_calendario_cliente ON calendario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_calendario_servicio ON calendario(servicio_id);
CREATE INDEX IF NOT EXISTS idx_calendario_etiqueta ON calendario(etiqueta_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE calendario ENABLE ROW LEVEL SECURITY;

-- Política de acceso (permitir todo para usuarios autenticados)
CREATE POLICY "Acceso completo calendario" ON calendario
  FOR ALL USING (auth.role() = 'authenticated');
