import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Cloud, WifiOff, TestTube, FileText } from "lucide-react";
import { toast } from "sonner";
import { printNodeService } from "@/lib/printNodeService";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';


interface PrintNodePrinter {
  id: number;
  name: string;
}

export function PrinterPanel() {
  const [workstationId, setWorkstationId] = useState<string>('');
  const [printers, setPrinters] = useState<PrintNodePrinter[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<PrintNodePrinter | null>(null);
  const [printNodeOnline, setPrintNodeOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [testPrinting, setTestPrinting] = useState<boolean>(false);
  const [testingPDF, setTestingPDF] = useState<boolean>(false);
  const [keySource, setKeySource] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');

  useEffect(() => {
    loadPrinterSettings();
    // Immediately check PrintNode status on mount
    refreshPrinters();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const printerList = await printNodeService.getPrinters();
        // Filter out the specific Rollo X1040 printer
        const filteredPrinters = printerList.filter(p => 
          !p.name.includes('Rollo X1040') && !p.name.includes('X1243221259')
        );
        const formattedPrinters = filteredPrinters.map(p => ({id: p.id, name: p.name}));
        setPrinters(formattedPrinters);
        setPrintNodeOnline(true);
        setConnectionError('');
      } catch (error) {
        setPrintNodeOnline(false);
        setPrinters([]);
        const errorMessage = error instanceof Error ? error.message : "Connection failed";
        setConnectionError(errorMessage);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadPrinterSettings = async () => {
    try {
      // Use the same workstation ID generation as printerService
      const { generateWorkstationId } = await import('@/lib/printerService');
      const id = generateWorkstationId();
      setWorkstationId(id);
      
      // Load from localStorage first for immediate UI update
      const localSettings = localStorage.getItem('printerSettings');
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        if (parsed.selectedPrinterId) {
          const printerId = parseInt(parsed.selectedPrinterId);
          setSelectedPrinter({ id: printerId, name: parsed.printerName || 'Unknown' });
        }
      }
      
      // Then load from Supabase
      const { data: settings } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('workstation_id', id)
        .single();
        
      if (settings && settings.selected_printer_id) {
        const printerId = settings.selected_printer_id;
        setSelectedPrinter({
          id: printerId,
          name: settings.selected_printer_name || 'Unknown'
        });
        
        // Update localStorage with Supabase data
        localStorage.setItem('printerSettings', JSON.stringify({
          workstationId: id,
          selectedPrinterId: printerId,
          printerName: settings.selected_printer_name
        }));
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  };

  const savePrinterSettings = async () => {
    if (!selectedPrinter) return;
    
    try {
      // Save to Supabase using correct field names from existing schema
      await supabase
        .from('printer_settings')
        .upsert({
          workstation_id: workstationId,
          selected_printer_id: selectedPrinter.id,
          selected_printer_name: selectedPrinter.name,
          use_printnode: true
        });
      
      // Also save to localStorage for immediate access
      const printerData = {
        workstationId,
        selectedPrinterId: selectedPrinter.id,
        printerName: selectedPrinter.name
      };
      localStorage.setItem('printerSettings', JSON.stringify(printerData));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('printerSelectionChanged', { 
        detail: printerData 
      }));
        
      toast.success("Printer settings saved");
    } catch (error) {
      console.error('Failed to save printer settings:', error);
      toast.error("Failed to save settings");
    }
  };

  const refreshPrinters = async () => {
    setLoading(true);
    setConnectionError('');
    try {
      const printerList = await printNodeService.getPrinters();
      // Filter out the specific Rollo X1040 printer
      const filteredPrinters = printerList.filter(p => 
        !p.name.includes('Rollo X1040') && !p.name.includes('X1243221259')
      );
      const formattedPrinters = filteredPrinters.map(p => ({id: p.id, name: p.name}));
      setPrinters(formattedPrinters);
      setPrintNodeOnline(true);
      
      // Try to get key source info from the service initialization
      try {
        await printNodeService.initialize();
        // This will log which key source is being used
      } catch (initError) {
        console.log('Key source detection failed:', initError);
      }
      
      toast.success(`Found ${formattedPrinters.length} printer(s)`);
    } catch (error) {
      setPrintNodeOnline(false);
      setPrinters([]);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to PrintNode";
      setConnectionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };




  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          PrintNode Cloud Printing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PrintNode Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">PrintNode Status:</span>
          <Badge variant={printNodeOnline ? "default" : "destructive"} className="gap-1">
            {printNodeOnline ? <Cloud className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {printNodeOnline ? "Connected" : "Not Connected"}
          </Badge>
        </div>

        {!printNodeOnline && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-1">
              <WifiOff className="h-4 w-4" />
              PrintNode Not Available
            </div>
            <p className="text-sm text-muted-foreground">
              {connectionError || "Check your PrintNode API key configuration in Supabase secrets."}
            </p>
          </div>
        )}

        {/* API Key Source Indicator */}
        {printNodeOnline && keySource && (
          <div className="p-2 bg-green-50 border border-green-200 rounded-md">
            <p className="text-xs text-green-700">
              Using {keySource} API key
            </p>
          </div>
        )}

        {/* Workstation ID */}
        <div className="text-xs text-muted-foreground">
          Workstation: {workstationId}
        </div>

        {/* Printer Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected Printer:</label>
          <Select 
            value={selectedPrinter?.id.toString() || ''} 
            onValueChange={async (value) => {
              const printer = printers.find(p => p.id.toString() === value);
              setSelectedPrinter(printer || null);
              
              // Auto-save selection immediately
              if (printer) {
                const settings = {
                  selectedPrinterId: printer.id,
                  printerName: printer.name,
                  workstationId
                };
                
                // Save to localStorage immediately
                localStorage.setItem('printerSettings', JSON.stringify(settings));
                
                // Dispatch custom event for same-window updates
                window.dispatchEvent(new CustomEvent('printerSelectionChanged', { 
                  detail: settings 
                }));
                
                // Save to Supabase in background (don't await to keep UI responsive)
                savePrinterSettings().catch(error => {
                  console.error('Background save failed:', error);
                });
                
                toast.success(`Selected printer: ${printer.name}`);
              }
            }}
            disabled={!printNodeOnline}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose printer" />
            </SelectTrigger>
            <SelectContent>
              {printers.map((printer) => (
                <SelectItem key={printer.id} value={printer.id.toString()}>
                  {printer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshPrinters}
            disabled={loading}
          >
            {loading ? "Checking..." : "Refresh"}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={savePrinterSettings}
            disabled={!selectedPrinter}
          >
            Save
          </Button>
        </div>

        <Separator className="my-4" />

        {/* Test Printing */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Test Printing:</label>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!selectedPrinter) {
                toast.error("No printer selected");
                return;
              }
              setTestingPDF(true);
              try {
                const doc = new jsPDF({
                  unit: 'in',
                  format: [2.0, 1.0],
                  orientation: 'landscape',
                  putOnlyUsedFonts: true,
                  compress: false
                });
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(12);
                doc.text('2x1" TEST', 0.1, 0.3);
                doc.setFontSize(10);
                doc.text('PDF Format', 0.1, 0.5);
                doc.setFontSize(8);
                doc.text(`${new Date().toLocaleTimeString()}`, 0.1, 0.7);
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                
                const result = await printNodeService.printPDF(pdfBase64, selectedPrinter.id, {
                  title: `PDF Test - ${new Date().toLocaleTimeString()}`,
                  copies: 1
                });
                
                if (result.success) {
                  toast.success(`PDF Test Sent - Job ID: ${result.jobId}`);
                } else {
                  throw new Error(result.error || 'PDF print failed');
                }
              } catch (error) {
                console.error('PDF test error:', error);
                toast.error(error instanceof Error ? error.message : "PDF test failed");
              } finally {
                setTestingPDF(false);
              }
            }}
            disabled={!printNodeOnline || !selectedPrinter || testingPDF}
            className="w-full"
          >
            <FileText className="w-4 h-4 mr-2" />
            {testingPDF ? "Testing..." : "Quick PDF Test"}
          </Button>
        </div>


        {/* PrintNode Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Supports both TSPL RAW and PDF printing.
          <br />
          {printers.length > 0 && `${printers.length} printer(s) available`}
        </div>
      </CardContent>
    </Card>
  );
}