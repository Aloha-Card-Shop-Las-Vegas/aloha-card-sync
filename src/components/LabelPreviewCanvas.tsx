import React, { useRef, useEffect, useImperativeHandle, useState } from 'react';
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
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Export function to get high-DPI PNG for printing
  const exportToPNG = (dpi: number = 203): Promise<Blob> => {
    return generateLabelPNG(fieldConfig, labelData, dpi);
  };

  // Export function to get PDF for printing
  const exportToPDF = async (): Promise<string> => {
    return generateLabelPDF(fieldConfig, labelData, 203);
  };

  // Expose the export functions through the ref
  useImperativeHandle(ref, () => ({
    exportToPNG,
    exportToPDF
  }));

  // Generate PDF and convert to display URL
  useEffect(() => {
    const generatePreviewPDF = async () => {
      setIsLoading(true);
      try {
        const pdfBase64 = await generateLabelPDF(fieldConfig, labelData, 203);
        const pdfUrl = `data:application/pdf;base64,${pdfBase64}`;
        setPdfDataUrl(pdfUrl);
      } catch (error) {
        console.error('Error generating PDF preview:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generatePreviewPDF();
  }, [fieldConfig, labelData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Label Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          {isLoading ? (
            <div className="w-80 h-60 bg-muted flex items-center justify-center border rounded">
              <span className="text-muted-foreground">Generating PDF preview...</span>
            </div>
          ) : pdfDataUrl ? (
            <iframe
              src={pdfDataUrl}
              width="320"
              height="240"
              style={{
                border: '1px solid hsl(var(--border))',
                borderRadius: '4px'
              }}
              title="Label PDF Preview"
            />
          ) : (
            <div className="w-80 h-60 bg-muted flex items-center justify-center border rounded">
              <span className="text-muted-foreground">Failed to generate preview</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          This preview uses the same settings as your Label Designer. Update settings in the Label Designer to change how labels appear.
        </p>
      </CardContent>
    </Card>
  );
});