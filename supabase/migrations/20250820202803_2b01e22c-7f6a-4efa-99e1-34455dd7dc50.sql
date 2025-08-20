-- Enable pgcrypto extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create label_templates table
CREATE TABLE IF NOT EXISTS label_templates (
  id text PRIMARY KEY,              -- e.g. 'price-2x1-v1'
  body text NOT NULL,               -- TSPL with {{placeholders}}
  required_fields text[] DEFAULT '{}',
  optional_fields text[] DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Drop existing print_jobs table if it exists to recreate with new schema
DROP TABLE IF EXISTS print_jobs;

-- Create print_jobs table with new schema
CREATE TABLE print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  claimed_at timestamptz,
  printed_at timestamptz,
  workstation_id text NOT NULL,     -- which PC should print
  template_id text,                 -- required unless using tspl_body
  data jsonb NOT NULL,              -- label fields
  target jsonb NOT NULL,            -- {"ip":"192.168.1.50"} or {"printer_name":"Rollo_USB"}
  copies int NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 50),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printing','printed','failed')),
  error text,
  template_version timestamptz,
  tspl_body text                    -- optional raw TSPL override
);

-- Create index for efficient job lookup
CREATE INDEX IF NOT EXISTS print_jobs_lookup ON print_jobs (status, workstation_id, created_at);

-- Create function to atomically claim next print job
CREATE OR REPLACE FUNCTION claim_next_print_job(ws text)
RETURNS print_jobs
LANGUAGE sql
AS $$
  WITH j AS (
    SELECT id FROM print_jobs
     WHERE status = 'queued' AND workstation_id = ws
     ORDER BY created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE print_jobs p
     SET status='printing', claimed_at=now()
    FROM j
   WHERE p.id = j.id
  RETURNING p.*;
$$;

-- Enable RLS
ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for label_templates
CREATE POLICY "Anyone can view label_templates" ON label_templates
  FOR SELECT USING (true);

CREATE POLICY "Staff/Admin can insert label_templates" ON label_templates
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff/Admin can update label_templates" ON label_templates
  FOR UPDATE USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff/Admin can delete label_templates" ON label_templates
  FOR DELETE USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for print_jobs - allow clients to insert jobs
CREATE POLICY "Anyone can insert print_jobs" ON print_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff/Admin can view print_jobs" ON print_jobs
  FOR SELECT USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff/Admin can update print_jobs" ON print_jobs
  FOR UPDATE USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Insert default 2x1 price label template
INSERT INTO label_templates (id, body, required_fields, optional_fields) VALUES (
  'price-2x1-v1',
  'SIZE 50.8 mm,25.4 mm
GAP 3 mm,0 mm
DENSITY 8
SPEED 2
CLS

TEXT 5,5,"0",0,1,1,"{{condition}}"
TEXT 200,5,"0",0,1,1,"{{price}}"

BARCODE 5,30,"128",40,1,0,2,3,"{{sku}}"

TEXT 5,80,"0",0,1,1,"{{product_name}}"

PRINT 1,1',
  ARRAY['condition', 'price', 'sku', 'product_name'],
  ARRAY[]::text[]
) ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body,
  required_fields = EXCLUDED.required_fields,
  optional_fields = EXCLUDED.optional_fields,
  updated_at = now();