import { useState, useCallback } from 'react';

export interface LabelData {
  barcodeValue: string;
  title: string;
  lot: string;
  price: string;
  sku: string;
  condition: string;
}

export interface LabelTemplate {
  id: string;
  name: string;
  template_type: 'graded' | 'raw';
  is_default: boolean;
  canvas: any;
  data: LabelData & { size: { widthIn: number; heightIn: number; dpi: number } };
  created_at?: string;
  updated_at?: string;
}

export const useLabelDesigner = () => {
  const [labelData, setLabelData] = useState<LabelData>({
    barcodeValue: "120979260",
    title: "POKEMON GENGAR VMAX #020",
    lot: "LOT-000001",
    price: "$1,000",
    sku: "120979260",
    condition: "Near Mint",
  });

  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateType, setTemplateType] = useState<'graded' | 'raw'>('graded');

  const updateLabelData = useCallback((updates: Partial<LabelData>) => {
    setLabelData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetLabelData = useCallback(() => {
    setLabelData({
      barcodeValue: "",
      title: "",
      lot: "",
      price: "",
      sku: "",
      condition: "Near Mint",
    });
  }, []);

  return {
    labelData,
    updateLabelData,
    resetLabelData,
    templates,
    setTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    templateType,
    setTemplateType,
  };
};