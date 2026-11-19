-- SOLO LECTURA. Se puede ejecutar en SQL Editor para revisar el estado real.
-- No devuelve contraseñas, claves, correos ni filas de mascotas.
SELECT current_database() AS base_actual, current_user AS rol_actual;

SELECT table_name, column_name, data_type, character_maximum_length,
       CASE WHEN column_name = 'id' THEN column_default ELSE NULL END AS generador_id, is_nullable, is_identity
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('usuarios','mascotas','publicacion_adopcion','publicaciones_hogares__temporales','pawid_web_sessions','password_reset_tokens')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('usuarios','mascotas','publicacion_adopcion','publicaciones_hogares__temporales','pawid_web_sessions','password_reset_tokens');

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('usuarios','mascotas','publicacion_adopcion','publicaciones_hogares__temporales','pawid_web_sessions','password_reset_tokens'))
   OR (schemaname = 'storage' AND tablename = 'objects');

SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid IN (coalesce(to_regclass('public.mascotas'), 0::oid), coalesce(to_regclass('public.usuarios'), 0::oid))
   OR confrelid IN (coalesce(to_regclass('public.mascotas'), 0::oid), coalesce(to_regclass('public.usuarios'), 0::oid));

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'mascotas-fotos';
SELECT bucket_id, count(*) AS cantidad_archivos FROM storage.objects
WHERE bucket_id = 'mascotas-fotos' GROUP BY bucket_id;

SELECT tgname, tgrelid::regclass AS tabla FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid IN (coalesce(to_regclass('public.mascotas'),0::oid), coalesce(to_regclass('public.usuarios'),0::oid));

-- Solo cantidades, sin correos ni hashes. Debe ser cero antes del índice único.
SELECT count(*) AS grupos_duplicados FROM (SELECT 1 FROM public.usuarios GROUP BY lower(email),coalesce(proveedor,'email') HAVING count(*)>1) duplicates;
