-- Move name under barcode and make price bigger
UPDATE public.label_templates 
SET canvas = jsonb_set(
  jsonb_set(
    canvas,
    '{elements,1}', 
    '{"x": 200, "y": 8, "id": "price-right", "type": "text", "field": "price", "width": 174, "height": 60, "fontSize": 12}'::jsonb
  ),
  '{elements,3}', 
  '{"x": 10, "y": 150, "id": "name-bottom", "type": "text", "field": "subject", "width": 360, "height": 20, "fontSize": 10}'::jsonb
),
updated_at = now()
WHERE id = '3292e143-cef4-48e5-b0ad-4ad6f6cd7360' 
AND template_type = 'raw' 
AND is_default = true;