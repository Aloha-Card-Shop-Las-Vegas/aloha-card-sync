import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

export interface LabelData {
  title: string;
  lot: string;
  price: string;
  barcode: string;
  sku?: string;
  condition?: string;
  grade?: string;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'barcode' | 'qr';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  text?: string;
  dataField?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
}

interface LabelTemplate {
  elements: TemplateElement[];
  width: number;
  height: number;
}

export class LabelPdfGenerator {
  private static LABEL_WIDTH_MM = 50.8; // 2 inches in mm
  private static LABEL_HEIGHT_MM = 25.4; // 1 inch in mm
  private static DPI = 203; // Label printer DPI
  private static MM_TO_POINTS = 2.834; // PDF points per mm

  static async generatePDF(data: LabelData, template?: LabelTemplate): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [this.LABEL_WIDTH_MM, this.LABEL_HEIGHT_MM]
    });

    if (template) {
      await this.renderTemplateLayout(pdf, data, template);
    } else {
      await this.renderDefaultLayout(pdf, data);
    }

    return pdf.output('datauristring').split(',')[1]; // Return base64 only
  }

  private static async renderTemplateLayout(pdf: jsPDF, data: LabelData, template: LabelTemplate): Promise<void> {
    for (const element of template.elements) {
      switch (element.type) {
        case 'text':
          await this.renderTextElement(pdf, element, data);
          break;
        case 'barcode':
          await this.renderBarcodeElement(pdf, element, data);
          break;
        case 'qr':
          // QR codes not implemented yet - skip
          break;
      }
    }
  }

  private static async renderDefaultLayout(pdf: jsPDF, data: LabelData): Promise<void> {
    const isGraded = data.grade && data.grade !== '';
    
    // Title - compact for 2x1 label
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    const titleLines = this.wrapText(pdf, data.title, this.LABEL_WIDTH_MM - 4);
    let yPos = 4;
    // Only show first 2 lines due to space constraints
    titleLines.slice(0, 2).forEach(line => {
      pdf.text(line, this.LABEL_WIDTH_MM / 2, yPos, { align: 'center' });
      yPos += 2.5;
    });

    // LOT and Price on same line - very compact
    pdf.setFontSize(5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`LOT: ${data.lot}`, 1, yPos + 2);
    
    if (data.price) {
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.text(data.price, this.LABEL_WIDTH_MM - 1, yPos + 2, { align: 'right' });
    }

    // Grade or Condition - small text
    if (isGraded && data.grade) {
      pdf.setFontSize(5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${data.grade}`, 1, yPos + 5);
    } else if (data.condition) {
      pdf.setFontSize(5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${this.abbreviateCondition(data.condition)}`, 1, yPos + 5);
    }

    // Barcode at bottom - sized for 2x1 label
    const barcodeY = this.LABEL_HEIGHT_MM - 8;
    const barcodeWidth = 30;
    const barcodeHeight = 6;
    const barcodeX = (this.LABEL_WIDTH_MM - barcodeWidth) / 2;
    
    await this.renderBarcode(pdf, data.barcode, barcodeX, barcodeY, barcodeWidth, barcodeHeight);
  }

  private static async renderTextElement(pdf: jsPDF, element: TemplateElement, data: LabelData): Promise<void> {
    let text = element.text || '';
    
    // Replace data field placeholders
    if (element.dataField) {
      switch (element.dataField) {
        case 'title':
          text = data.title;
          break;
        case 'lot':
          text = data.lot;
          break;
        case 'price':
          text = data.price;
          break;
        case 'grade':
          text = data.grade || '';
          break;
        case 'condition':
          text = this.abbreviateCondition(data.condition || '');
          break;
        case 'sku':
          text = data.sku || '';
          break;
      }
    }

    if (!text) return;

    // Convert template coordinates (assuming they're in label printer units)
    const x = (element.x / 8) * (this.LABEL_WIDTH_MM / 100); // Rough conversion
    const y = (element.y / 8) * (this.LABEL_HEIGHT_MM / 100);
    
    pdf.setFontSize(element.fontSize || 10);
    pdf.setFont('helvetica', element.fontWeight === 'bold' ? 'bold' : 'normal');
    
    const align = element.textAlign || 'left';
    pdf.text(text, x, y, { align });
  }

  private static async renderBarcodeElement(pdf: jsPDF, element: TemplateElement, data: LabelData): Promise<void> {
    // Convert template coordinates
    const x = (element.x / 8) * (this.LABEL_WIDTH_MM / 100);
    const y = (element.y / 8) * (this.LABEL_HEIGHT_MM / 100);
    const width = Math.max(30, (element.width / 8) * (this.LABEL_WIDTH_MM / 100));
    const height = Math.max(8, (element.height / 8) * (this.LABEL_HEIGHT_MM / 100));
    
    await this.renderBarcode(pdf, data.barcode, x, y, width, height);
  }

  private static async renderBarcode(pdf: jsPDF, text: string, x: number, y: number, width: number, height: number): Promise<void> {
    return new Promise((resolve) => {
      // Create canvas for barcode generation
      const canvas = document.createElement('canvas');
      canvas.width = 300; // Appropriate for 2x1 label
      canvas.height = 50;
      
      try {
        JsBarcode(canvas, text, {
          format: 'CODE128',
          width: 1.5, // Thinner bars for small label
          height: 30,
          displayValue: true,
          fontSize: 8, // Smaller font
          margin: 2,
          background: '#ffffff',
          lineColor: '#000000'
        });

        // Add barcode image to PDF
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', x, y, width, height);
      } catch (error) {
        console.error('Barcode generation failed:', error);
        // Fallback: just print the text
        pdf.setFontSize(5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(text, x + width/2, y + height/2, { align: 'center' });
      }
      
      resolve();
    });
  }

  private static wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = pdf.getTextWidth(testLine);
      
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  private static abbreviateCondition(condition: string): string {
    const abbreviations: { [key: string]: string } = {
      'Near Mint': 'NM',
      'Lightly Played': 'LP',
      'Moderately Played': 'MP',
      'Heavily Played': 'HP',
      'Damaged': 'DMG',
      'Mint': 'M'
    };
    
    return abbreviations[condition] || condition;
  }
}