import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import RawIntake from "@/components/RawIntake";
import { Link } from "react-router-dom";
import { cleanupAuthState } from "@/lib/auth";
import PrintPreviewDialog, { PreviewLabelData } from "@/components/PrintPreviewDialog";
import PrintAllPreviewDialog, { BulkPreviewItem } from "@/components/PrintAllPreviewDialog";
import { RolloPrinterStatus } from "@/components/RolloPrinterStatus";
import { LabelData } from "@/lib/labelPdf";
import { PrintService } from "@/lib/printService";

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
  quantity?: number;
  condition?: string;
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
    quantity: 1,
  });
  const [batch, setBatch] = useState<CardItem[]>([]);
  const [lookupCert, setLookupCert] = useState("");
  const [intakeMode, setIntakeMode] = useState<'graded' | 'raw'>("graded");

  // Auto Rollo printer state
  const [currentPrinter, setCurrentPrinter] = useState<{ id: number; name: string } | null>(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [defaultTemplates, setDefaultTemplates] = useState<{graded?: any, raw?: any}>({});

  // Load default templates
  useEffect(() => {
    const loadDefaultTemplates = async () => {
      try {
        const { data: templates } = await supabase
          .from('label_templates')
          .select('*')
          .eq('is_default', true);
        
        if (templates) {
          const templateMap: {graded?: any, raw?: any} = {};
          templates.forEach((template: any) => {
            if (template.template_type === 'graded') {
              templateMap.graded = template;
            } else if (template.template_type === 'raw') {
              templateMap.raw = template;
            }
          });
          setDefaultTemplates(templateMap);
          console.log('Loaded default templates:', templateMap);
        }
      } catch (error) {
        console.error('Failed to load default templates:', error);
      }
    };

    loadDefaultTemplates();
  }, []);

  // New UI state for bulk actions
  const [printingAll, setPrintingAll] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);
  const [pushPrintAllRunning, setPushPrintAllRunning] = useState(false);

  // Hardened printing locks
  const printingIdsRef = useRef<Set<string>>(new Set());
  const jobInFlightRef = useRef(false);
  const [jobInFlight, setJobInFlight] = useState(false);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLabel, setPreviewLabel] = useState<{ title: string; lot: string; price: string; barcode: string; grade?: string } | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  // Bulk preview modal state
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkPreviewItems, setBulkPreviewItems] = useState<BulkPreviewItem[]>([]);
  const [bulkPreviewBusy, setBulkPreviewBusy] = useState(false);

  // Inline edit state for Batch Queue
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editYear, setEditYear] = useState<string>("");
  const [editBrandTitle, setEditBrandTitle] = useState<string>("");
  const [editSubject, setEditSubject] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editVariant, setEditVariant] = useState<string>("");
  const [editCardNumber, setEditCardNumber] = useState<string>("");
  const [editGrade, setEditGrade] = useState<string>("");
  const [editPsaCert, setEditPsaCert] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editCost, setEditCost] = useState<string>("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editSku, setEditSku] = useState<string>("");
  // Details dialog state
  const [detailsItem, setDetailsItem] = useState<CardItem | null>(null);
  // Categories and Games for dropdowns
  const [categories, setCategories] = useState<string[]>([]);
  type GameOption = { id: number; name: string; categoryId: number | null; categoryName: string | null };
  const [games, setGames] = useState<GameOption[]>([]);
  const [editGameId, setEditGameId] = useState<number | null>(null);

  // Lock helpers
  const acquireRowLock = (id: string) => {
    if (!id) return false;
    if (printingIdsRef.current.has(id)) return false;
    printingIdsRef.current.add(id);
    return true;
  };
  
  const releaseRowLock = (id: string) => {
    if (!id) return;
    printingIdsRef.current.delete(id);
  };

  const acquireGlobalLock = () => {
    if (jobInFlightRef.current) return false;
    jobInFlightRef.current = true;
    setJobInFlight(true);
    return true;
  };
  
  const releaseGlobalLock = () => {
    jobInFlightRef.current = false;
    setJobInFlight(false);
  };

  const handleSignOut = async () => {
    try {
      cleanupAuthState();
      try { await supabase.auth.signOut({ scope: 'global' } as any); } catch {}
    } finally {
      window.location.href = '/auth';
    }
  };

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

  const gradeOptions = [
    "",
    "Authentic",
    "PR 1",
    "FR 1.5",
    "GD 2",
    "VG 3",
    "VG-EX 4",
    "EX 5",
    "EX-MT 6",
    "NM 7",
    "NM-MT 8",
    "MINT 9",
    "GEM MT 10",
  ];

  // Initialize Rollo printer auto-resolver
  useEffect(() => {
    // Auto-resolve Rollo printer on startup
    initializeRolloPrinter();

    // Listen for printer refresh requests
    window.addEventListener('custom:refreshPrinter', () => {
      console.log('🔄 Refreshing Rollo printer connection...');
      PrintService.refreshPrinterCache();
      initializeRolloPrinter();
    });

    return () => {
      window.removeEventListener('custom:refreshPrinter', () => {});
    };
  }, []);

  // Initialize Rollo printer auto-resolver
  const initializeRolloPrinter = async () => {
    try {
      console.log('🔍 Initializing auto Rollo printer...');
      const printer = await PrintService.getCurrentPrinter();
      
      if (printer) {
        setCurrentPrinter(printer);
        setPrinterConnected(true);
        console.log(`✅ Rollo printer ready: ${printer.name} (ID: ${printer.id})`);
      } else {
        setCurrentPrinter(null);
        setPrinterConnected(false);
        console.log('❌ No Rollo printer found');
      }
    } catch (error) {
      console.error('Failed to initialize Rollo printer:', error);
      setCurrentPrinter(null);
      setPrinterConnected(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const { data, error } = await supabase
        .from('card_inventory')
        .select(`
          *,
          game:games(name, category:categories(name))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading data:', error);
        return;
      }

      const mapped = data?.map((row: any) => ({
        id: row.id,
        title: row.title || "",
        set: row.set || "",
        player: row.player || "",
        year: row.year?.toString() || "",
        grade: row.grade || "",
        psaCert: row.psa_cert_number || "",
        price: row.price || "",
        lot: row.lot_number || "",
        sku: row.sku || "",
        cost: row.cost || "",
        brandTitle: row.brand_title || "",
        subject: row.subject || "",
        category: row.game?.category?.name || "",
        variant: row.variant || "",
        labelType: row.label_type || "",
        cardNumber: row.card_number || "",
        quantity: row.quantity || 1,
        condition: row.condition || "",
        printedAt: row.printed_at,
        pushedAt: row.pushed_at,
      })) || [];

      // Only show items that have not been pushed yet in the queue
      setBatch(mapped.filter((m) => !m.pushedAt));
    };

    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .order('name');
      
      if (!error && data) {
        setCategories(data.map(c => c.name));
      }
    };

    const loadGames = async () => {
      const { data, error } = await supabase
        .from('games')
        .select(`
          id,
          name,
          category_id,
          category:categories(name)
        `)
        .order('name');
      
      if (!error && data) {
        const gameOptions: GameOption[] = data.map(g => ({
          id: g.id,
          name: g.name,
          categoryId: g.category_id,
          categoryName: g.category?.name || null
        }));
        setGames(gameOptions);
      }
    };

    loadData();
    loadCategories();
    loadGames();
  }, []);

  const markPrinted = async (ids: string[]) => {
    // For demo, just mark items as printed in local state
    setBatch(prev => prev.map(item => 
      ids.includes(item.id || '') 
        ? { ...item, printedAt: new Date().toISOString() }
        : item
    ));
    toast.success(`Marked ${ids.length} items as printed`);
  };

  const onPreviewPrint = async (tspl: string) => {
    if (!previewItemId || !printerConnected) return;
    
    if (!acquireGlobalLock()) return;
    if (!acquireRowLock(previewItemId)) { releaseGlobalLock(); return; }
    
    try {
      // Convert to LabelData and use unified print service
      if (previewLabel) {
        const labelData: LabelData = {
          title: previewLabel.title,
          lot: previewLabel.lot,
          price: previewLabel.price,
          barcode: previewLabel.barcode,
          grade: previewLabel.grade,
          condition: 'Near Mint' // Default condition
        };
        
        const result = await PrintService.printLabel(labelData, {
          title: `Label Print · ${previewLabel.title}`,
          copies: 1
        });
        
        if (result.success) {
          // Mark as printed
          if (previewItemId) {
            await markPrinted([previewItemId]);
          }
          setPreviewOpen(false);
        }
      }
    } catch (e) {
      console.error('Print error:', e);
      toast.error('Print failed');
    } finally {
      releaseGlobalLock();
      releaseRowLock(previewItemId);
    }
  };

  const handlePrintRow = async (b: CardItem) => {
    if (!b.id) return;
    if (!printerConnected) { toast.error('Rollo printer not connected'); return; }

    // Show preview dialog instead of printing directly
    const title = buildTitleFromParts(b.year, b.brandTitle, b.cardNumber, b.subject, b.variant);
    
    try {
      setPreviewLabel({
        title,
        lot: b.lot || '',
        price: b.price || '',
        barcode: b.sku || b.id || 'NO-SKU',
        grade: b.grade || undefined,
      });
      setPreviewItemId(b.id || null);
      setPreviewOpen(true);
    } catch (e) {
      console.error('Preview error:', e);
      toast.error('Failed to open preview');
    }
  };

  const openBulkPreview = async () => {
    if (!printerConnected) {
      toast.error('Rollo printer not connected');
      return;
    }
    
    const items = batch.filter(i => i.id && !i.printedAt);
    if (items.length === 0) {
      toast.info('No unprintable items in batch');
      return;
    }
    
    try {
      const previews: BulkPreviewItem[] = [];
      
      for (const item of items) {
        const title = buildTitleFromParts(item.year, item.brandTitle, item.cardNumber, item.subject, item.variant);
        
        previews.push({
          id: item.id!,
          title,
          lot: item.lot || '',
          price: item.price || '',
          barcode: item.sku || item.id || 'NO-SKU'
        });
      }
      
      setBulkPreviewItems(previews);
      setBulkPreviewOpen(true);
    } catch (e) {
      console.error('Bulk preview error:', e);
      toast.error('Failed to generate bulk preview');
    }
  };

  const printAllFromPreview = async () => {
    if (!printerConnected) { toast.error('Rollo printer not connected'); return; }
    console.log(`🖨️ Starting batch print using unified print service`);
    setBulkPreviewBusy(true);
    
    try {
      // Convert preview items to LabelData format
      const labelDataList: LabelData[] = bulkPreviewItems.map(preview => ({
        title: preview.title,
        lot: preview.lot,
        price: preview.price,
        barcode: preview.barcode,
        grade: '', // Extract grade if available in the future
        condition: 'Near Mint' // Default condition
      }));
      
      // Use unified print service for batch printing
      const result = await PrintService.printBatch(labelDataList, (current, total) => {
        console.log(`📊 Batch progress: ${current}/${total}`);
      });
      
      if (result.successCount > 0) {
        const ids = bulkPreviewItems.map(p => p.id);
        await markPrinted(ids);
        setBulkPreviewOpen(false);
      }
    } catch (e) {
      console.error('Bulk print error:', e);
      toast.error('Failed to print all');
    } finally {
      setBulkPreviewBusy(false);
    }
  };

  const handlePrintAll = async () => {
    if (!printerConnected) { 
      toast.error('Rollo printer not connected'); 
      return; 
    }
    await openBulkPreview();
  };

  const fetchFromPSA = async () => {
    if (!lookupCert.trim()) {
      toast.error("Enter a PSA cert number");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('psa-scrape', {
        body: { certNumber: lookupCert.trim() }
      });

      if (error) throw error;

      if (data.success) {
        const psaData = data.data;
        setItem(prev => ({
          ...prev,
          title: psaData.title || "",
          grade: psaData.grade || "",
          psaCert: lookupCert.trim(),
          brandTitle: psaData.brandTitle || "",
          subject: psaData.subject || "",
          variant: psaData.variant || "",
          cardNumber: psaData.cardNumber || "",
        }));
        toast.success("PSA data loaded");
      } else {
        toast.error(data.error || "Failed to fetch PSA data");
      }
    } catch (error) {
      console.error('PSA fetch error:', error);
      toast.error("Failed to fetch PSA data");
    }
  };

  const generateLotNumber = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_lot_number');
    if (error) {
      console.error('Error generating lot number:', error);
      return `LOT-${Date.now()}`;
    }
    return data;
  };

  const addToBatch = async () => {
    if (!item.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const lotNumber = `LOT-${Date.now()}`;
    
    const newItem: CardItem = {
      id: Date.now().toString(),
      title: item.title,
      set: item.set,
      player: item.player,
      year: item.year,
      grade: item.grade,
      psaCert: item.psaCert,
      price: item.price,
      cost: item.cost,
      lot: lotNumber,
      sku: item.sku,
      brandTitle: item.brandTitle,
      subject: item.subject,
      variant: item.variant,
      cardNumber: item.cardNumber,
      quantity: item.quantity || 1,
      condition: item.condition || "Near Mint",
    };

    setBatch(prev => [newItem, ...prev]);
    
    // Reset form
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
      quantity: 1,
    });
    setLookupCert("");
    
    toast.success("Added to batch");
  };

  const startEditRow = (b: CardItem) => {
    setEditingId(b.id || null);
    setEditYear(b.year || "");
    setEditBrandTitle(b.brandTitle || "");
    setEditSubject(b.subject || "");
    setEditCategory(b.category || "");
    setEditVariant(b.variant || "");
    setEditCardNumber(b.cardNumber || "");
    setEditGrade(b.grade || "");
    setEditPsaCert(b.psaCert || "");
    setEditPrice(b.price || "");
    setEditCost(b.cost || "");
    setEditQty(b.quantity || 1);
    setEditSku(b.sku || "");
    setEditGameId(null);
  };

  const cancelEditRow = () => {
    setEditingId(null);
    setEditYear("");
    setEditBrandTitle("");
    setEditSubject("");
    setEditCategory("");
    setEditVariant("");
    setEditCardNumber("");
    setEditGrade("");
    setEditPsaCert("");
    setEditPrice("");
    setEditCost("");
    setEditQty(1);
    setEditSku("");
    setEditGameId(null);
  };

  const saveEditRow = async (b: CardItem) => {
    if (!b.id) return;
    
    try {
      const { error } = await supabase
        .from('card_inventory')
        .update({
          year: editYear ? parseInt(editYear) : null,
          brand_title: editBrandTitle,
          subject: editSubject,
          variant: editVariant,
          card_number: editCardNumber,
          grade: editGrade,
          psa_cert_number: editPsaCert,
          price: editPrice,
          cost: editCost,
          quantity: editQty,
          sku: editSku,
        })
        .eq('id', b.id);
      
      if (error) throw error;
      
      // Update local state
      setBatch(prev => prev.map(item => 
        item.id === b.id 
          ? {
              ...item,
              year: editYear,
              brandTitle: editBrandTitle,
              subject: editSubject,
              variant: editVariant,
              cardNumber: editCardNumber,
              grade: editGrade,
              psaCert: editPsaCert,
              price: editPrice,
              cost: editCost,
              quantity: editQty,
              sku: editSku,
            }
          : item
      ));
      
      cancelEditRow();
      toast.success("Updated successfully");
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error("Failed to update item");
    }
  };

  const deleteFromBatch = async (id: string) => {
    try {
      const { error } = await supabase
        .from('card_inventory')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setBatch(prev => prev.filter(item => item.id !== id));
      toast.success("Deleted from batch");
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error("Failed to delete item");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-accent-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-primary-100 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Card Intake System
              </h1>
              <div className="text-sm text-muted-foreground">
                Auto Rollo Printer · 2×1 PDF Labels
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSignOut} variant="outline" size="sm">Sign Out</Button>
              <Link to="/inventory"><Button variant="outline">Inventory</Button></Link>
              <Link to="/print-logs"><Button variant="outline">Print Logs</Button></Link>
              <Link to="/admin"><Button variant="outline">Admin</Button></Link>
              <Link to="/users"><Button variant="outline">Users</Button></Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 pb-24">
        <section className="grid md:grid-cols-3 gap-6 -mt-8">
          <RolloPrinterStatus 
            currentPrinter={currentPrinter}
            connected={printerConnected}
            onRefresh={initializeRolloPrinter}
          />
          
          <Card className="shadow-aloha">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Quick Intake</CardTitle>
                <ToggleGroup
                  type="single"
                  value={intakeMode}
                  onValueChange={(v) => v && setIntakeMode(v as 'graded' | 'raw')}
                  className="bg-muted rounded-lg p-1"
                >
                  <ToggleGroupItem value="graded" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    Graded
                  </ToggleGroupItem>
                  <ToggleGroupItem value="raw" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    Raw
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {intakeMode === 'graded' ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="PSA cert number"
                      value={lookupCert}
                      onChange={(e) => setLookupCert(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchFromPSA()}
                    />
                    <Button onClick={fetchFromPSA} size="sm">Lookup</Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" value={item.title} onChange={(e) => setItem({...item, title: e.target.value})} />
                    </div>
                    <div>
                      <Label htmlFor="grade">Grade</Label>
                      <Select value={item.grade} onValueChange={(v) => setItem({...item, grade: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeOptions.map(grade => (
                            <SelectItem key={grade} value={grade}>{grade || "No Grade"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="price">Price</Label>
                      <Input id="price" value={item.price} onChange={(e) => setItem({...item, price: e.target.value})} placeholder="$" />
                    </div>
                    <div>
                      <Label htmlFor="cost">Cost</Label>
                      <Input id="cost" value={item.cost} onChange={(e) => setItem({...item, cost: e.target.value})} placeholder="$" />
                    </div>
                  </div>
                  
                  <Button onClick={addToBatch} className="w-full">Add to Batch</Button>
                </>
              ) : (
                <RawIntake onAddToBatch={(newItem) => {
                  setBatch(prev => [newItem, ...prev]);
                  toast.success("Added to batch");
                }} />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-aloha">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handlePrintAll} 
                disabled={!printerConnected || batch.length === 0}
                className="w-full"
              >
                Print All Labels ({batch.filter(b => !b.printedAt).length})
              </Button>
              
              <div className="text-sm text-muted-foreground">
                {printerConnected ? (
                  <span className="text-green-600">✓ Rollo printer ready</span>
                ) : (
                  <span className="text-red-600">⚠ No printer connected</span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Batch Queue */}
        <section className="mt-8">
          <Card className="shadow-aloha">
            <CardHeader>
              <CardTitle>Batch Queue ({batch.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {batch.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items in batch. Add items using the intake form above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>LOT</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.map((b) => (
                        <TableRow key={b.id}>
                          {editingId === b.id ? (
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-4 bg-muted/30">
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                  <div>
                                    <Label htmlFor={`year-${b.id}`}>Year</Label>
                                    <Input id={`year-${b.id}`} value={editYear} onChange={(e) => setEditYear(e.target.value)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`brand-${b.id}`}>Brand</Label>
                                    <Input id={`brand-${b.id}`} value={editBrandTitle} onChange={(e) => setEditBrandTitle(e.target.value)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`subject-${b.id}`}>Subject</Label>
                                    <Input id={`subject-${b.id}`} value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`variant-${b.id}`}>Variant</Label>
                                    <Input id={`variant-${b.id}`} value={editVariant} onChange={(e) => setEditVariant(e.target.value)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`cardnum-${b.id}`}>Card #</Label>
                                    <Input id={`cardnum-${b.id}`} value={editCardNumber} onChange={(e) => setEditCardNumber(e.target.value)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`grade-${b.id}`}>Grade</Label>
                                    <Select value={editGrade} onValueChange={setEditGrade}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {gradeOptions.map(grade => (
                                          <SelectItem key={grade} value={grade}>{grade || "No Grade"}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor={`psa-${b.id}`}>PSA Cert</Label>
                                    <Input id={`psa-${b.id}`} value={editPsaCert} onChange={(e) => setEditPsaCert(e.target.value)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`cost-${b.id}`}>Cost</Label>
                                    <Input id={`cost-${b.id}`} value={editCost} onChange={(e) => setEditCost(e.target.value)} placeholder="$" />
                                  </div>
                                  <div>
                                    <Label htmlFor={`price-${b.id}`}>Price</Label>
                                    <Input id={`price-${b.id}`} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="$" />
                                  </div>
                                  <div>
                                    <Label htmlFor={`qty-${b.id}`}>Quantity</Label>
                                    <Input id={`qty-${b.id}`} type="number" value={String(editQty)} onChange={(e) => setEditQty(Number(e.target.value) || 0)} />
                                  </div>
                                  <div>
                                    <Label htmlFor={`sku-${b.id}`}>SKU</Label>
                                    <Input id={`sku-${b.id}`} value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button onClick={() => saveEditRow(b)}>Save</Button>
                                  <Button variant="secondary" onClick={cancelEditRow}>Cancel</Button>
                                </div>
                              </div>
                            </TableCell>
                          ) : (
                            <>
                              <TableCell>
                                <div className="font-medium">{buildTitleFromParts(b.year, b.brandTitle, b.cardNumber, b.subject, b.variant)}</div>
                                <div className="text-sm text-muted-foreground">{b.set}</div>
                              </TableCell>
                              <TableCell>{b.grade}</TableCell>
                              <TableCell>{b.price}</TableCell>
                              <TableCell>{b.lot}</TableCell>
                              <TableCell>
                                {b.printedAt ? (
                                  <span className="text-green-600">Printed</span>
                                ) : (
                                  <span className="text-yellow-600">Pending</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => handlePrintRow(b)} disabled={!printerConnected}>
                                    Print
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => startEditRow(b)}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => b.id && deleteFromBatch(b.id)}>
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
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

      {previewOpen && previewLabel && (
        <PrintPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          label={previewLabel}
          onPrint={(tspl: string) => {
            if (previewItemId) {
              onPreviewPrint(tspl);
            }
          }}
          templateType={previewLabel.grade ? 'graded' : 'raw'}
        />
      )}
      
      <PrintAllPreviewDialog
        open={bulkPreviewOpen}
        onOpenChange={setBulkPreviewOpen}
        items={bulkPreviewItems}
        onPrintAll={printAllFromPreview}
        loading={bulkPreviewBusy}
      />
    </div>
  );
};

export default Index;
