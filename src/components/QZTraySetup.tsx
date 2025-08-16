import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, CheckCircle2, AlertCircle } from "lucide-react";

interface QZTraySetupProps {
  isConnected: boolean;
  onRetryConnection?: () => void;
}

export function QZTraySetup({ isConnected, onRetryConnection }: QZTraySetupProps) {
  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        QZ Tray connected - Direct printing available
      </div>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          Install QZ Tray for Direct Printing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          QZ Tray enables direct printing to your Rollo thermal printer without system dialogs.
        </p>
        
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Quick Setup:</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Download and install QZ Tray for your operating system</li>
            <li>Start QZ Tray (it runs in the system tray)</li>
            <li>Refresh this page to connect automatically</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button 
            size="sm" 
            onClick={() => window.open('https://qz.io/download/', '_blank')}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download QZ Tray
          </Button>
          
          {onRetryConnection && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetryConnection}
              className="text-xs"
            >
              Retry Connection
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open('https://qz.io/wiki/', '_blank')}
            className="text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Setup Guide
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}