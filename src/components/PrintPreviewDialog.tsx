import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BarcodeLabel from "@/components/BarcodeLabel";
import React from "react";

export interface PreviewLabelData {
  title: string;
  lot: string;
  price: string;
  barcode: string;
}

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: PreviewLabelData;
  tspl: string;
  onPrint: () => void | Promise<void>;
}

const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({ open, onOpenChange, label, tspl, onPrint }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Print preview</DialogTitle>
          <DialogDescription>
            Verify layout and raw TSPL before sending to printer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Visual label mock (2x1 in) */}
          <div>
            <div className="rounded-md border bg-background p-3">
              <div
                className="relative mx-auto w-full overflow-hidden rounded-sm border bg-card"
                style={{ aspectRatio: "2 / 1" }}
                aria-label="Label preview (approximate)"
              >
                <div className="absolute left-2 top-1 text-xs leading-tight">
                  <div className="truncate max-w-[95%]" title={label.title}>{label.title}</div>
                </div>
                <div className="absolute left-2 top-6 text-xs">
                  <span className="opacity-80">{label.lot}</span>
                </div>
                <div className="absolute right-2 top-6 text-xs font-medium">
                  {label.price}
                </div>
                <div className="absolute left-2 right-2 bottom-1">
                  <BarcodeLabel value={label.barcode} showPrintButton={false} />
                </div>
              </div>
            </div>
          </div>

          {/* Raw TSPL preview */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Raw TSPL program (CRLF)</label>
            <textarea
              value={tspl}
              readOnly
              className="min-h-[220px] w-full rounded-md border bg-background p-3 font-mono text-xs"
              aria-label="TSPL program"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Compare with Rollo TSPL manual if printing is still silent.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onPrint}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewDialog;
