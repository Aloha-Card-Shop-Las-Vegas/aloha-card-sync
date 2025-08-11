import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import BarcodeLabel from "@/components/BarcodeLabel";
import { supabase } from "@/integrations/supabase/client";

type CardItem = {
  title: string;
  set: string;
  player?: string;
  year?: string;
  grade?: string;
  psaCert?: string;
  price?: string;
  lot?: string;
  sku?: string;
  brandTitle?: string;
  subject?: string;
  category?: string;
  variant?: string;
  cardNumber?: string;
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
  lot: "",
  sku: "",
  brandTitle: "",
  subject: "",
  category: "",
  variant: "",
  cardNumber: "",
});
  const [batch, setBatch] = useState<CardItem[]>([]);

  const addToBatch = () => {
    if (!item.title || !item.set) {
      toast.error("Please fill Title and Set");
      return;
    }
    const next = { ...item, sku: item.sku || item.psaCert || `${Date.now()}` };
    setBatch((b) => [next, ...b]);
    toast.success("Added to batch");
  };

const clearForm = () => setItem({
  title: "",
  set: "",
  player: "",
  year: "",
  grade: "",
  psaCert: "",
  price: "",
  lot: "",
  sku: "",
  brandTitle: "",
  subject: "",
  category: "",
  variant: "",
  cardNumber: "",
});

  const fetchPsa = async () => {
    const cert = (item.sku || item.psaCert || "").trim();
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
        title: d.title || d.cardName || prev.title,
        set: d.set || prev.set,
        player: d.player || prev.player,
        year: d.year || prev.year,
        grade: d.grade || prev.grade,
        psaCert: d.cert || d.certNumber || prev.psaCert,
        sku: prev.sku || d.cert || d.certNumber || prev.psaCert,
        brandTitle: d.brandTitle || prev.brandTitle,
        subject: d.subject || prev.subject,
        category: d.category || d.game || prev.category,
        variant: d.variant || d.varietyPedigree || prev.variant,
        cardNumber: d.cardNumber || prev.cardNumber,
      }));
      toast.success("PSA details fetched");
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch PSA details");
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
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 pb-24">
        <section className="grid md:grid-cols-2 gap-6 -mt-8">
          <Card className="shadow-aloha">
            <CardHeader>
              <CardTitle>Quick Intake</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title / Card Name</Label>
                  <Input id="title" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} placeholder="e.g., 1999 Charizard" />
                </div>
                <div>
                  <Label htmlFor="set">Card Set</Label>
                  <Input id="set" value={item.set} onChange={(e) => setItem({ ...item, set: e.target.value })} placeholder="e.g., Base Set" />
                </div>
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
                  <Label htmlFor="player">Player</Label>
                  <Input id="player" value={item.player} onChange={(e) => setItem({ ...item, player: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" value={item.year} onChange={(e) => setItem({ ...item, year: e.target.value })} placeholder="e.g., 1999" />
                </div>
                <div>
                  <Label htmlFor="grade">Condition / Grade</Label>
                  <Input id="grade" value={item.grade} onChange={(e) => setItem({ ...item, grade: e.target.value })} placeholder="e.g., GEM MT 10" />
                </div>
                <div>
                  <Label htmlFor="psa">PSA Cert Number</Label>
                  <Input id="psa" value={item.psaCert} onChange={(e) => setItem({ ...item, psaCert: e.target.value })} placeholder="e.g., 12345678" />
                </div>
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} placeholder="$" />
                </div>
                <div>
                  <Label htmlFor="lot">Lot Number</Label>
                  <Input id="lot" value={item.lot} onChange={(e) => setItem({ ...item, lot: e.target.value })} placeholder="e.g., LOT-2025-01" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="sku">SKU (defaults to PSA)</Label>
                  <Input id="sku" value={item.sku} onChange={(e) => setItem({ ...item, sku: e.target.value })} placeholder="Unique identifier used for barcode" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={addToBatch}>Add to Batch</Button>
                <Button variant="secondary" onClick={clearForm}>Clear</Button>
                <Button variant="outline" onClick={fetchPsa}>Fetch PSA Details</Button>
              </div>
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">Barcode Preview</p>
                <div className="rounded-md border p-4">
                  <BarcodeLabel value={item.sku || item.psaCert || "SAMPLE-12345"} label={item.title || "Sample Card"} />
                </div>
              </div>
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
              <CardTitle>Batch Queue ({batch.length})</CardTitle>
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
                        <TableHead>Price</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell>{b.title}</TableCell>
                          <TableCell>{b.set}</TableCell>
                          <TableCell>{b.grade}</TableCell>
                          <TableCell>{b.psaCert}</TableCell>
                          <TableCell>{b.lot}</TableCell>
                          <TableCell>{b.price}</TableCell>
                          <TableCell>{b.sku}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>
                              <Button size="sm" onClick={() => toast.info("Will push to Shopify after setup")}>Push</Button>
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

