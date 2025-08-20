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

    const { title, lot_number, price, grade, sku, id, printerLang = "TSPL" } = await req.json();
    
    const barcode = sku || id || "NO-SKU";
    const sanitize = (s?: string) => (s ?? "").replace(/"/g, "'").substring(0, 50);
    const formatPrice = (p: any) => {
      if (p == null || p === "") return "";
      const num = Number(p);
      return isNaN(num) ? "" : `$${num.toFixed(2)}`;
    };

    const tspl = `SIZE 50 mm,25 mm
GAP 3 mm,0
DENSITY 10
SPEED 4
DIRECTION 1
CLS
TEXT 10,8,"FONT001",0,1,1,"${sanitize(title)}"
TEXT 10,45,"FONT001",0,1,1,"${sanitize(lot_number)}"
TEXT 300,45,"FONT001",0,1,1,"${formatPrice(price)}"
BARCODE 10,70,"128",90,1,0,2,2,"${sanitize(barcode)}"
PRINT 1,1`.trim();

    const zpl = `^XA
^PW406
^LL203
^LH0,0
^FO10,10^A0N,24,24^FD${sanitize(title)}^FS
^FO10,42^A0N,22,22^FD${sanitize(lot_number)}^FS
^FO300,42^A0N,22,22^FD${formatPrice(price)}^FS
^FO10,70^BY2,2,90^BCN,90,Y,N,N
^FD${sanitize(barcode)}^FS
^PQ1
^XZ`.trim();

    const program = printerLang === "ZPL" ? zpl : tspl;
    const correlationId = `idx-${Date.now()}-${barcode}`;
    
    console.log('Generated label:', { correlationId, lang: printerLang, barcode, programLength: program.length });
    
    return new Response(JSON.stringify({ lang: printerLang, program, correlationId }), {
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