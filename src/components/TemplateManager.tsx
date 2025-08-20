import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Canvas as FabricCanvas, Rect } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { LabelTemplate, LabelData } from "@/hooks/useLabelDesigner";

const LABEL_WIDTH_IN = 2;
const LABEL_HEIGHT_IN = 1;
const PREVIEW_DPI = 150;
const PX_WIDTH = Math.round(LABEL_WIDTH_IN * PREVIEW_DPI);
const PX_HEIGHT = Math.round(LABEL_HEIGHT_IN * PREVIEW_DPI);

interface TemplateManagerProps {
  templates: LabelTemplate[];
  setTemplates: (templates: LabelTemplate[]) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  templateType: 'graded' | 'raw';
  setTemplateType: (type: 'graded' | 'raw') => void;
  fabricCanvas: FabricCanvas | null;
  labelData: LabelData;
}

export const TemplateManager = ({
  templates,
  setTemplates,
  selectedTemplateId,
  setSelectedTemplateId,
  templateType,
  setTemplateType,
  fabricCanvas,
  labelData
}: TemplateManagerProps) => {
  const [templateName, setTemplateName] = useState("");

  // Load templates and auto-load default
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Auto-load default template when templates change
  useEffect(() => {
    if (templates.length > 0 && fabricCanvas) {
      const defaultTemplate = templates.find(t => t.template_type === templateType && t.is_default);
      if (defaultTemplate && !selectedTemplateId) {
        loadTemplate(defaultTemplate.id);
        setSelectedTemplateId(defaultTemplate.id);
      }
    }
  }, [templates, templateType, fabricCanvas, selectedTemplateId]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('label_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error(error);
      toast.error('Failed to load templates');
      return;
    }
    setTemplates((data as unknown as LabelTemplate[]) || []);
  };

  const saveTemplate = async () => {
    if (!fabricCanvas || !templateName.trim()) {
      toast.error('Enter a template name');
      return;
    }

    const payload = {
      name: templateName.trim(),
      template_type: templateType,
      canvas: fabricCanvas.toJSON(),
      data: {
        ...labelData,
        size: { widthIn: LABEL_WIDTH_IN, heightIn: LABEL_HEIGHT_IN, dpi: PREVIEW_DPI },
      },
    };

    const { error } = await supabase.from('label_templates').insert(payload as any);
    if (error) {
      console.error(error);
      toast.error('Save failed');
    } else {
      toast.success('Template saved');
      setTemplateName('');
      fetchTemplates();
    }
  };

  const loadTemplate = async (id: string) => {
    const tpl = templates.find(t => t.id === id);
    if (!tpl || !fabricCanvas) return;

    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';

    fabricCanvas.loadFromJSON(tpl.canvas, () => {
      // Re-add border outline
      const border = new Rect({
        left: 1,
        top: 1,
        width: PX_WIDTH - 2,
        height: PX_HEIGHT - 2,
        rx: 6,
        ry: 6,
        fill: 'transparent',
        stroke: '#ddd',
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      fabricCanvas.add(border);
      fabricCanvas.renderAll();
      toast.success(`Template "${tpl.name}" loaded`);
    });
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('label_templates').delete().eq('id', id);
    if (error) {
      console.error(error);
      toast.error('Delete failed');
    } else {
      toast.success('Template deleted');
      if (selectedTemplateId === id) setSelectedTemplateId('');
      fetchTemplates();
    }
  };

  const setAsDefault = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    
    try {
      const { error } = await supabase.rpc('set_template_default', {
        template_id: id,
        template_type_param: template.template_type
      });
      
      if (error) throw error;
      toast.success(`Set as default ${template.template_type} template`);
      fetchTemplates();
    } catch (error) {
      console.error(error);
      toast.error('Failed to set default template');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Template Type</Label>
          <Select value={templateType} onValueChange={(value: 'graded' | 'raw') => setTemplateType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graded">Graded Cards</SelectItem>
              <SelectItem value="raw">Raw Cards</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Load Template</Label>
          <Select value={selectedTemplateId} onValueChange={(value) => {
            setSelectedTemplateId(value);
            if (value) loadTemplate(value);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates
                .filter(t => t.template_type === templateType)
                .map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default && <Badge className="ml-2" variant="secondary">Default</Badge>}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={fetchTemplates}
          >
            Refresh
          </Button>
          {selectedTemplateId && (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setAsDefault(selectedTemplateId)}
              >
                Set Default
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => deleteTemplate(selectedTemplateId)}
              >
                Delete
              </Button>
            </>
          )}
        </div>

        <div className="pt-4 border-t">
          <Label>Save New Template</Label>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button onClick={saveTemplate}>Save</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};