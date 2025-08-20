// Use explicit Deno global serve function to avoid import issues
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LabelRequest {
  title?: string;
  lot_number?: string;
  price?: string;
  grade?: string;
  sku?: string;
  id?: string;
  printerLang?: 'TSPL' | 'ZPL';
}

interface LabelResponse {
  program: string;
  correlationId: string;
  lang: 'TSPL' | 'ZPL';
}

function sanitizeText(text: string | undefined): string {
  if (!text) return '';
  // Remove quotes and newlines that could break TSPL/ZPL
  return text.replace(/["\n\r]/g, ' ').substring(0, 50);
}

function generateTSPL(data: LabelRequest): string {
  const title = sanitizeText(data.title);
  const lotNumber = sanitizeText(data.lot_number);
  const price = sanitizeText(data.price);
  const barcode = sanitizeText(data.sku || data.id) || 'NO-SKU';

  return `SIZE 50 mm,25 mm
GAP 3 mm,0
DENSITY 10
SPEED 4
DIRECTION 1
CLS
TEXT 10,8,"FONT001",0,1,1,"${title}"
TEXT 10,45,"FONT001",0,1,1,"${lotNumber}"
TEXT 300,45,"FONT001",0,1,1,"${price}"
BARCODE 10,70,"128",90,1,0,2,2,"${barcode}"
PRINT 1,1`;
}

function generateZPL(data: LabelRequest): string {
  const title = sanitizeText(data.title);
  const lotNumber = sanitizeText(data.lot_number);
  const price = sanitizeText(data.price);
  const barcode = sanitizeText(data.sku || data.id) || 'NO-SKU';

  return `^XA
^MMT
^PW406
^LL0203
^LS0
^FT10,30^A0N,25,25^FD${title}^FS
^FT10,70^A0N,20,20^FD${lotNumber}^FS
^FT300,70^A0N,20,20^FD${price}^FS
^FT10,120^BCN,60,Y,N,N
^FD${barcode}^FS
^XZ`;
}

Deno.serve(async (req) => {
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

    const data: LabelRequest = await req.json();
    console.log('Render label request:', data);

    // Generate correlation ID
    const timestamp = Date.now();
    const itemIds = [data.id, data.sku].filter(Boolean).join('-');
    const correlationId = `${timestamp}-${itemIds}`;

    // Determine language (default TSPL, ZPL for zebra printers)
    const lang = data.printerLang || 'TSPL';
    
    // Generate program
    const program = lang === 'ZPL' ? generateZPL(data) : generateTSPL(data);

    const response: LabelResponse = {
      program,
      correlationId,
      lang
    };

    console.log('Generated label program:', { correlationId, lang, programLength: program.length });

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

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