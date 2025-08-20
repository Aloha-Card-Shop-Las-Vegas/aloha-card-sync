-- Add payload_type column to print_jobs table to track PDF vs TSPL payloads
ALTER TABLE public.print_jobs 
ADD COLUMN payload_type TEXT DEFAULT 'tspl' CHECK (payload_type IN ('tspl', 'pdf_base64'));

-- Update existing records to have the default payload type
UPDATE public.print_jobs 
SET payload_type = 'tspl' 
WHERE payload_type IS NULL;