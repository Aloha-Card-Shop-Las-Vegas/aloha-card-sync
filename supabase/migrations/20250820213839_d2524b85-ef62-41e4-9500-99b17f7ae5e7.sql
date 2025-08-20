-- Fix the claim_next_print_job function with proper search_path
CREATE OR REPLACE FUNCTION public.claim_next_print_job(ws text)
RETURNS print_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH j AS (
    SELECT id FROM public.print_jobs
     WHERE status = 'queued' AND workstation_id = ws
     ORDER BY created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.print_jobs p
     SET status='printing', claimed_at=now()
    FROM j
   WHERE p.id = j.id
  RETURNING p.*;
$$;