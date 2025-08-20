import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Textbox, Image as FabricImage, Rect } from "fabric";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LABEL_WIDTH_IN = 2;
const LABEL_HEIGHT_IN = 1;
const PREVIEW_DPI = 150;
const PX_WIDTH = Math.round(LABEL_WIDTH_IN * PREVIEW_DPI);
const PX_HEIGHT = Math.round(LABEL_HEIGHT_IN * PREVIEW_DPI);

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

interface LabelCanvasProps {
  barcodeValue: string;
  title: string;
  lot: string;
  price: string;
  condition: string;
  grade?: string;
  selectedFontFamily: string;
  onCanvasReady: (canvas: FabricCanvas) => void;
}

export const LabelCanvas = ({ 
  barcodeValue, 
  title, 
  lot, 
  price, 
  condition,
  grade,
  selectedFontFamily,
  onCanvasReady 
}: LabelCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const borderRef = useRef<Rect | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: PX_WIDTH,
      height: PX_HEIGHT,
      backgroundColor: "#ffffff",
    });

    // Visible label outline
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

    // Initial layout
    const titleBox = new Textbox(withCondition(title, condition), { 
      left: 6, 
      top: 6, 
      fontSize: 14, 
      width: PX_WIDTH - 12,
      fontFamily: 'Roboto Condensed',
      fontWeight: 600,
    });
    const lotBox = new Textbox(lot, { 
      left: 6, 
      top: 28, 
      fontSize: 12, 
      width: PX_WIDTH - 12,
      fontFamily: 'Roboto Condensed',
      fontWeight: 400,
    });
    const priceBox = new Textbox(price, { 
      left: PX_WIDTH - 80, 
      top: PX_HEIGHT - 22, 
      fontSize: 14, 
      textAlign: "right", 
      width: 74,
      fontFamily: 'Inter',
      fontWeight: 600,
    });

    canvas.add(border, titleBox, lotBox, priceBox);
    setFabricCanvas(canvas);
    onCanvasReady(canvas);
    toast.success("Canvas ready!");

    return () => {
      canvas.dispose();
    };
  }, [title, lot, price, condition]);

  const addText = (text: string) => {
    if (!fabricCanvas) return;
    const tb = new Textbox(text, { 
      left: 10, 
      top: 10, 
      fontSize: 12, 
      width: PX_WIDTH - 20,
      fontFamily: selectedFontFamily,
      fontWeight: 500,
    });
    fabricCanvas.add(tb);
    fabricCanvas.setActiveObject(tb);
  };

  const addBarcode = async () => {
    if (!fabricCanvas || !barcodeValue.trim()) {
      toast.error("Enter a barcode value");
      return;
    }

    try {
      const tempCanvas = document.createElement("canvas");
      const JsBarcode: any = (await import("jsbarcode")).default;
      JsBarcode(tempCanvas, barcodeValue, { 
        format: "CODE128", 
        displayValue: false, 
        margin: 0, 
        width: 2, 
        height: 40, 
        lineColor: "#000" 
      });
      const dataUrl = tempCanvas.toDataURL("image/png");

      FabricImage.fromURL(dataUrl).then((img) => {
        img.set({ left: 6, top: PX_HEIGHT - 50, selectable: true });
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

  const addVerticalLine = () => {
    if (!fabricCanvas) return;
    const line = new Rect({
      left: PX_WIDTH / 2 - 1,
      top: 10,
      width: 2,
      height: PX_HEIGHT - 20,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 0,
      selectable: true,
      evented: true,
    });
    fabricCanvas.add(line);
    fabricCanvas.setActiveObject(line);
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

  // Keyboard shortcuts
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

  return (
    <div>
      <div className="border rounded-md p-3 inline-block" style={{ width: PX_WIDTH + 8, height: PX_HEIGHT + 8 }}>
        <canvas ref={canvasRef} width={PX_WIDTH} height={PX_HEIGHT} aria-label="Label design canvas" />
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button onClick={() => addText(title)}>Add Title</Button>
        <Button onClick={() => addText(condMap[condition] || condition)}>Add Condition</Button>
        <Button onClick={() => addText(lot)}>Add Lot</Button>
        <Button onClick={() => addText(price)}>Add Price</Button>
        {grade && <Button onClick={() => addText(`Grade: ${grade}`)}>Add Grade</Button>}
        <Button variant="outline" onClick={addBarcode}>Add Barcode</Button>
        <Button variant="outline" onClick={addVerticalLine}>Add Line</Button>
        <Button variant="outline" onClick={deleteSelected}>Delete Selected</Button>
        <Button variant="secondary" onClick={handleClear}>Clear</Button>
      </div>
    </div>
  );
};