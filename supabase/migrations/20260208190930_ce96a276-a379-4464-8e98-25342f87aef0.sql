
-- Fix search_path on generate_anonymous_id
CREATE OR REPLACE FUNCTION public.generate_anonymous_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := 'Anon-' || substr(md5(random()::text), 1, 5);
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE anonymous_id = new_id) INTO id_exists;
    EXIT WHEN NOT id_exists;
  END LOOP;
  RETURN new_id;
END;
$$;
