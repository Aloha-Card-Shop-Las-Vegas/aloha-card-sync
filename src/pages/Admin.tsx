import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { StoreSelector } from "@/components/StoreSelector";
import { UserAssignmentManager } from "@/components/UserAssignmentManager";
import { Navigation } from "@/components/Navigation";

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
  useSEO({ title: "Admin Dashboard | Aloha", description: "Manage Shopify configurations, user roles, and system diagnostics." });

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
  
  // User management state
  const [users, setUsers] = useState<Array<{ id: string; email: string | null; roles: string[] }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [email, setEmail] = useState("");
  
  // Secrets management state
  const [secrets, setSecrets] = useState<{[key: string]: boolean}>({});
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  
  // API Keys management state
  const [apiKeys, setApiKeys] = useState<Array<{
    id: string;
    key_name: string;
    key_value: string;
    description: string;
    category: string;
  }>>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValues, setKeyValues] = useState<{[key: string]: string}>({});
  
  // Dialog state for save confirmation
  const [saveDialog, setSaveDialog] = useState<{
    open: boolean;
    success: boolean;
    message: string;
    keyName?: string;
  }>({
    open: false,
    success: false,
    message: '',
  });

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

  // User management functions
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke("roles-admin", { body: { action: "list" } });
      if (error) throw error;
      const d: any = data;
      if (!d?.ok) throw new Error(d?.error || "Failed to load users");
      setUsers(d.users || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleRole = async (u: { email: string | null }, role: "admin" | "staff", grant: boolean) => {
    if (!u.email) {
      toast.error("User has no email");
      return;
    }
    try {
      const action = grant ? "grant" : "revoke";
      const { data, error } = await supabase.functions.invoke("roles-admin", { body: { action, email: u.email, role } });
      if (error) throw error;
      const d: any = data;
      if (!d?.ok) throw new Error(d?.error || "Failed");
      toast.success(grant ? `Granted ${role}` : `Revoked ${role}`);
      loadUsers();
    } catch (e) {
      console.error(e);
      toast.error("Operation failed");
    }
  };

  // API Keys management functions
  const loadApiKeys = async () => {
    setLoadingApiKeys(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true })
        .order('key_name', { ascending: true });
      
      if (error) throw error;
      setApiKeys(data || []);
      
      // Initialize keyValues with current values
      const values: {[key: string]: string} = {};
      (data || []).forEach(item => {
        values[item.key_name] = item.key_value || '';
      });
      setKeyValues(values);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load API keys');
    } finally {
      setLoadingApiKeys(false);
    }
  };

  // Get store-specific settings
  const getStoreSettings = (storeKey: string) => {
    const prefix = `SHOPIFY_${storeKey.toUpperCase()}_`;
    return apiKeys.filter(setting => setting.key_name.startsWith(prefix));
  };

  const updateApiKey = async (keyName: string, newValue: string) => {
    try {
      // Check if the key already exists
      const existingKey = apiKeys.find(k => k.key_name === keyName);
      
      if (existingKey) {
        // Update existing key
        const { error } = await supabase
          .from('system_settings')
          .update({ key_value: newValue, updated_at: new Date().toISOString() })
          .eq('key_name', keyName);
        
        if (error) throw error;
      } else {
        // Insert new key
        const { error } = await supabase
          .from('system_settings')
          .insert({
            key_name: keyName,
            key_value: newValue,
            category: keyName.startsWith('SHOPIFY_') ? 'shopify' : 'general',
            description: getKeyDescription(keyName),
            is_encrypted: true
          });
        
        if (error) throw error;
      }
      
      // Show success dialog
      setSaveDialog({
        open: true,
        success: true,
        message: `${getStoreFromKeyName(keyName)} settings saved successfully!`,
        keyName
      });
      
      setEditingKey(null);
      loadApiKeys();
    } catch (e) {
      console.error(e);
      // Show error dialog
      setSaveDialog({
        open: true,
        success: false,
        message: `Failed to save ${getStoreFromKeyName(keyName)} settings. Please try again.`,
        keyName
      });
    }
  };

  const getStoreFromKeyName = (keyName: string): string => {
    if (keyName.includes('LAS_VEGAS')) return 'Las Vegas Store';
    if (keyName.includes('HAWAII')) return 'Hawaii Store';
    return 'Store';
  };

  const getKeyDescription = (keyName: string): string => {
    if (keyName.includes('DOMAIN')) return 'Shopify store domain';
    if (keyName.includes('ACCESS_TOKEN')) return 'Shopify admin access token';
    if (keyName.includes('API_KEY')) return 'Shopify API key';
    if (keyName.includes('API_SECRET')) return 'Shopify API secret';
    if (keyName.includes('WEBHOOK_SECRET')) return 'Shopify webhook secret';
    return 'API configuration value';
  };

  const handleKeyEdit = (keyName: string) => {
    setEditingKey(keyName);
  };

  const handleKeySave = (keyName: string) => {
    const newValue = keyValues[keyName] || '';
    updateApiKey(keyName, newValue);
  };

  const handleKeyCancel = () => {
    setEditingKey(null);
    // Reset to original values
    loadApiKeys();
  };

  // Check admin status
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) return;
      setTimeout(async () => {
        const uid = session.user.id;
        const admin = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any });
        setIsAdmin(Boolean(admin.data));
      }, 0);
    }).data.subscription;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setTimeout(async () => {
          const uid = session.user!.id;
          const admin = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any });
          setIsAdmin(Boolean(admin.data));
        }, 0);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadStatus();
      loadRecent();
      loadMappings();
    }
    loadUsers();
    loadApiKeys();
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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage Shopify configurations, user roles, and system diagnostics.</p>
          </div>
          <div className="flex items-center gap-4">
            <StoreSelector 
              selectedStore={selectedStore} 
              onStoreChange={setSelectedStore} 
            />
            <Navigation />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs defaultValue="diagnostics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="diagnostics">Shopify Diagnostics</TabsTrigger>
            <TabsTrigger value="secrets">Shopify Configuration</TabsTrigger>
            <TabsTrigger value="apikeys">API Keys</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
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
          
          <TabsContent value="secrets" className="space-y-6">
            {!isAdmin ? (
              <Card className="shadow-aloha">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">You must be an admin to manage Shopify configurations.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Las Vegas Store Configuration */}
                <Card className="shadow-aloha">
                  <CardHeader>
                    <CardTitle>Las Vegas Store Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: 'SHOPIFY_LAS_VEGAS_STORE_DOMAIN', label: 'Store Domain', placeholder: 'lasvegas-store.myshopify.com', description: 'Your Las Vegas Shopify store domain' },
                      { key: 'SHOPIFY_LAS_VEGAS_ACCESS_TOKEN', label: 'Admin Access Token', placeholder: 'shpat_...', description: 'Private app access token for Las Vegas store', isPassword: true },
                      { key: 'SHOPIFY_LAS_VEGAS_API_KEY', label: 'API Key', placeholder: 'API Key', description: 'Public app API key for Las Vegas store', isPassword: true },
                      { key: 'SHOPIFY_LAS_VEGAS_API_SECRET', label: 'API Secret', placeholder: 'API Secret', description: 'Private app API secret for Las Vegas store', isPassword: true },
                      { key: 'SHOPIFY_LAS_VEGAS_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'Webhook Secret', description: 'Webhook signing secret for Las Vegas store', isPassword: true }
                    ].map((field) => {
                      const existingKey = apiKeys.find(k => k.key_name === field.key);
                      const isEditing = editingKey === field.key;
                      
                      return (
                        <div key={field.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>{field.label}</Label>
                            <div className="flex gap-2">
                              {isEditing ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleKeySave(field.key)}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={handleKeyCancel}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleKeyEdit(field.key)}
                                >
                                  {existingKey ? 'Edit' : 'Add'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <Input
                              type={field.isPassword ? "password" : "text"}
                              value={keyValues[field.key] || ''}
                              onChange={(e) => setKeyValues(prev => ({
                                ...prev,
                                [field.key]: e.target.value
                              }))}
                              placeholder={field.placeholder}
                            />
                          ) : (
                            <Input 
                              type={field.isPassword ? "password" : "text"}
                              value={existingKey?.key_value ? '••••••••••••••••' : ''}
                              placeholder={existingKey?.key_value ? `${field.label} is configured` : `${field.label} not set`}
                              disabled 
                            />
                          )}
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Hawaii Store Configuration */}
                <Card className="shadow-aloha">
                  <CardHeader>
                    <CardTitle>Hawaii Store Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: 'SHOPIFY_HAWAII_STORE_DOMAIN', label: 'Store Domain', placeholder: 'hawaii-store.myshopify.com', description: 'Your Hawaii Shopify store domain' },
                      { key: 'SHOPIFY_HAWAII_ACCESS_TOKEN', label: 'Admin Access Token', placeholder: 'shpat_...', description: 'Private app access token for Hawaii store', isPassword: true },
                      { key: 'SHOPIFY_HAWAII_API_KEY', label: 'API Key', placeholder: 'API Key', description: 'Public app API key for Hawaii store', isPassword: true },
                      { key: 'SHOPIFY_HAWAII_API_SECRET', label: 'API Secret', placeholder: 'API Secret', description: 'Private app API secret for Hawaii store', isPassword: true },
                      { key: 'SHOPIFY_HAWAII_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'Webhook Secret', description: 'Webhook signing secret for Hawaii store', isPassword: true }
                    ].map((field) => {
                      const existingKey = apiKeys.find(k => k.key_name === field.key);
                      const isEditing = editingKey === field.key;
                      
                      return (
                        <div key={field.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>{field.label}</Label>
                            <div className="flex gap-2">
                              {isEditing ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleKeySave(field.key)}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={handleKeyCancel}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleKeyEdit(field.key)}
                                >
                                  {existingKey ? 'Edit' : 'Add'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <Input
                              type={field.isPassword ? "password" : "text"}
                              value={keyValues[field.key] || ''}
                              onChange={(e) => setKeyValues(prev => ({
                                ...prev,
                                [field.key]: e.target.value
                              }))}
                              placeholder={field.placeholder}
                            />
                          ) : (
                            <Input 
                              type={field.isPassword ? "password" : "text"}
                              value={existingKey?.key_value ? '••••••••••••••••' : ''}
                              placeholder={existingKey?.key_value ? `${field.label} is configured` : `${field.label} not set`}
                              disabled 
                            />
                          )}
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="apikeys" className="space-y-6">
            {!isAdmin ? (
              <Card className="shadow-aloha">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">You must be an admin to view API key management.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="shadow-aloha">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>API Keys & System Settings</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={loadApiKeys} 
                      disabled={loadingApiKeys}
                    >
                      {loadingApiKeys ? "Loading…" : "Refresh"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* PrintNode Settings */}
                      {(() => {
                        const printingKeys = apiKeys.filter(key => key.category === 'printing');
                        if (printingKeys.length === 0) return null;
                        
                        return (
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                              PrintNode Settings
                            </h4>
                            <div className="space-y-3">
                              {printingKeys.map((apiKey) => (
                                <div key={apiKey.id} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <Label className="font-medium">{apiKey.key_name}</Label>
                                      <p className="text-xs text-muted-foreground">{apiKey.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      {editingKey === apiKey.key_name ? (
                                        <>
                                          <Button 
                                            size="sm" 
                                            onClick={() => handleKeySave(apiKey.key_name)}
                                          >
                                            Save
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={handleKeyCancel}
                                          >
                                            Cancel
                                          </Button>
                                        </>
                                      ) : (
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={() => handleKeyEdit(apiKey.key_name)}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {editingKey === apiKey.key_name ? (
                                      <Input
                                        type="password"
                                        value={keyValues[apiKey.key_name] || ''}
                                        onChange={(e) => setKeyValues(prev => ({
                                          ...prev,
                                          [apiKey.key_name]: e.target.value
                                        }))}
                                        placeholder="Enter API key value..."
                                        className="font-mono"
                                      />
                                    ) : (
                                      <Input
                                        type="password"
                                        value={apiKey.key_value ? '••••••••••••••••' : ''}
                                        disabled
                                        placeholder={apiKey.key_value ? 'API key is set' : 'No API key set'}
                                        className="font-mono"
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Las Vegas Store Settings */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                          Las Vegas Store Settings
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: 'SHOPIFY_STORE_DOMAIN_LASVEGAS', label: 'Store Domain', description: 'Las Vegas Shopify store domain (e.g., lasvegas-store.myshopify.com)' },
                            { key: 'SHOPIFY_ADMIN_ACCESS_TOKEN_LASVEGAS', label: 'Admin Access Token', description: 'Private app access token for Las Vegas store' },
                            { key: 'SHOPIFY_API_KEY_LASVEGAS', label: 'API Key', description: 'Public app API key for Las Vegas store' },
                            { key: 'SHOPIFY_API_SECRET_LASVEGAS', label: 'API Secret', description: 'Private app API secret for Las Vegas store' },
                            { key: 'SHOPIFY_WEBHOOK_SECRET_LASVEGAS', label: 'Webhook Secret', description: 'Webhook signing secret for Las Vegas store' }
                          ].map((field) => {
                            const existingKey = apiKeys.find(k => k.key_name === field.key);
                            const isEditing = editingKey === field.key;
                            
                            return (
                              <div key={field.key} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <Label className="font-medium">{field.label}</Label>
                                    <p className="text-xs text-muted-foreground">{field.description}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    {isEditing ? (
                                      <>
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleKeySave(field.key)}
                                        >
                                          Save
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={handleKeyCancel}
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    ) : (
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleKeyEdit(field.key)}
                                      >
                                        {existingKey ? 'Edit' : 'Add'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {isEditing ? (
                                    <Input
                                      type={field.key.includes('DOMAIN') ? "text" : "password"}
                                      value={keyValues[field.key] || ''}
                                      onChange={(e) => setKeyValues(prev => ({
                                        ...prev,
                                        [field.key]: e.target.value
                                      }))}
                                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                                      className="font-mono"
                                    />
                                  ) : (
                                    <Input
                                      type={field.key.includes('DOMAIN') ? "text" : "password"}
                                      value={existingKey?.key_value ? (field.key.includes('DOMAIN') ? existingKey.key_value : '••••••••••••••••') : ''}
                                      disabled
                                      placeholder={existingKey?.key_value ? `${field.label} is set` : `No ${field.label.toLowerCase()} set`}
                                      className="font-mono"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hawaii Store Settings */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                          Hawaii Store Settings
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: 'SHOPIFY_STORE_DOMAIN_HAWAII', label: 'Store Domain', description: 'Hawaii Shopify store domain (e.g., hawaii-store.myshopify.com)' },
                            { key: 'SHOPIFY_ADMIN_ACCESS_TOKEN_HAWAII', label: 'Admin Access Token', description: 'Private app access token for Hawaii store' },
                            { key: 'SHOPIFY_API_KEY_HAWAII', label: 'API Key', description: 'Public app API key for Hawaii store' },
                            { key: 'SHOPIFY_API_SECRET_HAWAII', label: 'API Secret', description: 'Private app API secret for Hawaii store' },
                            { key: 'SHOPIFY_WEBHOOK_SECRET_HAWAII', label: 'Webhook Secret', description: 'Webhook signing secret for Hawaii store' }
                          ].map((field) => {
                            const existingKey = apiKeys.find(k => k.key_name === field.key);
                            const isEditing = editingKey === field.key;
                            
                            return (
                              <div key={field.key} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <Label className="font-medium">{field.label}</Label>
                                    <p className="text-xs text-muted-foreground">{field.description}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    {isEditing ? (
                                      <>
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleKeySave(field.key)}
                                        >
                                          Save
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={handleKeyCancel}
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    ) : (
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleKeyEdit(field.key)}
                                      >
                                        {existingKey ? 'Edit' : 'Add'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {isEditing ? (
                                    <Input
                                      type={field.key.includes('DOMAIN') ? "text" : "password"}
                                      value={keyValues[field.key] || ''}
                                      onChange={(e) => setKeyValues(prev => ({
                                        ...prev,
                                        [field.key]: e.target.value
                                      }))}
                                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                                      className="font-mono"
                                    />
                                  ) : (
                                    <Input
                                      type={field.key.includes('DOMAIN') ? "text" : "password"}
                                      value={existingKey?.key_value ? (field.key.includes('DOMAIN') ? existingKey.key_value : '••••••••••••••••') : ''}
                                      disabled
                                      placeholder={existingKey?.key_value ? `${field.label} is set` : `No ${field.label.toLowerCase()} set`}
                                      className="font-mono"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* External Services */}
                      {(() => {
                        const externalKeys = apiKeys.filter(key => key.category === 'external');
                        if (externalKeys.length === 0) return null;
                        
                        return (
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                              External Services
                            </h4>
                            <div className="space-y-3">
                              {externalKeys.map((apiKey) => (
                                <div key={apiKey.id} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <Label className="font-medium">{apiKey.key_name}</Label>
                                      <p className="text-xs text-muted-foreground">{apiKey.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      {editingKey === apiKey.key_name ? (
                                        <>
                                          <Button 
                                            size="sm" 
                                            onClick={() => handleKeySave(apiKey.key_name)}
                                          >
                                            Save
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={handleKeyCancel}
                                          >
                                            Cancel
                                          </Button>
                                        </>
                                      ) : (
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={() => handleKeyEdit(apiKey.key_name)}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {editingKey === apiKey.key_name ? (
                                      <Input
                                        type="password"
                                        value={keyValues[apiKey.key_name] || ''}
                                        onChange={(e) => setKeyValues(prev => ({
                                          ...prev,
                                          [apiKey.key_name]: e.target.value
                                        }))}
                                        placeholder="Enter API key value..."
                                        className="font-mono"
                                      />
                                    ) : (
                                      <Input
                                        type="password"
                                        value={apiKey.key_value ? '••••••••••••••••' : ''}
                                        disabled
                                        placeholder={apiKey.key_value ? 'API key is set' : 'No API key set'}
                                        className="font-mono"
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {apiKeys.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          {loadingApiKeys ? "Loading API keys..." : "No API keys found"}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-aloha">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <h3 className="text-lg font-medium">Multi-Store API Management</h3>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>Configure separate API credentials for your Las Vegas and Hawaii stores.</p>
                        <p>Each store needs its own set of Shopify API credentials with location-specific suffixes.</p>
                        <p>Edge functions will automatically use the correct credentials based on the selected store.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="users" className="space-y-6">
            {!isAdmin ? (
              <Card className="shadow-aloha">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">You must be an admin to view user management.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="shadow-aloha">
                  <CardHeader>
                    <CardTitle>Grant Role by Email</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="user@example.com" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                      />
                      <Button 
                        onClick={() => toggleRole({ email }, "staff", true)} 
                        disabled={!email}
                      >
                        Grant Staff
                      </Button>
                      <Button 
                        variant="secondary" 
                        onClick={() => toggleRole({ email }, "admin", true)} 
                        disabled={!email}
                      >
                        Grant Admin
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      User must exist (sign up first). Use revoke buttons in the table to remove roles.
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-aloha">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Users</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={loadUsers} 
                      disabled={loadingUsers}
                    >
                      {loadingUsers ? "Loading…" : "Refresh"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">
                                {u.email || <span className="text-muted-foreground">(no email)</span>}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2 flex-wrap">
                                  {(u.roles || []).map((r) => (
                                    <Badge key={r} variant="secondary">{r}</Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end flex-wrap">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => toggleRole(u, "staff", true)} 
                                    disabled={!u.email || (u.roles || []).includes("staff")}
                                  >
                                    Grant Staff
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => toggleRole(u, "admin", true)} 
                                    disabled={!u.email || (u.roles || []).includes("admin")}
                                  >
                                    Grant Admin
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => toggleRole(u, "staff", false)} 
                                    disabled={!u.email || !(u.roles || []).includes("staff")}
                                  >
                                    Revoke Staff
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => toggleRole(u, "admin", false)} 
                                    disabled={!u.email || !(u.roles || []).includes("admin")}
                                  >
                                    Revoke Admin
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {users.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                {loadingUsers ? "Loading users..." : "No users found"}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="assignments" className="space-y-6">
            <UserAssignmentManager selectedStore={selectedStore} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Save confirmation dialog */}
      <AlertDialog open={saveDialog.open} onOpenChange={(open) => setSaveDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={saveDialog.success ? "text-green-600" : "text-red-600"}>
              {saveDialog.success ? "✅ Settings Saved!" : "❌ Save Failed"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {saveDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSaveDialog(prev => ({ ...prev, open: false }))}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
