import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get Shopify settings from system_settings table
    const { data: domainSetting } = await supabase.functions.invoke('get-system-setting', {
      body: { 
        keyName: 'SHOPIFY_STORE_DOMAIN',
        fallbackSecretName: 'SHOPIFY_STORE_DOMAIN'
      }
    });

    const { data: tokenSetting } = await supabase.functions.invoke('get-system-setting', {
      body: { 
        keyName: 'SHOPIFY_ADMIN_ACCESS_TOKEN',
        fallbackSecretName: 'SHOPIFY_ADMIN_ACCESS_TOKEN'
      }
    });

    const { data: webhookSetting } = await supabase.functions.invoke('get-system-setting', {
      body: { 
        keyName: 'SHOPIFY_WEBHOOK_SECRET',
        fallbackSecretName: 'SHOPIFY_WEBHOOK_SECRET'
      }
    });

    const SHOPIFY_STORE_DOMAIN = domainSetting?.value;
    const SHOPIFY_ADMIN_ACCESS_TOKEN = tokenSetting?.value;
    const SHOPIFY_WEBHOOK_SECRET = webhookSetting?.value;

    const hasDomain = Boolean(SHOPIFY_STORE_DOMAIN);
    const hasAdminToken = Boolean(SHOPIFY_ADMIN_ACCESS_TOKEN);
    const hasWebhookSecret = Boolean(SHOPIFY_WEBHOOK_SECRET);

    let shop: any = null;
    let locations: any[] = [];

    if (hasDomain && hasAdminToken) {
      const api = async (path: string) => {
        const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07${path}`, {
          headers: { "X-Shopify-Access-Token": SHOPIFY_ADMIN_ACCESS_TOKEN!, "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(json));
        return json;
      };
      try {
        const shopRes = await api(`/shop.json`);
        shop = shopRes.shop || null;
      } catch (e) {
        shop = null;
      }
      try {
        const locRes = await api(`/locations.json`);
        locations = locRes.locations || [];
      } catch (e) {
        locations = [];
      }
    }

    return new Response(
      JSON.stringify({
        storeDomain: SHOPIFY_STORE_DOMAIN || null,
        hasAdminToken,
        hasWebhookSecret,
        shop,
        locations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("shopify-config-check error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
