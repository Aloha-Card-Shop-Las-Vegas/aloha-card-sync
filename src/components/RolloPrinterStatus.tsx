import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { PrintService } from "@/lib/printService";
import { toast } from "sonner";

interface RolloPrinterStatusProps {
  currentPrinter: { id: number; name: string } | null;
  connected: boolean;
  onRefresh: () => void;
}

export const RolloPrinterStatus = ({ currentPrinter, connected, onRefresh }: RolloPrinterStatusProps) => {
  const handleRefresh = async () => {
    try {
      PrintService.refreshPrinterCache();
      onRefresh();
      toast.info('Refreshing Rollo printer connection...');
    } catch (error) {
      toast.error('Failed to refresh printer connection');
    }
  };

  return (
    <Card className="shadow-aloha">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Rollo Printer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Connected
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <Badge variant="destructive">
                  Disconnected
                </Badge>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>

        {currentPrinter ? (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Printer:</span> {currentPrinter.name}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">ID:</span> {currentPrinter.id}
            </div>
            <div className="text-xs text-muted-foreground">
              Auto-selected · 2×1 PDF labels
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No Rollo printer found. Check PrintNode setup.
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3">
          <div>✓ Auto-selects best Rollo printer</div>
          <div>✓ Forces 2×1 inch PDF labels</div>
          <div>✓ No manual printer selection needed</div>
        </div>
      </CardContent>
    </Card>
  );
};