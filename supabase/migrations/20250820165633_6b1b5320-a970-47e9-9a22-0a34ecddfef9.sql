-- Update the template with better positioning and field mapping
UPDATE label_templates 
SET canvas = '{
  "elements": [
    {
      "id": "condition-left",
      "type": "field", 
      "label": "Condition",
      "x": 10,
      "y": 8,
      "width": 180,
      "height": 48, 
      "fontSize": 12,
      "field": "variant"
    },
    {
      "id": "price-right",
      "type": "price",
      "label": "Price", 
      "x": 200,
      "y": 8,
      "width": 174,
      "height": 48,
      "fontSize": 12, 
      "field": "price"
    },
    {
      "id": "barcode-middle",
      "type": "barcode",
      "label": "Barcode",
      "x": 10,
      "y": 64,
      "width": 364,
      "height": 48,
      "fontSize": 8,
      "field": "sku"
    },
    {
      "id": "name-bottom", 
      "type": "field",
      "label": "Card Name",
      "x": 10,
      "y": 128,
      "width": 364,
      "height": 56,
      "fontSize": 14,
      "field": "subject"
    }
  ],
  "version": "1.0"
}'
WHERE name = 'Card Layout - Condition/Price/Barcode/Name';