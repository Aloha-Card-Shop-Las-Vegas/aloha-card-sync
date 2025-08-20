-- Ensure intake_items table has proper realtime configuration
ALTER TABLE public.intake_items REPLICA IDENTITY FULL;

-- Add the table to the realtime publication if not already there
INSERT INTO supabase_realtime.objects (id, name, owner, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'intake_items',
  current_user,
  now(),
  now()
) ON CONFLICT (name) DO NOTHING;