import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, Rect, Textbox, Circle, Line } from 'fabric';
import { LabelLayout } from '@/lib/tspl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ZoomIn, ZoomOut, Grid3X3, RotateCcw, Type, Hash, DollarSign, Package, Star, QrCode, Scan } from 'lucide-react';

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

// Element palette data
const FIELD_ELEMENTS = [
  { id: 'title', label: 'Title', icon: Type, color: 'bg-blue-100 border-blue-300 text-blue-700' },
  { id: 'sku', label: 'SKU', icon: Hash, color: 'bg-green-100 border-green-300 text-green-700' },
  { id: 'price', label: 'Price', icon: DollarSign, color: 'bg-purple-100 border-purple-300 text-purple-700' },
  { id: 'lot', label: 'Lot', icon: Package, color: 'bg-orange-100 border-orange-300 text-orange-700' },
  { id: 'condition', label: 'Condition', icon: Star, color: 'bg-pink-100 border-pink-300 text-pink-700' },
] as const;

const BARCODE_ELEMENTS = [
  { id: 'qr', label: 'QR Code', icon: QrCode, color: 'bg-indigo-100 border-indigo-300 text-indigo-700' },
  { id: 'barcode', label: 'Barcode', icon: Scan, color: 'bg-cyan-100 border-cyan-300 text-cyan-700' },
] as const;

export const LabelCanvasEditor = ({ 
  layout, 
  onChange, 
  labelData, 
  printerDpi = 203 
}: LabelCanvasEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [zoom, setZoom] = useState(1.75); // Better default zoom for visibility
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(8);
  const [gridObjects, setGridObjects] = useState<any[]>([]); // Cache grid objects
  const [draggedElement, setDraggedElement] = useState<string | null>(null);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: LABEL_WIDTH_DOTS * 1.75, // Start with better zoom
      height: LABEL_HEIGHT_DOTS * 1.75,
      backgroundColor: '#ffffff',
      selection: true,
    });

    // Set initial zoom
    canvas.setZoom(1.75);
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Handle grid rendering with caching for better performance
  useEffect(() => {
    if (!fabricCanvas) return;

    // Remove existing cached grid objects
    gridObjects.forEach(obj => fabricCanvas.remove(obj));
    
    const newGridObjects: any[] = [];

    if (showGrid) {
      // Add vertical grid lines
      for (let i = 0; i <= LABEL_WIDTH_DOTS; i += gridSize) {
        const lineV = new Line([i, 0, i, LABEL_HEIGHT_DOTS], {
          stroke: '#e0e0e0',
          strokeWidth: 0.5,
          selectable: false,
          evented: false,
        });
        lineV.set('isGrid', true);
        fabricCanvas.add(lineV);
        fabricCanvas.sendObjectToBack(lineV);
        newGridObjects.push(lineV);
      }
      
      // Add horizontal grid lines
      for (let i = 0; i <= LABEL_HEIGHT_DOTS; i += gridSize) {
        const lineH = new Line([0, i, LABEL_WIDTH_DOTS, i], {
          stroke: '#e0e0e0',
          strokeWidth: 0.5,
          selectable: false,
          evented: false,
        });
        lineH.set('isGrid', true);
        fabricCanvas.add(lineH);
        fabricCanvas.sendObjectToBack(lineH);
        newGridObjects.push(lineH);
      }
      
      fabricCanvas.renderAll();
    }
    
    setGridObjects(newGridObjects);
  }, [fabricCanvas, showGrid, gridSize]);

  // Update canvas objects when layout changes (from numeric controls)
  useEffect(() => {
    if (!fabricCanvas) return;

    // Clear existing objects (except grid lines)
    const objects = fabricCanvas.getObjects();
    const nonGridObjects = objects.filter(obj => !obj.get('isGrid'));
    nonGridObjects.forEach(obj => fabricCanvas.remove(obj));

    // Add text fields - always show all fields for editing
    const fields = ['title', 'sku', 'price', 'lot', 'condition'] as const;
    fields.forEach(fieldName => {
      const field = layout[fieldName];
      
      // Always add field for visual editing with enhanced chip-like styling
      const text = new Textbox(
        field.visible ? (labelData[fieldName] || fieldName.toUpperCase()) : `[${fieldName.toUpperCase()}]`, 
        {
          left: field.x,
          top: field.y,
          width: 120,
          fontSize: Math.max(field.fontSize * 8, 12), // Ensure minimum readable size
          fontFamily: 'Arial, sans-serif',
          fill: field.visible ? '#000000' : '#666666',
          backgroundColor: field.visible ? '#ffffff' : '#f0f0f0',
          selectable: true,
          evented: true,
          opacity: field.visible ? 1 : 0.8,
          borderColor: field.visible ? '#0066cc' : '#999999',
          cornerColor: field.visible ? '#0066cc' : '#999999',
          cornerSize: 8,
          transparentCorners: false,
          padding: 4,
          borderRadius: 4,
        }
      );
      
      text.set({ 
        id: fieldName, 
        fieldType: 'text',
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true
      });
      
      fabricCanvas.add(text);
      fabricCanvas.bringObjectToFront(text);
      
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
          fill: '#f0f0f0',
          stroke: '#000000',
          strokeWidth: 2,
          rx: 4,
          ry: 4,
          selectable: true,
          evented: true,
          borderColor: '#0066cc',
          cornerColor: '#0066cc',
          cornerSize: 6,
          transparentCorners: false,
        });
        
        const qrLabel = new Textbox('QR', {
          left: layout.barcode.x + barcodeSize/2 - 10,
          top: layout.barcode.y + barcodeSize/2 - 8,
          width: 20,
          fontSize: 12,
          fill: '#666666',
          selectable: false,
          evented: false,
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
        });
        
        qr.set({ 
          id: 'barcode', 
          fieldType: 'barcode',
          lockRotation: true
        });
        
        fabricCanvas.add(qr);
        fabricCanvas.add(qrLabel);
        fabricCanvas.bringObjectToFront(qr);
        
      } else {
        const barcode = new Rect({
          left: layout.barcode.x,
          top: layout.barcode.y,
          width: barcodeSize * 1.8,
          height: barcodeSize * 0.6,
          fill: '#f0f0f0',
          stroke: '#000000',
          strokeWidth: 2,
          rx: 4,
          ry: 4,
          selectable: true,
          evented: true,
          borderColor: '#0066cc',
          cornerColor: '#0066cc',
          cornerSize: 6,
          transparentCorners: false,
        });
        
        const barcodeLabel = new Textbox('BARCODE', {
          left: layout.barcode.x + 10,
          top: layout.barcode.y + (barcodeSize * 0.6)/2 - 8,
          width: barcodeSize * 1.8 - 20,
          fontSize: 10,
          fill: '#666666',
          selectable: false,
          evented: false,
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
        });
        
        barcode.set({ 
          id: 'barcode', 
          fieldType: 'barcode',
          lockRotation: true
        });
        
        fabricCanvas.add(barcode);
        fabricCanvas.add(barcodeLabel);
        fabricCanvas.bringObjectToFront(barcode);
        
      }
    }

    fabricCanvas.renderAll();
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
        // Enhanced boundary clamping for barcode
        const maxX = LABEL_WIDTH_DOTS - (obj.width || 80);
        const maxY = LABEL_HEIGHT_DOTS - (obj.height || 80);
        newLayout.barcode = {
          ...newLayout.barcode,
          x: Math.max(0, Math.min(maxX, Math.round(obj.left / gridSize) * gridSize)),
          y: Math.max(0, Math.min(maxY, Math.round(obj.top / gridSize) * gridSize)),
        };
      } else {
        // Enhanced boundary clamping for text fields
        const field = newLayout[id as keyof Omit<LabelLayout, 'barcode'>];
        if (field && 'x' in field) {
          const maxX = LABEL_WIDTH_DOTS - 100; // Reserve space for text width
          const maxY = LABEL_HEIGHT_DOTS - 25;  // Reserve space for text height
          field.x = Math.max(0, Math.min(maxX, Math.round(obj.left / gridSize) * gridSize));
          field.y = Math.max(0, Math.min(maxY, Math.round(obj.top / gridSize) * gridSize));
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

  // Reset view
  const resetView = () => {
    if (!fabricCanvas) return;
    setZoom(1);
    fabricCanvas.setZoom(1);
    fabricCanvas.setWidth(LABEL_WIDTH_DOTS);
    fabricCanvas.setHeight(LABEL_HEIGHT_DOTS);
    fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
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

  // Handle drag start with proper data transfer
  const handleDragStart = (e: React.DragEvent, elementId: string) => {
    e.dataTransfer.setData('text/plain', elementId);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedElement(elementId);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedElement(null);
  };

  // Handle drop on canvas with proper data transfer
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    const elementId = e.dataTransfer.getData('text/plain');
    if (!elementId || !fabricCanvas) return;

    // Get canvas bounds
    const canvasElement = fabricCanvas.getElement();
    const canvasRect = canvasElement.getBoundingClientRect();
    
    // Convert screen coordinates to canvas coordinates
    const canvasX = (e.clientX - canvasRect.left) / zoom;
    const canvasY = (e.clientY - canvasRect.top) / zoom;
    
    // Snap to grid
    const snappedX = Math.round(canvasX / gridSize) * gridSize;
    const snappedY = Math.round(canvasY / gridSize) * gridSize;
    
    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(LABEL_WIDTH_DOTS - 100, snappedX));
    const clampedY = Math.max(0, Math.min(LABEL_HEIGHT_DOTS - 25, snappedY));
    
    // Update layout based on element type
    const newLayout = { ...layout };
    
    if (elementId === 'qr' || elementId === 'barcode') {
      // Handle barcode elements - ensure barcode object exists
      const mode = elementId === 'qr' ? 'qr' : 'barcode';
      newLayout.barcode = {
        mode,
        x: clampedX,
        y: clampedY,
        size: 'M',
        ...newLayout.barcode, // Keep existing properties
      };
    } else {
      // Handle text field elements
      const field = newLayout[elementId as keyof Omit<LabelLayout, 'barcode'>];
      if (field && 'x' in field) {
        field.x = clampedX;
        field.y = clampedY;
        field.visible = true; // Make field visible when dropped
      }
    }
    
    onChange(newLayout);
    setDraggedElement(null);
  };

  // Handle drag over canvas with proper drop effect
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div className="flex gap-6">
      {/* Main Canvas Area */}
      <div className="flex-1 space-y-4">
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
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
            title="Reset view"
          >
            <RotateCcw className="h-4 w-4" />
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
        <div 
          className={`border rounded-lg p-4 bg-gray-50 overflow-auto transition-colors ${
            draggedElement ? 'border-primary border-2 bg-primary/5' : ''
          }`}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          <div className="inline-block">
            <canvas 
              ref={canvasRef}
              className="border border-gray-300 rounded shadow-sm bg-white"
            />
          </div>
        </div>

        {/* Enhanced field legend */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="font-medium mb-2">Field Legend:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white border border-blue-500 rounded"></div>
              <span>Visible fields</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-400 rounded"></div>
              <span>Hidden fields</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 border-2 border-blue-500 rounded"></div>
              <span>Barcode areas</span>
            </div>
          </div>
          <p className="mt-2 text-muted-foreground">
            <strong>Tip:</strong> Drag objects to reposition • Arrow keys for precision • Shift+Arrow for larger steps
          </p>
        </div>
      </div>

      {/* Elements Palette */}
      <div className="w-64 space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Type className="h-4 w-4" />
            Elements
          </h3>
          
          {/* Text Fields */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Text Fields</p>
            {FIELD_ELEMENTS.map((element) => {
              const Icon = element.icon;
              return (
                <div
                  key={element.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, element.id)}
                  onDragEnd={handleDragEnd}
                  className={`${element.color} border-2 border-dashed rounded-lg p-3 cursor-grab hover:shadow-sm transition-all active:cursor-grabbing flex items-center gap-2 text-sm`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{element.label}</span>
                </div>
              );
            })}
          </div>

          {/* Barcodes */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Barcodes</p>
            {BARCODE_ELEMENTS.map((element) => {
              const Icon = element.icon;
              return (
                <div
                  key={element.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, element.id)}
                  onDragEnd={handleDragEnd}
                  className={`${element.color} border-2 border-dashed rounded-lg p-3 cursor-grab hover:shadow-sm transition-all active:cursor-grabbing flex items-center gap-2 text-sm`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{element.label}</span>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p className="font-medium mb-1">How to use:</p>
            <p>• Drag elements to the canvas</p>
            <p>• Elements snap to grid automatically</p>
            <p>• Dropped fields become visible</p>
          </div>
        </div>
      </div>
    </div>
  );
};