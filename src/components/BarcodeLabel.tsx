import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface BarcodeLabelProps {
  value: string;
  label?: string;
  className?: string;
  showPrintButton?: boolean;
}

const BarcodeLabel = ({ value, label, className, showPrintButton = true }: BarcodeLabelProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const JsBarcode: any = (await import("jsbarcode")).default;
        if (isMounted && canvasRef.current && value) {
          JsBarcode(canvasRef.current, value, {
            format: "CODE128",
            displayValue: true,
            fontSize: 14,
            lineColor: "#111827",
            margin: 8,
          });
        }
      } catch (e) {
        // no-op in case of SSR or load errors
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [value]);

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Print Barcode</title><style>
      @page { size: auto; margin: 6mm; }
      body { display: flex; align-items: center; justify-content: center; height: 100vh; }
      img { width: 320px; }
    </style></head><body><img src="${dataUrl}" alt="Barcode ${value}" /></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className={className}>
      {label && <div className="text-sm text-muted-foreground mb-1">{label}</div>}
      <canvas ref={canvasRef} role="img" aria-label={`Barcode for ${value}`} />
      {showPrintButton && (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={handlePrint}>Print Label</Button>
        </div>
      )}
    </div>
  );
};

export default BarcodeLabel;
