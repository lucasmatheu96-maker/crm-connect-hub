CREATE OR REPLACE FUNCTION public.unaccent_safe(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(coalesce(_t,''),
    'ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_name(_nome text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.profiles
  WHERE _nome IS NOT NULL AND length(trim(_nome)) > 0
    AND (lower(public.unaccent_safe(nome)) = lower(public.unaccent_safe(_nome))
         OR lower(public.unaccent_safe(nome)) LIKE lower(public.unaccent_safe(_nome)) || '%'
         OR lower(public.unaccent_safe(_nome)) LIKE lower(public.unaccent_safe(nome)) || '%')
  ORDER BY length(nome) ASC
  LIMIT 1
$$;