import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Textbox, Image as FabricImage, Rect } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Trash2, Eye } from "lucide-react";

const LABEL_WIDTH_IN = 2;
const LABEL_HEIGHT_IN = 1;
const PREVIEW_DPI = 200;
const PX_WIDTH = Math.round(LABEL_WIDTH_IN * PREVIEW_DPI);
const PX_HEIGHT = Math.round(LABEL_HEIGHT_IN * PREVIEW_DPI);

interface Label2x1DesignerProps {
  onSave?: (templateData: any) => void;
  initialData?: {
    condition?: string;
    price?: string;
    productName?: string;
    sku?: string;
  };
}

export const Label2x1Designer = ({ onSave, initialData }: Label2x1DesignerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  
  // Form data
  const [condition, setCondition] = useState(initialData?.condition || "Near Mint");
  const [price, setPrice] = useState(initialData?.price || "$12.99");
  const [productName, setProductName] = useState(initialData?.productName || "POKEMON CHARIZARD VMAX");
  const [sku, setSku] = useState(initialData?.sku || "ACS-00123");

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: PX_WIDTH,
      height: PX_HEIGHT,
      backgroundColor: "#ffffff",
    });

    // Border for visual reference
    const border = new Rect({
      left: 2,
      top: 2,
      width: PX_WIDTH - 4,
      height: PX_HEIGHT - 4,
      rx: 4,
      ry: 4,
      fill: 'transparent',
      stroke: '#ddd',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });

    canvas.add(border);
    setFabricCanvas(canvas);
    
    // Generate initial layout
    generateLayout(canvas);
    
    toast.success("2x1 Label Designer Ready!");

    return () => {
      canvas.dispose();
    };
  }, []);

  const generateLayout = async (canvas: FabricCanvas) => {
    // Clear existing content (except border)
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.excludeFromExport !== true) {
        canvas.remove(obj);
      }
    });

    const margin = 8;
    const conditionMapping: Record<string, string> = {
      "Near Mint": "NM",
      "Lightly Played": "LP", 
      "Moderately Played": "MP",
      "Heavily Played": "HP",
      "Damaged": "DMG"
    };

    // 1. TOP ROW: Condition (left) and Price (right)
    const conditionText = new Textbox(conditionMapping[condition] || condition, {
      left: margin,
      top: margin,
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 600,
      width: PX_WIDTH / 2 - margin * 2,
      textAlign: 'left',
      selectable: false,
      evented: false,
    });

    const priceText = new Textbox(price, {
      left: PX_WIDTH / 2,
      top: margin,
      fontSize: 16,
      fontFamily: 'Inter', 
      fontWeight: 600,
      width: PX_WIDTH / 2 - margin,
      textAlign: 'right',
      selectable: false,
      evented: false,
    });

    // 2. MIDDLE: Barcode
    if (sku.trim()) {
      try {
        const tempCanvas = document.createElement("canvas");
        const JsBarcode: any = (await import("jsbarcode")).default;
        
        JsBarcode(tempCanvas, sku, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          width: 2,
          height: 60,
          lineColor: "#000"
        });
        
        const dataUrl = tempCanvas.toDataURL("image/png");
        
        FabricImage.fromURL(dataUrl).then((barcodeImg) => {
          const barcodeY = 45; // Position between top and bottom
          const maxWidth = PX_WIDTH - (margin * 2);
          
          if (barcodeImg.width && barcodeImg.width > maxWidth) {
            barcodeImg.scaleToWidth(maxWidth);
          }
          
          barcodeImg.set({
            left: margin,
            top: barcodeY,
            selectable: false,
            evented: false,
          });
          
          canvas.add(barcodeImg);
          canvas.renderAll();
        });
      } catch (error) {
        console.error("Barcode generation failed:", error);
      }
    }

    // 3. BOTTOM: Product Name
    const nameText = new Textbox(productName, {
      left: margin,
      top: PX_HEIGHT - 35,
      fontSize: 12,
      fontFamily: 'Inter',
      fontWeight: 400,
      width: PX_WIDTH - (margin * 2),
      textAlign: 'left',
      selectable: false,
      evented: false,
    });

    canvas.add(conditionText, priceText, nameText);
    canvas.renderAll();
  };

  const handlePreview = () => {
    if (!fabricCanvas) return;
    generateLayout(fabricCanvas);
  };

  const handleSave = () => {
    if (!fabricCanvas) return;
    
    const templateData = {
      name: "2x1 Price Label",
      template_type: "raw",
      canvas: fabricCanvas.toJSON(),
      fields: ["condition", "price", "product_name", "sku"],
      layout: {
        condition: { x: 8, y: 8, align: "left" },
        price: { x: PX_WIDTH / 2, y: 8, align: "right" },
        barcode: { x: 8, y: 45, type: "CODE128" },
        product_name: { x: 8, y: PX_HEIGHT - 35, align: "left" }
      }
    };
    
    onSave?.(templateData);
    toast.success("Template saved!");
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    objects.forEach(obj => {
      if (obj.excludeFromExport !== true) {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    toast.success("Canvas cleared!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            2x1 Label Designer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form Controls */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="condition">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Near Mint">Near Mint (NM)</SelectItem>
                    <SelectItem value="Lightly Played">Lightly Played (LP)</SelectItem>
                    <SelectItem value="Moderately Played">Moderately Played (MP)</SelectItem>
                    <SelectItem value="Heavily Played">Heavily Played (HP)</SelectItem>
                    <SelectItem value="Damaged">Damaged (DMG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="$12.99"
                />
              </div>

              <div>
                <Label htmlFor="productName">Product Name</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="POKEMON CHARIZARD VMAX"
                />
              </div>

              <div>
                <Label htmlFor="sku">SKU (for barcode)</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ACS-00123"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handlePreview} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Layout
                </Button>
                <Button onClick={handleSave} variant="outline" className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Template
                </Button>
                <Button onClick={handleClear} variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Canvas Preview */}
            <div className="flex flex-col items-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <canvas 
                  ref={canvasRef} 
                  width={PX_WIDTH} 
                  height={PX_HEIGHT}
                  className="bg-white shadow-sm rounded"
                  aria-label="2x1 Label Preview"
                />
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                2" × 1" Label Preview (200 DPI)
              </div>
            </div>
          </div>

          {/* Layout Description */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Label Layout:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <div>• <strong>Top:</strong> Condition (left) and Price (right)</div>
              <div>• <strong>Middle:</strong> Barcode generated from SKU</div>
              <div>• <strong>Bottom:</strong> Product Name</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};