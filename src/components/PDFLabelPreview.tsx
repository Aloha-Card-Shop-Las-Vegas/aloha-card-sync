// src/components/PDFLabelPreview.tsx
import React, { useEffect, useState } from "react";
import { generateLabelPDF } from "@/lib/labelRenderer";
import { buildLabelDataFromItem, CardItem } from "@/lib/labelData";
import { getLabelDesignerSettings } from "@/lib/labelDesignerSettings";

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

        // Build the exact same data as print
        const { fieldConfig } = getLabelDesignerSettings();
        const labelData = buildLabelDataFromItem(item);
        const pdfBase64 = await generateLabelPDF(fieldConfig, labelData); // returns base64 (no data: prefix)
        const bytes = ensureUint8Array(pdfBase64);

        // Blob URL is more Chrome/CSP friendly than data:
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        urlToRevoke = url;
        if (!mounted) return;
        setBlobUrl(url);

        // Add a timeout to detect if PDF embedding fails
        // This helps catch cases where Chrome silently blocks the PDF
        setTimeout(() => {
          if (mounted) {
            // Check if we should show fallback after a delay
            // This is a heuristic since onError isn't always reliable
            const shouldShowFallback = 
              // Check for common PDF viewer blocking scenarios
              navigator.userAgent.includes('Chrome') &&
              (navigator.plugins.length === 0 || !Array.from(navigator.plugins).some(p => p.name.toLowerCase().includes('pdf')));
            
            if (shouldShowFallback) {
              setEmbedFailed(true);
            }
          }
        }, 1500);
        
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

  const openInNewTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="w-80 h-40 bg-muted flex items-center justify-center border rounded text-sm">
        Generating preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 h-40 bg-muted flex items-center justify-center border rounded text-xs text-red-600">
        {error}
      </div>
    );
  }

  if (!blobUrl) return null;

  // If Chrome blocks the embed, show an explicit fallback
  if (embedFailed) {
    return (
      <div className="w-80 h-40 bg-muted flex flex-col items-center justify-center border rounded gap-2">
        <div className="text-xs text-muted-foreground text-center">
          PDF preview blocked by browser settings
        </div>
        <button
          className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
          onClick={openInNewTab}
        >
          Open PDF in new tab
        </button>
      </div>
    );
  }

  // Try to embed the PDF first
  return (
    <object
      data={blobUrl}
      type="application/pdf"
      width={320}
      height={160}
      aria-label="Label PDF Preview"
      className="border rounded"
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