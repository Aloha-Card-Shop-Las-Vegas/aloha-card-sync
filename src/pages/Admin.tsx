import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { StoreSelector } from "@/components/StoreSelector";
import { UserAssignmentManager } from "@/components/UserAssignmentManager";

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

  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [mappings, setMappings] = useState<any[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any[]>([]);

  const loadStatus = async () => {
    if (!selectedStore) return;
    
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-config-check", {
        body: { storeKey: selectedStore }
      });
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

  const loadMappings = async () => {
    setLoadingMappings(true);
    try {
      // Get recent intake items with their Shopify mapping data
      const { data: intakeData, error: intakeError } = await supabase
        .from("intake_items")
        .select("id, lot_number, sku, shopify_product_id, shopify_variant_id, shopify_inventory_item_id, pushed_at, brand_title, price, quantity")
        .not("shopify_product_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);
      
      if (intakeError) throw intakeError;
      
      // Get product sync status
      const { data: syncData, error: syncError } = await supabase
        .from("product_sync_status")
        .select("*")
        .order("last_sync_at", { ascending: false })
        .limit(10);
      
      if (syncError) throw syncError;
      
      setMappings(intakeData || []);
      setSyncStatus(syncData || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load mappings");
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      loadStatus();
      loadRecent();
      loadMappings();
    }
  }, [selectedStore]);

  const handlePush = async (id: string) => {
    if (!selectedStore) {
      toast.error("Please select a store first");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("shopify-import", { 
        body: { itemId: id, storeKey: selectedStore } 
      });
      if (error) throw error;
      toast.success("Imported to Shopify");
      loadRecent();
    } catch (e) {
      console.error(e);
      toast.error("Push failed");
    }
  };

  const handleWebhookTest = async () => {
    if (!selectedStore) {
      toast.error("Please select a store first");
      return;
    }
    
    if (!sku || !qty) {
      toast.info("Enter SKU and Qty");
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke("shopify-webhook-test", { 
        body: { sku, quantity: qty, storeKey: selectedStore } 
      });
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
            <p className="text-muted-foreground mt-2">Verify Shopify setup, push tests, and manage user assignments.</p>
          </div>
          <div className="flex gap-2 items-center">
            <StoreSelector 
              selectedStore={selectedStore} 
              onStoreChange={setSelectedStore} 
            />
            <Link to="/"><Button variant="secondary">Back</Button></Link>
            <Link to="/shopify-mapping"><Button variant="outline">Shopify Mapping</Button></Link>
            <Button variant="outline" onClick={() => { loadStatus(); loadRecent(); loadMappings(); }}>Refresh</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="diagnostics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            <TabsTrigger value="assignments">User Assignments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="diagnostics" className="space-y-6">
            {!selectedStore && (
              <Card className="shadow-aloha">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">Please select a store to view diagnostics.</p>
                </CardContent>
              </Card>
            )}
            
            {selectedStore && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-aloha">
                  <CardHeader><CardTitle>Shopify Configuration</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>Store: <span className="font-medium">{selectedStore}</span></div>
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
                    <p className="mt-3 text-xs text-muted-foreground">Sends a signed orders/create payload to our webhook. On success, the matching item's Qty will decrement.</p>
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

                <Card className="shadow-aloha lg:col-span-2">
                  <CardHeader><CardTitle>Shopify Product Mappings</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lot #</TableHead>
                            <TableHead>Brand/Title</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Shopify Product ID</TableHead>
                            <TableHead>Variant ID</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Pushed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappings.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">{item.lot_number}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{item.brand_title || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{item.sku || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{item.shopify_product_id || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{item.shopify_variant_id || "—"}</TableCell>
                              <TableCell>{item.price ? `$${Number(item.price).toLocaleString()}` : "—"}</TableCell>
                              <TableCell>{item.quantity || 0}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  item.pushed_at 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {item.pushed_at ? 'Yes' : 'No'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                          {mappings.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                {loadingMappings ? "Loading mappings..." : "No Shopify mappings found"}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-aloha lg:col-span-2">
                  <CardHeader><CardTitle>Product Sync Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product ID</TableHead>
                            <TableHead>Shopify ID</TableHead>
                            <TableHead>Sync Status</TableHead>
                            <TableHead>Last Sync</TableHead>
                            <TableHead>Error Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncStatus.map((sync) => (
                            <TableRow key={sync.id}>
                              <TableCell className="font-mono text-xs">{sync.product_id || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{sync.shopify_id || "—"}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  sync.sync_status === 'completed' 
                                    ? 'bg-green-100 text-green-800'
                                    : sync.sync_status === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {sync.sync_status || 'pending'}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">
                                {sync.last_sync_at 
                                  ? new Date(sync.last_sync_at).toLocaleString()
                                  : "Never"
                                }
                              </TableCell>
                              <TableCell className="max-w-[300px] truncate text-xs text-red-600">
                                {sync.error_message || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          {syncStatus.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                {loadingMappings ? "Loading sync status..." : "No sync records found"}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="assignments" className="space-y-6">
            <UserAssignmentManager selectedStore={selectedStore} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
