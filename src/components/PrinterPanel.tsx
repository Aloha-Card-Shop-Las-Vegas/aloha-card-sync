import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, Wifi, WifiOff, TestTube } from "lucide-react";
import { toast } from "sonner";
import { 
  generateWorkstationId, 
  fetchPrinters, 
  sendTSPL, 
  getPrinterSettings,
  upsertPrinterSettings,
  insertPrintJob,
  updatePrintJobStatus
} from "@/lib/printerService";
import { buildSampleLabel } from "@/lib/tspl";

export function PrinterPanel() {
  const [workstationId] = useState(generateWorkstationId());
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [bridgePort, setBridgePort] = useState(17777);
  const [loading, setLoading] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);

  // Load printer settings on mount
  useEffect(() => {
    loadPrinterSettings();
  }, [workstationId]);

  // Check bridge status periodically
  useEffect(() => {
    const checkBridge = async () => {
      try {
        const printerList = await fetchPrinters(bridgePort);
        setPrinters(printerList);
        setBridgeOnline(true);
      } catch (error) {
        setBridgeOnline(false);
        setPrinters([]);
      }
    };

    checkBridge();
    const interval = setInterval(checkBridge, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [bridgePort]);

  const loadPrinterSettings = async () => {
    try {
      const settings = await getPrinterSettings(workstationId);
      if (settings) {
        setSelectedPrinter(settings.preferred_printer || "");
        setBridgePort(settings.bridge_port || 17777);
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  };

  const savePrinterSettings = async () => {
    try {
      await upsertPrinterSettings({
        workstation_id: workstationId,
        preferred_printer: selectedPrinter,
        bridge_port: bridgePort
      });
      toast.success("Printer settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const refreshPrinters = async () => {
    setLoading(true);
    try {
      const printerList = await fetchPrinters(bridgePort);
      setPrinters(printerList);
      setBridgeOnline(true);
      toast.success(`Found ${printerList.length} printer(s)`);
    } catch (error) {
      setBridgeOnline(false);
      setPrinters([]);
      toast.error("Bridge offline or no printers found");
    } finally {
      setLoading(false);
    }
  };

  const runSmokeTest = async () => {
    if (!bridgeOnline) {
      toast.error("Bridge is offline");
      return;
    }

    setTestPrinting(true);
    
    try {
      // 1. Confirm bridge is online
      await fetchPrinters(bridgePort);
      
      // 2. Generate sample TSPL
      const tspl = buildSampleLabel();
      
      // 3. Insert job record
      const jobId = await insertPrintJob({
        workstation_id: workstationId,
        status: 'queued',
        copies: 1,
        language: 'TSPL',
        payload: tspl
      });

      try {
        // 4. Send to printer
        await sendTSPL(tspl, {
          printerName: selectedPrinter,
          copies: 1,
          port: bridgePort
        });
        
        // 5. Update job status
        await updatePrintJobStatus(jobId, 'sent');
        toast.success("Smoke test completed successfully!");
        
      } catch (printError) {
        await updatePrintJobStatus(jobId, 'error', printError instanceof Error ? printError.message : 'Print failed');
        throw printError;
      }
      
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
          Printer Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bridge Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Bridge Status:</span>
          <Badge variant={bridgeOnline ? "default" : "destructive"} className="gap-1">
            {bridgeOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {bridgeOnline ? "Online" : "Offline"}
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
            value={selectedPrinter} 
            onValueChange={setSelectedPrinter}
            disabled={!bridgeOnline}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose printer" />
            </SelectTrigger>
            <SelectContent>
              {printers.map((printer) => (
                <SelectItem key={printer} value={printer}>
                  {printer}
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
          disabled={!bridgeOnline || !selectedPrinter || testPrinting}
        >
          <TestTube className="h-4 w-4" />
          {testPrinting ? "Testing..." : "Smoke Test"}
        </Button>

        {/* Bridge Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Bridge: http://127.0.0.1:{bridgePort}
          <br />
          {printers.length > 0 && `${printers.length} printer(s) available`}
        </div>
      </CardContent>
    </Card>
  );
}