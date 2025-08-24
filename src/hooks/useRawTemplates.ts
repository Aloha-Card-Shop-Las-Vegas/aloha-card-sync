import { useTemplates } from './useTemplates';
import { useEffect } from 'react';
import { getLabelDesignerSettings } from '@/lib/labelDesignerSettings';

/**
 * Hook specifically for 'raw' template type used by Label Designer
 * Handles initialization and persistence of current layout
 */
export function useRawTemplates() {
  const templatesHook = useTemplates('raw');
  const { templates, defaultTemplate, saveTemplate, setAsDefault, loading } = templatesHook;

  // Initialize default raw template if none exists
  const initializeDefaultRawTemplate = async () => {
    if (loading || templates.length > 0) return;

    const currentSettings = getLabelDesignerSettings();
    
    // Create default raw template with current optimized settings
    const result = await saveTemplate(
      'Optimized Barcode Template',
      currentSettings.fieldConfig,
      {
        title: "POKEMON GENGAR VMAX #020",
        sku: "120979260", 
        price: "1000",
        lot: "LOT-000001",
        condition: "Near Mint",
        barcode: "120979260"
      },
      { density: 10, speed: 4, gapInches: 0 }
    );

    if (result.success && templates.length === 1) {
      // Set as default if it's the only template
      const newTemplate = templates[0];
      if (newTemplate) {
        await setAsDefault(newTemplate.id);
      }
    }
  };

  // Auto-initialize when templates are loaded
  useEffect(() => {
    if (!loading && templates.length === 0) {
      initializeDefaultRawTemplate();
    }
  }, [loading, templates.length]);

  return {
    ...templatesHook,
    initializeDefaultRawTemplate
  };
}