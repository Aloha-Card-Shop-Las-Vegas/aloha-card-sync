-- Update the existing template to use condition instead of variant
UPDATE label_templates 
SET canvas = jsonb_set(
  canvas,
  '{elements}',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'condition-left',
      'type', 'text',
      'x', 10,
      'y', 8,
      'width', 100,
      'height', 30,
      'fontSize', 12,
      'field', 'condition'
    ),
    jsonb_build_object(
      'id', 'price-right',
      'type', 'text', 
      'x', 280,
      'y', 8,
      'width', 100,
      'height', 30,
      'fontSize', 12,
      'field', 'price'
    ),
    jsonb_build_object(
      'id', 'barcode-middle',
      'type', 'barcode',
      'x', 10,
      'y', 70,
      'width', 360,
      'height', 90,
      'field', 'sku'
    ),
    jsonb_build_object(
      'id', 'name-bottom',
      'type', 'text',
      'x', 10,
      'y', 45,
      'width', 360,
      'height', 20,
      'fontSize', 10,
      'field', 'subject'
    )
  )
)
WHERE name = 'Card Template - Condition/Price | Barcode | Name' 
AND template_type = 'raw';