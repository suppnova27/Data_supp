-- ============================================================
-- Migración: Proyectos como entidad + Personal/Anticipos + Origen de leads
-- Fecha: 2026-08-24
--
-- 1. Tabla `proyectos`: se crea desde el menú Etiquetas y se puede
--    vincular a un movimiento financiero (gasto o ingreso).
-- 2. `finanzas.personal_id`: vincula el movimiento (ej. anticipo/adelanto)
--    directamente con la cuenta del personal en `directorio_cuentas`.
-- 3. `finanzas.proyecto_id`: vincula el movimiento con un proyecto.
-- 4. `clientes.origen` / `clientes.tipo_registro`: origen del lead
--    (Facebook, Instagram, TikTok, etc.) y tipo de registro (Lead/Cliente).
--    El estado real Lead/Cliente se deriva de los movimientos en `finanzas`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla proyectos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyectos_cliente ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_activa ON proyectos(activa);

ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo proyectos" ON proyectos;
CREATE POLICY "Acceso completo proyectos" ON proyectos
  FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 2 y 3. Columnas nuevas en finanzas
-- ------------------------------------------------------------
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS personal_id UUID;
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finanzas_personal ON finanzas(personal_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_proyecto ON finanzas(proyecto_id);

-- FK opcional hacia directorio_cuentas (no rompe la migración si el id
-- de esa tabla no es uuid o ya existe la restricción)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finanzas_personal'
  ) THEN
    BEGIN
      ALTER TABLE finanzas
        ADD CONSTRAINT fk_finanzas_personal
        FOREIGN KEY (personal_id) REFERENCES directorio_cuentas(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FK finanzas.personal_id -> directorio_cuentas omitida: %', SQLERRM;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Origen y tipo de registro en clientes
-- ------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS origen TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'Lead';
