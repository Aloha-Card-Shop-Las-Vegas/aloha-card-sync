-- Make price take up 2/3 of top area and condition 1/3
UPDATE public.label_templates 
SET canvas = jsonb_set(
  jsonb_set(
    canvas,
    '{elements,0}', 
    '{"x": 10, "y": 8, "id": "condition-left", "type": "text", "field": "condition", "width": 120, "height": 60, "fontSize": 12}'::jsonb
  ),
  '{elements,1}', 
  '{"x": 140, "y": 8, "id": "price-right", "type": "text", "field": "price", "width": 234, "height": 60, "fontSize": 12}'::jsonb
),
updated_at = now()
WHERE id = '3292e143-cef4-48e5-b0ad-4ad6f6cd7360' 
AND template_type = 'raw' 
AND is_default = true;