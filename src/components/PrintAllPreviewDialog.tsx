import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BarcodeLabel from "@/components/BarcodeLabel";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

export interface BulkPreviewItem {
  id: string;
  title: string;
  lot: string;
  price: string;
  barcode: string;
  tspl: string;
}

interface PrintAllPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkPreviewItem[];
  onPrintAll: () => void | Promise<void>;
  loading?: boolean;
}

const PrintAllPreviewDialog: React.FC<PrintAllPreviewDialogProps> = ({ 
  open, 
  onOpenChange, 
  items, 
  onPrintAll,
  loading = false 
}) => {
  const totalLabels = items.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Print All Preview ({totalLabels} labels)</DialogTitle>
          <DialogDescription>
            Review all labels before sending to printer. Each label will be printed once.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] w-full">
          <div className="space-y-6">
            {items.map((item, index) => (
              <div key={item.id} className="grid gap-4 sm:grid-cols-2 border-b pb-4 last:border-b-0">
                {/* Visual label mock */}
                <div>
                  <div className="text-sm font-medium mb-2">Label #{index + 1}</div>
                  <div className="rounded-md border bg-background p-3">
                    <div
                      className="relative mx-auto w-full overflow-hidden rounded-sm border bg-card"
                      style={{ aspectRatio: "2 / 1" }}
                      aria-label={`Label preview ${index + 1}`}
                    >
                      <div className="absolute left-2 top-1 text-xs leading-tight">
                        <div className="truncate max-w-[95%]" title={item.title}>{item.title}</div>
                      </div>
                      <div className="absolute left-2 top-6 text-xs">
                        <span className="opacity-80">{item.lot}</span>
                      </div>
                      <div className="absolute right-2 top-6 text-xs font-medium">
                        {item.price}
                      </div>
                      <div className="absolute left-2 right-2 bottom-1">
                        <BarcodeLabel value={item.barcode} showPrintButton={false} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TSPL for this label */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">TSPL Program</label>
                  <textarea
                    value={item.tspl}
                    readOnly
                    className="min-h-[180px] w-full rounded-md border bg-background p-3 font-mono text-xs resize-none"
                    aria-label={`TSPL program for label ${index + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {totalLabels} label{totalLabels === 1 ? '' : 's'} ready to print
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={onPrintAll} disabled={loading}>
              {loading ? 'Printing...' : `Print All ${totalLabels} Labels`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintAllPreviewDialog;