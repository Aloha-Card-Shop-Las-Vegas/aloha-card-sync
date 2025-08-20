-- Create a new template with the requested layout
INSERT INTO label_templates (
  name,
  template_type,
  canvas,
  is_default
) VALUES (
  'Card Layout - Condition/Price/Barcode/Name',
  'raw',
  '{
    "elements": [
      {
        "id": "condition-left",
        "type": "field",
        "label": "Condition",
        "x": 10,
        "y": 10,
        "width": 180,
        "height": 40,
        "fontSize": 14,
        "field": "variant"
      },
      {
        "id": "price-right", 
        "type": "price",
        "label": "Price",
        "x": 200,
        "y": 10,
        "width": 170,
        "height": 40,
        "fontSize": 14,
        "field": "price"
      },
      {
        "id": "barcode-middle",
        "type": "barcode",
        "label": "Barcode",
        "x": 10,
        "y": 70,
        "width": 364,
        "height": 50,
        "fontSize": 8,
        "field": "sku"
      },
      {
        "id": "name-bottom",
        "type": "field",
        "label": "Card Name",
        "x": 10,
        "y": 135,
        "width": 364,
        "height": 40,
        "fontSize": 16,
        "field": "subject"
      }
    ],
    "version": "1.0"
  }',
  false
);