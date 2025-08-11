import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extract(html: string, regex: RegExp): string | undefined {
  const m = html.match(regex);
  return m?.[1]?.trim();
}

function safeJsonLd(html: string): any | null {
  try {
    const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;
    const txt = m[1].trim();
    return JSON.parse(txt);
  } catch (_) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cert } = await req.json();
    if (!cert) {
      return new Response(JSON.stringify({ ok: false, error: "Missing cert" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://www.psacard.com/cert/${encodeURIComponent(cert)}/psa`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml",
      },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `PSA request failed (${resp.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await resp.text();

    // Try JSON-LD first
    const ld = safeJsonLd(html);
    let title: string | undefined;
    let player: string | undefined;
    let setName: string | undefined;
    let year: string | undefined;
    let grade: string | undefined;

    if (ld) {
      // Heuristics — PSA pages sometimes include a name/description
      title = ld.name || ld.headline || ld.title;
      const desc: string | undefined = ld.description;
      if (desc) {
        const yearM = desc.match(/\b(19|20)\d{2}\b/);
        if (yearM) year = yearM[0];
        const gradeM = desc.match(/PSA\s*([0-9]+(?:\.[0-9])?)/i);
        if (gradeM) grade = `PSA ${gradeM[1]}`;
      }
    }

    // Fallbacks: scrape common table labels on the Cert page
    grade = grade || extract(html, />\s*Grade\s*<[^>]*>[\s\S]*?<[^>]*>\s*([^<]{1,40})\s*</i) || extract(html, /PSA\s*([0-9]+(?:\.[0-9])?)/i);
    year = year || extract(html, />\s*Year\s*<[^>]*>[\s\S]*?<[^>]*>\s*(\d{4})\s*</i) || extract(html, /(19|20)\d{2}/);
    setName = setName || extract(html, />\s*Set\s*<[^>]*>[\s\S]*?<[^>]*>\s*([^<]{1,120})\s*</i);
    player = player || extract(html, />\s*(Player|Card\s*Name)\s*<[^>]*>[\s\S]*?<[^>]*>\s*([^<]{1,120})\s*</i);

    // Title: prefer explicit title, else build a sensible default
    title = title || extract(html, /<title>\s*([^<]+?)\s*<\/title>/i);
    if (!title) {
      const parts = [year, player, setName].filter(Boolean).join(" ");
      title = parts || `PSA Cert ${cert}`;
    }

    const result = {
      ok: true,
      url,
      cert: String(cert),
      title,
      player: player || undefined,
      set: setName || undefined,
      year: year || undefined,
      grade: grade || undefined,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("psa-scrape error", error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message } ), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
