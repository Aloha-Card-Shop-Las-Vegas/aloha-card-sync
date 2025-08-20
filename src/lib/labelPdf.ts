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
  private static LABEL_WIDTH_MM = 101.6; // 4 inches in mm
  private static LABEL_HEIGHT_MM = 76.2; // 3 inches in mm
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
    
    // Title (top, larger font)
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    const titleLines = this.wrapText(pdf, data.title, this.LABEL_WIDTH_MM - 10);
    let yPos = 15;
    titleLines.forEach(line => {
      pdf.text(line, this.LABEL_WIDTH_MM / 2, yPos, { align: 'center' });
      yPos += 5;
    });

    // Lot number (left side)
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`LOT: ${data.lot}`, 5, yPos + 8);

    // Price (right side)
    if (data.price) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(data.price, this.LABEL_WIDTH_MM - 5, yPos + 8, { align: 'right' });
    }

    // Grade (if present)
    if (isGraded) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Grade: ${data.grade}`, this.LABEL_WIDTH_MM / 2, yPos + 15, { align: 'center' });
    }

    // Condition (if present and not graded)
    if (data.condition && !isGraded) {
      pdf.setFontSize(10);
      pdf.text(`Condition: ${this.abbreviateCondition(data.condition)}`, 5, yPos + 20);
    }

    // Barcode (bottom center)
    await this.renderBarcode(pdf, data.barcode, this.LABEL_WIDTH_MM / 2 - 20, this.LABEL_HEIGHT_MM - 20, 40, 10);
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
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0
      });

      // Add barcode image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', x, y, width, height);
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