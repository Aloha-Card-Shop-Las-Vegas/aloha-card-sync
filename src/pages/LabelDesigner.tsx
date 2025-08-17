import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Canvas as FabricCanvas, Textbox, Image as FabricImage, Rect } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { printNodeService } from "@/lib/printNodeService";

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

const LABEL_WIDTH_IN = 2; // inches
const LABEL_HEIGHT_IN = 1; // inches
const PREVIEW_DPI = 150; // screen preview DPI
const PX_WIDTH = Math.round(LABEL_WIDTH_IN * PREVIEW_DPI); // 300 px
const PX_HEIGHT = Math.round(LABEL_HEIGHT_IN * PREVIEW_DPI); // 150 px

const condMap: Record<string, string> = {
  "Near Mint": "NM",
  "Lightly Played": "LP",
  "Moderately Played": "MP",
  "Heavily Played": "HP",
  "Damaged": "DMG",
};

const withCondition = (base: string, condition: string) => {
  const abbr = condMap[condition] || condition;
  return base ? `${base} • ${abbr}` : abbr;
};

// Shared template type
type LabelTemplate = {
  id: string;
  name: string;
  canvas: any;
  data: any;
  created_at?: string;
  updated_at?: string;
};

export default function LabelDesigner() {
  useSEO({ title: "Label Designer 2x1 in | Aloha", description: "Design and print 2x1 inch labels with barcode, lot, SKU, price, and more." });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const borderRef = useRef<Rect | null>(null);

  // PrintNode state
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printNodeConnected, setPrintNodeConnected] = useState(false);

  // Load printer selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('printnode-selected-printer');
    if (saved) setSelectedPrinterId(parseInt(saved));
  }, []);

  // Save printer selection to localStorage
  useEffect(() => {
    if (selectedPrinterId) {
      localStorage.setItem('printnode-selected-printer', selectedPrinterId.toString());
    }
  }, [selectedPrinterId]);
  const [printerName, setPrinterName] = useState("");
  const labelSizeText = useMemo(() => `${LABEL_WIDTH_IN} in × ${LABEL_HEIGHT_IN} in`, []);

  const [barcodeValue, setBarcodeValue] = useState("120979260");
  const [title, setTitle] = useState("POKEMON GENGAR VMAX #020");
  const [lot, setLot] = useState("LOT-000001");
  const [price, setPrice] = useState("$1,000");
const [sku, setSku] = useState("120979260");
  const [condition, setCondition] = useState("Near Mint");

  // Templates state
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: PX_WIDTH,
      height: PX_HEIGHT,
      backgroundColor: "#ffffff",
    });

    // Visible label outline (design only, not exported)
    const border = new Rect({
      left: 1,
      top: 1,
      width: PX_WIDTH - 2,
      height: PX_HEIGHT - 2,
      rx: 6,
      ry: 6,
      fill: 'transparent',
      stroke: '#000',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    borderRef.current = border;

    // Starter layout: Title, Lot, Price
    const titleBox = new Textbox(withCondition(title, condition), { left: 6, top: 6, fontSize: 14, width: PX_WIDTH - 12 });
    const lotBox = new Textbox(lot, { left: 6, top: 28, fontSize: 12, width: PX_WIDTH - 12 });
    const priceBox = new Textbox(price, { left: PX_WIDTH - 80, top: PX_HEIGHT - 22, fontSize: 14, textAlign: "right", width: 74 });

    canvas.add(border, titleBox, lotBox, priceBox);
    

    setFabricCanvas(canvas);
    toast.success("Label canvas ready. Drag elements to position.");

    return () => {
      canvas.dispose();
    };
  }, []);

  const addText = (text: string) => {
    if (!fabricCanvas) return;
    const tb = new Textbox(text, { left: 10, top: 10, fontSize: 12, width: PX_WIDTH - 20 });
    fabricCanvas.add(tb);
    fabricCanvas.setActiveObject(tb);
  };

  const addBarcode = async () => {
    if (!fabricCanvas) return;
    if (!barcodeValue.trim()) {
      toast.error("Enter a barcode value");
      return;
    }

    try {
      const tempCanvas = document.createElement("canvas");
      const JsBarcode: any = (await import("jsbarcode")).default;
      JsBarcode(tempCanvas, barcodeValue, { format: "CODE128", displayValue: false, margin: 0, width: 2, height: 40, lineColor: "#000" });
      const dataUrl = tempCanvas.toDataURL("image/png");

      FabricImage.fromURL(dataUrl).then((img) => {
        img.set({ left: 6, top: PX_HEIGHT - 50, selectable: true });
        // Scale if too wide
        const maxW = PX_WIDTH - 12;
        if (img.width && img.width > maxW) {
          img.scaleToWidth(maxW);
        }
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate barcode");
    }
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const objs = fabricCanvas.getActiveObjects();
    if (!objs.length) {
      toast.info("No selection to delete");
      return;
    }
    objs.forEach((o) => fabricCanvas.remove(o));
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    const objs = fabricCanvas.getObjects();
    objs.forEach((o) => {
      if (o !== borderRef.current) fabricCanvas.remove(o);
    });
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
  };
const exportImageDataUrl = () => fabricCanvas?.toDataURL({ multiplier: 1, format: "png", quality: 1 }) || "";

  // Templates: fetch, save, load, delete
  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('label_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Failed to load templates');
      return;
    }
    setTemplates((data as unknown as LabelTemplate[]) || []);
  };

  const saveTemplate = async (nameOverride?: string) => {
    if (!fabricCanvas) return;
    const name = (nameOverride ?? templateName).trim();
    if (!name) {
      toast.error('Enter a template name');
      return;
    }
    const payload = {
      name,
      canvas: fabricCanvas.toJSON(),
      data: {
        barcodeValue,
        title,
        lot,
        price,
        sku,
        condition,
        size: { widthIn: LABEL_WIDTH_IN, heightIn: LABEL_HEIGHT_IN, dpi: PREVIEW_DPI },
      },
    } as const;

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

  const quickSaveTemplate = async () => {
    const name = window.prompt('Template name');
    if (!name) return;
    await saveTemplate(name);
  };

  const loadTemplate = async (id: string) => {
    const tpl = templates.find(t => (t as any).id === id) as any;
    if (!tpl || !fabricCanvas) return;

    // Restore side fields if present
    const d = (tpl.data || {}) as any;
    setBarcodeValue(d.barcodeValue ?? "");
    setTitle(d.title ?? "");
    setLot(d.lot ?? "");
    setPrice(d.price ?? "");
    setSku(d.sku ?? "");
    setCondition(d.condition ?? condition);

    // Reset canvas then load objects
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    fabricCanvas.renderAll();

    fabricCanvas.loadFromJSON(tpl.canvas, () => {
      // Re-add non-exported border outline
      const border = new Rect({
        left: 1,
        top: 1,
        width: PX_WIDTH - 2,
        height: PX_HEIGHT - 2,
        rx: 6,
        ry: 6,
        fill: 'transparent',
        stroke: '#000',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      borderRef.current = border;
      fabricCanvas.add(border);
      fabricCanvas.renderAll();
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

  // Load PrintNode printers on component mount
  useEffect(() => {
    const loadPrintNode = async () => {
      try {
        const printerList = await printNodeService.getPrinters();
        setPrinters(printerList);
        setPrintNodeConnected(true);
        
        // Auto-select saved printer or first printer if available
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
    fetchTemplates();
  }, []);

  const refreshPrinters = async () => {
    try {
      const printerList = await printNodeService.getPrinters();
      setPrinters(printerList);
      setPrintNodeConnected(true);
      toast.success(`Found ${printerList.length} printer(s)`);
    } catch (e) {
      console.error("Failed to refresh printers:", e);
      toast.error("Failed to refresh printers");
      setPrintNodeConnected(false);
    }
  };

  // Keyboard shortcut: Delete key removes selected object(s)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || (ae as any).isContentEditable)) return;
      e.preventDefault();
      deleteSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fabricCanvas]);

  const handleDownload = () => {
    const url = exportImageDataUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-${Date.now()}.png`;
    a.click();
  };

  const handleTestPrint = async () => {
    if (!fabricCanvas) return;
    
    // Create a temporary canvas with test data
    const tempCanvas = new FabricCanvas(document.createElement("canvas"), {
      width: PX_WIDTH,
      height: PX_HEIGHT,
      backgroundColor: "#ffffff",
    });

    try {
      // Add test content
      const testTitle = new Textbox("TEST LABEL • NM", { 
        left: 6, 
        top: 6, 
        fontSize: 14, 
        width: PX_WIDTH - 12 
      });
      
      const testLot = new Textbox("TEST-LOT-001", { 
        left: 6, 
        top: 28, 
        fontSize: 12, 
        width: PX_WIDTH - 12 
      });
      
      const testPrice = new Textbox("$99.99", { 
        left: PX_WIDTH - 80, 
        top: PX_HEIGHT - 22, 
        fontSize: 14, 
        textAlign: "right", 
        width: 74 
      });

      // Add test barcode
      const testBarcodeCanvas = document.createElement("canvas");
      const JsBarcode: any = (await import("jsbarcode")).default;
      JsBarcode(testBarcodeCanvas, "123456789", { 
        format: "CODE128", 
        displayValue: false, 
        margin: 0, 
        width: 2, 
        height: 40, 
        lineColor: "#000" 
      });
      const barcodeDataUrl = testBarcodeCanvas.toDataURL("image/png");

      const barcodeImg = await FabricImage.fromURL(barcodeDataUrl);
      barcodeImg.set({ left: 6, top: PX_HEIGHT - 50, selectable: false });
      
      // Scale if too wide
      const maxW = PX_WIDTH - 12;
      if (barcodeImg.width && barcodeImg.width > maxW) {
        barcodeImg.scaleToWidth(maxW);
      }

      tempCanvas.add(testTitle, testLot, testPrice, barcodeImg);
      
      // Export and print
      const testUrl = tempCanvas.toDataURL({ multiplier: 1, format: "png", quality: 1 });
      
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

      const html = `<!doctype html><html><head><title>Print Test Label</title><style>
        @page { size: ${LABEL_WIDTH_IN}in ${LABEL_HEIGHT_IN}in; margin: 0; }
        html, body { height: 100%; }
        body { margin: 0; display: flex; align-items: center; justify-content: center; }
        img { width: ${LABEL_WIDTH_IN}in; height: ${LABEL_HEIGHT_IN}in; }
      </style></head><body>
        <img src="${testUrl}" alt="Test Label" />
        <script>setTimeout(function(){ window.focus(); window.print(); }, 20);<\/script>
      </body></html>`;

      doc.open();
      doc.write(html);
      doc.close();

      iframe.onload = () => {
        const win = iframe.contentWindow; if (!win) return; win.focus(); win.print();
      };

      const cleanup = () => {
        setTimeout(() => iframe.remove(), 300);
        tempCanvas.dispose();
      };
      iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 5000);
      
      toast.success("Test label sent to printer");
      
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate test label");
      tempCanvas.dispose();
    }
  };

  const handlePrint = () => {
    const url = exportImageDataUrl();
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

  // Direct print to Rollo with exact 2x1 dimensions
  const handleDirectPrint = async (isTest = false) => {
    setPrintLoading(true);
    try {
      // Import required functions
      const { labelDataToTSPL } = await import("@/lib/tspl");
      const { fabricToTSPL } = await import("@/lib/fabricToTspl");
      
      let tsplData: string;
      
      // Generate TSPL with exact 2x1 inch dimensions
      if (fabricCanvas && fabricCanvas.getObjects().filter(obj => !(obj as any).excludeFromExport).length > 0) {
        // Use canvas content if available
        tsplData = fabricToTSPL(fabricCanvas);
      } else {
        // Generate from form data with exact dimensions
        tsplData = labelDataToTSPL({
          title: isTest ? "ROLLO TEST PRINT" : withCondition(title, condition),
          sku: isTest ? "TEST-001" : sku,
          price: isTest ? "$99.99" : price,
          lot: isTest ? "TEST-LOT" : lot,
          barcode: isTest ? "123456789" : barcodeValue,
          condition: isTest ? "NM" : condition
        });
      }

      // Try network printer first (IPP at 192.168.0.248:631)
      try {
        const response = await fetch('http://192.168.0.248:631/printers/Rollo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.cups-raw',
          },
          body: tsplData
        });
        
        if (response.ok) {
          toast.success(`${isTest ? 'Test' : 'Label'} printed to network Rollo (2×1 exact)`);
          return;
        }
      } catch (networkError) {
        console.log("Network printer not available, trying local bridge");
      }

      // Try local bridge second (for desktop Rollo)
      try {
        const response = await fetch('http://127.0.0.1:17777/print', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: tsplData
        });
        
        if (response.ok) {
          toast.success(`${isTest ? 'Test' : 'Label'} printed to local Rollo (2×1 exact)`);
          return;
        }
      } catch (localError) {
        console.log("Local bridge not available, trying PrintNode");
      }

      // Fallback to PrintNode
      try {
        if (printNodeConnected && selectedPrinterId) {
          await printNodeService.printTSPL(tsplData, selectedPrinterId, {
            title: isTest ? "Test Label" : "Label Print"
          });
          
          const selectedPrinter = printers.find(p => p.id === selectedPrinterId);
          toast.success(`${isTest ? 'Test' : 'Label'} sent to ${selectedPrinter?.name || 'printer'} via PrintNode (2×1 exact)`);
        } else {
          throw new Error("No printing method available");
        }
      } catch (printNodeError) {
        throw new Error("Unable to print - all methods failed");
      }
      
    } catch (e) {
      console.error("Direct print failed:", e);
      toast.error(`Print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
            <p className="text-muted-foreground mt-2">Design 2×1 inch labels. Direct printing available with PrintNode cloud printing.</p>
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
              <div className="border rounded-md p-3 inline-block" style={{ width: PX_WIDTH + 8, height: PX_HEIGHT + 8 }}>
                <canvas ref={canvasRef} width={PX_WIDTH} height={PX_HEIGHT} aria-label="Label design canvas" />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button onClick={() => addText(withCondition(title, condition))}>Add Title + Condition</Button>
                <Button onClick={() => addText(lot)}>Add Lot</Button>
                <Button onClick={() => addText(sku)}>Add SKU</Button>
                <Button onClick={() => addText(price)}>Add Price</Button>
                <Button variant="outline" onClick={addBarcode}>Add Barcode</Button>
                <Button variant="outline" onClick={deleteSelected}>Delete Selected</Button>
                <Button onClick={quickSaveTemplate}>Save Template</Button>
                <Button variant="secondary" onClick={handleClear}>Clear</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Printer Options</CardTitle>
              </CardHeader>
              <CardContent>
                {printNodeConnected && printers.length > 0 && (
                  <div className="mb-4 p-3 border rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium text-blue-800">PrintNode Connected</Label>
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                    <p className="text-xs text-blue-700 mb-2">
                      Found {printers.length} printer(s) - Cloud printing available
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="printnode-printer" className="text-xs text-blue-800">Select Printer</Label>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={refreshPrinters}
                        className="h-6 px-2 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        Refresh
                      </Button>
                    </div>
                    <Select value={selectedPrinterId?.toString() || ""} onValueChange={(value) => setSelectedPrinterId(parseInt(value))}>
                      <SelectTrigger id="printnode-printer" className="h-8 text-xs border-blue-200">
                        <SelectValue placeholder="Choose printer" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {printers.map((printer) => (
                          <SelectItem key={printer.id} value={printer.id.toString()} className="text-xs">
                            {printer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPrinterId && (
                      <div className="mt-2 p-2 rounded bg-blue-100">
                        <span className="text-xs text-blue-800 font-medium">
                          Selected: {printers.find(p => p.id === selectedPrinterId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                {!printNodeConnected && (
                  <div className="mb-4 p-3 border rounded-lg bg-orange-50">
                    <p className="text-sm text-orange-700">
                      PrintNode not connected. Check your API key configuration.
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="printer">Printer</Label>
                    <Input id="printer" value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="Select in system dialog (optional name)" />
                    <p className="text-xs text-muted-foreground mt-1">Browsers can’t list printers. When you click Print, choose your printer in the system dialog.</p>
                  </div>
                  <div>
                    <Label>Label Size</Label>
                    <div className="mt-2">{labelSizeText}</div>
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
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button 
                      onClick={() => handleDirectPrint(false)} 
                      disabled={printLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {printLoading ? "Printing..." : "Print to Rollo (2×1 exact)"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleDirectPrint(true)}
                      disabled={printLoading}
                    >
                      Test Print
                    </Button>
                    <Button variant="outline" onClick={handleDownload}>Download PNG</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tplName">New template name</Label>
                    <div className="flex gap-2 mt-2">
                      <Input id="tplName" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., 2×1: Pokemon NM" />
                      <Button onClick={() => saveTemplate()}>Save</Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="tplSelect">Load template</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={(v) => {
                        setSelectedTemplateId(v);
                        loadTemplate(v);
                      }}
                    >
                      <SelectTrigger id="tplSelect">
                        <SelectValue placeholder={templates.length ? `Choose (${templates.length})` : "No templates yet"} />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplateId && (
                      <div className="mt-2">
                        <Button variant="outline" onClick={() => deleteTemplate(selectedTemplateId)}>Delete Selected</Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-aloha">
              <CardHeader>
                <CardTitle>Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Set your printer media to 2×1 inches and zero margins.</li>
                  <li>Disable page headers/footers in the print dialog.</li>
                  <li>Use thermal printer driver settings for best density.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
