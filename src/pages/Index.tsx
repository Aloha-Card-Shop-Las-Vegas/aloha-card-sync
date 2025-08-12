import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import RawIntake from "@/components/RawIntake";
import { Link } from "react-router-dom";

type CardItem = {
  title: string;
  set: string;
  player?: string;
  year?: string;
  grade?: string;
  psaCert?: string;
  price?: string;
  cost?: string;
  lot?: string;
  sku?: string;
  brandTitle?: string;
  subject?: string;
  category?: string;
  variant?: string;
  labelType?: string;
  cardNumber?: string;
  id?: string;
  printedAt?: string | null;
  pushedAt?: string | null;
};

const Index = () => {
  const [item, setItem] = useState<CardItem>({
    title: "",
    set: "",
    player: "",
    year: "",
    grade: "",
    psaCert: "",
    price: "",
    cost: "",
    lot: "",
    sku: "",
    brandTitle: "",
    subject: "",
    category: "",
    variant: "",
    labelType: "",
    cardNumber: "",
  });
  const [batch, setBatch] = useState<CardItem[]>([]);
  const [lookupCert, setLookupCert] = useState("");
  const [intakeMode, setIntakeMode] = useState<'graded' | 'raw'>("graded");

  // New UI state for bulk actions
  const [printingAll, setPrintingAll] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);
  const [pushPrintAllRunning, setPushPrintAllRunning] = useState(false);

  // Build a display title similar to PSA fetch formatting
  const buildTitleFromParts = (
    year?: string | null,
    brandTitle?: string | null,
    cardNumber?: string | null,
    subject?: string | null,
    variant?: string | null
  ) => {
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
  };

  // Load existing items from DB so batch persists
  useEffect(() => {
    const loadBatch = async () => {
      console.log("Loading intake items from DB");
      const { data, error } = await supabase
        .from("intake_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load intake_items", error);
        toast.error("Failed to load existing batch");
        return;
      }

      const mapped: CardItem[] =
        (data || []).map((row: any) => ({
          title: buildTitleFromParts(row.year, row.brand_title, row.card_number, row.subject, row.variant),
          set: "",
          year: row.year || "",
          grade: row.grade || "",
          psaCert: row.psa_cert || "",
          price: row?.price != null ? String(row.price) : "",
          cost: row?.cost != null ? String(row.cost) : "",
          lot: row.lot_number || "",
          sku: row.sku || "",
          brandTitle: row.brand_title || "",
          subject: row.subject || "",
          category: row.category || "",
          variant: row.variant || "",
          cardNumber: row.card_number || "",
          id: row.id,
          printedAt: row.printed_at || null,
          pushedAt: row.pushed_at || null,
        })) || [];

      // Only show items that have not been pushed yet in the queue
      setBatch(mapped.filter((m) => !m.pushedAt));
    };

    loadBatch();
  }, []);

  const addToBatch = async () => {
    if (!item.psaCert) {
      toast.error("Please fill Cert Number");
      return;
    }

    const insertPayload = {
      year: item.year || null,
      brand_title: item.brandTitle || null,
      subject: item.subject || null,
      category: item.category || null,
      variant: item.variant || null,
      card_number: item.cardNumber || null,
      grade: item.grade || null,
      psa_cert: item.psaCert || null,
      price: item.price ? Number(item.price) : null,
      cost: item.cost ? Number(item.cost) : null,
      sku: item.sku || item.psaCert || null,
    };

    try {
      const { data, error } = await supabase
        .from("intake_items")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) throw error;

      const next: CardItem = {
        title:
          buildTitleFromParts(
            data?.year,
            data?.brand_title,
            data?.card_number,
            data?.subject,
            data?.variant
          ) || item.title,
        set: item.set || "",
        player: item.player || "",
        year: data?.year || "",
        grade: data?.grade || "",
        psaCert: data?.psa_cert || "",
        price: data?.price != null ? String(data.price) : "",
        cost: data?.cost != null ? String(data.cost) : "",
        lot: data?.lot_number || "",
        sku: data?.sku || "",
        brandTitle: data?.brand_title || "",
        subject: data?.subject || "",
        category: data?.category || "",
        variant: data?.variant || "",
        labelType: item.labelType || "",
        cardNumber: data?.card_number || "",
        id: data?.id,
        printedAt: data?.printed_at || null,
        pushedAt: data?.pushed_at || null,
      };

      setBatch((b) => [next, ...b]);
      toast.success(`Added to batch (Lot ${next.lot})`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save item");
    }
  };

  const clearForm = () =>
    setItem({
      title: "",
      set: "",
      player: "",
      year: "",
      grade: "",
      psaCert: "",
      price: "",
      cost: "",
      lot: "",
      sku: "",
      brandTitle: "",
      subject: "",
      category: "",
      variant: "",
      labelType: "",
      cardNumber: "",
    });

  const fetchPsa = async (overrideCert?: string) => {
    const cert = (overrideCert || item.psaCert || item.sku || "").trim();
    if (!cert) {
      toast.error("Enter PSA number in SKU or PSA Cert");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("psa-scrape", { body: { cert } });
      if (error) throw error;
      const d: any = data;
      if (!d?.ok) throw new Error(d?.error || "Unknown PSA error");
      setItem((prev) => ({
        ...prev,
        title: [d.year || prev.year, (d.brandTitle || prev.brandTitle || "").replace(/&amp;/g, "&"), (d.cardNumber || prev.cardNumber) ? `#${String(d.cardNumber || prev.cardNumber).replace(/^#/, "")}` : undefined, (d.subject || prev.subject || "").replace(/&amp;/g, "&"), (d.variant || d.varietyPedigree || prev.variant || "").replace(/&amp;/g, "&")].filter(Boolean).join(" ").trim(),
        set: d.set || prev.set,
        player: d.player || prev.player,
        year: d.year || prev.year,
        grade: d.grade || prev.grade,
        psaCert: d.cert || d.certNumber || prev.psaCert,
        sku: prev.sku || d.cert || d.certNumber || prev.psaCert,
        brandTitle: (d.brandTitle || prev.brandTitle || "").replace(/&amp;/g, "&"),
        subject: (d.subject || prev.subject || "").replace(/&amp;/g, "&"),
        category: (d.category || d.game || prev.category || "").replace(/&amp;/g, "&"),
        variant: (d.variant || d.varietyPedigree || prev.variant || "").replace(/&amp;/g, "&"),
        labelType: d.labelType || prev.labelType,
        cardNumber: d.cardNumber || prev.cardNumber,
      }));
      toast.success("PSA details fetched");
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch PSA details");
    }
  };

  // Helpers to mark items printed/pushed in DB and update UI
  const markPrinted = async (ids: string[]) => {
    if (ids.length === 0) return;
    console.log("Marking printed for ids:", ids);
    const { data, error } = await supabase
      .from("intake_items")
      .update({ printed_at: new Date().toISOString() })
      .in("id", ids)
      .select("id, printed_at");

    if (error) {
      console.error("Failed to mark printed:", error);
      throw error;
    }

    const printedIds = new Set((data || []).map((d: any) => d.id));
    setBatch((prev) =>
      prev.map((b) => (b.id && printedIds.has(b.id) ? { ...b, printedAt: new Date().toISOString() } : b))
    );
  };

  const markPushed = async (ids: string[]) => {
    if (ids.length === 0) return;
    console.log("Marking pushed for ids:", ids);
    const { data, error } = await supabase
      .from("intake_items")
      .update({ pushed_at: new Date().toISOString() })
      .in("id", ids)
      .select("id, pushed_at");

    if (error) {
      console.error("Failed to mark pushed:", error);
      throw error;
    }

    const pushedIds = new Set((data || []).map((d: any) => d.id));
    setBatch((prev) => prev.filter((b) => !(b.id && pushedIds.has(b.id))));
  };

  // Row actions
  const handlePrintRow = async (b: CardItem) => {
    if (!b.id) return;
    try {
      await markPrinted([b.id]);
      window.print();
      toast.success(`Printed label for Lot ${b.lot || ""}`);
    } catch {
      toast.error("Failed to print");
    }
  };

  const handlePushRow = async (b: CardItem) => {
    if (!b.id) return;
    try {
      await markPushed([b.id]);
      toast.success(`Pushed Lot ${b.lot || ""} to Shopify`);
    } catch {
      toast.error("Failed to push");
    }
  };

  // Bulk actions
  const handlePrintAll = async () => {
    const ids = batch.map((b) => b.id!).filter(Boolean);
    if (ids.length === 0) {
      toast.info("Nothing to print");
      return;
    }
    setPrintingAll(true);
    try {
      await markPrinted(ids);
      window.print();
      toast.success("Printed all labels");
    } catch {
      toast.error("Failed to print all");
    } finally {
      setPrintingAll(false);
    }
  };

  const handlePushAll = async () => {
    const ids = batch.map((b) => b.id!).filter(Boolean);
    if (ids.length === 0) {
      toast.info("Nothing to push");
      return;
    }
    setPushingAll(true);
    try {
      await markPushed(ids);
      toast.success("Pushed all to Shopify");
    } catch {
      toast.error("Failed to push all");
    } finally {
      setPushingAll(false);
    }
  };

  const handlePushAndPrintAll = async () => {
    const ids = batch.map((b) => b.id!).filter(Boolean);
    if (ids.length === 0) {
      toast.info("Nothing to process");
      return;
    }
    setPushPrintAllRunning(true);
    try {
      await markPushed(ids); // Remove from queue only after push succeeds
      await markPrinted(ids); // Mark printed for those items as well
      window.print();
      toast.success("Pushed and printed all");
    } catch {
      toast.error("Failed to push and print all");
    } finally {
      setPushPrintAllRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-aloha-gradient" aria-hidden="true" />
        <div className="container relative mx-auto px-6 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Aloha Card Inventory Manager</h1>
            <p className="mt-4 text-lg text-muted-foreground">Centralize PSA-graded cards, batch intake with lot tracking, print barcodes, and sync to Shopify.</p>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => toast.info("Connect Supabase to enable login & sync")}>Get Started</Button>
              <Button variant="secondary" onClick={() => window.scrollTo({ top: 9999, behavior: 'smooth' })}>View Batch</Button>
              <Link to="/inventory"><Button variant="outline">View Inventory</Button></Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 pb-24">
        <section className="grid md:grid-cols-2 gap-6 -mt-8">
          <Card className="shadow-aloha">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Quick Intake</CardTitle>
                <ToggleGroup
                  type="single"
                  value={intakeMode}
                  onValueChange={(v) => v && setIntakeMode(v as 'graded' | 'raw')}
                  aria-label="Select intake mode"
                >
                  <ToggleGroupItem value="graded" aria-label="Graded">Graded</ToggleGroupItem>
                  <ToggleGroupItem value="raw" aria-label="Raw">Raw</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent>
              {intakeMode === 'graded' ? (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-4">
                    <Input
                      id="psa-lookup"
                      value={lookupCert}
                      onChange={(e) => setLookupCert(e.target.value)}
                      placeholder="Enter PSA Cert # to fetch details"
                    />
                    <Button variant="outline" onClick={() => fetchPsa(lookupCert)}>Fetch PSA</Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="brandTitle">Brand / Title / Game</Label>
                      <Input id="brandTitle" value={item.brandTitle || ""} onChange={(e) => setItem({ ...item, brandTitle: e.target.value })} placeholder="e.g., POKEMON JAPANESE SWORD & SHIELD..." />
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input id="subject" value={item.subject || ""} onChange={(e) => setItem({ ...item, subject: e.target.value })} placeholder="e.g., FA/GENGAR VMAX" />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Input id="category" value={item.category || ""} onChange={(e) => setItem({ ...item, category: e.target.value })} placeholder="e.g., TCG Cards" />
                    </div>
                    <div>
                      <Label htmlFor="variant">Variant</Label>
                      <Input id="variant" value={item.variant || ""} onChange={(e) => setItem({ ...item, variant: e.target.value })} placeholder="e.g., GENGAR VMAX HIGH-CLS.DK." />
                    </div>
                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input id="cardNumber" value={item.cardNumber || ""} onChange={(e) => setItem({ ...item, cardNumber: e.target.value })} placeholder="e.g., 020" />
                    </div>
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" value={item.year} onChange={(e) => setItem({ ...item, year: e.target.value })} placeholder="e.g., 1999" />
                    </div>
                    <div>
                      <Label htmlFor="grade">Item Grade</Label>
                      <Input id="grade" value={item.grade} onChange={(e) => setItem({ ...item, grade: e.target.value })} placeholder="e.g., GEM MT 10" />
                    </div>
                    <div>
                      <Label htmlFor="psa">Cert Number</Label>
                      <Input id="psa" value={item.psaCert} onChange={(e) => setItem({ ...item, psaCert: e.target.value })} placeholder="e.g., 12345678" />
                    </div>
                    <div>
                      <Label htmlFor="cost">Cost</Label>
                      <Input id="cost" value={item.cost} onChange={(e) => setItem({ ...item, cost: e.target.value })} placeholder="$" />
                    </div>
                    <div>
                      <Label htmlFor="price">Price</Label>
                      <Input id="price" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} placeholder="$" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Lot number is assigned automatically when you add to batch.
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={addToBatch}>Add to Batch</Button>
                    <Button variant="secondary" onClick={clearForm}>Clear</Button>
                  </div>
                </>
              ) : (
                <RawIntake />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-aloha">
            <CardHeader>
              <CardTitle>Shopify Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Push selected cards to Shopify and keep them in sync.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => toast.info("Connect Supabase to enable Shopify sync")}>Push Selected</Button>
                <Button variant="secondary" onClick={() => toast.info("Batch upload requires connection")}>Batch Upload</Button>
                <Button variant="outline" onClick={() => toast.info("Sync will be enabled after setup")}>Sync Now</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <Card className="shadow-aloha">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Batch Queue ({batch.length})</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handlePrintAll} disabled={printingAll || batch.length === 0}>
                    {printingAll ? "Printing…" : "Print All"}
                  </Button>
                  <Button variant="outline" onClick={handlePushAll} disabled={pushingAll || batch.length === 0}>
                    {pushingAll ? "Pushing…" : "Push All"}
                  </Button>
                  <Button onClick={handlePushAndPrintAll} disabled={pushPrintAllRunning || batch.length === 0}>
                    {pushPrintAllRunning ? "Processing…" : "Push & Print All"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {batch.length === 0 ? (
                <p className="text-muted-foreground">No items yet. Add cards via Quick Intake.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Set</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>PSA</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.map((b, i) => (
                        <TableRow key={b.id || i}>
                          <TableCell>{b.title}</TableCell>
                          <TableCell>{b.set}</TableCell>
                          <TableCell>{b.grade}</TableCell>
                          <TableCell>{b.psaCert}</TableCell>
                          <TableCell>{b.lot}</TableCell>
                          <TableCell>{b.cost}</TableCell>
                          <TableCell>{b.price}</TableCell>
                          <TableCell>{b.sku}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant={b.printedAt ? "secondary" : "default"}
                                onClick={() => handlePrintRow(b)}
                                disabled={!!b.printedAt}
                              >
                                {b.printedAt ? "Printed" : "Print"}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePushRow(b)}
                              >
                                Push
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;
