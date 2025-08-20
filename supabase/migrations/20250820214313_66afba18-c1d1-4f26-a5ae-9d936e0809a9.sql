-- Remove old template if it exists (so rerunning won't error)
DELETE FROM label_templates_new WHERE id = 'price-2x1-v1';

-- Insert our 2x1 price label template
INSERT INTO label_templates_new (id, body, required_fields, updated_at)
VALUES (
  'price-2x1-v1',
  $$SIZE 50.8 mm,25.4 mm
GAP 2 mm,0
DIRECTION 1
CLS

TEXT 20,20,"0",0,1,1,"{{product_name}}"
TEXT 20,60,"4",0,2,2,"${{price}}"
TEXT 20,120,"0",0,1,1,"SKU: {{sku}}"
TEXT 200,120,"0",0,1,1,"{{variant}}"

PRINT 1,1$$,
  ARRAY['product_name','price','sku','variant'],
  now()
);