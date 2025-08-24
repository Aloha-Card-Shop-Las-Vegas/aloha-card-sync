import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

export interface LabelData {
  title: string;
  sku: string;
  price: string;
  lot: string;
  condition: string;
  barcode: string;
}

export interface LabelFieldConfig {
  includeTitle: boolean;
  includeSku: boolean;
  includePrice: boolean;
  includeLot: boolean;
  includeCondition: boolean;
  barcodeMode: 'qr' | 'barcode' | 'none';
  templateStyle?: string;
}

// Constants for 2x1 inch label at 203 DPI
export const LABEL_WIDTH = 406; // 2 inches * 203 DPI
export const LABEL_HEIGHT = 203; // 1 inch * 203 DPI

const calculateFontSize = (text: string, maxWidth: number, maxHeight: number, ctx: CanvasRenderingContext2D): number => {
  let fontSize = Math.min(maxHeight * 0.8, 40);
  
  while (fontSize > 8) {
    ctx.font = `${fontSize}px Arial`;
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      break;
    }
    fontSize -= 2;
  }
  
  return Math.max(fontSize, 8);
};

const drawBarcode = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, data: string, mode: 'qr' | 'barcode') => {
  if (mode === 'barcode') {
    // Create a temporary canvas for JsBarcode
    const barcodeCanvas = document.createElement('canvas');
    try {
      JsBarcode(barcodeCanvas, data, {
        format: "CODE128",
        width: 2,
        height: height,
        displayValue: false,
        margin: 0
      });
      
      // Draw the barcode on the main canvas
      ctx.drawImage(barcodeCanvas, x, y, width, height);
    } catch (error) {
      console.error('Barcode generation failed:', error);
      // Fallback to text if barcode fails
      ctx.fillStyle = '#000000';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(data, x + width/2, y + height/2);
    }
  } else if (mode === 'qr') {
    // Simple QR placeholder pattern
    ctx.fillStyle = '#000000';
    const cellSize = Math.min(width, height) / 21; // 21x21 grid for QR
    for (let i = 0; i < 21; i++) {
      for (let j = 0; j < 21; j++) {
        // Create a pseudo-random pattern based on data
        if ((i + j + data.length) % 3 === 0) {
          ctx.fillRect(x + j * cellSize, y + i * cellSize, cellSize, cellSize);
        }
      }
    }
  }
};

const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxHeight: number, align: 'left' | 'center' | 'right' = 'left') => {
  if (!text.trim()) return;
  
  const fontSize = calculateFontSize(text, maxWidth, maxHeight, ctx);
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  
  let drawX = x;
  if (align === 'center') {
    drawX = x + maxWidth / 2;
    ctx.textAlign = 'center';
  } else if (align === 'right') {
    drawX = x + maxWidth;
    ctx.textAlign = 'right';
  } else {
    ctx.textAlign = 'left';
  }
  
  ctx.fillText(text, drawX, y + maxHeight / 2);
};

export const renderLabelToCanvas = (
  ctx: CanvasRenderingContext2D,
  fieldConfig: LabelFieldConfig,
  labelData: LabelData,
  showGuides: boolean = false
): void => {
  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Draw border
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, LABEL_WIDTH - 2, LABEL_HEIGHT - 2);

  // Use boxed layout
  const padding = 10;
  const topRowHeight = 60;
  const middleHeight = 60;
  const bottomHeight = LABEL_HEIGHT - topRowHeight - middleHeight - padding * 3;

  // Top row boxes
  const topLeftWidth = 120;
  const topRightWidth = LABEL_WIDTH - topLeftWidth - padding * 3;

  // Draw guide outlines only if showGuides is enabled
  if (showGuides) {
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    // Top left box (Condition)
    ctx.strokeRect(padding, padding, topLeftWidth, topRowHeight);
    
    // Top right box (Price)
    const topRightX = padding + topLeftWidth + padding;
    ctx.strokeRect(topRightX, padding, topRightWidth, topRowHeight);
    
    // Bottom box (Title)
    const bottomY = padding + topRowHeight + padding + middleHeight + padding;
    ctx.strokeRect(padding, bottomY, LABEL_WIDTH - padding * 2, bottomHeight);
    
    ctx.setLineDash([]); // Reset to solid line
  }

  // Top left content (Condition) - dynamic sizing to fill box
  if (fieldConfig.includeCondition && labelData.condition) {
    const fontSize = calculateFontSize(labelData.condition, topLeftWidth - 10, topRowHeight - 10, ctx);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelData.condition, padding + topLeftWidth/2, padding + topRowHeight/2);
  }

  // Top right content (Price) - dynamic sizing to fill box
  if (fieldConfig.includePrice && labelData.price) {
    const topRightX = padding + topLeftWidth + padding;
    const fontSize = calculateFontSize(labelData.price, topRightWidth - 10, topRowHeight - 10, ctx);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelData.price, topRightX + topRightWidth/2, padding + topRowHeight/2);
  }

  // Add SKU below top row
  if (fieldConfig.includeSku && labelData.sku) {
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`SKU: ${labelData.sku}`, padding, padding + topRowHeight + 5);
  }

  // Title below SKU - two lines with larger text
  if (fieldConfig.includeTitle && labelData.title) {
    const titleY = padding + topRowHeight + 25; // Start below SKU
    const titleWidth = LABEL_WIDTH - padding * 2;
    const titleHeight = 40; // Height for two lines
    
    // Split title into words and create up to 2 lines
    const words = labelData.title.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    // Calculate font size for the available space
    const testFontSize = calculateFontSize(labelData.title, titleWidth, titleHeight / 2, ctx);
    ctx.font = `${testFontSize}px Arial`;
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width <= titleWidth && lines.length < 2) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length >= 2) break; // Limit to 2 lines
      }
    }
    if (currentLine && lines.length < 2) lines.push(currentLine);
    
    // Draw the lines
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    lines.forEach((line, index) => {
      ctx.fillText(line, padding, titleY + (index * (testFontSize + 2)));
    });
  }

  // Barcode below title area
  if (fieldConfig.barcodeMode !== 'none') {
    const barcodeY = padding + topRowHeight + 75; // Position below title
    const barcodeWidth = LABEL_WIDTH - padding * 4;
    const barcodeHeight = 30; // Smaller to fit below title
    const barcodeX = padding * 2;
    drawBarcode(ctx, barcodeX, barcodeY, barcodeWidth, barcodeHeight, labelData.barcode, fieldConfig.barcodeMode);
  }

  // Add lot number support if included
  if (fieldConfig.includeLot && labelData.lot) {
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'right';
    ctx.fillText(`Lot: ${labelData.lot}`, LABEL_WIDTH - padding - 5, padding + 15);
  }
};

export const generateLabelPDF = async (
  fieldConfig: LabelFieldConfig,
  labelData: LabelData,
  dpi: number = 203
): Promise<string> => {
  // Create a canvas for rendering
  const canvas = document.createElement('canvas');
  const scaleFactor = dpi / 96; // 96 is standard screen DPI
  canvas.width = LABEL_WIDTH * scaleFactor;
  canvas.height = LABEL_HEIGHT * scaleFactor;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Scale the context to match DPI
  ctx.scale(scaleFactor, scaleFactor);
  
  // Render the label
  renderLabelToCanvas(ctx, fieldConfig, labelData, false);
  
  // Convert to blob and then to PDF
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create PNG blob'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        
        // Create PDF with exact 2x1 inch dimensions
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'in',
          format: [2, 1] // 2x1 inch
        });
        
        // Add the PNG image to fill the entire page
        pdf.addImage(dataUrl, 'PNG', 0, 0, 2, 1);
        
        // Return base64 PDF data
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        resolve(pdfBase64);
      };
      reader.onerror = () => reject(new Error('Failed to read PNG blob'));
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
};

export const generateLabelPNG = async (
  fieldConfig: LabelFieldConfig,
  labelData: LabelData,
  dpi: number = 203
): Promise<Blob> => {
  // Create a canvas for rendering
  const canvas = document.createElement('canvas');
  const scaleFactor = dpi / 96; // 96 is standard screen DPI
  canvas.width = LABEL_WIDTH * scaleFactor;
  canvas.height = LABEL_HEIGHT * scaleFactor;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Scale the context to match DPI
  ctx.scale(scaleFactor, scaleFactor);
  
  // Render the label
  renderLabelToCanvas(ctx, fieldConfig, labelData, false);
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG blob'));
      }
    }, 'image/png');
  });
};