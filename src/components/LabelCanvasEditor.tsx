import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, Rect, FabricText, Circle, Line } from 'fabric';
import { LabelLayout } from '@/lib/tspl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ZoomIn, ZoomOut, Grid3X3 } from 'lucide-react';

interface LabelCanvasEditorProps {
  layout: LabelLayout;
  onChange: (layout: LabelLayout) => void;
  labelData: {
    title: string;
    sku: string;
    price: string;
    lot: string;
    condition: string;
    barcode: string;
  };
  printerDpi?: number;
}

const LABEL_WIDTH_DOTS = 386; // 2 inches * 203 DPI
const LABEL_HEIGHT_DOTS = 203; // 1 inch * 203 DPI

export const LabelCanvasEditor = ({ 
  layout, 
  onChange, 
  labelData, 
  printerDpi = 203 
}: LabelCanvasEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(8);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: LABEL_WIDTH_DOTS,
      height: LABEL_HEIGHT_DOTS,
      backgroundColor: '#ffffff',
      selection: true,
    });

    // Draw grid if enabled
    const drawGrid = () => {
      if (!showGrid) return;
      
      for (let i = 0; i <= LABEL_WIDTH_DOTS; i += gridSize) {
        const lineV = new Line([i, 0, i, LABEL_HEIGHT_DOTS], {
          stroke: '#e0e0e0',
          strokeWidth: 0.5,
          selectable: false,
          evented: false,
        });
        canvas.add(lineV);
        canvas.sendObjectToBack(lineV);
      }
      
      for (let i = 0; i <= LABEL_HEIGHT_DOTS; i += gridSize) {
        const lineH = new Line([0, i, LABEL_WIDTH_DOTS, i], {
          stroke: '#e0e0e0',
          strokeWidth: 0.5,
          selectable: false,
          evented: false,
        });
        canvas.add(lineH);
        canvas.sendObjectToBack(lineH);
      }
    };

    drawGrid();
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [showGrid, gridSize]);

  // Update canvas objects when layout changes (from numeric controls)
  useEffect(() => {
    if (!fabricCanvas) return;

    console.log('Updating canvas with layout:', layout);

    // Clear existing objects (except grid lines)
    const objects = fabricCanvas.getObjects();
    const nonGridObjects = objects.filter(obj => 
      obj.type === 'text' || obj.type === 'rect' || obj.type === 'circle'
    );
    nonGridObjects.forEach(obj => fabricCanvas.remove(obj));

    // Add text fields
    const fields = ['title', 'sku', 'price', 'lot', 'condition'] as const;
    fields.forEach(fieldName => {
      const field = layout[fieldName];
      console.log(`Adding field ${fieldName}:`, field);
      
      // Always add field, make visible ones selectable
      const text = new FabricText(
        field.visible ? (labelData[fieldName] || fieldName.toUpperCase()) : `[${fieldName.toUpperCase()}]`, 
        {
          left: field.x,
          top: field.y,
          fontSize: field.fontSize * 12, // Larger for better visibility
          fontFamily: 'Arial, sans-serif',
          fill: field.visible ? '#000000' : '#cccccc',
          selectable: field.visible,
          evented: field.visible,
          opacity: field.visible ? 1 : 0.5,
          backgroundColor: field.visible ? 'transparent' : '#f0f0f0',
        }
      );
      
      text.set({ id: fieldName, fieldType: 'text' });
      fabricCanvas.add(text);
    });

    // Add barcode placeholder - always show if mode is not 'none'
    if (layout.barcode && layout.barcode.mode !== 'none') {
      const barcodeSize = layout.barcode.size === 'S' ? 40 : layout.barcode.size === 'M' ? 60 : 80;
      
      if (layout.barcode.mode === 'qr') {
        const qr = new Rect({
          left: layout.barcode.x,
          top: layout.barcode.y,
          width: barcodeSize,
          height: barcodeSize,
          fill: 'transparent',
          stroke: '#000000',
          strokeWidth: 2,
          selectable: true,
          evented: true,
        });
        
        const qrLabel = new FabricText('QR CODE', {
          left: layout.barcode.x + barcodeSize/2 - 25,
          top: layout.barcode.y + barcodeSize/2 - 6,
          fontSize: 10,
          fill: '#666666',
          selectable: false,
          evented: false,
          fontFamily: 'Arial, sans-serif',
        });
        
        qr.set({ id: 'barcode', fieldType: 'barcode' });
        fabricCanvas.add(qr);
        fabricCanvas.add(qrLabel);
      } else {
        const barcode = new Rect({
          left: layout.barcode.x,
          top: layout.barcode.y,
          width: barcodeSize * 1.8,
          height: barcodeSize * 0.6,
          fill: 'transparent',
          stroke: '#000000',
          strokeWidth: 2,
          selectable: true,
          evented: true,
        });
        
        const barcodeLabel = new FabricText('BARCODE', {
          left: layout.barcode.x + 8,
          top: layout.barcode.y + (barcodeSize * 0.6)/2 - 6,
          fontSize: 10,
          fill: '#666666',
          selectable: false,
          evented: false,
          fontFamily: 'Arial, sans-serif',
        });
        
        barcode.set({ id: 'barcode', fieldType: 'barcode' });
        fabricCanvas.add(barcode);
        fabricCanvas.add(barcodeLabel);
      }
    }

    fabricCanvas.renderAll();
    console.log('Canvas objects after update:', fabricCanvas.getObjects().length);
  }, [fabricCanvas, layout, labelData]);

  // Handle object modifications (from canvas to numeric controls)
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleObjectModified = (e: any) => {
      const obj = e.target;
      const id = obj.get('id');
      
      if (!id || !layout[id as keyof LabelLayout]) return;

      const newLayout = { ...layout };
      
      if (id === 'barcode') {
        newLayout.barcode = {
          ...newLayout.barcode,
          x: Math.max(0, Math.min(LABEL_WIDTH_DOTS - obj.width, Math.round(obj.left / gridSize) * gridSize)),
          y: Math.max(0, Math.min(LABEL_HEIGHT_DOTS - obj.height, Math.round(obj.top / gridSize) * gridSize)),
        };
      } else {
        const field = newLayout[id as keyof Omit<LabelLayout, 'barcode'>];
        if (field && 'x' in field) {
          field.x = Math.max(0, Math.min(LABEL_WIDTH_DOTS - 50, Math.round(obj.left / gridSize) * gridSize));
          field.y = Math.max(0, Math.min(LABEL_HEIGHT_DOTS - 20, Math.round(obj.top / gridSize) * gridSize));
        }
      }
      
      onChange(newLayout);
    };

    fabricCanvas.on('object:modified', handleObjectModified);

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
    };
  }, [fabricCanvas, layout, onChange, gridSize]);

  // Handle zoom
  const handleZoom = (newZoom: number) => {
    if (!fabricCanvas) return;
    setZoom(newZoom);
    fabricCanvas.setZoom(newZoom);
    fabricCanvas.setWidth(LABEL_WIDTH_DOTS * newZoom);
    fabricCanvas.setHeight(LABEL_HEIGHT_DOTS * newZoom);
    fabricCanvas.renderAll();
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeObject = fabricCanvas.getActiveObject();
      if (!activeObject) return;

      const step = e.shiftKey ? gridSize * 2 : gridSize;
      let moved = false;

      switch (e.key) {
        case 'ArrowLeft':
          activeObject.set('left', Math.max(0, activeObject.left! - step));
          moved = true;
          break;
        case 'ArrowRight':
          activeObject.set('left', Math.min(LABEL_WIDTH_DOTS - (activeObject.width || 0), activeObject.left! + step));
          moved = true;
          break;
        case 'ArrowUp':
          activeObject.set('top', Math.max(0, activeObject.top! - step));
          moved = true;
          break;
        case 'ArrowDown':
          activeObject.set('top', Math.min(LABEL_HEIGHT_DOTS - (activeObject.height || 0), activeObject.top! + step));
          moved = true;
          break;
      }

      if (moved) {
        e.preventDefault();
        fabricCanvas.renderAll();
        fabricCanvas.fire('object:modified', { target: activeObject });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabricCanvas, gridSize]);

  return (
    <div className="space-y-4">
      {/* Canvas Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom(Math.max(0.5, zoom - 0.25))}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2">{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom(Math.min(2, zoom + 0.25))}
            disabled={zoom >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            <Switch 
              checked={showGrid} 
              onCheckedChange={setShowGrid}
            />
            <Label className="text-sm">Grid</Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm">Snap:</Label>
            <Select value={gridSize.toString()} onValueChange={(v) => setGridSize(parseInt(v))}>
              <SelectTrigger className="w-16 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4px</SelectItem>
                <SelectItem value="8">8px</SelectItem>
                <SelectItem value="10">10px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="border rounded-lg p-4 bg-gray-50 overflow-auto">
        <div className="inline-block">
          <canvas 
            ref={canvasRef}
            className="border border-gray-300 rounded shadow-sm bg-white"
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p><strong>Tip:</strong> Drag objects to move them, use arrow keys for precise positioning (Shift for larger steps).</p>
        <p>Canvas shows your label at {LABEL_WIDTH_DOTS}×{LABEL_HEIGHT_DOTS} dots (2×1 inch at 203 DPI).</p>
      </div>
    </div>
  );
};