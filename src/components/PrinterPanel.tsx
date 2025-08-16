import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, Wifi, WifiOff, TestTube, Cloud } from "lucide-react";
import { toast } from "sonner";
import { printNodeService } from "@/lib/printNodeService";
import { buildSampleLabel } from "@/lib/tspl";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    loadPrinterSettings();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const printerList = await printNodeService.getPrinters();
        const formattedPrinters = printerList.map(p => ({id: p.id, name: p.name}));
        setPrinters(formattedPrinters);
        setPrintNodeOnline(true);
      } catch (error) {
        setPrintNodeOnline(false);
        setPrinters([]);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadPrinterSettings = async () => {
    try {
      const id = crypto.randomUUID().substring(0, 8);
      setWorkstationId(id);
      
      const { data: settings } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('workstation_id', id)
        .single();
        
      if (settings && settings.selected_printer_id && settings.selected_printer_name) {
        setSelectedPrinter({
          id: settings.selected_printer_id,
          name: settings.selected_printer_name
        });
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  };

  const savePrinterSettings = async () => {
    if (!selectedPrinter) return;
    
    try {
      await supabase
        .from('printer_settings')
        .upsert({
          workstation_id: workstationId,
          selected_printer_id: selectedPrinter.id,
          selected_printer_name: selectedPrinter.name,
          use_printnode: true,
        });
        
      toast.success("Printer settings saved");
    } catch (error) {
      console.error('Failed to save printer settings:', error);
      toast.error("Failed to save settings");
    }
  };

  const refreshPrinters = async () => {
    setLoading(true);
    try {
      const printerList = await printNodeService.getPrinters();
      const formattedPrinters = printerList.map(p => ({id: p.id, name: p.name}));
      setPrinters(formattedPrinters);
      setPrintNodeOnline(true);
      toast.success(`Found ${formattedPrinters.length} printer(s)`);
    } catch (error) {
      setPrintNodeOnline(false);
      setPrinters([]);
      toast.error("Failed to connect to PrintNode. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const runSmokeTest = async () => {
    if (!selectedPrinter) {
      toast.error("No printer selected");
      return;
    }

    setTestPrinting(true);
    
    try {
      // Generate test label TSPL
      const testTSPL = buildSampleLabel();

      // Create print job record
      const { data: printJob } = await supabase
        .from('print_jobs')
        .insert({
          workstation_id: workstationId,
          printer_name: selectedPrinter.name,
          printer_id: selectedPrinter.id,
          tspl_code: testTSPL,
          status: 'queued'
        })
        .select()
        .single();

      if (!printJob) throw new Error('Failed to create print job record');

      // Send print job via PrintNode
      const result = await printNodeService.printTSPL(testTSPL, selectedPrinter.id, {
        title: 'Smoke Test Label',
        copies: 1
      });

      // Update print job with PrintNode job ID
      await supabase
        .from('print_jobs')
        .update({
          status: 'sent',
          printnode_job_id: result.id
        })
        .eq('id', printJob.id);

      toast.success("Smoke test completed successfully!");
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Smoke test failed';
      toast.error(errorMsg);
    } finally {
      setTestPrinting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          PrintNode Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PrintNode Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">PrintNode Status:</span>
          <Badge variant={printNodeOnline ? "default" : "destructive"} className="gap-1">
            {printNodeOnline ? <Cloud className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {printNodeOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        {/* Workstation ID */}
        <div className="text-xs text-muted-foreground">
          Workstation: {workstationId}
        </div>

        {/* Printer Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected Printer:</label>
          <Select 
            value={selectedPrinter?.id.toString() || ''} 
            onValueChange={(value) => {
              const printer = printers.find(p => p.id.toString() === value);
              setSelectedPrinter(printer || null);
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

        {/* Smoke Test */}
        <Button 
          className="w-full gap-2" 
          onClick={runSmokeTest}
          disabled={!printNodeOnline || !selectedPrinter || testPrinting}
        >
          <TestTube className="h-4 w-4" />
          {testPrinting ? "Testing..." : "Smoke Test"}
        </Button>

        {/* PrintNode Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          PrintNode Cloud Service
          <br />
          {printers.length > 0 && `${printers.length} printer(s) available`}
        </div>
      </CardContent>
    </Card>
  );
}