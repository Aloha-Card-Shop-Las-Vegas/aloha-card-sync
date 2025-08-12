import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

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

export default function Admin() {
  useSEO({ title: "Admin Diagnostics | Aloha", description: "Test Shopify config, imports, and webhook updates." });

  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-config-check");
      if (error) throw error;
      setStatus(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load config status");
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadRecent = async () => {
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase
        .from("intake_items")
        .select("id, lot_number, sku, quantity, price, pushed_at, deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setRecent(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadRecent();
  }, []);

  const handlePush = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("shopify-import", { body: { itemId: id } });
      if (error) throw error;
      toast.success("Imported to Shopify");
      loadRecent();
    } catch (e) {
      console.error(e);
      toast.error("Push failed");
    }
  };

  const handleWebhookTest = async () => {
    if (!sku || !qty) {
      toast.info("Enter SKU and Qty");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("shopify-webhook-test", { body: { sku, quantity: qty } });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Webhook test sent; inventory should update");
      } else {
        toast.error(data?.error || "Webhook test failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Webhook test failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-8 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Admin Diagnostics</h1>
            <p className="text-muted-foreground mt-2">Verify Shopify setup, push tests, and send webhook self-tests.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/"><Button variant="secondary">Back</Button></Link>
            <Button variant="outline" onClick={() => { loadStatus(); loadRecent(); }}>Refresh</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-aloha">
          <CardHeader><CardTitle>Shopify Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>Store domain: <span className="font-medium">{status?.storeDomain || "—"}</span></div>
              <div>Admin token: <span className="font-medium">{status?.hasAdminToken ? "SET" : "MISSING"}</span></div>
              <div>Webhook secret: <span className="font-medium">{status?.hasWebhookSecret ? "SET" : "MISSING"}</span></div>
              <div>Shopify API: <span className="font-medium">{status?.shop?.name ? `OK (${status.shop.name})` : "Not Connected"}</span></div>
              <div>Locations: <span className="font-medium">{status?.locations?.length ?? 0}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={loadStatus} disabled={loadingStatus}>{loadingStatus ? "Checking…" : "Recheck"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-aloha">
          <CardHeader><CardTitle>Webhook Self-Test</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Enter SKU" />
              </div>
              <div>
                <Label htmlFor="qty">Quantity (sold)</Label>
                <Input id="qty" type="number" value={String(qty)} onChange={(e) => setQty(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleWebhookTest}>Send Webhook Test</Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Sends a signed orders/create payload to our webhook. On success, the matching item’s Qty will decrement.</p>
          </CardContent>
        </Card>

        <Card className="shadow-aloha lg:col-span-2">
          <CardHeader><CardTitle>Recent Intake Items</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Pushed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.lot_number}</TableCell>
                      <TableCell>{r.sku || "—"}</TableCell>
                      <TableCell>{r.quantity ?? 1}</TableCell>
                      <TableCell>{r.price != null ? `$${Number(r.price).toLocaleString()}` : "—"}</TableCell>
                      <TableCell>{r.pushed_at ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handlePush(r.id)}>Push to Shopify</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recent.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">{loadingRecent ? "Loading…" : "No items"}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
