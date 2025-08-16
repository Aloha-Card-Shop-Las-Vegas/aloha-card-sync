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
import { QZTraySetup } from "@/components/QZTraySetup";

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

  // QZ Tray state
  const [qzInstance, setQzInstance] = useState<any>(null);
  const [qzConnected, setQzConnected] = useState(false);
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [qzLoading, setQzLoading] = useState(false);

  // Load printer selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('qz-selected-printer');
    if (saved) setSelectedPrinter(saved);
  }, []);

  // Save printer selection to localStorage
  useEffect(() => {
    if (selectedPrinter) {
      localStorage.setItem('qz-selected-printer', selectedPrinter);
    }
  }, [selectedPrinter]);

  // Printer UI (note: browsers can't enumerate printers without helpers like QZ Tray)
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

  // Load QZ Tray on component mount
  useEffect(() => {
    const loadQZ = async () => {
      try {
        // Load QZ Tray library
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
        script.onload = async () => {
          const qz = (window as any).qz;
          if (!qz) return;
          
          setQzInstance(qz);
          
          // Configure QZ with demo certificate for development
          qz.security.setCertificatePromise(() => {
            return Promise.resolve(
              "-----BEGIN CERTIFICATE-----\n" +
              "MIIEKzCCApOgAwIBAgIJALm161xCHrWKMA0GCSqGSIb3DQEBCwUAMCoxGDAWBgNV\n" +
              "BAMMD3F6LWluZHVzdHJpZXMuY29tMQ4wDAYDVQQKDAVxei5pbzAeFw0xNzAzMjgx\n" +
              "OTQ3NDNaFw0yNzAzMjYxOTQ3NDNaMCoxGDAWBgNVBAMMD3F6LWluZHVzdHJpZXMu\n" +
              "Y29tMQ4wDAYDVQQKDAVxei5pbzCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC\n" +
              "ggIBALCCAdP1mZLj8qVTCzqJJHSEudw2SXLF+Xn9mhN6X1kxvUo7vS5SPEVpVjJG\n" +
              "2Fv0TKDuKbKu/V5gFLs8+aS8Qa8l1V+yRV4gJ8l5H8R1P6VJa7JKqOgO5Oea8k\n" +
              "NvH0dE7Kng/lgNh3AkJzT8L9O4Z0DgA8TJzpEoNp9+Ka5lV3FLSV3m1jPqj+zQ\n" +
              "J6i2vZs1E8tPztZgF6OzH0XJQJ7hL8b7mhC7o6Nkn7V0fEQqvE9w5M2l+B9WQa\n" +
              "ggIBALCCAdP1mZLj8qVTCzqJJHSEudw2SXLF+Xn9mhN6X1kxvUo7vS5SPEVpVjJG\n" +
              "-----END CERTIFICATE-----"
            );
          });

          // For development, use demo signature - in production, call your signing endpoint
          qz.security.setSignaturePromise((toSign: string) => {
            return Promise.resolve("demo"); // This would call your signing endpoint in production
          });

          // Try to connect
          try {
            if (!qz.websocket.isActive()) {
              await qz.websocket.connect();
            }
            setQzConnected(true);
            
            // Get available printers
            const printers = await qz.printers.find();
            setQzPrinters(printers);
            
            // Auto-select saved printer or first Rollo printer if available
            const savedPrinter = localStorage.getItem('qz-selected-printer');
            if (savedPrinter && printers.includes(savedPrinter)) {
              setSelectedPrinter(savedPrinter);
            } else {
              const rolloPrinter = printers.find((p: string) => 
                p.toLowerCase().includes('rollo') || 
                p.toLowerCase().includes('label')
              );
              if (rolloPrinter) {
                setSelectedPrinter(rolloPrinter);
              }
            }
            
            toast.success("QZ Tray connected - Direct printing available");
          } catch (e) {
            console.error("QZ connection failed:", e);
            setQzConnected(false);
          }
        };
        
        script.onerror = () => {
          console.warn("QZ Tray library failed to load");
        };
        
        document.head.appendChild(script);
      } catch (e) {
        console.error("Failed to load QZ Tray:", e);
      }
    };

    loadQZ();
    fetchTemplates();
  }, []);

  const refreshPrinters = async () => {
    if (!qzInstance || !qzConnected) return;
    try {
      const printers = await qzInstance.printers.find();
      setQzPrinters(printers);
      toast.success(`Found ${printers.length} printer(s)`);
    } catch (e) {
      console.error("Failed to refresh printers:", e);
      toast.error("Failed to refresh printers");
    }
  };

  const reconnectQZ = async () => {
    if (!qzInstance) return;
    try {
      if (qzInstance.websocket.isActive()) {
        await qzInstance.websocket.disconnect();
      }
      await qzInstance.websocket.connect();
      setQzConnected(true);
      const printers = await qzInstance.printers.find();
      setQzPrinters(printers);
      toast.success("QZ Tray reconnected successfully");
    } catch (e) {
      console.error("Reconnection failed:", e);
      setQzConnected(false);
      toast.error("Failed to reconnect to QZ Tray");
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

  // QZ Tray direct print function
  const handleDirectPrint = async (isTest = false) => {
    if (!qzInstance || !qzConnected || !selectedPrinter) {
      toast.error("QZ Tray not connected or no printer selected");
      return;
    }

    setQzLoading(true);
    try {
      let imageData;
      
      if (isTest) {
        // Create test label similar to handleTestPrint but export as image data
        const tempCanvas = new FabricCanvas(document.createElement("canvas"), {
          width: PX_WIDTH,
          height: PX_HEIGHT,
          backgroundColor: "#ffffff",
        });

        const testTitle = new Textbox("DIRECT TEST • NM", { 
          left: 6, top: 6, fontSize: 14, width: PX_WIDTH - 12 
        });
        const testLot = new Textbox("QZ-TEST-001", { 
          left: 6, top: 28, fontSize: 12, width: PX_WIDTH - 12 
        });
        const testPrice = new Textbox("$199.99", { 
          left: PX_WIDTH - 80, top: PX_HEIGHT - 22, fontSize: 14, textAlign: "right", width: 74 
        });

        // Add test barcode
        const testBarcodeCanvas = document.createElement("canvas");
        const JsBarcode: any = (await import("jsbarcode")).default;
        JsBarcode(testBarcodeCanvas, "987654321", { 
          format: "CODE128", displayValue: false, margin: 0, width: 2, height: 40, lineColor: "#000" 
        });
        const barcodeDataUrl = testBarcodeCanvas.toDataURL("image/png");
        const barcodeImg = await FabricImage.fromURL(barcodeDataUrl);
        barcodeImg.set({ left: 6, top: PX_HEIGHT - 50, selectable: false });
        
        const maxW = PX_WIDTH - 12;
        if (barcodeImg.width && barcodeImg.width > maxW) {
          barcodeImg.scaleToWidth(maxW);
        }

        tempCanvas.add(testTitle, testLot, testPrice, barcodeImg);
        
        // Export at higher DPI for Rollo (203 DPI)
        const printDPI = 203;
        const multiplier = printDPI / PREVIEW_DPI; // ~1.35x for better quality
        imageData = tempCanvas.toDataURL({ multiplier, format: "png", quality: 1 });
        tempCanvas.dispose();
      } else {
        // Use current canvas
        const printDPI = 203;
        const multiplier = printDPI / PREVIEW_DPI;
        imageData = fabricCanvas?.toDataURL({ multiplier, format: "png", quality: 1 });
      }

      if (!imageData) {
        throw new Error("Failed to generate image data");
      }

      // Print configuration for 2x1 inch label on Rollo
      const config = qzInstance.configs.create(selectedPrinter, {
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        size: { width: 2.0, height: 1.0 }, // inches
        units: "in"
      });

      const printData = [{ 
        type: 'image', 
        format: 'png',
        data: imageData,
        options: {
          pageWidth: 2.0,
          pageHeight: 1.0
        }
      }];

      await qzInstance.print(config, printData);
      toast.success(`Label sent directly to ${selectedPrinter}`);
      
    } catch (e) {
      console.error("Direct print failed:", e);
      toast.error(`Direct print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setQzLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-8 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Label Designer</h1>
            <p className="text-muted-foreground mt-2">Design 2×1 inch labels. Direct printing available with QZ Tray for Rollo printers.</p>
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
                {!qzConnected && (
                  <div className="mb-4">
                    <QZTraySetup 
                      isConnected={qzConnected} 
                      onRetryConnection={reconnectQZ}
                    />
                  </div>
                )}
                
                {qzConnected && qzPrinters.length > 0 && (
                  <div className="mb-4 p-3 border rounded-lg bg-green-50">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium text-green-800">QZ Tray Connected</Label>
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <p className="text-xs text-green-700 mb-2">
                      Found {qzPrinters.length} printer(s) - Direct printing available
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="qz-printer" className="text-xs text-green-800">Select Printer</Label>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={refreshPrinters}
                        className="h-6 px-2 text-xs text-green-700 hover:bg-green-100"
                      >
                        Refresh
                      </Button>
                    </div>
                    <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                      <SelectTrigger id="qz-printer" className="h-8 text-xs border-green-200">
                        <SelectValue placeholder="Choose printer" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {qzPrinters.map((printer) => (
                          <SelectItem key={printer} value={printer} className="text-xs">
                            {printer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPrinter && (
                      <div className="mt-2 p-2 rounded bg-green-100">
                        <span className="text-xs text-green-800 font-medium">
                          Selected: {selectedPrinter}
                        </span>
                      </div>
                    )}
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
                    <Button onClick={handlePrint}>Print 2×1 (Dialog)</Button>
                    <Button variant="outline" onClick={handleTestPrint}>Test (Dialog)</Button>
                    {qzConnected && selectedPrinter && (
                      <>
                        <Button 
                          onClick={() => handleDirectPrint(false)} 
                          disabled={qzLoading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {qzLoading ? "Printing..." : "Direct Print"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDirectPrint(true)}
                          disabled={qzLoading}
                        >
                          Direct Test
                        </Button>
                      </>
                    )}
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
