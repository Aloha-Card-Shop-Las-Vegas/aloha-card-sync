import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BarcodeLabel from "@/components/BarcodeLabel";
import TemplateEditor, { TemplateElement } from "./TemplateEditor";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Edit } from "lucide-react";

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
  onPrint: (tspl: string) => void | Promise<void>;
  templateType?: 'graded' | 'raw';
}

const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({ 
  open, 
  onOpenChange, 
  label, 
  onPrint,
  templateType = 'graded'
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [currentTspl, setCurrentTspl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateElements, setTemplateElements] = useState<TemplateElement[]>([]);
  const [activeTab, setActiveTab] = useState('preview');
  
  // Local state for editing label data
  const [editableLabel, setEditableLabel] = useState(label);

  // Update editable label when prop changes
  useEffect(() => {
    setEditableLabel(label);
  }, [label]);

  // Load templates and auto-generate TSPL when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, templateType]);

  // Generate TSPL when dialog opens or when template/label changes
  useEffect(() => {
    if (open && selectedTemplateId) {
      generateTSPL();
      loadTemplateElements();
    }
  }, [open, selectedTemplateId, editableLabel]);

  const loadTemplateElements = async () => {
    if (!selectedTemplateId) return;
    
    try {
      const { data, error } = await supabase
        .from('label_templates')
        .select('*')
        .eq('id', selectedTemplateId)
        .single();
        
      if (error) throw error;
      
      // Load template elements for editing
      if (data.canvas && typeof data.canvas === 'object' && (data.canvas as any).elements) {
        setTemplateElements((data.canvas as any).elements);
      } else {
        // Create default elements if none exist
        setTemplateElements([
          {
            id: 'default-subject',
            type: 'field',
            label: 'Name',
            x: 10,
            y: 10,
            width: 200,
            height: 20,
            fontSize: 12,
            field: 'subject'
          },
          {
            id: 'default-price',
            type: 'price',
            label: 'Price',
            x: 10,
            y: 40,
            width: 80,
            height: 16,
            fontSize: 10,
            field: 'price'
          },
          {
            id: 'default-sku',
            type: 'barcode',
            label: 'SKU',
            x: 10,
            y: 70,
            width: 180,
            height: 30,
            fontSize: 8,
            field: 'sku'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading template elements:', error);
    }
  };

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

  const generateTSPL = async () => {
    if (!selectedTemplateId) return;
    setLoading(true);
    
    try {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      
      const { data: labelData, error } = await supabase.functions.invoke('render-label', {
        body: {
          title: editableLabel.title,
          lot_number: editableLabel.lot,
          price: editableLabel.price,
          grade: editableLabel.grade,
          sku: editableLabel.sku,
          id: editableLabel.barcode,
          template: selectedTemplate
        }
      });
      
      if (error) {
        console.error('Label render error:', error);
        toast.error('Failed to render label');
        return;
      }
      
      setCurrentTspl((labelData as any)?.program || "");
    } catch (error) {
      console.error('Error generating TSPL:', error);
      toast.error('Failed to generate TSPL');
    } finally {
      setLoading(false);
    }
  };

  const refreshPreview = () => {
    generateTSPL();
    toast.success('Preview refreshed');
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
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    
    try {
      // Use current selected template as base or create minimal template with elements
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      const templateData = {
        elements: templateElements,
        objects: (selectedTemplate?.canvas as any)?.objects || [],
        version: "6.0.0"
      } as any;
      
      const { data, error } = await supabase
        .from('label_templates')
        .insert({
          name: templateName.trim(),
          template_type: templateType,
          canvas: templateData,
          is_default: false
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      toast.success('Template saved successfully');
      setTemplateName("");
      if (data?.id) {
        setSelectedTemplateId(data.id);
      }
      await fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const updateTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template to update');
      return;
    }
    
    try {
      // Get current template data and update it with new elements
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      const templateData = {
        elements: templateElements,
        objects: (selectedTemplate?.canvas as any)?.objects || [],
        version: "6.0.0"
      } as any;
      
      const { error } = await supabase
        .from('label_templates')
        .update({
          canvas: templateData,
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
    if (!currentTspl) {
      toast.error('No TSPL generated. Please select a template first.');
      return;
    }
    onPrint(currentTspl);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Print Preview & Template Editor</DialogTitle>
          <DialogDescription>
            Preview, edit template design, and verify TSPL before printing.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview & Print</TabsTrigger>
            <TabsTrigger value="design">Design Template</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="space-y-4">
            {/* Template Selector and Actions */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="template-select">Template</Label>
                <Select 
                  value={selectedTemplateId} 
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
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
                onClick={refreshPreview}
                disabled={loading}
              >
                Refresh Preview
              </Button>
              
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
                <div className="flex items-center justify-between">
                  <Label>Label Preview</Label>
                  {loading && <Badge variant="secondary">Loading...</Badge>}
                </div>
                <div className="border rounded-lg p-4 bg-background">
                  <div
                    className="relative mx-auto w-full max-w-sm overflow-hidden rounded-sm border bg-card"
                    style={{ aspectRatio: "2 / 1" }}
                    aria-label="Label preview"
                  >
                    <div className="absolute left-2 top-1 text-xs leading-tight">
                      <div className="truncate max-w-[95%]" title={editableLabel.title}>{editableLabel.title}</div>
                    </div>
                    <div className="absolute left-2 top-6 text-xs">
                      <span className="opacity-80">{editableLabel.lot}</span>
                    </div>
                    {editableLabel.grade && (
                      <div className="absolute left-2 top-10 text-xs font-medium">
                        <span className="bg-primary text-primary-foreground px-1 rounded text-[10px]">{editableLabel.grade}</span>
                      </div>
                    )}
                    <div className="absolute right-2 top-6 text-xs font-medium">
                      {editableLabel.price}
                    </div>
                    <div className="absolute left-2 right-2 bottom-1">
                      <BarcodeLabel value={editableLabel.barcode} showPrintButton={false} />
                    </div>
                  </div>
                </div>
                
                {/* Label Editor (conditionally shown) */}
                {isEditing && (
                  <div className="space-y-4">
                    {/* Label Data Editor */}
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                      <Label className="text-sm font-medium">Edit Label Data</Label>
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
                    
                    {/* Template Management */}
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                      <Label className="text-sm font-medium">Template Management</Label>
                      
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
                          <Button onClick={updateTemplate} variant="default" size="sm">
                            Update Template
                          </Button>
                        </div>
                      )}
                      
                      {/* Save as New Template */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label htmlFor="template-name" className="text-xs">Save as New Template</Label>
                          <Input
                            id="template-name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="New template name"
                            className="text-xs"
                          />
                        </div>
                        <Button onClick={saveTemplate} disabled={!templateName.trim()} size="sm">
                          Save New
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TSPL Preview */}
              <div className="flex flex-col gap-2 lg:col-span-2">
                <Label>Generated TSPL Program</Label>
                <textarea
                  value={currentTspl}
                  readOnly
                  className="min-h-[400px] w-full rounded-md border bg-background p-3 font-mono text-xs"
                  aria-label="TSPL program"
                  placeholder={loading ? "Generating TSPL..." : "Select a template to generate TSPL"}
                />
                <p className="text-xs text-muted-foreground">
                  This TSPL program will be sent to your thermal printer. The preview above shows exactly what will be printed.
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="design" className="space-y-4">
            <TemplateEditor
              elements={templateElements}
              onChange={setTemplateElements}
              sampleData={{
                subject: editableLabel.title,
                price: editableLabel.price,
                sku: editableLabel.barcode,
                lot_number: editableLabel.lot,
                grade: editableLabel.grade,
                created_at: new Date().toLocaleDateString()
              }}
            />
            
            <div className="flex justify-center gap-2">
              <Button onClick={updateTemplate} disabled={!selectedTemplateId}>
                <Edit className="w-4 h-4 mr-2" />
                Update Template Design
              </Button>
              <Button 
                variant="outline" 
                onClick={() => generateTSPL()}
                disabled={loading}
              >
                Refresh Preview
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={!currentTspl || loading}>
            Print Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewDialog;
