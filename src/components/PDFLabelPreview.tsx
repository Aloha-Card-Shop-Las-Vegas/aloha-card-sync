import React, { useEffect, useState } from "react";
import { generateLabelPDF } from "@/lib/labelRenderer";
import { getLabelDesignerSettings } from "@/lib/labelDesignerSettings";
import { buildLabelDataFromItem, CardItem } from "@/lib/labelData";

function base64ToUint8Array(base64: string): Uint8Array {
  if (base64.startsWith("data:")) base64 = base64.split(",")[1] || "";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function ensureUint8Array(pdfOut: unknown): Uint8Array {
  if (pdfOut instanceof Uint8Array) return pdfOut;
  if (pdfOut instanceof ArrayBuffer) return new Uint8Array(pdfOut);
  if (typeof pdfOut === "string") return base64ToUint8Array(pdfOut);
  throw new Error("Unsupported PDF data type from generateLabelPDF");
}

const PDFLabelPreview: React.FC<{ item: CardItem }> = ({ item }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedFailed, setEmbedFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let urlToRevoke: string | null = null;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setEmbedFailed(false);

        // Use the same settings as printing for 1:1 parity
        const { fieldConfig } = getLabelDesignerSettings();
        const labelData = buildLabelDataFromItem(item);

        // Generate the exact same PDF as printing
        const out = await generateLabelPDF(fieldConfig, labelData);
        const bytes = ensureUint8Array(out);

        // Use a Blob URL (Chrome-friendly vs data:)
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        urlToRevoke = url;

        if (!mounted) return;
        setBlobUrl(url);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to create preview PDF");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [item]);

  if (loading) {
    return (
      <div className="w-80 h-40 bg-muted flex items-center justify-center border rounded text-sm">
        Generating preview…
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-80 h-40 bg-muted flex items-center justify-center border rounded text-xs text-destructive">
        {error}
      </div>
    );
  }
  if (!blobUrl) return null;

  if (embedFailed) {
    return (
      <div className="w-80 h-40 bg-muted flex flex-col items-center justify-center border rounded gap-2">
        <div className="text-xs text-muted-foreground">
          Chrome blocked the inline PDF preview.
        </div>
        <button
          className="px-3 py-1 border rounded text-xs hover:bg-accent"
          onClick={() => window.open(blobUrl, "_blank", "noopener,noreferrer")}
        >
          Open PDF in a new tab
        </button>
      </div>
    );
  }

  // Try to embed; if it fails (viewer disabled / forced download), show fallback UI
  return (
    <object
      data={blobUrl}
      type="application/pdf"
      width={320}
      height={160}
      aria-label="Label PDF Preview"
      className="border rounded"
      // object onError triggers when viewer is disabled
      onError={() => setEmbedFailed(true)}
    >
      <iframe
        src={blobUrl}
        width={320}
        height={160}
        title="Label PDF Preview"
        onError={() => setEmbedFailed(true)}
      />
    </object>
  );
};

export default PDFLabelPreview;