BEGIN;
-- Colección persistente; foto_path sigue siendo la portada para clientes antiguos.
ALTER TABLE public.mascotas ADD COLUMN IF NOT EXISTS fotos jsonb;
ALTER TABLE public.mascotas ADD COLUMN IF NOT EXISTS peso_kg numeric(6,2), ADD COLUMN IF NOT EXISTS vacunas text, ADD COLUMN IF NOT EXISTS descripcion text;
UPDATE public.mascotas SET fotos = CASE WHEN coalesce(foto_path, '') = '' THEN '[]'::jsonb ELSE jsonb_build_array(foto_path) END WHERE fotos IS NULL;
ALTER TABLE public.mascotas ALTER COLUMN fotos SET DEFAULT '[]'::jsonb;
ALTER TABLE public.mascotas ALTER COLUMN fotos SET NOT NULL;
ALTER TABLE public.mascotas ADD CONSTRAINT mascotas_fotos_array CHECK (jsonb_typeof(fotos) = 'array' AND jsonb_array_length(fotos) <= 8);

-- El proyecto usa usuarios propio, no auth.uid() para las cuentas de correo.
-- Solo la función de servidor puede leer o escribir estas sesiones.
CREATE TABLE public.pawid_web_sessions (
  token_hash text PRIMARY KEY,
  owner_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE INDEX ON public.pawid_web_sessions(owner_id);
ALTER TABLE public.pawid_web_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pawid_web_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.pawid_web_sessions TO service_role;

CREATE TABLE public.adopciones_web (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  pet_id text NOT NULL,
  adopted boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adopciones_payload_object CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX ON public.adopciones_web(owner_id);
CREATE INDEX ON public.adopciones_web(adopted);
ALTER TABLE public.adopciones_web ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.adopciones_web FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adopciones_web TO service_role;

CREATE FUNCTION public.revoke_pawid_sessions_on_password_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.password IS DISTINCT FROM OLD.password THEN
    DELETE FROM public.pawid_web_sessions WHERE owner_id = NEW.id::text;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER revoke_pawid_sessions AFTER UPDATE OF password ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.revoke_pawid_sessions_on_password_change();
COMMIT;
