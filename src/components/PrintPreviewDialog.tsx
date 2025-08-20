import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelCanvas } from "@/components/LabelCanvas";
import { TemplateManager } from "@/components/TemplateManager";
import { fabricToTSPL } from "@/lib/fabricToTspl";
import { supabase } from "@/integrations/supabase/client";
import { Canvas as FabricCanvas } from "fabric";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface PreviewLabelData {
  title: string;
  lot: string;
  price: string;
  barcode: string;
  sku?: string;
  condition?: string;
}

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: PreviewLabelData;
  tspl: string;
  onPrint: () => void | Promise<void>;
  templateType?: 'graded' | 'raw';
}

const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({ 
  open, 
  onOpenChange, 
  label, 
  tspl: initialTspl, 
  onPrint,
  templateType = 'graded'
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [currentTspl, setCurrentTspl] = useState(initialTspl);
  const [templateName, setTemplateName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, templateType]);

  // Update TSPL when initial value changes
  useEffect(() => {
    setCurrentTspl(initialTspl);
  }, [initialTspl]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('label_templates')
        .select('*')
        .eq('template_type', templateType)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      
      setTemplates(data || []);
      
      // Auto-select default template
      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    }
  };

  const handleCanvasReady = useCallback((canvas: FabricCanvas) => {
    setFabricCanvas(canvas);
  }, []);

  const regenerateTSPL = useCallback(() => {
    if (!fabricCanvas) return;
    
    try {
      const newTspl = fabricToTSPL(fabricCanvas, {
        density: 10,
        speed: 4,
        gapInches: 0
      });
      setCurrentTspl(newTspl);
      toast.success('TSPL regenerated from canvas');
    } catch (error) {
      console.error('Error generating TSPL:', error);
      toast.error('Failed to generate TSPL');
    }
  }, [fabricCanvas]);

  const loadTemplate = async (templateId: string) => {
    if (!templateId || !fabricCanvas) return;
    
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      
      // Clear canvas and load template
      fabricCanvas.clear();
      
      if (template.canvas) {
        await fabricCanvas.loadFromJSON(template.canvas);
        fabricCanvas.renderAll();
        regenerateTSPL();
        toast.success(`Loaded template: ${template.name}`);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('Failed to load template');
    }
  };

  const saveTemplate = async () => {
    if (!fabricCanvas || !templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    
    try {
      const canvasData = fabricCanvas.toJSON();
      
      const { error } = await supabase
        .from('label_templates')
        .insert({
          name: templateName.trim(),
          template_type: templateType,
          canvas: canvasData,
          is_default: false
        });
      
      if (error) throw error;
      
      toast.success('Template saved successfully');
      setTemplateName("");
      await fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handlePrint = () => {
    // Use the current TSPL (either original or regenerated)
    onPrint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Print Preview & Template Editor</DialogTitle>
          <DialogDescription>
            Preview, edit template, and verify TSPL before printing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="template-select">Template</Label>
              <Select 
                value={selectedTemplateId} 
                onValueChange={(value) => {
                  setSelectedTemplateId(value);
                  loadTemplate(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.is_default ? '(Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Hide Editor' : 'Show Editor'}
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Visual Label Preview */}
            <div className="space-y-4">
              <Label>Label Preview</Label>
              <div className="rounded-md border bg-background p-4">
                <div
                  className="relative mx-auto w-full overflow-hidden rounded-sm border bg-card"
                  style={{ aspectRatio: "2 / 1" }}
                  aria-label="Label preview (approximate)"
                >
                  <div className="absolute left-2 top-1 text-xs leading-tight">
                    <div className="truncate max-w-[95%]" title={label.title}>{label.title}</div>
                  </div>
                  <div className="absolute left-2 top-6 text-xs">
                    <span className="opacity-80">{label.lot}</span>
                  </div>
                  <div className="absolute right-2 top-6 text-xs font-medium">
                    {label.price}
                  </div>
                  <div className="absolute left-2 right-2 bottom-1 text-center">
                    <div className="text-xs font-mono">{label.barcode}</div>
                    <div className="text-xs opacity-60">QR/Barcode</div>
                  </div>
                </div>
              </div>
              
              {/* Template Editor (conditionally shown) */}
              {isEditing && (
                <div className="space-y-4">
                  <div>
                    <Label>Template Editor</Label>
                    <div className="border rounded-lg p-4 bg-background">
                      <LabelCanvas
                        barcodeValue={label.barcode}
                        title={label.title}
                        lot={label.lot}
                        price={label.price}
                        condition={label.condition || 'Near Mint'}
                        selectedFontFamily="Arial"
                        onCanvasReady={handleCanvasReady}
                      />
                    </div>
                  </div>
                  
                  {/* Save Template Controls */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="template-name">Save as Template</Label>
                      <Input
                        id="template-name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Template name"
                      />
                    </div>
                    <Button onClick={saveTemplate} disabled={!templateName.trim()}>
                      Save
                    </Button>
                  </div>
                  
                  <Button onClick={regenerateTSPL} variant="outline" className="w-full">
                    Regenerate TSPL from Canvas
                  </Button>
                </div>
              )}
            </div>

            {/* TSPL Preview */}
            <div className="flex flex-col gap-2 lg:col-span-2">
              <Label>Raw TSPL Program</Label>
              <textarea
                value={currentTspl}
                readOnly
                className="min-h-[400px] w-full rounded-md border bg-background p-3 font-mono text-xs"
                aria-label="TSPL program"
              />
              <p className="text-xs text-muted-foreground">
                Generated TSPL for Rollo printer. Check Rollo manual if issues occur.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            Print with Current TSPL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewDialog;
