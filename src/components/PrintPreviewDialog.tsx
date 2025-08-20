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
  grade?: string;
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
  
  // Local state for editing label data
  const [editableLabel, setEditableLabel] = useState(label);

  // Update editable label when prop changes
  useEffect(() => {
    setEditableLabel(label);
  }, [label]);

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

  const setAsDefault = async (templateId: string) => {
    try {
      const { error } = await supabase.rpc('set_template_default', {
        template_id: templateId,
        template_type_param: templateType
      });
      
      if (error) throw error;
      
      toast.success('Template set as default');
      await fetchTemplates();
    } catch (error) {
      console.error('Error setting default template:', error);
      toast.error('Failed to set template as default');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('label_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      toast.success('Template deleted');
      
      // Reset selection if we deleted the selected template
      if (templateId === selectedTemplateId) {
        setSelectedTemplateId("");
      }
      
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
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

  const updateTemplate = async () => {
    if (!fabricCanvas || !selectedTemplateId) {
      toast.error('Please select a template to update');
      return;
    }
    
    try {
      const canvasData = fabricCanvas.toJSON();
      
      const { error } = await supabase
        .from('label_templates')
        .update({
          canvas: canvasData,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplateId);
      
      if (error) throw error;
      
      toast.success('Template updated successfully');
      await fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
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
            
            {/* Template Actions */}
            {selectedTemplateId && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAsDefault(selectedTemplateId)}
                  disabled={templates.find(t => t.id === selectedTemplateId)?.is_default}
                >
                  Set Default
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => deleteTemplate(selectedTemplateId)}
                  className="text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Hide Editor' : 'Show Editor'}
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Visual Label Preview - Always show the canvas */}
            <div className="space-y-4">
              <Label>Label Preview {isEditing ? '& Editor' : ''}</Label>
              <div className="border rounded-lg p-4 bg-background">
                <LabelCanvas
                  barcodeValue={editableLabel.barcode}
                  title={editableLabel.title}
                  lot={editableLabel.lot}
                  price={editableLabel.price}
                  grade={editableLabel.grade}
                  condition={editableLabel.condition || 'Near Mint'}
                  selectedFontFamily="Arial"
                  onCanvasReady={handleCanvasReady}
                />
              </div>
              
              {/* Template Editor Controls (conditionally shown) */}
              {isEditing && (
                <div className="space-y-4">
                  {/* Label Data Editor */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <Label className="text-sm font-medium">Label Data</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-title" className="text-xs">Title</Label>
                        <Input
                          id="edit-title"
                          value={editableLabel.title}
                          onChange={(e) => setEditableLabel(prev => ({ ...prev, title: e.target.value }))}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-lot" className="text-xs">Lot</Label>
                        <Input
                          id="edit-lot"
                          value={editableLabel.lot}
                          onChange={(e) => setEditableLabel(prev => ({ ...prev, lot: e.target.value }))}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-price" className="text-xs">Price</Label>
                        <Input
                          id="edit-price"
                          value={editableLabel.price}
                          onChange={(e) => setEditableLabel(prev => ({ ...prev, price: e.target.value }))}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-grade" className="text-xs">Grade</Label>
                        <Input
                          id="edit-grade"
                          value={editableLabel.grade || ""}
                          onChange={(e) => setEditableLabel(prev => ({ ...prev, grade: e.target.value }))}
                          placeholder="e.g., PSA 10, BGS 9.5"
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="edit-barcode" className="text-xs">Barcode</Label>
                        <Input
                          id="edit-barcode"
                          value={editableLabel.barcode}
                          onChange={(e) => setEditableLabel(prev => ({ ...prev, barcode: e.target.value }))}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Template Actions */}
                  <div className="flex items-center gap-2">
                    {selectedTemplateId && (
                      <Button onClick={updateTemplate} variant="default" className="flex-1">
                        Update "{templates.find(t => t.id === selectedTemplateId)?.name}"
                      </Button>
                    )}
                    <Button onClick={regenerateTSPL} variant="outline" className="flex-1">
                      Regenerate TSPL
                    </Button>
                  </div>
                  
                  {/* Save as New Template */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="template-name">Save as New Template</Label>
                      <Input
                        id="template-name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="New template name"
                      />
                    </div>
                    <Button onClick={saveTemplate} disabled={!templateName.trim()}>
                      Save New
                    </Button>
                  </div>
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
                Generated TSPL for Rollo printer. The canvas above shows exactly what this TSPL represents.
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
