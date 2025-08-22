import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type LabelTemplate = {
  id: string;
  name: string;
  template_type: 'graded' | 'raw';
  is_default: boolean;
  canvas: any;
  data: any;
  created_at?: string;
  updated_at?: string;
};

export function useTemplates() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('label_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      setTemplates((data as unknown as LabelTemplate[]) || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveTemplate = useCallback(async (
    name: string,
    templateType: 'graded' | 'raw',
    canvas: any,
    data: any
  ) => {
    if (!name.trim()) {
      toast.error('Enter a template name');
      return false;
    }

    try {
      const { error } = await supabase.from('label_templates').insert({
        name: name.trim(),
        template_type: templateType,
        canvas,
        data,
      } as any);

      if (error) throw error;
      toast.success('Template saved');
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Save failed');
      return false;
    }
  }, [fetchTemplates]);

  const updateTemplate = useCallback(async (
    id: string,
    canvas: any,
    data: any
  ) => {
    const template = templates.find(t => t.id === id);
    if (!template) {
      toast.error('Template not found');
      return false;
    }

    try {
      const { error } = await supabase
        .from('label_templates')
        .update({
          canvas,
          data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Template "${template.name}" updated`);
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Update failed');
      return false;
    }
  }, [templates, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('label_templates').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Template deleted');
      if (selectedTemplateId === id) setSelectedTemplateId('');
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Delete failed');
      return false;
    }
  }, [selectedTemplateId, fetchTemplates]);

  const setAsDefault = useCallback(async (id: string, templateType: 'graded' | 'raw') => {
    try {
      const { error } = await supabase.rpc('set_template_default', {
        template_id: id,
        template_type_param: templateType
      });
      
      if (error) throw error;
      toast.success(`Set as default ${templateType} template`);
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Failed to set default template');
      return false;
    }
  }, [fetchTemplates]);

  const clearDefault = useCallback(async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return false;

    try {
      const { error } = await supabase
        .from('label_templates')
        .update({ is_default: false })
        .eq('id', id);
      
      if (error) throw error;
      toast.success(`Cleared default ${template.template_type} template`);
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Failed to clear default template');
      return false;
    }
  }, [templates, fetchTemplates]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  return {
    templates,
    selectedTemplate,
    selectedTemplateId,
    setSelectedTemplateId,
    isLoading,
    fetchTemplates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    clearDefault
  };
}