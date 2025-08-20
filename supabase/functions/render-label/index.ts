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

    const { title, lot_number, price, grade, sku, id, template } = await req.json();
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
        barcode: barcode
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

// Template-based TSPL renderer
function renderTemplateToTSPL(template: any, data: {
  title: string;
  lot_number: string;
  price: string;
  grade: string;
  sku: string;
  barcode: string;
}): string {
  try {
    const canvas = template.canvas;
    if (!canvas) {
      throw new Error('Invalid template canvas data');
    }

    const sanitize = (s: string) => s.replace(/"/g, "'");
    const formatPrice = (p: string) => p.startsWith('$') ? p : (p ? `$${p}` : '');

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
        const x = Math.round(element.x || 0);
        const y = Math.round(element.y || 0);
        const width = Math.round(element.width || 100);
        const height = Math.round(element.height || 20);
        const fontSize = Math.min(5, Math.max(1, Math.round((element.fontSize || 12) / 6)));
        
        let text = '';
        
        // Get data based on element field mapping
        if (element.type === 'text') {
          text = element.text || '';
        } else if (element.field) {
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
            case 'variant':
              // Use grade as fallback if variant is empty, or show "Raw" as default
              text = data.grade || 'Raw';
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
        }
        
        console.log(`Processing element ${element.id}: field=${element.field}, text="${text}"`);
        
        if (element.type === 'barcode') {
          // Render as barcode
          const barcodeHeight = Math.max(30, height);
          commands.push(`BARCODE ${x},${y},"128",${barcodeHeight},1,0,2,2,"${sanitize(text || data.barcode)}"`);
        } else {
          // Render as text - always render even if empty, but with placeholder
          const displayText = text || (element.field ? `[${element.field}]` : '');
          if (displayText) {
            commands.push(`TEXT ${x},${y},"FONT001",0,${fontSize},${fontSize},"${sanitize(displayText)}"`);
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
          const height = Math.round(obj.height || 90);
          
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