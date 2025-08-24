import { useState, useEffect, useCallback } from 'react';
import { printNodeService } from '@/lib/printNodeService';
import { toast } from 'sonner';

interface PrintNodePrinter {
  id: number;
  name: string;
  description: string;
  capabilities: string[];
  default: boolean;
  createTimestamp: string;
  state: string;
}

export function usePrintNode() {
  const [printers, setPrinters] = useState<PrintNodePrinter[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');

  // Load saved printer selection
  useEffect(() => {
    const saved = localStorage.getItem('printnode-selected-printer');
    if (saved) setSelectedPrinterId(parseInt(saved));
  }, []);

  // Save printer selection
  useEffect(() => {
    if (selectedPrinterId) {
      localStorage.setItem('printnode-selected-printer', selectedPrinterId.toString());
    }
  }, [selectedPrinterId]);

  const refreshPrinters = useCallback(async (showToast = false) => {
    setIsLoading(true);
    setConnectionError('');
    try {
      const printerList = await printNodeService.getPrinters();
      setPrinters(printerList);
      setIsConnected(true);
      
      // Auto-select saved printer or first available
      const saved = localStorage.getItem('printnode-selected-printer');
      if (saved && printerList.find(p => p.id === parseInt(saved))) {
        setSelectedPrinterId(parseInt(saved));
      } else if (printerList.length > 0 && !selectedPrinterId) {
        setSelectedPrinterId(printerList[0].id);
      }
      
      if (showToast) {
        toast.success(`PrintNode connected - Found ${printerList.length} printer(s)`);
      }
    } catch (error) {
      setIsConnected(false);
      setPrinters([]);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to PrintNode";
      setConnectionError(errorMessage);
      if (showToast) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedPrinterId]);

  // Initialize on mount
  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  const printPDF = useCallback(async (pdfBase64: string, options?: { title?: string; copies?: number }) => {
    if (!selectedPrinterId) {
      throw new Error('No printer selected');
    }
    return printNodeService.printPDF(pdfBase64, selectedPrinterId, options);
  }, [selectedPrinterId]);

  const printRAW = useCallback(async (rawText: string, options?: { title?: string; copies?: number }) => {
    if (!selectedPrinterId) {
      throw new Error('No printer selected');
    }
    return printNodeService.printRAW(rawText, selectedPrinterId, options);
  }, [selectedPrinterId]);

  const selectedPrinter = printers.find(p => p.id === selectedPrinterId) || null;

  return {
    printers,
    selectedPrinter,
    selectedPrinterId,
    setSelectedPrinterId,
    isConnected,
    isLoading,
    connectionError,
    refreshPrinters,
    printPDF,
    printRAW
  };
}