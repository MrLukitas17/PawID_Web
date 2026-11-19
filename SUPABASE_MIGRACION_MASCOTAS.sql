-- PawID - campos adicionales solicitados para Mis Mascotas
-- Ejecutar una sola vez en Supabase > SQL Editor.

ALTER TABLE public.mascotas
  ADD COLUMN IF NOT EXISTS peso_kg numeric(6,2),
  ADD COLUMN IF NOT EXISTS vacunas text,
  ADD COLUMN IF NOT EXISTS descripcion text;

COMMENT ON COLUMN public.mascotas.peso_kg IS 'Peso de la mascota en kilogramos';
COMMENT ON COLUMN public.mascotas.vacunas IS 'Estado informado de vacunas al día: Sí, No o sin informar';
COMMENT ON COLUMN public.mascotas.descripcion IS 'Descripción u observaciones generales de la mascota';
