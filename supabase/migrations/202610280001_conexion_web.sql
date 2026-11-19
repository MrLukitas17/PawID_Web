-- PawID: ampliación compatible con usuarios y mascotas existentes.
-- Integración a las tablas reales verificada el 28/10. No crea tablas paralelas de publicaciones.
-- No requiere las migraciones antiguas 20261020*. No convierte IDs ni borra filas.
BEGIN;
ALTER TABLE public.mascotas
  ADD COLUMN IF NOT EXISTS fotos jsonb,
  ADD COLUMN IF NOT EXISTS peso_kg numeric(6,2),
  ADD COLUMN IF NOT EXISTS vacunas text,
  ADD COLUMN IF NOT EXISTS descripcion text;
UPDATE public.mascotas SET fotos=CASE WHEN coalesce(foto_path,'')='' THEN '[]'::jsonb ELSE jsonb_build_array(foto_path) END WHERE fotos IS NULL;
ALTER TABLE public.mascotas ALTER COLUMN fotos SET DEFAULT '[]'::jsonb;
ALTER TABLE public.mascotas ALTER COLUMN fotos SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.mascotas'::regclass AND conname='mascotas_fotos_array') THEN
    ALTER TABLE public.mascotas ADD CONSTRAINT mascotas_fotos_array CHECK(jsonb_typeof(fotos)='array' AND jsonb_array_length(fotos)<=8);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pawid_web_sessions(
  token_hash text PRIMARY KEY,owner_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE INDEX IF NOT EXISTS pawid_sessions_owner_idx ON public.pawid_web_sessions(owner_id);
ALTER TABLE public.pawid_web_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pawid_web_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.pawid_web_sessions TO service_role;

-- Tablas originales: se conservan IDs, filas y nombres usados por la app móvil.
ALTER TABLE public.publicacion_adopcion
  ADD COLUMN IF NOT EXISTS adoptado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS especie text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tamano text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefono text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS raza text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS edad text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS esterilizado text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vacunas text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.publicaciones_hogares__temporales
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS contacto text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.publicaciones_hogares__temporales ALTER COLUMN disponibilidad SET DEFAULT true;
-- Los IDs anteriores eran IDs de usuarios; conservar y completar su propietario.
UPDATE public.publicaciones_hogares__temporales SET usuario_id=id WHERE usuario_id IS NULL AND EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=publicaciones_hogares__temporales.id);
-- Sustituye las FK incorrectas de publicación.id por la relación usuario_id.
ALTER TABLE public.publicacion_adopcion DROP CONSTRAINT IF EXISTS publicacion_adopcion_id_fkey;
ALTER TABLE public.publicaciones_hogares__temporales DROP CONSTRAINT IF EXISTS publicaciones_hogares__temporales_id_fkey;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.publicacion_adopcion'::regclass AND conname='publicacion_adopcion_usuario_id_fkey') THEN
  ALTER TABLE public.publicacion_adopcion ADD CONSTRAINT publicacion_adopcion_usuario_id_fkey FOREIGN KEY(usuario_id) REFERENCES public.usuarios(id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS adopciones_usuario_idx ON public.publicacion_adopcion(usuario_id);
CREATE INDEX IF NOT EXISTS adopciones_mascota_idx ON public.publicacion_adopcion(mascota_id);
CREATE INDEX IF NOT EXISTS adopciones_estado_idx ON public.publicacion_adopcion(adoptado);
CREATE INDEX IF NOT EXISTS hogares_usuario_idx ON public.publicaciones_hogares__temporales(usuario_id);
CREATE INDEX IF NOT EXISTS hogares_disponibilidad_idx ON public.publicaciones_hogares__temporales(disponibilidad);
CREATE INDEX IF NOT EXISTS mascotas_usuario_idx ON public.mascotas(usuario_id);
-- Siguen protegidas frente al acceso directo; las opera pawid-api tras autenticar.
ALTER TABLE public.publicacion_adopcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones_hogares__temporales ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.publicacion_adopcion,public.publicaciones_hogares__temporales TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_pawid_sessions_on_password_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.password IS DISTINCT FROM OLD.password THEN
    DELETE FROM public.pawid_web_sessions WHERE owner_id=NEW.id::text;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.revoke_pawid_sessions_on_password_change() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.usuarios'::regclass AND tgname='revoke_pawid_sessions') THEN
    CREATE TRIGGER revoke_pawid_sessions AFTER UPDATE OF password ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.revoke_pawid_sessions_on_password_change();
  END IF;
END $$;

-- Evita cuentas duplicadas ante registros simultáneos. Si ya hay duplicados,
-- toda esta transacción se cancela; revisar el diagnóstico sin borrar cuentas.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_provider_unique ON public.usuarios(lower(email),coalesce(proveedor,'email'));

CREATE TABLE IF NOT EXISTS public.password_reset_tokens(
  token_hash text PRIMARY KEY,email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes'
);
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.password_reset_tokens TO service_role;
CREATE INDEX IF NOT EXISTS reset_email_created_idx ON public.password_reset_tokens(email,created_at);
CREATE OR REPLACE FUNCTION public.consume_password_reset(p_token_hash text,p_password_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target_email text;
BEGIN
  IF p_password_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  DELETE FROM public.password_reset_tokens WHERE token_hash=p_token_hash AND expires_at>now() RETURNING email INTO target_email;
  IF target_email IS NULL THEN RETURN false; END IF;
  UPDATE public.usuarios SET password=p_password_hash WHERE lower(email)=target_email;
  DELETE FROM public.password_reset_tokens WHERE email=target_email;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.consume_password_reset(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_password_reset(text,text) TO service_role;
COMMIT;
