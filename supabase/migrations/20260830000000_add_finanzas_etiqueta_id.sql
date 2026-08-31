-- ============================================================
-- Migración: Etiqueta directa en movimientos de finanzas
-- Fecha: 2026-08-30
--
-- Problema: el formulario de movimientos permitía elegir una
-- "Etiqueta" pero solo la usaba como filtro del catálogo de
-- servicios; nunca se guardaba en la BD. Por eso, al exportar
-- a Excel, la columna "Etiqueta(s)" salía vacía ('-') cuando el
-- movimiento no tenía un "Servicio Realizado" que la derivara.
--
-- Solución:
-- 1. `finanzas.etiqueta_id`: guarda la etiqueta elegida en el
--    formulario directamente sobre el movimiento.
-- 2. Backfill: deduce la etiqueta de los movimientos existentes
--    (finanza_servicios -> servicios.etiqueta_id, o por nombre
--    de servicio en el catálogo) para que Julio/Agosto ya
--    exporten con etiqueta sin re-cargarlos.
-- ============================================================

-- 1. Columna nueva en finanzas
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS etiqueta_id UUID REFERENCES etiquetas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finanzas_etiqueta ON finanzas(etiqueta_id);

-- 2. Backfill de movimientos existentes
--    a) Por el vínculo histórico finanza_servicios -> servicios
UPDATE finanzas f
SET etiqueta_id = fs.etiqueta_id
FROM (
  SELECT fs.finanza_id, s.etiqueta_id
  FROM finanza_servicios fs
  JOIN servicios s ON s.id = fs.servicio_id
  WHERE s.etiqueta_id IS NOT NULL
) fs
WHERE f.id = fs.finanza_id
  AND f.etiqueta_id IS NULL;

--    b) Por coincidencia del texto `finanzas.servicio` con el
--       catálogo de servicios (caso de movimientos registrados
--       a mano que guardan el nombre del servicio como texto).
--       Se ignora el prefijo decorativo (emoji/espacios) del nombre.
UPDATE finanzas f
SET etiqueta_id = s.etiqueta_id
FROM servicios s
WHERE f.etiqueta_id IS NULL
  AND s.etiqueta_id IS NOT NULL
  AND f.servicio IS NOT NULL
  AND (
    s.nombre = f.servicio
    OR btrim(regexp_replace(split_part(f.servicio, ' - ', 1), '^[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+', '', ''))
       = btrim(regexp_replace(s.nombre, '^[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+', '', ''))
  );
