import { printNodeService } from './printNodeService';
import { LabelPdfGenerator, LabelData } from './labelPdf';
import { rolloAutoResolver } from './rolloAutoResolver';
import { toast } from 'sonner';

interface PrintResult {
  success: boolean;
  jobId?: number;
  error?: string;
  printerName?: string;
}

/**
 * Unified print service that always uses PDF method with auto-resolved Rollo printer
 */
export class PrintService {
  /**
   * Print a single label using PDF method to auto-resolved Rollo printer
   */
  static async printLabel(labelData: LabelData, options: { title?: string; copies?: number } = {}): Promise<PrintResult> {
    try {
      console.log('🖨️ Starting label print process...');
      
      // Auto-resolve Rollo printer
      const printer = await rolloAutoResolver.resolveRolloPrinter();
      if (!printer) {
        return {
          success: false,
          error: 'No Rollo printer available'
        };
      }

      console.log(`📄 Generating 2x1 PDF for: ${labelData.title}`);
      
      // Generate PDF using consistent 2x1 dimensions
      const pdfBase64 = await LabelPdfGenerator.generatePDF(labelData);
      
      if (!pdfBase64) {
        return {
          success: false,
          error: 'Failed to generate PDF'
        };
      }

      console.log(`📤 Sending PDF to Rollo printer: ${printer.name} (ID: ${printer.id})`);
      
      // Send to printer using PDF method
      const result = await printNodeService.printPDF(pdfBase64, printer.id, {
        title: options.title || `Label Print · ${labelData.title}`,
        copies: options.copies || 1
      });

      if (result.success) {
        console.log(`✅ Print job ${result.jobId} submitted successfully`);
        toast.success(`Label printed to ${printer.name}`);
        return {
          success: true,
          jobId: result.jobId,
          printerName: printer.name
        };
      } else {
        console.error(`❌ Print job failed:`, result.error);
        toast.error(`Print failed: ${result.error}`);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('💥 Print service error:', error);
      toast.error(`Print error: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Print multiple labels in batch using PDF method
   */
  static async printBatch(
    labelDataList: LabelData[], 
    onProgress?: (current: number, total: number) => void
  ): Promise<{ successCount: number; failedCount: number; printerName?: string }> {
    try {
      console.log(`🖨️ Starting batch print of ${labelDataList.length} labels...`);
      
      // Auto-resolve Rollo printer once for the batch
      const printer = await rolloAutoResolver.resolveRolloPrinter();
      if (!printer) {
        toast.error('No Rollo printer available for batch printing');
        return { successCount: 0, failedCount: labelDataList.length };
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < labelDataList.length; i++) {
        const labelData = labelDataList[i];
        
        onProgress?.(i + 1, labelDataList.length);
        
        try {
          console.log(`📄 Batch item ${i + 1}/${labelDataList.length}: Generating PDF for ${labelData.title}`);
          
          const pdfBase64 = await LabelPdfGenerator.generatePDF(labelData);
          
          if (!pdfBase64) {
            console.error(`❌ PDF generation failed for ${labelData.title}`);
            failedCount++;
            continue;
          }

          const result = await printNodeService.printPDF(pdfBase64, printer.id, {
            title: `Batch Print · ${labelData.title}`,
            copies: 1
          });

          if (result.success) {
            console.log(`✅ Batch item ${i + 1} printed successfully (Job ${result.jobId})`);
            successCount++;
          } else {
            console.error(`❌ Batch item ${i + 1} failed:`, result.error);
            failedCount++;
          }
        } catch (itemError) {
          console.error(`💥 Batch item ${i + 1} error:`, itemError);
          failedCount++;
        }
      }

      const message = `Batch complete: ${successCount} printed, ${failedCount} failed`;
      console.log(`📊 ${message}`);
      
      if (successCount > 0) {
        toast.success(`${successCount} labels printed to ${printer.name}`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} labels failed to print`);
      }

      return { successCount, failedCount, printerName: printer.name };
    } catch (error) {
      console.error('💥 Batch print error:', error);
      toast.error('Batch print failed');
      return { successCount: 0, failedCount: labelDataList.length };
    }
  }

  /**
   * Get the current auto-resolved printer info for display
   */
  static async getCurrentPrinter(): Promise<{ id: number; name: string } | null> {
    return await rolloAutoResolver.resolveRolloPrinter();
  }

  /**
   * Force refresh the printer cache
   */
  static refreshPrinterCache(): void {
    rolloAutoResolver.refreshCache();
  }
}