-- Ensure realtime works reliably for intake_items
ALTER TABLE public.intake_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Add table to the supabase_realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'intake_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_items';
  END IF;
END $$;