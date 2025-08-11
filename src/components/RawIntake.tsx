import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RawTradeInForm {
  game: string;
  name: string;
  set?: string;
  set_code?: string;
  card_number?: string;
  condition?: string;
  language?: string;
  printing?: string;
  rarity?: string;
  quantity: number;
  price_each?: string; // keep as string for input; convert on save
  cost_each?: string; // keep as string for input; convert on save
  sku?: string;
  product_id?: number;
}

const gameAbbr = (g: string) => {
  const key = g.toLowerCase();
  if (key.includes("pok")) return "PKM";
  if (key.includes("magic") || key.includes("mtg")) return "MTG";
  if (key.includes("yugi")) return "YGO";
  if (key.includes("sport")) return "SPT";
  return "GEN";
};

export default function RawIntake() {
  const [form, setForm] = useState<RawTradeInForm>({
    game: "Pokémon",
    name: "",
    set: "",
    set_code: "",
    card_number: "",
    condition: "Near Mint",
    language: "English",
    printing: "Unlimited",
    rarity: "",
    quantity: 1,
    price_each: "",
    cost_each: "",
    sku: "",
    product_id: undefined,
  });
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const autoSku = useMemo(() => {
    const ab = gameAbbr(form.game);
    const setc = (form.set_code || "GEN").toUpperCase();
    const no = (form.card_number || "NA").toUpperCase();
    return `${ab}-${setc}-${no}`;
  }, [form.game, form.set_code, form.card_number]);

  useEffect(() => {
    if (!form.sku) {
      setForm((f) => ({ ...f, sku: autoSku }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSku]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      const rawName = (form.name || "").trim();
      const inputCard = (form.card_number || "").trim();

      if (rawName.length < 2) {
        if (active) setSuggestions([]);
        return;
      }

      setLoading(true);

      // Parse trailing number token from name (e.g., "Charizard 4/102")
      const trailingTokenMatch = rawName.match(/(?:^|\s)(\d{1,3}(?:\s*\/\s*\d{1,3})?)$/);
      const trailingCard = trailingTokenMatch ? trailingTokenMatch[1].replace(/\s*/g, "") : "";
      const baseName = trailingCard ? rawName.slice(0, rawName.length - trailingTokenMatch[0].length).trim() : rawName;
      const cardToUse = inputCard || trailingCard;

      try {
        const { data: products, error } = await (supabase as any)
          .from("products")
          .select("id,name,group_id,tcgcsv_data")
          .ilike("name", `%${baseName || rawName}%`)
          .limit(15);
        if (error) throw error;

        const groupIds = Array.from(new Set((products || []).map((p: any) => p.group_id).filter(Boolean)));
        let groupsMap: Record<string, string> = {};
        if (groupIds.length) {
          const { data: groups, error: gerr } = await (supabase as any)
            .from("groups")
            .select("id,name")
            .in("id", groupIds);
          if (!gerr && groups) {
            groupsMap = Object.fromEntries(groups.map((g: any) => [String(g.id), g.name]));
          }
        }

        const norm = (v: string) => {
          if (!v) return "";
          const s = String(v).trim().toUpperCase().replace(/\s+/g, "");
          const parts = s.split("/");
          return parts.map((p) => p.replace(/^0+/, "") || "0").join(parts.length > 1 ? "/" : "");
        };

        const getExt = (tcg: any, key: string) => {
          try {
            if (tcg?.extendedData && Array.isArray(tcg.extendedData)) {
              const found = tcg.extendedData.find((e: any) => String(e.name || "").toLowerCase() === key.toLowerCase());
              if (found?.value != null) return String(found.value);
            }
            if (tcg && typeof tcg === "object") {
              for (const k of Object.keys(tcg)) {
                if (k.toLowerCase() === key.toLowerCase()) return String((tcg as any)[k]);
              }
            }
          } catch {}
          return "";
        };

        let built = (products || []).map((p: any) => {
          const cn = getExt(p.tcgcsv_data, "Number");
          const rarity = getExt(p.tcgcsv_data, "Rarity");
          return {
            source: "product",
            product_id: p.id,
            name: p.name,
            set: groupsMap[String(p.group_id)] || "",
            card_number: cn,
            rarity,
          };
        });

        if (cardToUse) {
          const target = norm(cardToUse);
          const targetHasSlash = /\//.test(cardToUse);
          built = built.filter((s: any) => {
            const sNorm = norm(s.card_number);
            if (!sNorm) return false;
            if (targetHasSlash) return sNorm === target;
            const sNum = sNorm.split("/")[0];
            return sNorm === target || sNum === target || sNorm.startsWith(target + "/");
          });
        }

        built = built.slice(0, 5);

        if (active) setSuggestions(built);
      } catch (e) {
        console.error(e);
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [form.name, form.card_number]);

  // Auto-fill card number from trailing token in name if empty
  useEffect(() => {
    const rawName = (form.name || "").trim();
    if (!rawName || form.card_number) return;
    const m = rawName.match(/(?:^|\s)(\d{1,3}(?:\s*\/\s*\d{1,3})?)$/);
    if (m) {
      const value = m[1].replace(/\s*/g, "");
      setForm((f) => ({ ...f, card_number: value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  const applySuggestion = (s: any) => {
    setForm((f) => ({
      ...f,
      name: s.name || f.name,
      set: s.set || f.set,
      set_code: s.set_code || f.set_code,
      card_number: s.card_number || f.card_number,
      condition: s.condition || f.condition,
      language: s.language || f.language,
      price_each: s.price_each != null ? String(s.price_each) : f.price_each,
      sku: s.sku || f.sku,
      product_id: s.product_id ?? f.product_id,
    }));
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      set: form.set || null,
      set_code: form.set_code || null,
      card_number: form.card_number || null,
      condition: form.condition || null,
      language: form.language || null,
      printing: form.printing || null,
      rarity: form.rarity || null,
      quantity: form.quantity || 1,
      price_each: form.price_each ? Number(form.price_each) : null,
      cost_each: form.cost_each ? Number(form.cost_each) : null,
      sku: form.sku || autoSku,
      product_id: form.product_id || null,
    } as const;

    try {
      const { error } = await (supabase as any).from("trade_ins").insert(payload);
      if (error) throw error;
      toast.success("Raw trade-in saved");
      setForm((f) => ({ ...f, name: "", price_each: "", quantity: 1, sku: autoSku }));
    } catch (e) {
      console.error(e);
      toast.error("Failed to save raw trade-in");
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Game</Label>
          <Select value={form.game} onValueChange={(v) => setForm((f) => ({ ...f, game: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select game" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="Pokémon">Pokémon</SelectItem>
              <SelectItem value="Magic: The Gathering">Magic: The Gathering</SelectItem>
              <SelectItem value="Yu-Gi-Oh!">Yu-Gi-Oh!</SelectItem>
              <SelectItem value="Sports">Sports</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Type to search products (e.g., Charizard or Charizard 4/102)" />
        </div>
        <div>
          <Label htmlFor="set">Set</Label>
          <Input id="set" value={form.set} onChange={(e) => setForm({ ...form, set: e.target.value })} placeholder="e.g., Base Set" />
        </div>
        <div>
          <Label htmlFor="set_code">Set Code</Label>
          <Input id="set_code" value={form.set_code} onChange={(e) => setForm({ ...form, set_code: e.target.value })} placeholder="e.g., BS" />
        </div>
        <div>
          <Label htmlFor="card_number">Card #</Label>
          <Input id="card_number" value={form.card_number} onChange={(e) => setForm({ ...form, card_number: e.target.value })} placeholder="e.g., 4/102" />
        </div>
        <div>
          <Label htmlFor="condition">Condition</Label>
          <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="Near Mint">Near Mint (NM)</SelectItem>
              <SelectItem value="Lightly Played">Lightly Played (LP)</SelectItem>
              <SelectItem value="Moderately Played">Moderately Played (MP)</SelectItem>
              <SelectItem value="Heavily Played">Heavily Played (HP)</SelectItem>
              <SelectItem value="Damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="printing">Printing</Label>
          <Select value={form.printing} onValueChange={(v) => setForm({ ...form, printing: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select print" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="Unlimited">Unlimited</SelectItem>
              <SelectItem value="1st Edition">1st Edition</SelectItem>
              <SelectItem value="Shadowless">Shadowless</SelectItem>
              <SelectItem value="Holo">Holo</SelectItem>
              <SelectItem value="Reverse Holo">Reverse Holo</SelectItem>
              <SelectItem value="Non-Holo">Non-Holo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="language">Language</Label>
          <Input id="language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="e.g., English" />
        </div>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value || 1) })} />
        </div>
        <div>
          <Label htmlFor="price_each">Price Each</Label>
          <Input id="price_each" value={form.price_each} onChange={(e) => setForm({ ...form, price_each: e.target.value })} placeholder="$" />
        </div>
        <div>
          <Label htmlFor="cost_each">Cost Each</Label>
          <Input id="cost_each" value={form.cost_each} onChange={(e) => setForm({ ...form, cost_each: e.target.value })} placeholder="$" />
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" value={form.sku || autoSku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={autoSku} />
        </div>
      </div>

      <div className="mt-4">
        <Label>Suggestions</Label>
        {loading ? (
          <div className="text-sm text-muted-foreground mt-2">Searching…</div>
        ) : suggestions.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {suggestions.map((s, i) => (
              <li key={`${s.product_id || s.name}-${i}`} className="flex items-center justify-between gap-3 border rounded-md p-2">
                <div className="text-sm">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-muted-foreground">{[s.set, s.card_number, s.rarity].filter(Boolean).join(" • ")}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => applySuggestion(s)}>Use</Button>
              </li>
            ))}
          </ul>
        ) : ((form.name || '').trim().length >= 2 ? (
          <div className="text-sm text-muted-foreground mt-2">No matches. Try refining the name or add a card # (e.g., 4/102).</div>
        ) : (
          <div className="text-sm text-muted-foreground mt-2">Type at least 2 characters in Name to search products</div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={save}>Save</Button>
        <Button variant="secondary" onClick={() => setForm((f) => ({ ...f, name: "", price_each: "", cost_each: "", quantity: 1, sku: autoSku, product_id: undefined }))}>Clear</Button>
      </div>
    </div>
  );
}
