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

  // Load saved layout on mount and auto-create default if needed
  useEffect(() => {
    if (currentLayoutId && layouts.length > 0) {
      const savedLayout = layouts.find(l => l.id === currentLayoutId);
      if (savedLayout) {
        setCurrentLayout(savedLayout.layout);
      }
    } else if (layoutMode === 'custom' && !currentLayout && layouts.length === 0) {
      // Auto-create default layout for better onboarding
      const defaultLayout: LabelLayout = {
        title: { visible: true, x: 15, y: 15, fontSize: 2 },
        sku: { visible: true, x: 15, y: 35, fontSize: 2 },
        price: { visible: true, x: 15, y: 55, fontSize: 2 },
        lot: { visible: true, x: 200, y: 15, fontSize: 2 },
        condition: { visible: true, x: 200, y: 35, fontSize: 2 },
        barcode: { x: 280, y: 60, mode: 'qr', size: 'S' }
      };
      setCurrentLayout(defaultLayout);
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
                    <Label htmlFor="layout-custom" className="text-sm">Custom Layout</Label>
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

              {/* Custom Layout Controls */}
              {layoutMode === 'custom' && (
                <div className="space-y-4">
                  {/* Layout Management */}
                  <div className="flex gap-2 flex-wrap">
                    <Select value={currentLayoutId} onValueChange={(value) => {
                      setCurrentLayoutId(value);
                      const layout = layouts.find(l => l.id === value);
                      if (layout) setCurrentLayout(layout.layout);
                    }}>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const name = prompt('Layout name:');
                        if (name && currentLayout) {
                          saveLayout(name, currentLayout).then(() => {
                            toast.success('Layout saved successfully');
                          }).catch((error) => {
                            toast.error('Failed to save layout: ' + error.message);
                          });
                        }
                      }}
                      disabled={!currentLayout}
                    >
                      Save New
                    </Button>
                    {currentLayoutId && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (currentLayoutId && currentLayout) {
                              const layout = layouts.find(l => l.id === currentLayoutId);
                              if (layout) {
                                updateLayout(currentLayoutId, layout.name, currentLayout).then(() => {
                                  toast.success('Layout updated successfully');
                                }).catch((error) => {
                                  toast.error('Failed to update layout: ' + error.message);
                                });
                              }
                            }
                          }}
                        >
                          Update
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this layout?')) {
                              deleteLayout(currentLayoutId).then(() => {
                                setCurrentLayoutId('');
                                setCurrentLayout(null);
                                toast.success('Layout deleted successfully');
                              }).catch((error) => {
                                toast.error('Failed to delete layout: ' + error.message);
                              });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Canvas Editor Toggle */}
                  {currentLayout && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Switch 
                        checked={useCanvasEditor === 'true'}
                        onCheckedChange={(checked) => setUseCanvasEditor(checked ? 'true' : 'false')}
                      />
                      <Label className="text-sm font-medium">Canvas Editor (Beta)</Label>
                      <p className="text-xs text-muted-foreground ml-2">Drag and drop fields visually</p>
                    </div>
                  )}

                  {!currentLayout && (
                    <div className="p-4 border rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">
                        Create a new custom layout or load an existing one to start positioning fields.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          // Create default layout with better positioning
                          const defaultLayout: LabelLayout = {
                            title: { visible: true, x: 15, y: 15, fontSize: 2 },
                            sku: { visible: true, x: 10, y: 40, fontSize: 1, prefix: 'SKU: ' },
                            price: { visible: true, x: 280, y: 10, fontSize: 3 },
                            lot: { visible: true, x: 10, y: 60, fontSize: 1, prefix: 'LOT: ' },
                            condition: { visible: true, x: 200, y: 40, fontSize: 1 },
                            barcode: { mode: 'qr', x: 10, y: 90, size: 'M' }
                          };
                          setCurrentLayout(defaultLayout);
                        }}
                      >
                        Create New Layout
                      </Button>
                    </div>
                  )}

                  {/* Custom Layout Field Controls */}
                  {currentLayout && (
                    <div className="space-y-4">
                      {useCanvasEditor === 'true' ? (
                        <ResizablePanelGroup direction="horizontal" className="min-h-[500px] border rounded-lg">
                          <ResizablePanel defaultSize={65}>
                            <div className="p-4 h-full">
                              <h4 className="font-medium mb-4">Visual Editor</h4>
                              <LabelCanvasEditor
                                layout={currentLayout}
                                onChange={setCurrentLayout}
                                labelData={labelData}
                                printerDpi={203}
                              />
                            </div>
                          </ResizablePanel>
                          
                          <ResizableHandle withHandle />
                          
                          <ResizablePanel defaultSize={35}>
                            <div className="p-4 h-full">
                              <h4 className="font-medium mb-4">Numeric Controls</h4>
                              <div className="space-y-4 max-h-[450px] overflow-y-auto">
                                {/* ... keep existing field controls ... */}
                                {/* Title Controls */}
                                <div className="grid grid-cols-4 gap-2 items-end text-xs">
                                  <div className="flex items-center space-x-1">
                                    <Checkbox 
                                      checked={currentLayout.title.visible}
                                      onCheckedChange={(checked) => {
                                        setCurrentLayout({
                                          ...currentLayout,
                                          title: { ...currentLayout.title, visible: !!checked }
                                        });
                                      }}
                                    />
                                    <Label className="text-xs">Title</Label>
                                  </div>
                                  <div>
                                    <Label className="text-xs">X</Label>
                                    <Input 
                                      type="number" 
                                      value={currentLayout.title.x}
                                      onChange={(e) => {
                                        const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                                        setCurrentLayout({
                                          ...currentLayout,
                                          title: { ...currentLayout.title, x }
                                        });
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Y</Label>
                                    <Input 
                                      type="number" 
                                      value={currentLayout.title.y}
                                      onChange={(e) => {
                                        const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                                        setCurrentLayout({
                                          ...currentLayout,
                                          title: { ...currentLayout.title, y }
                                        });
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Size</Label>
                                    <Select 
                                      value={currentLayout.title.fontSize.toString()}
                                      onValueChange={(value) => {
                                        setCurrentLayout({
                                          ...currentLayout,
                                          title: { ...currentLayout.title, fontSize: parseInt(value) as 1|2|3|4|5 }
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">1</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                        <SelectItem value="3">3</SelectItem>
                                        <SelectItem value="4">4</SelectItem>
                                        <SelectItem value="5">5</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                {/* Compact controls for other fields */}
                                {/* Add similar compact controls for SKU, Price, Lot, Condition, and Barcode */}
                                <div className="text-xs text-muted-foreground">
                                  Use the visual editor or adjust values here. Changes sync both ways.
                                </div>
                              </div>
                            </div>
                          </ResizablePanel>
                        </ResizablePanelGroup>
                      ) : (
                        <div className="space-y-4 border p-4 rounded-lg">
                      <h4 className="font-medium">Field Positioning</h4>
                      
                      {/* Title Controls */}
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={currentLayout.title.visible}
                            onCheckedChange={(checked) => {
                              setCurrentLayout({
                                ...currentLayout,
                                title: { ...currentLayout.title, visible: !!checked }
                              });
                            }}
                          />
                          <Label className="text-sm">Title</Label>
                        </div>
                        <div>
                          <Label className="text-xs">X</Label>
                          <Input 
                            type="number" 
                            value={currentLayout.title.x}
                            onChange={(e) => {
                              const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                title: { ...currentLayout.title, x }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Y</Label>
                          <Input 
                            type="number" 
                            value={currentLayout.title.y}
                            onChange={(e) => {
                              const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                title: { ...currentLayout.title, y }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Size</Label>
                          <Select 
                            value={currentLayout.title.fontSize.toString()}
                            onValueChange={(value) => {
                              setCurrentLayout({
                                ...currentLayout,
                                title: { ...currentLayout.title, fontSize: parseInt(value) as 1|2|3|4|5 }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* SKU Controls */}
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={currentLayout.sku.visible}
                            onCheckedChange={(checked) => {
                              setCurrentLayout({
                                ...currentLayout,
                                sku: { ...currentLayout.sku, visible: !!checked }
                              });
                            }}
                          />
                          <Label className="text-sm">SKU</Label>
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.sku.x}
                            onChange={(e) => {
                              const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                sku: { ...currentLayout.sku, x }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.sku.y}
                            onChange={(e) => {
                              const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                sku: { ...currentLayout.sku, y }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Select 
                            value={currentLayout.sku.fontSize.toString()}
                            onValueChange={(value) => {
                              setCurrentLayout({
                                ...currentLayout,
                                sku: { ...currentLayout.sku, fontSize: parseInt(value) as 1|2|3|4|5 }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Price Controls */}
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={currentLayout.price.visible}
                            onCheckedChange={(checked) => {
                              setCurrentLayout({
                                ...currentLayout,
                                price: { ...currentLayout.price, visible: !!checked }
                              });
                            }}
                          />
                          <Label className="text-sm">Price</Label>
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.price.x}
                            onChange={(e) => {
                              const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                price: { ...currentLayout.price, x }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.price.y}
                            onChange={(e) => {
                              const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                price: { ...currentLayout.price, y }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Select 
                            value={currentLayout.price.fontSize.toString()}
                            onValueChange={(value) => {
                              setCurrentLayout({
                                ...currentLayout,
                                price: { ...currentLayout.price, fontSize: parseInt(value) as 1|2|3|4|5 }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Lot Controls */}
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={currentLayout.lot.visible}
                            onCheckedChange={(checked) => {
                              setCurrentLayout({
                                ...currentLayout,
                                lot: { ...currentLayout.lot, visible: !!checked }
                              });
                            }}
                          />
                          <Label className="text-sm">Lot</Label>
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.lot.x}
                            onChange={(e) => {
                              const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                lot: { ...currentLayout.lot, x }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.lot.y}
                            onChange={(e) => {
                              const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                lot: { ...currentLayout.lot, y }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Select 
                            value={currentLayout.lot.fontSize.toString()}
                            onValueChange={(value) => {
                              setCurrentLayout({
                                ...currentLayout,
                                lot: { ...currentLayout.lot, fontSize: parseInt(value) as 1|2|3|4|5 }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Condition Controls */}
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={currentLayout.condition.visible}
                            onCheckedChange={(checked) => {
                              setCurrentLayout({
                                ...currentLayout,
                                condition: { ...currentLayout.condition, visible: !!checked }
                              });
                            }}
                          />
                          <Label className="text-sm">Condition</Label>
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.condition.x}
                            onChange={(e) => {
                              const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                condition: { ...currentLayout.condition, x }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.condition.y}
                            onChange={(e) => {
                              const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                condition: { ...currentLayout.condition, y }
                              });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Select 
                            value={currentLayout.condition.fontSize.toString()}
                            onValueChange={(value) => {
                              setCurrentLayout({
                                ...currentLayout,
                                condition: { ...currentLayout.condition, fontSize: parseInt(value) as 1|2|3|4|5 }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Barcode Controls */}
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div>
                          <Label className="text-sm">Barcode</Label>
                          <Select 
                            value={currentLayout.barcode.mode}
                            onValueChange={(value: 'qr' | 'barcode' | 'none') => {
                              setCurrentLayout({
                                ...currentLayout,
                                barcode: { ...currentLayout.barcode, mode: value }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="qr">QR Code</SelectItem>
                              <SelectItem value="barcode">Barcode</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.barcode.x}
                            onChange={(e) => {
                              const x = Math.max(0, Math.min(386, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                barcode: { ...currentLayout.barcode, x }
                              });
                            }}
                            className="h-8 text-xs"
                            disabled={currentLayout.barcode.mode === 'none'}
                          />
                        </div>
                        <div>
                          <Input 
                            type="number" 
                            value={currentLayout.barcode.y}
                            onChange={(e) => {
                              const y = Math.max(0, Math.min(203, parseInt(e.target.value) || 0));
                              setCurrentLayout({
                                ...currentLayout,
                                barcode: { ...currentLayout.barcode, y }
                              });
                            }}
                            className="h-8 text-xs"
                            disabled={currentLayout.barcode.mode === 'none'}
                          />
                        </div>
                        {currentLayout.barcode.mode === 'qr' && (
                          <div>
                            <Select 
                              value={currentLayout.barcode.size || 'M'}
                              onValueChange={(value: 'S' | 'M' | 'L') => {
                                setCurrentLayout({
                                  ...currentLayout,
                                  barcode: { ...currentLayout.barcode, size: value }
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="S">Small</SelectItem>
                                <SelectItem value="M">Medium</SelectItem>
                                <SelectItem value="L">Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {currentLayout.barcode.mode === 'barcode' && (
                          <div>
                            <Input 
                              type="number" 
                              placeholder="Height"
                              value={currentLayout.barcode.height || 50}
                              onChange={(e) => {
                                const height = Math.max(10, Math.min(100, parseInt(e.target.value) || 50));
                                setCurrentLayout({
                                  ...currentLayout,
                                  barcode: { ...currentLayout.barcode, height }
                                });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                        )}
                      </div>

                        <p className="text-xs text-muted-foreground">
                          Label dimensions: 386×203 dots (2×1 inches at 203 DPI)
                        </p>
                      </div>
                      )}
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