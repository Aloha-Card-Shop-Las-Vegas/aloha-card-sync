-- Update the default raw template to have proper 50/50 condition/price split and smaller barcode
UPDATE public.label_templates 
SET canvas = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        canvas,
        '{elements,0}', 
        '{"x": 10, "y": 8, "id": "condition-left", "type": "text", "field": "condition", "width": 180, "height": 48, "fontSize": 12}'::jsonb
      ),
      '{elements,1}', 
      '{"x": 200, "y": 8, "id": "price-right", "type": "text", "field": "price", "width": 174, "height": 48, "fontSize": 12}'::jsonb
    ),
    '{elements,2}', 
    '{"x": 10, "y": 70, "id": "barcode-middle", "type": "barcode", "field": "sku", "width": 360, "height": 72}'::jsonb
  ),
  '{elements,3}', 
  '{"x": 10, "y": 45, "id": "name-bottom", "type": "text", "field": "subject", "width": 360, "height": 20, "fontSize": 10}'::jsonb
),
updated_at = now()
WHERE id = '3292e143-cef4-48e5-b0ad-4ad6f6cd7360' 
AND template_type = 'raw' 
AND is_default = true;