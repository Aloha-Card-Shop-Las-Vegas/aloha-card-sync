import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { toast } from "sonner";
import { Link, useLocation } from "react-router-dom";
import { PrinterPanel } from "@/components/PrinterPanel";
import { LabelCanvasEditor } from "@/components/LabelCanvasEditor";
import { usePrintNode } from "@/hooks/usePrintNode";
import { useLocalStorageString } from "@/hooks/useLocalStorage";
import { generateUnifiedTSPL, generateTSPLFromLayout, type LabelFieldConfig, type LabelLayout } from "@/lib/tspl";
import { useLabelLayouts } from "@/hooks/useLabelLayouts";

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

// Create a well-positioned starter layout
const createStarterLayout = (): LabelLayout => ({
  title: { 
    visible: true, 
    x: 15, 
    y: 15, 
    fontSize: 2,
    prefix: '' 
  },
  sku: { 
    visible: true, 
    x: 15, 
    y: 45, 
    fontSize: 1,
    prefix: 'SKU: ' 
  },
  price: { 
    visible: true, 
    x: 280, 
    y: 15, 
    fontSize: 3,
    prefix: '$' 
  },
  lot: { 
    visible: true, 
    x: 15, 
    y: 70, 
    fontSize: 1,
    prefix: 'LOT: ' 
  },
  condition: { 
    visible: true, 
    x: 200, 
    y: 45, 
    fontSize: 1,
    prefix: '' 
  },
  barcode: { 
    mode: 'qr' as const, 
    x: 15, 
    y: 100, 
    size: 'M' as const,
    width: 60,
    height: 60
  }
});

export default function LabelDesigner() {
  useSEO({ 
    title: "Label Designer 2x1 in | Aloha", 
    description: "Design and print 2x1 inch labels with barcode, lot, SKU, price, and more using TSPL for Rollo printers." 
  });

  const location = useLocation();
  const { printRAW, isConnected: printNodeConnected, selectedPrinterId } = usePrintNode();
  const [printLoading, setPrintLoading] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  
  // Layout management
  const { layouts, saveLayout, updateLayout, deleteLayout, setAsDefault } = useLabelLayouts();
  const [layoutMode, setLayoutMode] = useLocalStorageString('layout-mode', 'auto');
  const [currentLayoutId, setCurrentLayoutId] = useLocalStorageString('current-layout-id', '');
  const [currentLayout, setCurrentLayout] = useState<LabelLayout | null>(null);
  const [useCanvasEditor, setUseCanvasEditor] = useLocalStorageString('use-canvas-editor', 'true');
  const [layoutName, setLayoutName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // TSPL settings with localStorage persistence
  const [tsplDensity, setTsplDensity] = useLocalStorageString('tspl-density', '10');
  const [tsplSpeed, setTsplSpeed] = useLocalStorageString('tspl-speed', '4');
  const [tsplGap, setTsplGap] = useLocalStorageString('tspl-gap', '0');

  // Field configuration with localStorage persistence (for Auto mode)
  const [includeTitle, setIncludeTitle] = useLocalStorageString('field-title', 'true');
  const [includeSku, setIncludeSku] = useLocalStorageString('field-sku', 'true');
  const [includePrice, setIncludePrice] = useLocalStorageString('field-price', 'true');
  const [includeLot, setIncludeLot] = useLocalStorageString('field-lot', 'true');
  const [includeCondition, setIncludeCondition] = useLocalStorageString('field-condition', 'true');
  const [barcodeMode, setBarcodeMode] = useLocalStorageString('barcode-mode', 'qr');

  // Label data - pre-fill from route state if coming from inventory
  const [title, setTitle] = useState(location.state?.title || "POKEMON GENGAR VMAX #020");
  const [sku, setSku] = useState(location.state?.sku || "120979260");
  const [price, setPrice] = useState(location.state?.price || "1000");
  const [lot, setLot] = useState(location.state?.lot || "LOT-000001");
  const [condition, setCondition] = useState(location.state?.condition || "Near Mint");
  const [barcodeValue, setBarcodeValue] = useState(location.state?.barcode || location.state?.sku || "120979260");
  
  // Preview TSPL
  const [previewTspl, setPreviewTspl] = useState("");

  const labelData = {
    title,
    sku,
    price,
    lot,
    condition,
    barcode: barcodeValue
  };

  const fieldConfig: LabelFieldConfig = {
    includeTitle: includeTitle === 'true',
    includeSku: includeSku === 'true',
    includePrice: includePrice === 'true',
    includeLot: includeLot === 'true',
    includeCondition: includeCondition === 'true',
    barcodeMode: barcodeMode as 'qr' | 'barcode' | 'none'
  };

  const tsplSettings = {
    density: parseInt(tsplDensity) || 10,
    speed: parseInt(tsplSpeed) || 4,
    gapInches: parseFloat(tsplGap) || 0
  };

  // Load saved layout on mount and auto-create starter layout if needed
  useEffect(() => {
    if (currentLayoutId && layouts.length > 0) {
      const savedLayout = layouts.find(l => l.id === currentLayoutId);
      if (savedLayout) {
        setCurrentLayout(savedLayout.layout);
        setLayoutName(savedLayout.name);
      }
    } else if (layoutMode === 'custom' && !currentLayout) {
      // Auto-create starter layout for better onboarding
      const starterLayout = createStarterLayout();
      setCurrentLayout(starterLayout);
      setLayoutName('Untitled Layout');
      setIsEditingName(true);
    }
  }, [currentLayoutId, layouts, layoutMode, currentLayout]);

  // Update preview when data or config changes
  useEffect(() => {
    try {
      let tspl: string;
      if (layoutMode === 'custom' && currentLayout) {
        tspl = generateTSPLFromLayout(currentLayout, labelData, tsplSettings);
      } else {
        tspl = generateUnifiedTSPL(labelData, fieldConfig, tsplSettings);
      }
      setPreviewTspl(tspl);
    } catch (error) {
      console.error('Failed to generate TSPL preview:', error);
      setPreviewTspl('// Error generating preview');
    }
  }, [labelData, fieldConfig, tsplSettings, layoutMode, currentLayout]);

  const handleSaveLayout = async (asNew = false) => {
    if (!currentLayout) return;
    
    const finalName = layoutName.trim() || 'Untitled Layout';
    
    try {
      if (asNew || !currentLayoutId) {
        // Save as new layout
        const id = await saveLayout(finalName, currentLayout, false);
        setCurrentLayoutId(id);
        setIsEditingName(false);
        toast.success(`Layout "${finalName}" saved successfully`);
      } else {
        // Update existing layout
        await updateLayout(currentLayoutId, finalName, currentLayout);
        setIsEditingName(false);
        toast.success(`Layout "${finalName}" updated successfully`);
      }
    } catch (error) {
      toast.error('Failed to save layout: ' + (error as Error).message);
    }
  };

  const handleLoadLayout = (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    if (layout) {
      setCurrentLayoutId(layoutId);
      setCurrentLayout(layout.layout);
      setLayoutName(layout.name);
      setIsEditingName(false);
    }
  };

  const handleCreateNewLayout = () => {
    const starterLayout = createStarterLayout();
    setCurrentLayout(starterLayout);
    setLayoutName('New Layout');
    setCurrentLayoutId('');
    setIsEditingName(true);
  };

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

      const testConfig = isTest ? {
        includeTitle: true,
        includeSku: true,
        includePrice: true,
        includeLot: true,
        includeCondition: true,
        barcodeMode: 'qr' as const
      } : fieldConfig;

      let tspl: string;
      if (layoutMode === 'custom' && currentLayout) {
        tspl = generateTSPLFromLayout(currentLayout, testData, tsplSettings);
      } else {
        tspl = generateUnifiedTSPL(testData, testConfig, tsplSettings);
      }

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
              {/* Layout Mode Selection */}
              <div>
                <Label className="text-base font-medium">Layout Mode</Label>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="layout-auto"
                      name="layout-mode"
                      value="auto"
                      checked={layoutMode === 'auto'}
                      onChange={(e) => setLayoutMode(e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="layout-auto" className="text-sm">Auto Layout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="layout-custom"
                      name="layout-mode"
                      value="custom"
                      checked={layoutMode === 'custom'}
                      onChange={(e) => setLayoutMode(e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="layout-custom" className="text-sm">Visual Designer</Label>
                  </div>
                </div>
              </div>

              {/* Auto Layout Fields */}
              {layoutMode === 'auto' && (
                <div>
                  <Label className="text-base font-medium">Include Fields</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-title" 
                        checked={includeTitle === 'true'} 
                        onCheckedChange={(checked) => setIncludeTitle(checked ? 'true' : 'false')}
                      />
                      <Label htmlFor="include-title" className="text-sm">Title</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-sku" 
                        checked={includeSku === 'true'} 
                        onCheckedChange={(checked) => setIncludeSku(checked ? 'true' : 'false')}
                      />
                      <Label htmlFor="include-sku" className="text-sm">SKU</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-price" 
                        checked={includePrice === 'true'} 
                        onCheckedChange={(checked) => setIncludePrice(checked ? 'true' : 'false')}
                      />
                      <Label htmlFor="include-price" className="text-sm">Price</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-lot" 
                        checked={includeLot === 'true'} 
                        onCheckedChange={(checked) => setIncludeLot(checked ? 'true' : 'false')}
                      />
                      <Label htmlFor="include-lot" className="text-sm">Lot Number</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-condition" 
                        checked={includeCondition === 'true'} 
                        onCheckedChange={(checked) => setIncludeCondition(checked ? 'true' : 'false')}
                      />
                      <Label htmlFor="include-condition" className="text-sm">Condition</Label>
                    </div>
                    <div>
                      <Label htmlFor="barcode-mode" className="text-sm">Barcode</Label>
                      <Select value={barcodeMode} onValueChange={setBarcodeMode}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="qr">QR Code</SelectItem>
                          <SelectItem value="barcode">Barcode</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Designer Mode */}
              {layoutMode === 'custom' && (
                <div className="space-y-4">
                  {/* Layout Management Header */}
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">Visual Designer</h3>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">Beta</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop fields to create custom label layouts
                      </p>
                    </div>
                  </div>

                  {/* Layout Name and Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-1">
                      {isEditingName ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={layoutName}
                            onChange={(e) => setLayoutName(e.target.value)}
                            placeholder="Layout name"
                            className="max-w-xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveLayout();
                              } else if (e.key === 'Escape') {
                                setIsEditingName(false);
                              }
                            }}
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleSaveLayout()}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{layoutName || 'Untitled Layout'}</span>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditingName(true)}>
                            Edit Name
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Select value={currentLayoutId} onValueChange={handleLoadLayout}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Load saved layout" />
                        </SelectTrigger>
                        <SelectContent>
                          {layouts.map(layout => (
                            <SelectItem key={layout.id} value={layout.id}>
                              {layout.name} {layout.is_default && '(Default)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button variant="outline" size="sm" onClick={handleCreateNewLayout}>
                        New Layout
                      </Button>

                      <Button 
                        size="sm" 
                        onClick={() => handleSaveLayout(true)}
                        disabled={!currentLayout}
                      >
                        Save as New
                      </Button>

                      {currentLayoutId && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this layout?')) {
                              deleteLayout(currentLayoutId).then(() => {
                                setCurrentLayoutId('');
                                setCurrentLayout(null);
                                setLayoutName('');
                                toast.success('Layout deleted successfully');
                              }).catch((error) => {
                                toast.error('Failed to delete layout: ' + error.message);
                              });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Visual Canvas Editor */}
                  {currentLayout && (
                    <div className="border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 p-1">
                      <LabelCanvasEditor
                        layout={currentLayout}
                        onChange={(newLayout) => {
                          setCurrentLayout(newLayout);
                        }}
                        labelData={labelData}
                        printerDpi={203}
                      />
                    </div>
                  )}

                  {!currentLayout && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                      <p className="text-muted-foreground mb-4">No layout selected</p>
                      <Button onClick={handleCreateNewLayout}>
                        Create Starter Layout
                      </Button>
                    </div>
                  )}
                </div>
              )}

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

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>TSPL for Rollo Printers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-medium">Optimized for Rollo:</h4>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                      <li>Field-based layout generation</li>
                      <li>Raw TSPL for crisp thermal printing</li>
                      <li>QR codes and barcodes supported</li>
                      <li>2×1 inch label size optimized</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium">Print Quality:</h4>
                    <p className="text-muted-foreground">
                      Direct TSPL commands ensure maximum print quality on Rollo thermal printers.
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
