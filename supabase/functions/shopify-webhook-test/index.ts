const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256",
};

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sku, quantity } = await req.json();
    if (!sku || !quantity) throw new Error("Missing sku or quantity");

    const SHOPIFY_WEBHOOK_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");
    if (!SHOPIFY_WEBHOOK_SECRET) throw new Error("Webhook secret not set");

    const body = JSON.stringify({ line_items: [{ sku, quantity: Number(quantity) }] });

    // Compute HMAC-SHA256 of raw body with secret
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(SHOPIFY_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const hmacHeader = toBase64(new Uint8Array(signature));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const url = `${SUPABASE_URL}/functions/v1/shopify-webhook`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-topic": "orders/create",
        "x-shopify-hmac-sha256": hmacHeader,
      },
      body,
    });

    const data = await res.json();

    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, webhookResponse: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("shopify-webhook-test error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
