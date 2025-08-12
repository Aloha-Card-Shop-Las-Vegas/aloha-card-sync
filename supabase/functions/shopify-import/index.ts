import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildTitleFromParts(
  year?: string | null,
  brandTitle?: string | null,
  cardNumber?: string | null,
  subject?: string | null,
  variant?: string | null
) {
  return [
    year,
    (brandTitle || "").replace(/&amp;/g, "&"),
    cardNumber ? `#${String(cardNumber).replace(/^#/, "")}` : undefined,
    (subject || "").replace(/&amp;/g, "&"),
    (variant || "").replace(/&amp;/g, "&"),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHOPIFY_STORE_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN")!; // e.g. mystore.myshopify.com
    const SHOPIFY_ADMIN_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN")!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase environment not configured");
    }
    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
      throw new Error("Shopify environment not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { itemId } = await req.json();
    if (!itemId) throw new Error("Missing itemId");

    // Load the intake item
    const { data: item, error: itemErr } = await supabase
      .from("intake_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr) throw itemErr;
    if (!item) throw new Error("Item not found");

    const title = buildTitleFromParts(item.year, item.brand_title, item.card_number, item.subject, item.variant) || item.sku || item.lot_number;
    const price = item.price != null ? Number(item.price) : 0;
    const sku = item.sku || item.psa_cert || item.lot_number;
    const quantity = item.quantity ?? 1;

    // Helper: Shopify REST Admin API request
    const api = async (path: string, init?: RequestInit) => {
      const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07${path}`;
      const res = await fetch(url, {
        ...init,
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_ACCESS_TOKEN,
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify ${path} ${res.status}: ${text}`);
      }
      return res.json();
    };

    // Helper: Shopify GraphQL Admin API request
    const gql = async (query: string, variables?: Record<string, unknown>) => {
      const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors || json)}`);
      }
      return json.data;
    };

    const gidToId = (gid: string | null | undefined) => gid ? gid.split("/").pop() || "" : "";

    let productId = item.shopify_product_id as string | null;
    let variantId = item.shopify_variant_id as string | null;
    let inventoryItemId = item.shopify_inventory_item_id as string | null;

    // If we don't have IDs yet, try to find an existing variant by SKU via GraphQL
    if (!(variantId && productId && inventoryItemId)) {
      try {
        const data = await gql(
          `query($q: String!) {\n            productVariants(first: 1, query: $q) {\n              edges { node { id product { id } inventoryItem { id } } }\n            }\n          }`,
          { q: `sku:\"${String(sku).replace(/"/g, '\\"')}\"` }
        );
        const edge = data?.productVariants?.edges?.[0];
        if (edge?.node) {
          productId = gidToId(edge.node.product?.id);
          variantId = gidToId(edge.node.id);
          inventoryItemId = gidToId(edge.node.inventoryItem?.id);
          // Persist Shopify IDs for future updates
          await supabase
            .from("intake_items")
            .update({
              shopify_product_id: productId,
              shopify_variant_id: variantId,
              shopify_inventory_item_id: inventoryItemId,
            })
            .eq("id", itemId);
        }
      } catch (e) {
        console.warn("SKU lookup via GraphQL failed; will create product", e);
      }
    }

    if (variantId && productId && inventoryItemId) {
      // Update existing variant price and SKU if changed
      await api(`/variants/${variantId}.json`, {
        method: "PUT",
        body: JSON.stringify({ variant: { id: Number(variantId), price: String(price), sku } }),
      });
    } else {
      // Create product + variant
      const created = await api(`/products.json`, {
        method: "POST",
        body: JSON.stringify({
          product: {
            title,
            status: "active",
            tags: [item.category, item.grade, item.year].filter(Boolean).join(", "),
            product_type: item.category || undefined,
            variants: [
              {
                price: String(price ?? 0),
                sku,
                inventory_management: "shopify",
                requires_shipping: true,
              },
            ],
          },
        }),
      });

      const prod = created.product;
      const variant = prod.variants?.[0];
      productId = String(prod.id);
      variantId = String(variant.id);
      inventoryItemId = String(variant.inventory_item_id);

      // Persist Shopify IDs
      await supabase
        .from("intake_items")
        .update({
          shopify_product_id: productId,
          shopify_variant_id: variantId,
          shopify_inventory_item_id: inventoryItemId,
        })
        .eq("id", itemId);
    }

    // Ensure we have a location to set inventory
    const locs = await api(`/locations.json`);
    const locationId = String(locs.locations?.[0]?.id);
    if (!locationId) throw new Error("No Shopify locations found");

    // Set inventory to our quantity
    await api(`/inventory_levels/set.json`, {
      method: "POST",
      body: JSON.stringify({
        location_id: Number(locationId),
        inventory_item_id: Number(inventoryItemId!),
        available: Number(quantity ?? 1),
      }),
    });

    // Mark as pushed
    const { error: upErr } = await supabase
      .from("intake_items")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", itemId);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ ok: true, productId, variantId, inventoryItemId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("shopify-import error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
