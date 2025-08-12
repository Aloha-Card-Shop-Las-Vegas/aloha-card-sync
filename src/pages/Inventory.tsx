import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

// Simple SEO helpers without extra deps
function useSEO(opts: { title: string; description?: string; canonical?: string }) {
  useEffect(() => {
    document.title = opts.title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", opts.description || "");
    else if (opts.description) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = opts.description;
      document.head.appendChild(m);
    }

    const linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const href = opts.canonical || window.location.href;
    if (linkCanonical) linkCanonical.href = href;
    else {
      const l = document.createElement("link");
      l.rel = "canonical";
      l.href = href;
      document.head.appendChild(l);
    }
  }, [opts.title, opts.description, opts.canonical]);
}

// Helper to build a human title similar to the intake page
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

const pageSize = 20;

type ItemRow = {
  id: string;
  lot_number: string;
  created_at: string;
  updated_at: string;
  price: number | null;
  cost: number | null;
  printed_at: string | null;
  pushed_at: string | null;
  year: string | null;
  brand_title: string | null;
  subject: string | null;
  category: string | null;
  variant: string | null;
  card_number: string | null;
  grade: string | null;
  psa_cert: string | null;
  sku: string | null;
};

export default function Inventory() {
  useSEO({
    title: "Card Inventory | Aloha",
    description: "View all cards in inventory with lot numbers, IDs, status, price, and more.",
  });

  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [printed, setPrinted] = useState<"all" | "printed" | "unprinted">("all");
  const [pushed, setPushed] = useState<"all" | "pushed" | "unpushed">("all");
  const [sortKey, setSortKey] = useState<keyof ItemRow>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("intake_items")
          .select("*", { count: "exact" })
          .order(sortKey as string, { ascending: sortAsc });

        if (search.trim()) {
          const term = `%${search.trim()}%`;
          query = query.or(
            [
              `brand_title.ilike.${term}`,
              `subject.ilike.${term}`,
              `category.ilike.${term}`,
              `variant.ilike.${term}`,
              `card_number.ilike.${term}`,
              `year.ilike.${term}`,
              `psa_cert.ilike.${term}`,
              `sku.ilike.${term}`,
              `lot_number.ilike.${term}`,
              `grade.ilike.${term}`,
            ].join(",")
          );
        }

        if (printed === "printed") query = query.not("printed_at", "is", null);
        if (printed === "unprinted") query = query.is("printed_at", null);
        if (pushed === "pushed") query = query.not("pushed_at", "is", null);
        if (pushed === "unpushed") query = query.is("pushed_at", null);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await query.range(from, to);
        if (error) throw error;
        setItems((data as ItemRow[]) || []);
        setTotal(count || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, search, printed, pushed, sortKey, sortAsc]);

  const toggleSort = (key: keyof ItemRow) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Card Inventory</h1>
              <p className="text-muted-foreground mt-2">Search and manage all items that have been added to your queue.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/">
                <Button variant="secondary">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card className="shadow-aloha">
          <CardHeader>
            <CardTitle>Inventory List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  placeholder="Search title, SKU, lot, cert, etc."
                />
              </div>
              <div>
                <Label>Status: Printed</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={printed === "all" ? "default" : "outline"}
                    onClick={() => {
                      setPage(1);
                      setPrinted("all");
                    }}
                  >
                    All
                  </Button>
                  <Button
                    variant={printed === "printed" ? "default" : "outline"}
                    onClick={() => {
                      setPage(1);
                      setPrinted("printed");
                    }}
                  >
                    Printed
                  </Button>
                  <Button
                    variant={printed === "unprinted" ? "default" : "outline"}
                    onClick={() => {
                      setPage(1);
                      setPrinted("unprinted");
                    }}
                  >
                    Unprinted
                  </Button>
                </div>
              </div>
              <div>
                <Label>Status: Pushed</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={pushed === "all" ? "default" : "outline"}
                    onClick={() => {
                      setPage(1);
                      setPushed("all");
                    }}
                  >
                    All
                  </Button>
                  <Button
                    variant={pushed === "pushed" ? "default" : "outline"}
                    onClick={() => {
                      setPage(1);
                      setPushed("pushed");
                    }}
                  >
                    Pushed
                  </Button>
                  <Button
                    variant={pushed === "unpushed" ? "default" : "outline"}
                    onClick={() => {
                      setPage(1);
                      setPushed("unpushed");
                    }}
                  >
                    Unpushed
                  </Button>
                </div>
              </div>
              <div>
                <Label>Sort</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button variant="outline" onClick={() => toggleSort("created_at")}>Date {sortKey === "created_at" ? (sortAsc ? "↑" : "↓") : ""}</Button>
                  <Button variant="outline" onClick={() => toggleSort("price")}>Price {sortKey === "price" ? (sortAsc ? "↑" : "↓") : ""}</Button>
                  <Button variant="outline" onClick={() => toggleSort("cost")}>Cost {sortKey === "cost" ? (sortAsc ? "↑" : "↓") : ""}</Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>UUID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Printed</TableHead>
                    <TableHead>Pushed</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const title = buildTitleFromParts(it.year, it.brand_title, it.card_number, it.subject, it.variant);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.lot_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{it.id}</TableCell>
                        <TableCell>{title || "—"}</TableCell>
                        <TableCell>{it.sku || "—"}</TableCell>
                        <TableCell>{it.price != null ? `$${Number(it.price).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>{it.cost != null ? `$${Number(it.cost).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          {it.printed_at ? <Badge variant="secondary">Printed</Badge> : <Badge>Unprinted</Badge>}
                        </TableCell>
                        <TableCell>
                          {it.pushed_at ? <Badge variant="secondary">Pushed</Badge> : <Badge>Unpushed</Badge>}
                        </TableCell>
                        <TableCell>{new Date(it.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        {loading ? "Loading…" : "No items found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages} • {total.toLocaleString()} items
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
