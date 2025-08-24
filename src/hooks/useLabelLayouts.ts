import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LabelLayout } from '@/lib/tspl';

export interface SavedLabelLayout {
  id: string;
  name: string;
  layout: LabelLayout;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Defensive sanitization to prevent serialization issues
const sanitizeLayout = (layout: LabelLayout): LabelLayout => {
  return {
    title: {
      visible: layout.title?.visible ?? true,
      x: layout.title?.x ?? 15,
      y: layout.title?.y ?? 15,
      fontSize: layout.title?.fontSize ?? 2,
      prefix: layout.title?.prefix ?? ''
    },
    sku: {
      visible: layout.sku?.visible ?? true,
      x: layout.sku?.x ?? 15,
      y: layout.sku?.y ?? 45,
      fontSize: layout.sku?.fontSize ?? 1,
      prefix: layout.sku?.prefix ?? 'SKU: '
    },
    price: {
      visible: layout.price?.visible ?? true,
      x: layout.price?.x ?? 280,
      y: layout.price?.y ?? 15,
      fontSize: layout.price?.fontSize ?? 3,
      prefix: layout.price?.prefix ?? '$'
    },
    lot: {
      visible: layout.lot?.visible ?? true,
      x: layout.lot?.x ?? 15,
      y: layout.lot?.y ?? 70,
      fontSize: layout.lot?.fontSize ?? 1,
      prefix: layout.lot?.prefix ?? 'LOT: '
    },
    condition: {
      visible: layout.condition?.visible ?? true,
      x: layout.condition?.x ?? 200,
      y: layout.condition?.y ?? 45,
      fontSize: layout.condition?.fontSize ?? 1,
      prefix: layout.condition?.prefix ?? ''
    },
    barcode: {
      mode: layout.barcode?.mode ?? 'none',
      x: layout.barcode?.x ?? 10,
      y: layout.barcode?.y ?? 90,
      size: layout.barcode?.size ?? 'M',
      width: layout.barcode?.width,
      height: layout.barcode?.height
    },
    printer: layout.printer
  };
};

export function useLabelLayouts() {
  const [layouts, setLayouts] = useState<SavedLabelLayout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLayouts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('label_templates')
        .select('id, name, canvas, is_default, created_at, updated_at')
        .eq('template_type', 'tspl-layout')
        .order('name');

      if (error) throw error;

      const formattedLayouts: SavedLabelLayout[] = data?.map(item => ({
        id: item.id,
        name: item.name,
        layout: item.canvas as unknown as LabelLayout,
        is_default: item.is_default || false,
        created_at: item.created_at,
        updated_at: item.updated_at
      })) || [];

      setLayouts(formattedLayouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load layouts');
      console.error('Error loading layouts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLayout = async (name: string, layout: LabelLayout, isDefault = false) => {
    setError(null);
    
    try {
      // Use defensive sanitization
      const cleanLayout = sanitizeLayout(layout);

      const { data, error } = await supabase
        .from('label_templates')
        .insert({
          name,
          canvas: cleanLayout as any,
          template_type: 'tspl-layout',
          is_default: isDefault
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase save error:', error);
        throw error;
      }

      if (!data) {
        console.error('No data returned from insert');
        throw new Error('Failed to save layout - no data returned');
      }

      // If setting as default, update existing default
      if (isDefault) {
        await supabase.rpc('set_template_default', {
          template_id: data.id,
          template_type_param: 'tspl-layout'
        });
      }

      await loadLayouts();
      return data.id;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save layout';
      console.error('Save layout error:', err);
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const updateLayout = async (id: string, name: string, layout: LabelLayout) => {
    setError(null);
    
    try {
      // Use defensive sanitization
      const cleanLayout = sanitizeLayout(layout);

      const { error } = await supabase
        .from('label_templates')
        .update({
          name,
          canvas: cleanLayout as any,
          template_type: 'tspl-layout',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      await loadLayouts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update layout';
      console.error('Update layout error:', err);
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const deleteLayout = async (id: string) => {
    setError(null);
    
    try {
      const { error } = await supabase
        .from('label_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadLayouts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete layout';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const setAsDefault = async (id: string) => {
    setError(null);
    
    try {
      await supabase.rpc('set_template_default', {
        template_id: id,
        template_type_param: 'tspl-layout'
      });

      await loadLayouts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to set default layout';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  useEffect(() => {
    loadLayouts();
  }, []);

  return {
    layouts,
    isLoading,
    error,
    loadLayouts,
    saveLayout,
    updateLayout,
    deleteLayout,
    setAsDefault
  };
}