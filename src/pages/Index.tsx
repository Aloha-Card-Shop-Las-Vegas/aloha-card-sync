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
import { generateWorkstationId, queueTemplateJob, queueTemplateBatch } from "@/lib/printerService";
import { Printer } from "lucide-react";

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

  // Print queue state
  const [workstationId, setWorkstationId] = useState<string>('');
  const [defaultTemplates, setDefaultTemplates] = useState<{graded?: any, raw?: any}>({});
  const [printerName, setPrinterName] = useState<string>('');

  // Initialize workstation ID and printer settings
  useEffect(() => {
    const id = generateWorkstationId();
    setWorkstationId(id);
    
    // Load saved printer name
    const savedPrinter = localStorage.getItem('selectedPrinter');
    if (savedPrinter) {
      setPrinterName(savedPrinter);
    }
  }, []);

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

  // Simple printing state (no preview dialogs)
  const [printingItemId, setPrintingItemId] = useState<string | null>(null);

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

  // Common PSA grades for quick selection
  const PSA_GRADE_OPTIONS = [
    "Raw",
    "Authentic",
    "PR 1",
    "FR 1.5",
    "GOOD 2",
    "VG 3",
    "VG-EX 4",
    "EX 5",
    "EX-MT 6",
    "NM 7",
    "NM-MT 8",
    "MINT 9",
    "GEM MT 10",
  ];

  // StrictMode guards
  const didInitMainRef = useRef(false);
  const didInitCatsGamesRef = useRef(false);
  const didInitIntakeListenerRef = useRef(false);

  // Listen for intake item additions from RawIntake component
  useEffect(() => {
    if (didInitIntakeListenerRef.current) return;
    didInitIntakeListenerRef.current = true;
    
    const handleIntakeItemAdded = (event: any) => {
      console.log('Received intake:item-added event:', event.detail);
      const newItemData = event.detail;
      
      // Build title from the added data
      const title = buildTitleFromParts(
        newItemData.year, 
        newItemData.brand_title, 
        newItemData.card_number, 
        newItemData.subject, 
        newItemData.variant
      );
      
      const newItem: CardItem = {
        title: title,
        set: "",
        year: newItemData.year || "",
        grade: newItemData.grade || "",
        psaCert: newItemData.psa_cert || "",
        price: newItemData.price != null ? String(newItemData.price) : "",
        cost: newItemData.cost != null ? String(newItemData.cost) : "",
        lot: newItemData.lot_number || "",
        sku: newItemData.sku || "",
        brandTitle: newItemData.brand_title || "",
        subject: newItemData.subject || "",
        category: newItemData.category || "",
        variant: newItemData.variant || "",
        cardNumber: newItemData.card_number || "",
        quantity: newItemData.quantity || 1,
        condition: newItemData.variant || "",
        id: newItemData.id,
        printedAt: newItemData.printed_at || null,
        pushedAt: newItemData.pushed_at || null,
      };
      
      console.log('Adding item from RawIntake to batch:', newItem);
      setBatch(prev => {
        console.log('Previous batch length:', prev.length);
        const newBatch = [newItem, ...prev];
        console.log('New batch length after RawIntake addition:', newBatch.length);
        return newBatch;
      });
    };
    
    window.addEventListener('intake:item-added', handleIntakeItemAdded);
    
    return () => {
      window.removeEventListener('intake:item-added', handleIntakeItemAdded);
    };
  }, []);

  // Load existing items from DB so batch persists
  useEffect(() => {
    if (didInitMainRef.current) return;
    didInitMainRef.current = true;
    const loadBatch = async () => {
      console.log("Loading intake items from DB");
      const { data, error } = await supabase
        .from("intake_items")
        .select("*")
        .is("deleted_at", null)
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
          quantity: row.quantity || 1,
          id: row.id,
          printedAt: row.printed_at || null,
          pushedAt: row.pushed_at || null,
        })) || [];

      // Only show items that have not been pushed yet in the queue
      setBatch(mapped.filter((m) => !m.pushedAt));
    };

    loadBatch();
  }, []);

  // Load categories and games for dropdowns
  useEffect(() => {
    if (didInitCatsGamesRef.current) return;
    didInitCatsGamesRef.current = true;
    
    const loadCategoriesAndGames = async () => {
      try {
        const [catsResult] = await Promise.all([
          supabase.from('categories').select('name').order('name')
        ]);

        if (!catsResult.error && catsResult.data) {
          setCategories(catsResult.data.map(c => c.name));
        }

        // Set empty games array since we don't need it for simplified version
        setGames([]);
      } catch (error) {
        console.error('Failed to load categories/games:', error);
      }
    };

    loadCategoriesAndGames();
  }, []);

  // Queue-based printing functions
  const queueLabel = async (cardItem: CardItem): Promise<boolean> => {
    if (!cardItem.id) return false;

    try {
      const title = buildTitleFromParts(cardItem.year, cardItem.brandTitle, cardItem.cardNumber, cardItem.subject, cardItem.variant);
      
      console.log(`=== QUEUEING PRINT JOB ===`);
      console.log(`Title: ${title}`);
      console.log(`Workstation: ${workstationId}`);
      console.log(`Printer: ${printerName || 'Default'}`);

      // Create print data for template
      const printData = {
        product_name: title,
        price: cardItem.price || '0.00',
        sku: cardItem.sku || cardItem.id || 'NO-SKU',
        condition: cardItem.grade || (cardItem.condition || 'Raw'),
      };

      // Queue the print job using template
      const jobId = await queueTemplateJob({
        workstationId,
        templateId: 'price-2x1-v1',
        data: printData,
        printerName: printerName || undefined,
        copies: 1
      });
      
      console.log(`Queued print job: ${jobId}`);
      return true;
      
    } catch (error) {
      console.error(`Error queueing print job:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to queue print job: ${errorMsg}`);
      return false;
    }
  };

  // Handle single row print
  const handlePrintRow = async (cardItem: CardItem) => {
    if (!cardItem.id) return;
    
    if (!acquireRowLock(cardItem.id)) {
      toast.error('Item already being queued');
      return;
    }
    
    setPrintingItemId(cardItem.id);
    
    try {
      const success = await queueLabel(cardItem);
      
      if (success) {
        // Mark as printed in database (ready for agent pickup)
        await markPrinted([cardItem.id]);
        toast.success('Print job queued successfully - agent will process it shortly');
      }
      
    } finally {
      setPrintingItemId(null);
      releaseRowLock(cardItem.id);
    }
  };

  // Handle bulk print
  const handlePrintAll = async () => {
    if (!acquireGlobalLock()) {
      toast.error('Another batch job is in progress');
      return;
    }
    
    setPrintingAll(true);
    
    try {
      const unprintedItems = batch.filter(item => !item.printedAt && item.id);
      if (unprintedItems.length === 0) {
        toast.error('No items to print');
        return;
      }
      
      let successCount = 0;
      const totalItems = unprintedItems.length;
      
      console.log(`=== QUEUEING BATCH PRINT JOBS ===`);
      console.log(`Items: ${totalItems}`);
      console.log(`Workstation: ${workstationId}`);
      
      // Prepare batch jobs
      const batchJobs = unprintedItems.map(item => {
        const title = buildTitleFromParts(item.year, item.brandTitle, item.cardNumber, item.subject, item.variant);
        
        return {
          workstationId,
          templateId: 'price-2x1-v1',
          data: {
            product_name: title,
            price: item.price || '0.00',
            sku: item.sku || item.id || 'NO-SKU',
            condition: item.grade || (item.condition || 'Raw'),
          },
          printerName: printerName || undefined,
          copies: 1
        };
      });

      try {
        // Queue all jobs
        const jobIds = await queueTemplateBatch(batchJobs);
        successCount = jobIds.length;
        
        // Mark all as printed (queued for processing)
        const itemIds = unprintedItems.map(item => item.id!).filter(Boolean);
        await markPrinted(itemIds);
        
        console.log(`Queued ${successCount} print jobs:`, jobIds);
      } catch (error) {
        console.error(`Batch queue failed:`, error);
        throw error;
      }
      
      if (successCount > 0) {
        toast.success(`Queued ${successCount}/${totalItems} print jobs - agent will process them shortly`);
        // Reload batch to reflect printed status
        window.location.reload();
      } else {
        toast.error('No print jobs were queued');
      }
      
    } finally {
      setPrintingAll(false);
      releaseGlobalLock();
    }
  };

  const fetchPsa = async (psaCert: string) => {
    if (!psaCert.trim()) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('psa-scrape', {
        body: { cert_number: psaCert.trim() }
      });

      if (error) throw error;

      if (data?.success && data?.cardData) {
        const cardData = data.cardData;
        setItem({
          ...item,
          title: cardData.title || "",
          year: cardData.year || "",
          brandTitle: cardData.brand || "",
          subject: cardData.subject || "",
          variant: cardData.variant || "",
          cardNumber: cardData.cardNumber || "",
          grade: cardData.grade || "",
          psaCert: psaCert.trim(),
        });
        toast.success('PSA data fetched successfully');
      } else {
        throw new Error(data?.error || 'No card data found');
      }
    } catch (error) {
      console.error('PSA fetch error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch PSA data');
    }
  };

  const addToQueue = async () => {
    console.log('addToQueue called with item:', item);
    
    if (!item.title && !item.brandTitle && !item.subject) {
      console.log('Validation failed - no required fields filled');
      toast.error('Please fill in at least one field');
      return;
    }

    console.log('Validation passed, attempting to insert to database');
    try {
      const title = buildTitleFromParts(item.year, item.brandTitle, item.cardNumber, item.subject, item.variant);
      
      const { data, error } = await supabase
        .from("intake_items")
        .insert({
          year: item.year || null,
          brand_title: item.brandTitle || null,
          card_number: item.cardNumber || null,
          subject: item.subject || null,
          variant: item.variant || null,
          category: item.category || null,
          grade: item.grade || null,
          psa_cert: item.psaCert || null,
          price: item.price ? parseFloat(item.price) : null,
          cost: item.cost ? parseFloat(item.cost) : null,
          lot_number: item.lot || null,
          sku: item.sku || null,
          quantity: item.quantity || 1,
          condition: item.condition || 'Near Mint',
        })
        .select()
        .single();

      if (error) throw error;

      console.log('Database insert successful, data:', data);

      const newItem: CardItem = {
        ...item,
        title,
        id: data.id,
        printedAt: null,
        pushedAt: null,
      };

      console.log('Adding newItem to batch:', newItem);
      setBatch(prev => {
        console.log('Previous batch length:', prev.length);
        const newBatch = [newItem, ...prev];
        console.log('New batch length:', newBatch.length);
        return newBatch;
      });
      
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
      
      console.log('Item added to batch successfully');
      toast.success('Item added to batch');
    } catch (error) {
      console.error('Error adding to queue:', error);
      console.error('Error details:', error);
      toast.error('Failed to add item');
    }
  };

  const markPrinted = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from("intake_items")
        .update({ printed_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;

      setBatch(prev => prev.map(item => 
        ids.includes(item.id || '') ? { ...item, printedAt: new Date().toISOString() } : item
      ));
    } catch (error) {
      console.error('Error marking as printed:', error);
      toast.error('Failed to update print status');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from("intake_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setBatch(prev => prev.filter(item => item.id !== id));
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-accent/20">
      <header className="py-6 mb-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <h1 className="text-4xl font-bold text-foreground">Aloha Card Shop</h1>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSignOut} variant="destructive">Sign Out</Button>
                <Button variant="secondary" onClick={() => window.scrollTo({ top: 9999, behavior: 'smooth' })}>View Batch</Button>
                <Link to="/inventory"><Button variant="outline">View Inventory</Button></Link>
                <Link to="/admin"><Button variant="outline">Admin</Button></Link>
                <Link to="/users"><Button variant="outline">Users</Button></Link>
                <Link to="/print-logs"><Button variant="outline">Print Logs</Button></Link>
              </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 pb-24">
        <section className="grid md:grid-cols-3 gap-6 -mt-8">
          <Card className="shadow-aloha">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Print Queue Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="workstation">Workstation ID</Label>
                <Input 
                  id="workstation" 
                  value={workstationId} 
                  disabled 
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="printer">Printer Name (Optional)</Label>
                <Input 
                  id="printer" 
                  value={printerName} 
                  onChange={(e) => {
                    setPrinterName(e.target.value);
                    localStorage.setItem('selectedPrinter', e.target.value);
                  }}
                  placeholder="e.g., Rollo_USB or leave blank for IP printing"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Print jobs are queued in the database. The desktop agent will process them automatically.
              </div>
            </CardContent>
          </Card>
          
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
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" value={item.year || ""} onChange={(e) => setItem({ ...item, year: e.target.value })} placeholder="e.g., 2020" />
                    </div>
                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input id="cardNumber" value={item.cardNumber || ""} onChange={(e) => setItem({ ...item, cardNumber: e.target.value })} placeholder="e.g., 020" />
                    </div>
                    <div>
                      <Label htmlFor="grade">Grade</Label>
                      <Select value={item.grade || ""} onValueChange={(value) => setItem({ ...item, grade: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {PSA_GRADE_OPTIONS.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="psaCert">PSA Cert #</Label>
                      <Input id="psaCert" value={item.psaCert || ""} onChange={(e) => setItem({ ...item, psaCert: e.target.value })} placeholder="e.g., 12345678" />
                    </div>
                    <div>
                      <Label htmlFor="price">Price ($)</Label>
                      <Input id="price" value={item.price || ""} onChange={(e) => setItem({ ...item, price: e.target.value })} placeholder="e.g., 100.00" />
                    </div>
                    <div>
                      <Label htmlFor="lot">Lot #</Label>
                      <Input id="lot" value={item.lot || ""} onChange={(e) => setItem({ ...item, lot: e.target.value })} placeholder="e.g., LOT-001" />
                    </div>
                    <div>
                      <Label htmlFor="sku">SKU</Label>
                      <Input id="sku" value={item.sku || ""} onChange={(e) => setItem({ ...item, sku: e.target.value })} placeholder="e.g., 12345" />
                    </div>
                  </div>
                </>
              ) : (
                <RawIntake onAdded={(addedItem) => {
                  console.log('RawIntake onAdded callback triggered:', addedItem);
                  // The event listener above will handle the batch update
                  // This callback can be used for additional immediate actions if needed
                }} />
              )}
              {intakeMode === 'graded' && (
                <div className="mt-4">
                  <Button onClick={addToQueue} className="w-full">Add to Batch</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Batch Queue Section */}
        <section className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Batch Queue ({batch.length} items)</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePrintAll}
                     disabled={printingAll || batch.filter(b => !b.printedAt).length === 0}
                   >
                     {printingAll ? 'Queueing...' : `Queue All (${batch.filter(b => !b.printedAt).length})`}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {batch.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No items in batch. Add items above to get started.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.map((b) => (
                        <TableRow key={b.id || Math.random()}>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={b.title}>
                              {b.title}
                            </div>
                          </TableCell>
                          <TableCell>{b.grade || 'Raw'}</TableCell>
                          <TableCell>{b.price ? `$${b.price}` : '-'}</TableCell>
                          <TableCell>{b.lot || '-'}</TableCell>
                          <TableCell>
                            {b.printedAt ? (
                              <span className="text-green-600">Printed</span>
                            ) : (
                              <span className="text-muted-foreground">Ready</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => handlePrintRow(b)}
                                 disabled={!!b.printedAt || printingItemId === b.id}
                               >
                                 {printingItemId === b.id ? 'Queueing...' : 'Queue Print'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => b.id && deleteItem(b.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}</TableBody>
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
