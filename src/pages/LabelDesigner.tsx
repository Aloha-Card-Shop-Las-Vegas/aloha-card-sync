import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Canvas as FabricCanvas, Rect } from "fabric";
import { PrinterPanel } from "@/components/PrinterPanel";
import { CanvasEditor } from "@/components/CanvasEditor";
import { RawTemplateEditor } from "@/components/RawTemplateEditor";
import { TemplateManager } from "@/components/TemplateManager";
import { usePrintNode } from "@/hooks/usePrintNode";
import { useLocalStorageString } from "@/hooks/useLocalStorage";
import { type LabelTemplate } from "@/hooks/useTemplates";

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

const LABEL_WIDTH_IN = 2;
const LABEL_HEIGHT_IN = 1;

export default function LabelDesigner() {
  useSEO({ title: "Label Designer 2x1 in | Aloha", description: "Design and print 2x1 inch labels with barcode, lot, SKU, price, and more." });

  const { printPDF, isConnected: printNodeConnected, selectedPrinterId } = usePrintNode();
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  
  // Settings with localStorage persistence
  const [tsplDensity, setTsplDensity] = useLocalStorageString('tspl-density', '10');
  const [tsplSpeed, setTsplSpeed] = useLocalStorageString('tspl-speed', '4');
  const [tsplGap, setTsplGap] = useLocalStorageString('tspl-gap', '0');
  const [selectedFontFamily, setSelectedFontFamily] = useLocalStorageString('font-family', 'Roboto Condensed');
  const [templateType, setTemplateType] = useState<'graded' | 'raw'>('graded');
  const [printerName, setPrinterName] = useState("");

  // Label data
  const [barcodeValue, setBarcodeValue] = useState("120979260");
  const [title, setTitle] = useState("POKEMON GENGAR VMAX #020");
  const [lot, setLot] = useState("LOT-000001");
  const [price, setPrice] = useState("$1,000");
  const [sku, setSku] = useState("120979260");
  const [condition, setCondition] = useState("Near Mint");

  const labelData = {
    barcodeValue,
    title,
    lot,
    price,
    sku,
    condition
  };

  const handleTemplateLoad = (template: LabelTemplate) => {
    if (!fabricCanvas) return;
    
    // Restore side fields if present
    const d = (template.data || {}) as any;
    setBarcodeValue(d.barcodeValue ?? barcodeValue);
    setTitle(d.title ?? title);
    setLot(d.lot ?? lot);
    setPrice(d.price ?? price);
    setSku(d.sku ?? sku);
    setCondition(d.condition ?? condition);

    // Reset canvas then load objects
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';

    fabricCanvas.loadFromJSON(template.canvas, () => {
      // Re-add non-exported border outline
      const border = new Rect({
        left: 1,
        top: 1,
        width: 298,
        height: 148,
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
      fabricCanvas.requestRenderAll();
      toast.success(`Template "${template.name}" loaded`);
    });
  };

  const handlePrintNodePrint = async (isTest = false) => {
    if (!selectedPrinterId) {
      toast.error('Select a PrintNode printer first');
      return;
    }

    setPrintLoading(true);
    try {
      let pdfBase64: string;
      
      if (fabricCanvas && fabricCanvas.getObjects().filter(obj => !(obj as any).excludeFromExport).length > 0) {
        // Wait for fonts to load before printing
        await document.fonts.ready;
        
        // Use canvas content - export as image and convert to PDF
        const dataURL = fabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 2
        });
        
        // Create PDF with canvas image
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({
          unit: 'in',
          format: [2.0, 1.0],
          orientation: 'landscape',
          putOnlyUsedFonts: true,
          compress: false
        });

        doc.setProperties({
          title: 'Single Label Print',
          subject: 'Label Print',
          creator: 'Label Designer'
        });
        
        doc.addImage(dataURL, 'PNG', 0, 0, 2.0, 1.0, undefined, 'FAST');
        pdfBase64 = doc.output('datauristring').split(',')[1];
      } else {
        // Generate PDF from form data
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({
          unit: 'in',
          format: [2.0, 1.0],
          orientation: 'landscape',
          putOnlyUsedFonts: true,
          compress: false
        });

        doc.setProperties({
          title: 'Single Label Print',
          subject: 'Label Print',
          creator: 'Label Designer'
        });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        const titleText = isTest ? "TEST LABEL" : `${title} • ${condition}`;
        const skuText = isTest ? "TEST-001" : sku;
        const priceText = isTest ? "$99.99" : price;
        const lotText = isTest ? "TEST-LOT" : lot;
        const barcodeText = isTest ? "123456789" : barcodeValue;

        if (titleText) doc.text(titleText, 0.05, 0.25);
        if (skuText) doc.text(`SKU: ${skuText}`, 0.05, 0.45);
        if (priceText) doc.text(`Price: ${priceText}`, 0.05, 0.65);
        if (lotText) doc.text(`Lot: ${lotText}`, 1.1, 0.25);
        if (barcodeText) doc.text(`Code: ${barcodeText}`, 1.1, 0.45);

        pdfBase64 = doc.output('datauristring').split(',')[1];
      }

      const result = await printPDF(pdfBase64, {
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

  // Keyboard shortcut: Delete key removes selected object(s)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || (ae as any).isContentEditable)) return;
      e.preventDefault();
      if (!fabricCanvas) return;
      const objs = fabricCanvas.getActiveObjects();
      if (!objs.length) return;
      objs.forEach((o) => fabricCanvas.remove(o));
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fabricCanvas]);

  const handleDownload = () => {
    const url = fabricCanvas?.toDataURL({ multiplier: 1, format: "png", quality: 1 }) || "";
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-${Date.now()}.png`;
    a.click();
  };

  const handlePrint = async () => {
    await document.fonts.ready;
    const url = fabricCanvas?.toDataURL({ multiplier: 1, format: "png", quality: 1 }) || "";
    if (!url) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }

    const html = `<!doctype html><html><head><title>Print 2x1 Label</title><style>
      @page { size: ${LABEL_WIDTH_IN}in ${LABEL_HEIGHT_IN}in; margin: 0; }
      html, body { height: 100%; }
      body { margin: 0; display: flex; align-items: center; justify-content: center; }
      img { width: ${LABEL_WIDTH_IN}in; height: ${LABEL_HEIGHT_IN}in; }
    </style></head><body>
      <img src="${url}" alt="Label" />
      <script>setTimeout(function(){ window.focus(); window.print(); }, 20);<\/script>
    </body></html>`;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      const win = iframe.contentWindow; if (!win) return; win.focus(); win.print();
    };

    const cleanup = () => setTimeout(() => iframe.remove(), 300);
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 5000);
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
            <p className="text-muted-foreground mt-2">Design 2×1 inch labels with PrintNode cloud printing. PrintNode provides reliable printing to any connected printer.</p>
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
              <CardTitle>Canvas (2×1 in preview)</CardTitle>
            </CardHeader>
            <CardContent>
              <CanvasEditor
                title={title}
                lot={lot}
                price={price}
                condition={condition}
                barcodeValue={barcodeValue}
                selectedFontFamily={selectedFontFamily}
                onCanvasReady={setFabricCanvas}
              />
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
                        Reliable cloud printing available
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
                <CardTitle>Browser Print</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="browser-printer">Printer Name (Optional)</Label>
                    <Input id="browser-printer" value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="Select in system dialog" />
                    <p className="text-xs text-muted-foreground mt-1">Browsers can't list printers. When you click Print, choose your printer in the system dialog.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleDownload}>Download PNG</Button>
                    <Button variant="outline" onClick={handlePrint}>Browser Print</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Font Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="font-family">Default Font for New Text</Label>
                    <Select value={selectedFontFamily} onValueChange={setSelectedFontFamily}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Roboto Condensed">
                          <span style={{ fontFamily: 'Roboto Condensed' }}>Roboto Condensed</span>
                        </SelectItem>
                        <SelectItem value="Atkinson Hyperlegible">
                          <span style={{ fontFamily: 'Atkinson Hyperlegible' }}>Atkinson Hyperlegible</span>
                        </SelectItem>
                        <SelectItem value="Inter">
                          <span style={{ fontFamily: 'Inter' }}>Inter</span>
                        </SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                        <SelectItem value="Courier New">Courier New</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => applyFontToSelected(selectedFontFamily)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Apply Font to Selected Text
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Label Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label>Label Size</Label>
                    <div className="mt-2 font-mono text-sm">{LABEL_WIDTH_IN} in × {LABEL_HEIGHT_IN} in</div>
                  </div>
                  <div>
                    <Label htmlFor="barcode">Barcode Value</Label>
                    <Input id="barcode" value={barcodeValue} onChange={(e) => setBarcodeValue(e.target.value)} placeholder="e.g., 120979260" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="condition">Condition</Label>
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger id="condition">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          <SelectItem value="Near Mint">Near Mint (NM)</SelectItem>
                          <SelectItem value="Lightly Played">Lightly Played (LP)</SelectItem>
                          <SelectItem value="Moderately Played">Moderately Played (MP)</SelectItem>
                          <SelectItem value="Heavily Played">Heavily Played (HP)</SelectItem>
                          <SelectItem value="Damaged">Damaged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="lot">Lot</Label>
                      <Input id="lot" value={lot} onChange={(e) => setLot(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="sku">SKU</Label>
                      <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="price">Price</Label>
                      <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Advanced TSPL Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="tspl-density" className="text-sm">Density (0-15)</Label>
                      <Input 
                        id="tspl-density"
                        value={tsplDensity} 
                        onChange={(e) => setTsplDensity(e.target.value)} 
                        placeholder="10"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tspl-speed" className="text-sm">Speed (2-8)</Label>
                      <Input 
                        id="tspl-speed"
                        value={tsplSpeed} 
                        onChange={(e) => setTsplSpeed(e.target.value)} 
                        placeholder="4"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tspl-gap" className="text-sm">Gap (inches)</Label>
                      <Input 
                        id="tspl-gap"
                        value={tsplGap} 
                        onChange={(e) => setTsplGap(e.target.value)} 
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adjust print density, speed, and label gap for optimal output quality.
                  </p>
                </div>
              </CardContent>
            </Card>

            <TemplateManager
              fabricCanvas={fabricCanvas}
              templateType={templateType}
              setTemplateType={setTemplateType}
              onTemplateLoad={handleTemplateLoad}
              labelData={labelData}
            />

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>PrintNode provides reliable cloud printing to any connected printer</li>
                  <li>Set your printer media to 2×1 inches and zero margins for best results</li>
                  <li>Use thermal printer driver settings for optimal density</li>
                  <li>Browser print is available as fallback if PrintNode is unavailable</li>
                  <li>Raw template printing supports ZPL and TSPL for maximum precision</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}