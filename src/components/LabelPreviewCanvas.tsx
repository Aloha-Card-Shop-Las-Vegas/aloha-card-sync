import { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LabelPreviewCanvasProps {
  fieldConfig: {
    includeTitle: boolean;
    includeSku: boolean;
    includePrice: boolean;
    includeLot: boolean;
    includeCondition: boolean;
    barcodeMode: 'qr' | 'barcode' | 'none';
    templateStyle?: string;
  };
  labelData: {
    title: string;
    sku: string;
    price: string;
    lot: string;
    condition: string;
    barcode: string;
  };
  showGuides?: boolean;
}

export const LabelPreviewCanvas = ({ fieldConfig, labelData, showGuides = false }: LabelPreviewCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Constants for 2x1 inch label at 203 DPI
  const LABEL_WIDTH = 406; // 2 inches * 203 DPI
  const LABEL_HEIGHT = 203; // 1 inch * 203 DPI
  const DISPLAY_SCALE = 0.8; // Scale down for display

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
    // Simple barcode/QR representation
    ctx.fillStyle = '#000000';
    
    if (mode === 'qr') {
      // Draw QR code pattern
      const cellSize = Math.min(width, height) / 21; // 21x21 grid for QR
      for (let i = 0; i < 21; i++) {
        for (let j = 0; j < 21; j++) {
          // Create a pseudo-random pattern based on data
          if ((i + j + data.length) % 3 === 0) {
            ctx.fillRect(x + j * cellSize, y + i * cellSize, cellSize, cellSize);
          }
        }
      }
    } else {
      // Draw barcode pattern
      const barWidth = width / 50;
      for (let i = 0; i < 50; i++) {
        if ((i + data.charCodeAt(i % data.length)) % 3 === 0) {
          ctx.fillRect(x + i * barWidth, y, barWidth, height);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

    // Draw border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, LABEL_WIDTH - 2, LABEL_HEIGHT - 2);

    // Always use boxed layout
    {
      // Boxed layout - match the user's image
      const padding = 10;
      const topRowHeight = 60;
      const middleHeight = 60; // Reduced further to give more space to title
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

      // Top left content (Condition)
      if (fieldConfig.includeCondition) {
        drawText(ctx, labelData.condition, padding + 5, padding + 5, topLeftWidth - 10, topRowHeight - 10, 'center');
      }

      // Top right content (Price)
      if (fieldConfig.includePrice) {
        const topRightX = padding + topLeftWidth + padding;
        drawText(ctx, labelData.price, topRightX + 5, padding + 5, topRightWidth - 10, topRowHeight - 10, 'center');
      }

      // Middle section (Barcode/QR)
      if (fieldConfig.barcodeMode !== 'none') {
        const middleY = padding + topRowHeight + padding;
        const barcodeWidth = LABEL_WIDTH - padding * 2;
        drawBarcode(ctx, padding + 50, middleY + 10, barcodeWidth - 100, middleHeight - 20, labelData.barcode, fieldConfig.barcodeMode);
      }

      // Bottom content (Title)
      if (fieldConfig.includeTitle) {
        const bottomY = padding + topRowHeight + padding + middleHeight + padding;
        drawText(ctx, labelData.title, padding + 5, bottomY + 5, LABEL_WIDTH - padding * 2 - 10, bottomHeight - 10, 'center');
      }
    }
  }, [fieldConfig, labelData, showGuides]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Label Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={LABEL_WIDTH}
            height={LABEL_HEIGHT}
            style={{
              width: LABEL_WIDTH * DISPLAY_SCALE,
              height: LABEL_HEIGHT * DISPLAY_SCALE,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'white'
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};