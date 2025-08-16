import { Canvas as FabricCanvas, FabricObject } from "fabric";
import { buildTSPL, TSPLOptions } from "./tspl";

// Convert Fabric.js canvas objects to TSPL
export function fabricToTSPL(fabricCanvas: FabricCanvas): string {
  const objects = fabricCanvas.getObjects();
  const textLines: TSPLOptions['textLines'] = [];
  const lines: TSPLOptions['lines'] = [];
  let qrcode: TSPLOptions['qrcode'] | undefined;

  objects.forEach((obj: FabricObject) => {
    // Skip border objects or objects marked as non-printable
    if (obj.excludeFromExport || obj.name === 'border') {
      return;
    }

    // Convert text objects
    if (obj.type === 'textbox' || obj.type === 'text') {
      const textObj = obj as any; // Fabric text object
      
      textLines?.push({
        text: textObj.text || '',
        x: Math.round(textObj.left || 0),
        y: Math.round(textObj.top || 0),
        fontSize: getFontSize(textObj.fontSize || 12),
        rotation: getRotation(textObj.angle || 0)
      });
    }
    
    // Convert line/rectangle objects to bars
    else if (obj.type === 'rect' || obj.type === 'line') {
      const rectObj = obj as any;
      
      lines?.push({
        x: Math.round(rectObj.left || 0),
        y: Math.round(rectObj.top || 0),
        width: Math.round(rectObj.width * (rectObj.scaleX || 1)),
        height: Math.round(rectObj.height * (rectObj.scaleY || 1))
      });
    }
    
    // Convert images marked as QR codes
    else if (obj.type === 'image' && obj.meta?.type === 'qrcode') {
      if (!qrcode) { // Take first QR code only
        qrcode = {
          data: obj.meta?.data || 'https://example.com',
          x: Math.round(obj.left || 0),
          y: Math.round(obj.top || 0),
          size: getQRSize(obj.width || 50)
        };
      }
    }
    
    // Convert barcode images
    else if (obj.type === 'image' && obj.meta?.type === 'barcode') {
      // For now, treat barcodes as text (TSPL doesn't have simple barcode support)
      textLines?.push({
        text: obj.meta?.data || 'BARCODE',
        x: Math.round(obj.left || 0),
        y: Math.round((obj.top || 0) + (obj.height || 20) + 5), // Below barcode image
        fontSize: 1
      });
    }
  });

  return buildTSPL({
    textLines,
    qrcode,
    lines
  });
}

// Convert Fabric font size to TSPL font size (1-5)
function getFontSize(fabricSize: number): 1 | 2 | 3 | 4 | 5 {
  if (fabricSize <= 12) return 1;
  if (fabricSize <= 18) return 2;
  if (fabricSize <= 24) return 3;
  if (fabricSize <= 32) return 4;
  return 5;
}

// Convert Fabric angle to TSPL rotation
function getRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360;
  
  if (normalized >= 315 || normalized < 45) return 0;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  return 270;
}

// Convert object size to QR code size
function getQRSize(objectSize: number): 'S' | 'M' | 'L' {
  if (objectSize <= 40) return 'S';
  if (objectSize <= 80) return 'M';
  return 'L';
}

// Helper to mark Fabric objects with metadata for TSPL conversion
export function markAsBarcode(obj: FabricObject, data: string): void {
  obj.meta = { type: 'barcode', data };
}

export function markAsQRCode(obj: FabricObject, data: string): void {
  obj.meta = { type: 'qrcode', data };
}