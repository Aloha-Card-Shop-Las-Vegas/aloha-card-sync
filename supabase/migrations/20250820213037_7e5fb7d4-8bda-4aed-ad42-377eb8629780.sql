-- Fix all functions to have secure search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_lot_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_next bigint;
begin
  v_next := nextval('public.lot_number_seq');
  return 'LOT-' || to_char(v_next, 'FM000000');
end;
$$;

CREATE OR REPLACE FUNCTION public.set_template_default(template_id uuid, template_type_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- First, unset all defaults for this template type
  UPDATE public.label_templates 
  SET is_default = false 
  WHERE template_type = template_type_param;
  
  -- Then set the specified template as default
  UPDATE public.label_templates 
  SET is_default = true 
  WHERE id = template_id AND template_type = template_type_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;