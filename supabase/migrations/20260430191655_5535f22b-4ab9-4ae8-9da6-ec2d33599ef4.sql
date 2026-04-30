ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_action_check;

ALTER TABLE public.access_logs
ADD CONSTRAINT access_logs_action_check
CHECK (
  action = ANY (
    ARRAY[
      'login'::text,
      'login_blocked'::text,
      'logout'::text,
      'signup'::text,
      'location_capture'::text
    ]
  )
);