import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import BarcodeLabel from "@/components/BarcodeLabel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

export interface BulkPreviewItem {
  id: string;
  title: string;
  lot: string;
  price: string;
  barcode: string;
  tspl: string;
}

interface PrintAllPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkPreviewItem[];
  onPrintAll: (items: BulkPreviewItem[]) => void | Promise<void>;
  loading?: boolean;
  templateType?: 'graded' | 'raw';
}

const PrintAllPreviewDialog: React.FC<PrintAllPreviewDialogProps> = ({ 
  open, 
  onOpenChange, 
  items: initialItems, 
  onPrintAll,
  loading = false,
  templateType = 'graded'
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewItems, setPreviewItems] = useState<BulkPreviewItem[]>(initialItems);
  const [refreshing, setRefreshing] = useState(false);
  
  const totalLabels = previewItems.length;

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, templateType]);

  // Update preview items when initial items change
  useEffect(() => {
    setPreviewItems(initialItems);
  }, [initialItems]);

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

  const refreshPreview = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template first');
      return;
    }
    
    setRefreshing(true);
    try {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      const refreshedItems: BulkPreviewItem[] = [];
      
      for (const item of initialItems) {
        const { data: labelData, error } = await supabase.functions.invoke('render-label', {
          body: {
            title: item.title,
            lot_number: item.lot,
            price: item.price.replace('$', ''),
            grade: '', // Add grade extraction if needed
            sku: item.barcode,
            id: item.id,
            template: selectedTemplate
          }
        });
        
        if (error) {
          console.error('Label render error:', error);
          toast.error(`Failed to render label for ${item.title}`);
          return;
        }
        
        refreshedItems.push({
          ...item,
          tspl: (labelData as any)?.program || ""
        });
      }
      
      setPreviewItems(refreshedItems);
      toast.success('Preview refreshed with selected template');
    } catch (error) {
      console.error('Error refreshing preview:', error);
      toast.error('Failed to refresh preview');
    } finally {
      setRefreshing(false);
    }
  };

  const handlePrintAll = () => {
    onPrintAll(previewItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Print All Preview ({totalLabels} labels)</DialogTitle>
          <DialogDescription>
            Review all labels before sending to printer. Each label will be printed once.
          </DialogDescription>
        </DialogHeader>

        {/* Template Selector */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <div className="flex-1">
            <Label htmlFor="template-select">Template for All Labels</Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={setSelectedTemplateId}
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
            onClick={refreshPreview}
            disabled={refreshing || !selectedTemplateId}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Preview'}
          </Button>
          
          {refreshing && <Badge variant="secondary">Updating...</Badge>}
        </div>

        <ScrollArea className="max-h-[500px] w-full">
          <div className="space-y-6">
            {previewItems.map((item, index) => (
              <div key={item.id} className="grid gap-4 sm:grid-cols-2 border-b pb-4 last:border-b-0">
                {/* Visual label mock */}
                <div>
                  <div className="text-sm font-medium mb-2">Label #{index + 1}</div>
                  <div className="rounded-md border bg-background p-3">
                    <div
                      className="relative mx-auto w-full overflow-hidden rounded-sm border bg-card"
                      style={{ aspectRatio: "2 / 1" }}
                      aria-label={`Label preview ${index + 1}`}
                    >
                      <div className="absolute left-2 top-1 text-xs leading-tight">
                        <div className="truncate max-w-[95%]" title={item.title}>{item.title}</div>
                      </div>
                      <div className="absolute left-2 top-6 text-xs">
                        <span className="opacity-80">{item.lot}</span>
                      </div>
                      <div className="absolute right-2 top-6 text-xs font-medium">
                        {item.price}
                      </div>
                      <div className="absolute left-2 right-2 bottom-1">
                        <BarcodeLabel value={item.barcode} showPrintButton={false} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TSPL for this label */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">TSPL Program</label>
                  <textarea
                    value={item.tspl}
                    readOnly
                    className="min-h-[180px] w-full rounded-md border bg-background p-3 font-mono text-xs resize-none"
                    aria-label={`TSPL program for label ${index + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {totalLabels} label{totalLabels === 1 ? '' : 's'} ready to print
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handlePrintAll} disabled={loading || refreshing}>
              {loading ? 'Printing...' : `Print All ${totalLabels} Labels`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintAllPreviewDialog;