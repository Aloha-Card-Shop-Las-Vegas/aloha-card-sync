import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { printNodeService } from "@/lib/printNodeService";
import { LabelCanvas } from "@/components/LabelCanvas";
import { TemplateManager } from "@/components/TemplateManager";
import { useLabelDesigner } from "@/hooks/useLabelDesigner";

function useSEO(opts: { title: string; description?: string }) {
  useEffect(() => {
    document.title = opts.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", opts.description || "");
    else if (opts.description) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = opts.description;
      document.head.appendChild(m);
    }
  }, [opts.title, opts.description]);
}

export default function LabelDesigner() {
  useSEO({ 
    title: "Label Designer 2x1 in | Aloha", 
    description: "Design and print 2x1 inch labels with barcode, lot, SKU, price, and more." 
  });

  const {
    labelData,
    updateLabelData,
    templates,
    setTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    templateType,
    setTemplateType,
  } = useLabelDesigner();

  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedFontFamily, setSelectedFontFamily] = useState('Roboto Condensed');
  
  // PrintNode state
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printNodeConnected, setPrintNodeConnected] = useState(false);

  // Load printer selection
  useEffect(() => {
    const saved = localStorage.getItem('printnode-selected-printer');
    if (saved) setSelectedPrinterId(parseInt(saved));
  }, []);

  useEffect(() => {
    if (selectedPrinterId) {
      localStorage.setItem('printnode-selected-printer', selectedPrinterId.toString());
    }
  }, [selectedPrinterId]);

  // Load PrintNode printers
  useEffect(() => {
    const loadPrintNode = async () => {
      try {
        const printerList = await printNodeService.getPrinters();
        setPrinters(printerList);
        setPrintNodeConnected(true);
        
        const saved = localStorage.getItem('printnode-selected-printer');
        if (saved && printerList.find(p => p.id === parseInt(saved))) {
          setSelectedPrinterId(parseInt(saved));
        } else if (printerList.length > 0) {
          setSelectedPrinterId(printerList[0].id);
        }
        
        toast.success(`PrintNode connected - Found ${printerList.length} printer(s)`);
      } catch (e) {
        console.error("PrintNode connection failed:", e);
        setPrintNodeConnected(false);
        toast.error("PrintNode connection failed");
      }
    };

    loadPrintNode();
  }, []);

  const handleTSPLPrint = async () => {
    if (!selectedPrinterId || !fabricCanvas) {
      toast.error('Select a PrintNode printer first');
      return;
    }

    setPrintLoading(true);
    try {
      // Get the selected template for rendering
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      
      // Call render-label edge function with template data
      const { data: labelResponse, error } = await supabase.functions.invoke('render-label', {
        body: {
          title: labelData.title,
          lot_number: labelData.lot,
          price: labelData.price,
          grade: labelData.condition,
          sku: labelData.sku,
          id: labelData.barcodeValue,
          template: selectedTemplate // Pass template data
        }
      });

      if (error) {
        console.error('Label render error:', error);
        toast.error('Failed to render label');
        return;
      }

      const { program } = labelResponse;
      
      // Send TSPL to PrintNode
      const result = await printNodeService.printRAW(program, selectedPrinterId, {
        title: 'Label Designer Print',
        copies: 1
      });

      if (result.success) {
        toast.success(`Label sent to printer (Job ID: ${result.jobId})`);
      } else {
        throw new Error(result.error || 'Print failed');
      }
      
    } catch (e) {
      console.error("TSPL print failed:", e);
      toast.error(`Print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setPrintLoading(false);
    }
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;
    const url = fabricCanvas.toDataURL({ multiplier: 1, format: "png", quality: 1 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-${Date.now()}.png`;
    a.click();
  };

  const applyFontToSelected = (fontFamily: string) => {
    if (!fabricCanvas) return;
    
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && (activeObject.type === 'text' || activeObject.type === 'textbox')) {
      (activeObject as any).set('fontFamily', fontFamily);
      fabricCanvas.renderAll();
      toast.success(`Font changed to ${fontFamily}`);
    } else {
      toast.info('Select a text object first');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-8 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Label Designer</h1>
            <p className="text-muted-foreground mt-2">Design 2×1 inch labels with TSPL printing to Rollo printers.</p>
          </div>
          <Link to="/">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Canvas (2×1 in preview)</CardTitle>
            </CardHeader>
            <CardContent>
              <LabelCanvas
                barcodeValue={labelData.barcodeValue}
                title={labelData.title}
                lot={labelData.lot}
                price={labelData.price}
                condition={labelData.condition}
                selectedFontFamily={selectedFontFamily}
                onCanvasReady={setFabricCanvas}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* PrintNode Printing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  TSPL Printing
                  {printNodeConnected ? (
                    <Badge variant="default" className="bg-green-600">
                      Connected ({printers.length})
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Not Connected</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {printNodeConnected && printers.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Select Printer</Label>
                      <Select value={selectedPrinterId?.toString() || ""} onValueChange={(value) => setSelectedPrinterId(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose printer" />
                        </SelectTrigger>
                        <SelectContent>
                          {printers.map((printer) => (
                            <SelectItem key={printer.id} value={printer.id.toString()}>
                              {printer.name} {printer.state === 'online' ? '🟢' : '🔴'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      onClick={handleTSPLPrint}
                      disabled={printLoading || !selectedPrinterId}
                      className="w-full"
                    >
                      {printLoading ? "Printing..." : "Print Label (TSPL)"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    PrintNode connection required for printing.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Label Data */}
            <Card>
              <CardHeader>
                <CardTitle>Label Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={labelData.title}
                    onChange={(e) => updateLabelData({ title: e.target.value })}
                    placeholder="Card title"
                  />
                </div>
                <div>
                  <Label>Lot Number</Label>
                  <Input
                    value={labelData.lot}
                    onChange={(e) => updateLabelData({ lot: e.target.value })}
                    placeholder="LOT-000001"
                  />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input
                    value={labelData.price}
                    onChange={(e) => updateLabelData({ price: e.target.value })}
                    placeholder="$1,000"
                  />
                </div>
                <div>
                  <Label>SKU/Barcode</Label>
                  <Input
                    value={labelData.sku}
                    onChange={(e) => updateLabelData({ sku: e.target.value, barcodeValue: e.target.value })}
                    placeholder="120979260"
                  />
                </div>
                <div>
                  <Label>Condition</Label>
                  <Select value={labelData.condition} onValueChange={(value) => updateLabelData({ condition: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Near Mint">Near Mint</SelectItem>
                      <SelectItem value="Lightly Played">Lightly Played</SelectItem>
                      <SelectItem value="Moderately Played">Moderately Played</SelectItem>
                      <SelectItem value="Heavily Played">Heavily Played</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Font Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Font Family</Label>
                  <Select value={selectedFontFamily} onValueChange={setSelectedFontFamily}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Roboto Condensed">Roboto Condensed</SelectItem>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  size="sm" 
                  className="mt-2" 
                  onClick={() => applyFontToSelected(selectedFontFamily)}
                >
                  Apply to Selected
                </Button>
              </CardContent>
            </Card>

            {/* Template Manager */}
            <TemplateManager
              templates={templates}
              setTemplates={setTemplates}
              selectedTemplateId={selectedTemplateId}
              setSelectedTemplateId={setSelectedTemplateId}
              templateType={templateType}
              setTemplateType={setTemplateType}
              fabricCanvas={fabricCanvas}
              labelData={labelData}
            />

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={handleDownload} variant="outline" className="w-full">
                  Download PNG
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}