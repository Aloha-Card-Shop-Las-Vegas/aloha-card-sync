import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  renderLabelToCanvas, 
  generateLabelPDF, 
  generateLabelPNG, 
  LABEL_WIDTH, 
  LABEL_HEIGHT,
  type LabelData,
  type LabelFieldConfig 
} from '@/lib/labelRenderer';

interface LabelPreviewCanvasProps {
  fieldConfig: LabelFieldConfig & { templateStyle?: string };
  labelData: LabelData;
  showGuides?: boolean;
}

export const LabelPreviewCanvas = React.forwardRef<any, LabelPreviewCanvasProps>(({ fieldConfig, labelData, showGuides = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Export function to get high-DPI PNG for printing
  const exportToPNG = (dpi: number = 203): Promise<Blob> => {
    return generateLabelPNG(fieldConfig, labelData, dpi);
  };

  // Export function to get PDF for printing
  const exportToPDF = async (): Promise<string> => {
    return generateLabelPDF(fieldConfig, labelData, 203);
  };

  const DISPLAY_SCALE = 0.8; // Scale down for display

  // Expose the export functions through the ref
  useImperativeHandle(ref, () => ({
    exportToPNG,
    exportToPDF
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderLabelToCanvas(ctx, fieldConfig, labelData, showGuides);
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
});