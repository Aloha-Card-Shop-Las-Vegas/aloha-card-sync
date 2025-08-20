-- Set the new template as the default for raw type and delete the old one
SELECT set_template_default('3292e143-cef4-48e5-b0ad-4ad6f6cd7360'::uuid, 'raw');

-- Delete the old Raw Card BC template
DELETE FROM label_templates WHERE id = '569a7ec0-5785-4a00-a65d-9b66298cbc0c';