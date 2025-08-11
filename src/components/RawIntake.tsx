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
  sku?: string;
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
    sku: "",
  });
  const [search, setSearch] = useState("");
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
    const run = async () => {
      try {
        setLoading(true);
        const q = (search || "").trim();
        let query: any;
        if (!q || q.length < 2) {
          // Show the 5 most recent trade-ins when query is empty/short
          query = (supabase as any)
            .from("trade_ins")
            .select("name,set,set_code,card_number,price_each,sku,condition,language,created_at")
            .order("created_at", { ascending: false })
            .limit(5);
        } else {
          // Multi-field search across name, set, set_code, card_number, and sku
          query = (supabase as any)
            .from("trade_ins")
            .select("name,set,set_code,card_number,price_each,sku,condition,language,created_at")
            .or(`name.ilike.%${q}%,set.ilike.%${q}%,set_code.ilike.%${q}%,card_number.ilike.%${q}%,sku.ilike.%${q}%`)
            .order("created_at", { ascending: false })
            .limit(5);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!active) return;
        setSuggestions(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [search]);

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
      sku: form.sku || autoSku,
      // product_id left null for now
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
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Charizard" />
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
          <Input id="condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g., Near Mint" />
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
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" value={form.sku || autoSku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={autoSku} />
        </div>
      </div>

      <div className="mt-4">
        <Label>Search existing (top 5)</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, set, set code, #, or SKU" />
        {loading ? (
          <div className="text-sm text-muted-foreground mt-2">Searching…</div>
        ) : suggestions.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {suggestions.map((s, i) => (
              <li key={`${s.sku || s.name}-${i}`} className="flex items-center justify-between gap-3 border rounded-md p-2">
                <div className="text-sm">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-muted-foreground">{[s.set_code, s.card_number, s.condition].filter(Boolean).join(" • ")}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => applySuggestion(s)}>Use</Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground mt-2">No suggestions</div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={save}>Save</Button>
        <Button variant="secondary" onClick={() => setForm((f) => ({ ...f, name: "", price_each: "", quantity: 1, sku: autoSku }))}>Clear</Button>
      </div>
    </div>
  );
}
