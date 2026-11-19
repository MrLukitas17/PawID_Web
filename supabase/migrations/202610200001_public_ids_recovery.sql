BEGIN;
-- Conserva el tipo y los valores de la PK existente. Para UUID/text sin default,
-- permite que PostgreSQL cree el ID interno; no convierte IDs ni relaciones.
DO $$
DECLARE id_type text; id_default text; id_identity text; id_length integer;
BEGIN
  SELECT data_type, column_default, is_identity, character_maximum_length INTO id_type, id_default, id_identity, id_length
  FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mascotas' AND column_name = 'id';
  IF id_default IS NULL AND id_identity = 'NO' THEN
    IF id_type = 'uuid' THEN ALTER TABLE public.mascotas ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ELSIF id_type IN ('text', 'character varying') AND (id_length IS NULL OR id_length >= 36) THEN ALTER TABLE public.mascotas ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ELSE RAISE EXCEPTION 'Revisar generación del ID interno de mascotas antes de aplicar esta migración: %', id_type;
    END IF;
  END IF;
END $$;
CREATE SEQUENCE public.mascotas_public_id_seq AS bigint MAXVALUE 9007199254740991;
ALTER TABLE public.mascotas ADD COLUMN public_id text;
UPDATE public.mascotas SET public_id = nextval('public.mascotas_public_id_seq')::text;
ALTER TABLE public.mascotas ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX mascotas_public_id_unique ON public.mascotas(public_id);
ALTER TABLE public.mascotas ADD CONSTRAINT mascotas_public_id_digits CHECK (public_id ~ '^[0-9]+$');
CREATE FUNCTION public.assign_pet_public_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.public_id := nextval('public.mascotas_public_id_seq')::text;
  ELSIF NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'El identificador público es permanente';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mascotas_public_id BEFORE INSERT OR UPDATE ON public.mascotas
FOR EACH ROW EXECUTE FUNCTION public.assign_pet_public_id();
REVOKE ALL ON SEQUENCE public.mascotas_public_id_seq FROM PUBLIC, anon, authenticated;
CREATE TABLE public.password_reset_tokens (
  token_hash text PRIMARY KEY, email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes'
);
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.password_reset_tokens TO service_role;
CREATE INDEX ON public.password_reset_tokens(email, created_at);
CREATE FUNCTION public.consume_password_reset(p_token_hash text, p_password_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_email text;
BEGIN
  IF p_password_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  DELETE FROM public.password_reset_tokens WHERE token_hash = p_token_hash AND expires_at > now() RETURNING email INTO target_email;
  IF target_email IS NULL THEN RETURN false; END IF;
  UPDATE public.usuarios SET password = p_password_hash WHERE lower(email) = target_email;
  DELETE FROM public.password_reset_tokens WHERE email = target_email;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.consume_password_reset(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_password_reset(text,text) TO service_role;
COMMIT;
