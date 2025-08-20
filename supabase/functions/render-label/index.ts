import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { title, lot_number, price, grade, sku, id, template, condition, variant } = await req.json();
    const barcode = sku || id || "NO-SKU";

    let tspl: string;

    if (template && template.canvas) {
      // Template-based rendering using Fabric.js canvas data
      console.log('Using template-based rendering:', { templateId: template.id, templateType: template.template_type });
      
      tspl = renderTemplateToTSPL(template, {
        title: title || "",
        lot_number: lot_number || "",
        price: price || "",
        grade: grade || "",
        sku: sku || "",
        barcode: barcode,
        condition: condition || "",
        variant: variant || ""
      });
    } else {
      // Fallback to legacy fixed layout
      console.log('Using legacy fixed layout rendering');
      
      const sanitize = (s?: string) => (s ?? "").replace(/"/g, "'");
      const formatPrice = (p: any) => (p == null || p === "" ? "" : `$${Number(p).toFixed(2)}`);

      // Tunables (Rollo @ 203dpi, 2x1 label)
      const SPEED = 4;      // 2–5; lower can improve darkness
      const DENSITY = 10;   // 0–15; increase if bars are light
      const NARROW = 2;     // module width; 2 or 3 recommended
      const WIDE = 2;       // leave = NARROW unless you need wider ratios
      const BAR_H = 90;     // bar height in dots; 90–120 typical

      // Use inches and CRLF line endings for Rollo compatibility
      tspl = [
        "SIZE 2.0,1.0",
        "GAP 0.12,0", 
        `DENSITY ${DENSITY}`,
        `SPEED ${SPEED}`,
        "DIRECTION 1",
        "CLS",
        `TEXT 10,8,"FONT001",0,1,1,"${sanitize(title)}"`,
        `TEXT 10,45,"FONT001",0,1,1,"${sanitize(lot_number || "")}"`,
        `TEXT 300,45,"FONT001",0,1,1,"${formatPrice(price)}"`,
        `BARCODE 10,70,"128",${BAR_H},1,0,${NARROW},${WIDE},"${sanitize(barcode)}"`,
        "PRINT 1,1"
      ].join("\r\n");
    }

    const correlationId = `idx-${Date.now()}-${barcode}`;
    
    console.log('Generated TSPL label:', { 
      correlationId, 
      barcode, 
      programLength: tspl.length,
      templateUsed: !!template?.canvas,
      templateType: template?.template_type || 'legacy'
    });
    
    return new Response(JSON.stringify({ program: tspl, correlationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error rendering label:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to render label' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Condition abbreviation mapping
const getConditionAbbr = (condition: string): string => {
  const conditionMap: Record<string, string> = {
    'Near Mint': 'NM',
    'Lightly Played': 'LP', 
    'Moderately Played': 'MP',
    'Heavily Played': 'HP',
    'Damaged': 'DMG',
    'Poor': 'P'
  };
  return conditionMap[condition] || condition.slice(0, 3).toUpperCase();
};

// Auto-fitting text scale calculation
const getOptimalTextScale = (text: string, elementWidth: number, elementHeight: number, aggressive: boolean = false): number => {
  if (!text || elementWidth <= 0 || elementHeight <= 0) return 1;
  
  // TSPL FONT001 approximate dimensions per scale (in dots at 203dpi)
  const charWidths = { 1: 6, 2: 12, 3: 18, 4: 24, 5: 30 };
  const charHeights = { 1: 8, 2: 16, 3: 24, 4: 32, 5: 40 };
  const padding = aggressive ? 2 : 4; // Less padding for condition/price to maximize size
  
  const availableWidth = elementWidth - padding;
  const availableHeight = elementHeight - padding;
  
  // Find largest scale that fits both width and height
  for (let scale = 5; scale >= 1; scale--) {
    const textWidth = text.length * charWidths[scale as keyof typeof charWidths];
    const textHeight = charHeights[scale as keyof typeof charHeights];
    
    if (textWidth <= availableWidth && textHeight <= availableHeight) {
      console.log(`Text "${text}" - Scale: ${scale}, Width: ${textWidth}/${availableWidth}, Height: ${textHeight}/${availableHeight}, Aggressive: ${aggressive}`);
      return scale;
    }
  }
  
  console.log(`Text "${text}" - Fallback to scale 1, Width: ${availableWidth}, Height: ${availableHeight}, Aggressive: ${aggressive}`);
  return 1; // Minimum scale as fallback
};

// Template-based TSPL renderer
function renderTemplateToTSPL(template: any, data: {
  title: string;
  lot_number: string;
  price: string;
  grade: string;
  sku: string;
  barcode: string;
  condition: string;
  variant: string;
}): string {
  try {
    const canvas = template.canvas;
    if (!canvas) {
      throw new Error('Invalid template canvas data');
    }

    const sanitize = (s: string) => s.replace(/"/g, "'");
    const formatPrice = (p: string) => {
      if (!p || p === '') return '';
      if (p.startsWith('$')) {
        // Extract number from existing formatted price
        const numStr = p.replace(/[$,]/g, '');
        const num = parseFloat(numStr);
        if (isNaN(num)) return p;
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(num);
      } else {
        const num = parseFloat(p);
        if (isNaN(num)) return p;
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(num);
      }
    };

    // TSPL settings from template or defaults
    const settings = template.data?.tsplSettings || {};
    const DENSITY = settings.density || 10;
    const SPEED = settings.speed || 4;
    const GAP = settings.gapInches || 0.12;

    const commands: string[] = [];
    
    // Header
    commands.push("SIZE 2.0,1.0");
    commands.push(`GAP ${GAP},0`);
    commands.push(`DENSITY ${DENSITY}`);
    commands.push(`SPEED ${SPEED}`);
    commands.push("DIRECTION 1");
    commands.push("CLS");

    // Check if we have new template elements format
    if (canvas.elements && Array.isArray(canvas.elements)) {
      console.log('Processing template elements:', canvas.elements.length);
      
      // Process new template elements format
      canvas.elements.forEach((element: any) => {
        let x = Math.round(element.x || 0);
        let y = Math.round(element.y || 0);
        let width = Math.round(element.width || 100);
        let height = Math.round(element.height || 20);
        
        // Auto-adjust condition and price for 50/50 top area split
        if (element.field === 'condition' || element.field === 'variant') {
          x = 10;
          y = 8;
          width = 180; // Left half minus margin
          height = 48;
        } else if (element.field === 'price') {
          x = 200;
          y = 8; 
          width = 174; // Right half minus margin
          height = 48;
        }
        
        let text = '';
        
        // Prioritize field mapping over static text for dynamic templates
        if (element.field) {
          switch (element.field) {
            case 'subject':
            case 'title':
              text = data.title;
              break;
            case 'lot_number':
              text = data.lot_number;
              break;
            case 'price':
              text = formatPrice(data.price);
              break;
            case 'grade':
              text = data.grade;
              break;
            case 'sku':
              text = data.sku;
              break;
            case 'barcode':
              text = data.barcode;
              break;
            case 'brand_title':
              text = data.title; // fallback to title
              break;
            case 'condition':
              text = getConditionAbbr(data.condition);
              break;
            case 'variant':
              text = data.variant || (data.grade ? 'Graded' : 'Raw');
              break;
            case 'card_number':
              text = ''; // not provided in current data
              break;
            case 'year':
              text = ''; // not provided in current data
              break;
            case 'quantity':
              text = '1'; // default
              break;
            case 'created_at':
              text = new Date().toLocaleDateString();
              break;
            default:
              text = element.field;
          }
        } else if (element.type === 'text') {
          text = element.text || '';
        }
        
        console.log(`Processing element ${element.id}: field=${element.field}, text="${text}"`);
        
        if (element.type === 'barcode') {
          // Render as barcode - 20% smaller than element height
          const barcodeHeight = Math.max(30, Math.round(height * 0.8));
          commands.push(`BARCODE ${x},${y},"128",${barcodeHeight},1,0,2,2,"${sanitize(text || data.barcode)}"`);
        } else {
          // Render as text with auto-fitting scale
          const displayText = text || (element.field ? `[${element.field}]` : '');
          if (displayText) {
            // For condition and price in top area, maximize scaling
            let optimalScale;
            if (element.field === 'condition' || element.field === 'price') {
              // For top area elements, use more aggressive scaling
              optimalScale = getOptimalTextScale(displayText, width, height, true);
            } else {
              optimalScale = getOptimalTextScale(displayText, width, height);
            }
            commands.push(`TEXT ${x},${y},"FONT001",0,${optimalScale},${optimalScale},"${sanitize(displayText)}"`);
          }
        }
      });
    }
    // Fallback to legacy Fabric.js objects format
    else if (canvas.objects && Array.isArray(canvas.objects)) {
      console.log('Processing legacy Fabric.js objects:', canvas.objects.length);
      
      // Process legacy canvas objects
      canvas.objects.forEach((obj: any) => {
        if (obj.excludeFromExport || obj.name === 'border') return;

        // Text objects
        if (obj.type === 'textbox' || obj.type === 'text') {
          let text = obj.text || '';
          
          // Replace template variables with actual data
          text = text.replace(/\{title\}/g, sanitize(data.title));
          text = text.replace(/\{lot_number\}/g, sanitize(data.lot_number));
          text = text.replace(/\{price\}/g, sanitize(formatPrice(data.price)));
          text = text.replace(/\{grade\}/g, sanitize(data.grade));
          text = text.replace(/\{sku\}/g, sanitize(data.sku));
          text = text.replace(/\{barcode\}/g, sanitize(data.barcode));

          const x = Math.round(obj.left || 0);
          const y = Math.round(obj.top || 0);
          const fontSize = Math.min(5, Math.max(1, Math.round((obj.fontSize || 12) / 6)));
          const rotation = Math.round((obj.angle || 0) / 90) * 90;

          commands.push(`TEXT ${x},${y},"FONT001",${rotation},${fontSize},${fontSize},"${text}"`);
        }
        
        // Rectangle/Line objects as bars
        else if (obj.type === 'rect' || obj.type === 'line') {
          const x = Math.round(obj.left || 0);
          const y = Math.round(obj.top || 0);
          const width = Math.round((obj.width || 1) * (obj.scaleX || 1));
          const height = Math.round((obj.height || 1) * (obj.scaleY || 1));
          
          commands.push(`BAR ${x},${y},${width},${height}`);
        }
        
        // Barcode objects
        else if (obj.type === 'image' && obj.meta?.type === 'barcode') {
          const x = Math.round(obj.left || 0);
          const y = Math.round(obj.top || 0);
          // Make barcode 20% smaller
          const height = Math.round((obj.height || 90) * 0.8);
          
          commands.push(`BARCODE ${x},${y},"128",${height},1,0,2,2,"${sanitize(data.barcode)}"`);
        }
        
        // QR Code objects  
        else if (obj.type === 'image' && obj.meta?.type === 'qrcode') {
          const x = Math.round(obj.left || 0);
          const y = Math.round(obj.top || 0);
          const size = obj.width <= 40 ? 3 : (obj.width <= 80 ? 4 : 6);
          
          let qrData = obj.meta?.data || data.barcode;
          // Replace template variables in QR data
          qrData = qrData.replace(/\{barcode\}/g, data.barcode);
          qrData = qrData.replace(/\{sku\}/g, data.sku);
          
          commands.push(`QRCODE ${x},${y},M,${size},A,0,"${sanitize(qrData)}"`);
        }
      });
    } else {
      throw new Error('No valid template elements or objects found');
    }

    commands.push("PRINT 1,1");
    
    return commands.join("\r\n");
    
  } catch (error) {
    console.error('Template rendering error:', error);
    throw new Error(`Template rendering failed: ${error.message}`);
  }
}