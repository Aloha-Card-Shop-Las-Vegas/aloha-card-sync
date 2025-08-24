import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RawTemplate {
  id: string;
  body: string;
  required_fields: string[];
  optional_fields: string[];
  updated_at: string;
}

export function useRawTemplates() {
  const [templates, setTemplates] = useState<RawTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const detectTokens = (template: string): string[] => {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const tokens = new Set<string>();
    let match;
    while ((match = regex.exec(template)) !== null) {
      tokens.add(match[1]);
    }
    return Array.from(tokens);
  };

  const detectEngine = (template: string): 'ZPL' | 'TSPL' => {
    // Check for ZPL patterns
    if (/\^[A-Z]{2}/.test(template) || template.includes('^XA') || template.includes('^XZ')) {
      return 'ZPL';
    }
    // Check for TSPL patterns
    if (/\b(SIZE|DENSITY|SPEED|CLS|TEXT|BARCODE|PRINT)\b/i.test(template)) {
      return 'TSPL';
    }
    // Default to ZPL if unclear
    return 'ZPL';
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('label_templates_new')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error('Failed to load templates: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplate = async (id: string, body: string) => {
    const tokens = detectTokens(body);
    
    try {
      const { error } = await supabase
        .from('label_templates_new')
        .upsert({
          id,
          body,
          required_fields: tokens,
          optional_fields: [],
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      toast.success('Template saved successfully');
      await fetchTemplates();
    } catch (error: any) {
      toast.error('Failed to save template: ' + error.message);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('label_templates_new')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Template deleted successfully');
      await fetchTemplates();
    } catch (error: any) {
      toast.error('Failed to delete template: ' + error.message);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return {
    templates,
    isLoading,
    saveTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
    detectEngine,
    detectTokens
  };
}