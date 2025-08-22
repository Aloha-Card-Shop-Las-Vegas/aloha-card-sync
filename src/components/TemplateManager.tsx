import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTemplates, type LabelTemplate } from '@/hooks/useTemplates';
import { Canvas as FabricCanvas, Rect } from 'fabric';

interface TemplateManagerProps {
  fabricCanvas: FabricCanvas | null;
  templateType: 'graded' | 'raw';
  setTemplateType: (type: 'graded' | 'raw') => void;
  onTemplateLoad: (template: LabelTemplate) => void;
  labelData: {
    barcodeValue: string;
    title: string;
    lot: string;
    price: string;
    sku: string;
    condition: string;
  };
}

const LABEL_WIDTH_IN = 2;
const LABEL_HEIGHT_IN = 1;
const PREVIEW_DPI = 150;
const PX_WIDTH = Math.round(LABEL_WIDTH_IN * PREVIEW_DPI);
const PX_HEIGHT = Math.round(LABEL_HEIGHT_IN * PREVIEW_DPI);

export function TemplateManager({
  fabricCanvas,
  templateType,
  setTemplateType,
  onTemplateLoad,
  labelData
}: TemplateManagerProps) {
  const {
    templates,
    selectedTemplate,
    selectedTemplateId,
    setSelectedTemplateId,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    clearDefault
  } = useTemplates();

  const [templateName, setTemplateName] = useState('');

  const handleSave = async () => {
    if (!fabricCanvas || !templateName.trim()) return;

    const success = await saveTemplate(
      templateName,
      templateType,
      fabricCanvas.toJSON(),
      {
        ...labelData,
        size: { widthIn: LABEL_WIDTH_IN, heightIn: LABEL_HEIGHT_IN, dpi: PREVIEW_DPI },
      }
    );

    if (success) {
      setTemplateName('');
    }
  };

  const handleUpdate = async () => {
    if (!fabricCanvas || !selectedTemplateId) return;

    await updateTemplate(
      selectedTemplateId,
      fabricCanvas.toJSON(),
      {
        ...labelData,
        size: { widthIn: LABEL_WIDTH_IN, heightIn: LABEL_HEIGHT_IN, dpi: PREVIEW_DPI },
      }
    );
  };

  const handleLoad = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onTemplateLoad(template);
    }
  };

  const quickSave = () => {
    const name = window.prompt('Template name');
    if (name && fabricCanvas) {
      saveTemplate(
        name,
        templateType,
        fabricCanvas.toJSON(),
        {
          ...labelData,
          size: { widthIn: LABEL_WIDTH_IN, heightIn: LABEL_HEIGHT_IN, dpi: PREVIEW_DPI },
        }
      );
    }
  };

  return (
    <Card className="shadow-aloha">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Templates
          <Button onClick={quickSave} size="sm" variant="outline">
            Quick Save
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-name">New template name</Label>
            <div className="flex gap-2 mt-2">
              <Input 
                id="template-name"
                value={templateName} 
                onChange={(e) => setTemplateName(e.target.value)} 
                placeholder="e.g., 2×1: Pokemon NM" 
              />
              <Select value={templateType} onValueChange={(value) => setTemplateType(value as 'graded' | 'raw')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="graded">Graded</SelectItem>
                  <SelectItem value="raw">Raw</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSave} disabled={!templateName.trim()}>
                Save
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="template-select">Load template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={handleLoad}
            >
              <SelectTrigger id="template-select">
                <SelectValue placeholder={templates.length ? `Choose (${templates.length})` : "No templates yet"} />
              </SelectTrigger>
              <SelectContent className="z-50">
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} {template.is_default && "⭐"} ({template.template_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplate && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleUpdate}>
                    Update Template
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => deleteTemplate(selectedTemplateId)}
                  >
                    Delete
                  </Button>
                  {!selectedTemplate.is_default ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setAsDefault(selectedTemplateId, selectedTemplate.template_type)}
                    >
                      Set as Default
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => clearDefault(selectedTemplateId)}
                    >
                      Clear Default
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setAsDefault(selectedTemplateId, 'graded')}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300"
                  >
                    Set as Default for Graded Cards
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setAsDefault(selectedTemplateId, 'raw')}
                    className="bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
                  >
                    Set as Default for Raw Cards
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}