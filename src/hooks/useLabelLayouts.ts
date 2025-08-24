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
      // Strip any accidental data values from layout before saving
      const cleanLayout: LabelLayout = {
        title: { visible: layout.title.visible, x: layout.title.x, y: layout.title.y, fontSize: layout.title.fontSize, prefix: layout.title.prefix },
        sku: { visible: layout.sku.visible, x: layout.sku.x, y: layout.sku.y, fontSize: layout.sku.fontSize, prefix: layout.sku.prefix },
        price: { visible: layout.price.visible, x: layout.price.x, y: layout.price.y, fontSize: layout.price.fontSize, prefix: layout.price.prefix },
        lot: { visible: layout.lot.visible, x: layout.lot.x, y: layout.lot.y, fontSize: layout.lot.fontSize, prefix: layout.lot.prefix },
        condition: { visible: layout.condition.visible, x: layout.condition.x, y: layout.condition.y, fontSize: layout.condition.fontSize, prefix: layout.condition.prefix },
        barcode: { 
          mode: layout.barcode.mode, 
          x: layout.barcode.x, 
          y: layout.barcode.y, 
          width: layout.barcode.width, 
          height: layout.barcode.height, 
          size: layout.barcode.size 
        },
        printer: layout.printer
      };

      const { data, error } = await supabase
        .from('label_templates')
        .insert({
          name,
          canvas: cleanLayout as any,
          template_type: 'tspl-layout',
          is_default: isDefault
        })
        .select()
        .single();

      if (error) throw error;

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
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const updateLayout = async (id: string, name: string, layout: LabelLayout) => {
    setError(null);
    
    try {
      // Strip any accidental data values from layout before saving
      const cleanLayout: LabelLayout = {
        title: { visible: layout.title.visible, x: layout.title.x, y: layout.title.y, fontSize: layout.title.fontSize, prefix: layout.title.prefix },
        sku: { visible: layout.sku.visible, x: layout.sku.x, y: layout.sku.y, fontSize: layout.sku.fontSize, prefix: layout.sku.prefix },
        price: { visible: layout.price.visible, x: layout.price.x, y: layout.price.y, fontSize: layout.price.fontSize, prefix: layout.price.prefix },
        lot: { visible: layout.lot.visible, x: layout.lot.x, y: layout.lot.y, fontSize: layout.lot.fontSize, prefix: layout.lot.prefix },
        condition: { visible: layout.condition.visible, x: layout.condition.x, y: layout.condition.y, fontSize: layout.condition.fontSize, prefix: layout.condition.prefix },
        barcode: { 
          mode: layout.barcode.mode, 
          x: layout.barcode.x, 
          y: layout.barcode.y, 
          width: layout.barcode.width, 
          height: layout.barcode.height, 
          size: layout.barcode.size 
        },
        printer: layout.printer
      };

      const { error } = await supabase
        .from('label_templates')
        .update({
          name,
          canvas: cleanLayout as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      await loadLayouts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update layout';
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