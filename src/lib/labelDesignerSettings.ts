/**
 * Utility to read Label Designer settings from localStorage
 * This ensures the batch queue uses the same settings as the Label Designer
 */

import { LabelFieldConfig } from "@/lib/labelRenderer";

export interface LabelDesignerSettings {
  fieldConfig: LabelFieldConfig;
  showGuides: boolean;
}

export function getLabelDesignerSettings(): LabelDesignerSettings {
  try {
    // Read settings from localStorage (same keys used in LabelDesigner.tsx)
    const includeTitle = localStorage.getItem('field-title') === 'true';
    const includeSku = localStorage.getItem('field-sku') === 'true';
    const includePrice = localStorage.getItem('field-price') === 'true';
    const includeLot = localStorage.getItem('field-lot') === 'true';
    const includeCondition = localStorage.getItem('field-condition') === 'true';
    const barcodeMode = localStorage.getItem('barcode-mode') || 'barcode';
    const showGuides = localStorage.getItem('labelDesigner_showGuides') === 'true';

    return {
      fieldConfig: {
        includeTitle,
        includeSku,
        includePrice,
        includeLot,
        includeCondition,
        barcodeMode: barcodeMode as 'qr' | 'barcode' | 'none'
      },
      showGuides
    };
  } catch (error) {
    console.error('Error reading label designer settings:', error);
    
    // Return sensible defaults if localStorage fails
    return {
      fieldConfig: {
        includeTitle: true,
        includeSku: true,
        includePrice: true,
        includeLot: true,
        includeCondition: true,
        barcodeMode: 'barcode'
      },
      showGuides: false
    };
  }
}