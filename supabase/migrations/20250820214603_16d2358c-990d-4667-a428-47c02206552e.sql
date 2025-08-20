INSERT INTO print_jobs (
  workstation_id,
  template_id,
  data,
  target,
  copies,
  status,
  created_at
) VALUES (
  'lasvegas',  -- must match the workstation_id configured in the Rollo Agent app
  'price-2x1-v1',
  '{"product_name":"ALOHA HOLO","price":"12.99","sku":"ACS-00123","variant":"Blue"}',
  '{"printer_name":"Rollo_USB"}',  -- or {"ip":"192.168.x.x"} if using network printer
  1,
  'queued',
  now()
);