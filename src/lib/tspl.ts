// TSPL (Thermal Printer Programming Language) generator for 2x1 inch labels

export const LABEL_WIDTH_IN = 2;
export const LABEL_HEIGHT_IN = 1;
export const DPI = 203;

// Convert inches to dots at 203 DPI
export const dots = (inches: number): number => Math.round(inches * DPI);

export interface TSPLOptions {
  textLines?: Array<{
    text: string;
    x?: number;
    y?: number;
    fontSize?: 1 | 2 | 3 | 4 | 5;
    rotation?: 0 | 90 | 180 | 270;
  }>;
  qrcode?: {
    data: string;
    x?: number;
    y?: number;
    size?: 'S' | 'M' | 'L';
    errorLevel?: 'L' | 'M' | 'Q' | 'H';
  };
  barcode?: {
    data: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    type?: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8';
  };
  lines?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  gapInches?: number;
  density?: number; // 0-15, default 10
  speed?: number; // 2-8, default 4
}

export function buildTSPL(options: TSPLOptions = {}): string {
  const {
    textLines = [],
    qrcode,
    barcode,
    lines = [],
    gapInches = 0,
    density = 10,
    speed = 4
  } = options;

  const commands: string[] = [];

  // Header commands
  commands.push(`SIZE ${LABEL_WIDTH_IN},${LABEL_HEIGHT_IN}`);
  commands.push(`GAP ${gapInches},0`);
  commands.push(`DENSITY ${density}`);
  commands.push(`SPEED ${speed}`);
  commands.push('DIRECTION 1');
  commands.push('REFERENCE 0,0');
  commands.push('CLS');

  // Add text elements
  textLines.forEach(({ text, x = 10, y = 20, fontSize = 1, rotation = 0 }) => {
    // TSPL TEXT command: TEXT x,y,"font",rotation,x_scale,y_scale,"content"
    commands.push(`TEXT ${x},${y},"0",${rotation},${fontSize},${fontSize},"${text}"`);
  });

  // Add QR code if specified
  if (qrcode) {
    const { data, x = 10, y = 80, size = 'M', errorLevel = 'M' } = qrcode;
    // TSPL QRCODE command: QRCODE x,y,level,cell_width,mode,rotation,"data"
    const cellWidth = size === 'S' ? 3 : size === 'M' ? 4 : 6;
    commands.push(`QRCODE ${x},${y},${errorLevel},${cellWidth},A,0,"${data}"`);
  }

  // Add barcode if specified
  if (barcode) {
    const { data, x = 10, y = 80, width = 2, height = 50, type = 'CODE128' } = barcode;
    // TSPL BARCODE command: BARCODE x,y,"type",height,readable,rotation,narrow,wide,"data"
    commands.push(`BARCODE ${x},${y},"${type}",${height},1,0,${width},${width},"${data}"`);
  }

  // Add horizontal/vertical lines
  lines.forEach(({ x, y, width, height }) => {
    commands.push(`BAR ${x},${y},${width},${height}`);
  });

  // Print command
  commands.push('PRINT 1');

  return commands.join('\n');
}

export function buildSampleLabel(): string {
  return buildTSPL({
    textLines: [
      { text: 'ALOHA CARD SHOP', x: 10, y: 20, fontSize: 2 }
    ],
    qrcode: {
      data: 'https://alohacardshop.com',
      x: 10,
      y: 80
    },
    lines: [
      { x: 10, y: 190, width: 386, height: 2 }
    ]
  });
}

// Unified TSPL generator with field selection
export interface LabelFieldConfig {
  includeTitle: boolean;
  includeSku: boolean;
  includePrice: boolean;
  includeLot: boolean;
  includeCondition: boolean;
  barcodeMode: 'qr' | 'barcode' | 'none';
}

export function generateUnifiedTSPL(
  data: {
    title?: string;
    sku?: string;
    price?: string;
    lot?: string;
    barcode?: string;
    condition?: string;
  },
  fieldConfig: LabelFieldConfig,
  tsplSettings?: { density?: number; speed?: number; gapInches?: number }
): string {
  const textLines: TSPLOptions['textLines'] = [];
  let yPos = 10;

  // Title
  if (fieldConfig.includeTitle && data.title) {
    textLines.push({ 
      text: data.title.slice(0, 25), 
      x: 10, 
      y: yPos, 
      fontSize: 2 
    });
    yPos += 25;
  }

  // Second row: SKU and Condition
  let secondRowY = yPos;
  if (fieldConfig.includeSku && data.sku) {
    textLines.push({ 
      text: `SKU: ${data.sku}`, 
      x: 10, 
      y: secondRowY, 
      fontSize: 1 
    });
  }
  
  if (fieldConfig.includeCondition && data.condition) {
    textLines.push({ 
      text: data.condition, 
      x: 200, 
      y: secondRowY, 
      fontSize: 1 
    });
  }
  
  if (fieldConfig.includeSku || fieldConfig.includeCondition) {
    yPos = secondRowY + 20;
  }

  // Lot number
  if (fieldConfig.includeLot && data.lot) {
    textLines.push({ 
      text: `LOT: ${data.lot}`, 
      x: 10, 
      y: yPos, 
      fontSize: 1 
    });
    yPos += 20;
  }

  // Price (always on right if included)
  if (fieldConfig.includePrice && data.price) {
    const priceText = data.price.startsWith('$') ? data.price : `$${data.price}`;
    textLines.push({ 
      text: priceText, 
      x: 280, 
      y: 10, 
      fontSize: 3 
    });
  }

  const options: TSPLOptions = { 
    textLines,
    ...tsplSettings
  };

  // Barcode/QR code
  if (fieldConfig.barcodeMode !== 'none' && data.barcode) {
    if (fieldConfig.barcodeMode === 'qr') {
      options.qrcode = {
        data: data.barcode,
        x: 10,
        y: Math.max(yPos + 10, 90),
        size: 'M'
      };
    } else if (fieldConfig.barcodeMode === 'barcode') {
      options.barcode = {
        data: data.barcode,
        x: 10,
        y: Math.max(yPos + 10, 90),
        height: 50,
        width: 2,
        type: 'CODE128'
      };
    }
  }

  return buildTSPL(options);
}