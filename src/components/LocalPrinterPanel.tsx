import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, TestTube, Settings } from "lucide-react";
import { toast } from "sonner";
import { sendTSPL, generateWorkstationId } from "@/lib/printerService";
import { supabase } from "@/integrations/supabase/client";

export function LocalPrinterPanel() {
  const [workstationId, setWorkstationId] = useState<string>('');
  const [printerName, setPrinterName] = useState<string>('');
  const [port, setPort] = useState<number>(17777);
  const [testing, setTesting] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const id = generateWorkstationId();
    setWorkstationId(id);
    
    // Load from localStorage
    const settings = localStorage.getItem('localPrinterSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      setPrinterName(parsed.printerName || '');
      setPort(parsed.port || 17777);
    }
  };

  const saveSettings = () => {
    const settings = {
      workstationId,
      printerName,
      port
    };
    
    localStorage.setItem('localPrinterSettings', JSON.stringify(settings));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('localPrinterChanged', { detail: settings }));
    
    toast.success("Local printer settings saved");
  };

  const runTestPrint = async () => {
    setTesting(true);
    
    try {
      // Generate test TSPL
      const testTSPL = `SIZE 2.0,1.0
GAP 0.12,0
DENSITY 8
SPEED 4
DIRECTION 1
REFERENCE 0,0
OFFSET 0
SET PEEL OFF
SET CUTTER OFF
SET PARTIAL_CUTTER OFF
SET TEAR ON
CLS

TEXT 10,10,"3",0,1,1,"LOCAL TEST"
TEXT 10,40,"2",0,1,1,"${new Date().toLocaleTimeString()}"
TEXT 10,70,"1",0,1,1,"Workstation: ${workstationId.slice(-8)}"

PRINT 1,1`;

      await sendTSPL(testTSPL, { 
        printerName: printerName || undefined, 
        copies: 1, 
        port 
      });
      
      toast.success("Test print sent successfully");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Test print failed';
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Local TSPL Printer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workstation ID */}
        <div className="text-xs text-muted-foreground">
          Workstation: {workstationId}
        </div>

        {/* Settings */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="printer-name" className="text-sm">Printer Name (optional)</Label>
            <Input
              id="printer-name"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              placeholder="Leave blank for default printer"
              className="text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="port" className="text-sm">Local Bridge Port</Label>
            <Input
              id="port"
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 17777)}
              className="text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={saveSettings}
          >
            <Settings className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>

        <Separator className="my-4" />

        {/* Test Printing */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Test Print</Label>
          
          <Button 
            className="w-full gap-2" 
            onClick={runTestPrint}
            disabled={testing}
          >
            <TestTube className="h-4 w-4" />
            {testing ? "Testing..." : "Send Test Print"}
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Sends TSPL commands to local desktop bridge at localhost:{port}
          <br />
          Configure your local printer bridge to receive TSPL data.
        </div>
      </CardContent>
    </Card>
  );
}