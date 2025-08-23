import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PrinterPanel } from "@/components/PrinterPanel";
import { RawTemplateEditor } from "@/components/RawTemplateEditor";
import { usePrintNode } from "@/hooks/usePrintNode";
import { useLocalStorageString } from "@/hooks/useLocalStorage";
import { useTemplateDefault } from "@/hooks/useTemplateDefault";
import { 
  AVAILABLE_TEMPLATES, 
  generateLabelTSPL, 
  type LabelData, 
  type TSPLSettings 
} from "@/lib/labelTemplates";

function useSEO(opts: { title: string; description?: string; canonical?: string }) {
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
    const linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const href = opts.canonical || window.location.href;
    if (linkCanonical) linkCanonical.href = href; else { const l = document.createElement("link"); l.rel = "canonical"; l.href = href; document.head.appendChild(l); }
  }, [opts.title, opts.description, opts.canonical]);
}

export default function LabelDesigner() {
  useSEO({ 
    title: "Label Designer 2x1 in | Aloha", 
    description: "Design and print 2x1 inch labels with barcode, lot, SKU, price, and more using reliable TSPL templates." 
  });

  const { printRAW, isConnected: printNodeConnected, selectedPrinterId } = usePrintNode();
  const [printLoading, setPrintLoading] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  
  // Template and settings with localStorage persistence
  const { 
    selectedTemplateId, 
    setSelectedTemplateId, 
    setAsDefault, 
    resetToAppDefault, 
    isUsingAppDefault 
  } = useTemplateDefault();
  const [tsplDensity, setTsplDensity] = useLocalStorageString('tspl-density', '10');
  const [tsplSpeed, setTsplSpeed] = useLocalStorageString('tspl-speed', '4');
  const [tsplGap, setTsplGap] = useLocalStorageString('tspl-gap', '0');

  // Label data
  const [barcodeValue, setBarcodeValue] = useState("120979260");
  const [title, setTitle] = useState("POKEMON GENGAR VMAX #020");
  const [lot, setLot] = useState("LOT-000001");
  const [price, setPrice] = useState("1000");
  const [sku, setSku] = useState("120979260");
  const [condition, setCondition] = useState("Near Mint");
  
  // Preview TSPL
  const [previewTspl, setPreviewTspl] = useState("");

  const labelData: LabelData = {
    title,
    sku,
    price,
    lot,
    condition,
    barcode: barcodeValue
  };

  const tsplSettings: TSPLSettings = {
    density: parseInt(tsplDensity) || 10,
    speed: parseInt(tsplSpeed) || 4,
    gapInches: parseFloat(tsplGap) || 0
  };

  // Update preview when data or template changes
  useEffect(() => {
    try {
      const tspl = generateLabelTSPL(selectedTemplateId, labelData, tsplSettings);
      setPreviewTspl(tspl);
    } catch (error) {
      console.error('Failed to generate TSPL preview:', error);
      setPreviewTspl('// Error generating preview');
    }
  }, [selectedTemplateId, labelData, tsplSettings]);

  const handlePrintNodePrint = async (isTest = false) => {
    if (!selectedPrinterId) {
      toast.error('Select a PrintNode printer first');
      return;
    }

    setPrintLoading(true);
    try {
      const testData = isTest ? {
        title: "TEST LABEL",
        sku: "TEST-001", 
        price: "99.99",
        lot: "TEST-LOT",
        condition: "Test",
        barcode: "123456789"
      } : labelData;

      const tspl = generateLabelTSPL(selectedTemplateId, testData, tsplSettings);

      const result = await printRAW(tspl, {
        title: isTest ? 'Test Label' : 'Label Print',
        copies: 1
      });

      if (result.success) {
        setHasPrinted(true);
        toast.success(`${isTest ? 'Test' : 'Label'} sent to PrintNode printer successfully (Job ID: ${result.jobId})`);
      } else {
        throw new Error(result.error || 'Print failed');
      }
      
    } catch (e) {
      console.error("PrintNode print failed:", e);
      toast.error(`PrintNode print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setPrintLoading(false);
    }
  };

  const selectedTemplate = AVAILABLE_TEMPLATES.find(t => t.id === selectedTemplateId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-8 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Label Designer</h1>
            <p className="text-muted-foreground mt-2">Design 2×1 inch labels with PrintNode cloud printing using reliable TSPL templates.</p>
          </div>
          <Link to="/">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-aloha lg:col-span-2">
            <CardHeader>
              <CardTitle>Label Data & Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Selection */}
              <div>
                <Label htmlFor="template-select">Label Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_TEMPLATES.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplate.description}
                    </p>
                    <div className="flex gap-2">
                      {!isUsingAppDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            resetToAppDefault();
                            toast.success('Reset to app default template');
                          }}
                          className="text-xs"
                        >
                          Reset Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAsDefault(selectedTemplateId);
                          toast.success(`${selectedTemplate.name} set as default template`);
                        }}
                        className="text-xs"
                      >
                        Set as Default
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Label Data Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Item title" 
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input 
                    id="price" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="99.99" 
                  />
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input 
                    id="sku" 
                    value={sku} 
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="SKU123" 
                  />
                </div>
                <div>
                  <Label htmlFor="condition">Condition</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gem Mint">Gem Mint</SelectItem>
                      <SelectItem value="Mint">Mint</SelectItem>
                      <SelectItem value="Near Mint">Near Mint</SelectItem>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Very Good">Very Good</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lot">Lot Number</Label>
                  <Input 
                    id="lot" 
                    value={lot} 
                    onChange={(e) => setLot(e.target.value)}
                    placeholder="LOT-000001" 
                  />
                </div>
                <div>
                  <Label htmlFor="barcode">Barcode/QR Data</Label>
                  <Input 
                    id="barcode" 
                    value={barcodeValue} 
                    onChange={(e) => setBarcodeValue(e.target.value)}
                    placeholder="123456789" 
                  />
                </div>
              </div>

              {/* TSPL Settings */}
              <div>
                <Label className="text-base font-medium">TSPL Printer Settings</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label htmlFor="density" className="text-sm">Density (0-15)</Label>
                    <Input 
                      id="density" 
                      type="number" 
                      min="0" 
                      max="15" 
                      value={tsplDensity} 
                      onChange={(e) => setTsplDensity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="speed" className="text-sm">Speed (2-8)</Label>
                    <Input 
                      id="speed" 
                      type="number" 
                      min="2" 
                      max="8" 
                      value={tsplSpeed} 
                      onChange={(e) => setTsplSpeed(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gap" className="text-sm">Gap (inches)</Label>
                    <Input 
                      id="gap" 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      value={tsplGap} 
                      onChange={(e) => setTsplGap(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* TSPL Preview */}
              <div>
                <Label className="text-base font-medium">TSPL Preview</Label>
                <Textarea 
                  value={previewTspl} 
                  readOnly 
                  className="font-mono text-sm mt-2" 
                  rows={8}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  PrintNode Cloud Printing
                  {printNodeConnected ? (
                    <Badge variant="default" className="bg-green-600">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Not Connected</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {printNodeConnected && selectedPrinterId ? (
                  <div className="space-y-4">
                    <div className="p-3 border rounded-lg bg-green-50">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-green-800">✓ PrintNode Ready</Label>
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                      <p className="text-xs text-green-700 mb-3">
                        Reliable raw TSPL printing available
                      </p>
                      
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          onClick={() => handlePrintNodePrint(true)}
                          disabled={printLoading}
                          variant="outline"
                          className="flex-1 border-green-600 text-green-700 hover:bg-green-50"
                        >
                          {printLoading ? "Testing..." : "Test Print"}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handlePrintNodePrint(false)}
                          disabled={printLoading}
                          className={`flex-1 text-white ${
                            hasPrinted 
                              ? 'bg-orange-600 hover:bg-orange-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {printLoading ? "Printing..." : hasPrinted ? "Reprint" : "Print Label"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border rounded-lg bg-red-50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <Label className="text-sm font-medium text-red-800">PrintNode Not Available</Label>
                    </div>
                    <p className="text-sm text-red-700 mb-2">
                      {!printNodeConnected ? 
                        "Check your PrintNode API key configuration in Supabase secrets." :
                        "No printer selected. Use the PrintNode panel below."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <PrinterPanel />

            <RawTemplateEditor />

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-medium">Template Features:</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                      <li>Code-defined templates for consistent output</li>
                      <li>Direct TSPL generation for crisp printing</li>
                      <li>Reliable barcode/QR code positioning</li>
                      <li>No rasterization or DPI issues</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium">Print Quality:</h4>
                    <p className="text-muted-foreground">
                      Raw TSPL commands ensure maximum print quality and reliability on thermal printers.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}