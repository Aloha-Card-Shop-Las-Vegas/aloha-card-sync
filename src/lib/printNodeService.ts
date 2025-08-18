import { supabase } from '@/integrations/supabase/client';

interface PrintNodePrinter {
  id: number;
  name: string;
  description: string;
  capabilities: string[];
  default: boolean;
  createTimestamp: string;
  state: string;
}

interface PrintNodeJob {
  id: number;
  printer: PrintNodePrinter;
  title: string;
  contentType: string;
  source: string;
  createTimestamp: string;
  state: string;
}

interface PrintJobOptions {
  copies?: number;
  title?: string;
}

interface PrintJobResult {
  jobId: number;
  success: boolean;
  error?: string;
}

class PrintNodeService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.printnode.com';

  async initialize(): Promise<void> {
    // Get API key from Supabase edge function
    const { data } = await supabase.functions.invoke('get-printnode-key');
    if (!data?.apiKey) {
      throw new Error('PrintNode API key not configured');
    }
    this.apiKey = data.apiKey;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      await this.initialize();
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${btoa(this.apiKey + ':')}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`PrintNode API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getPrinters(): Promise<PrintNodePrinter[]> {
    return this.makeRequest<PrintNodePrinter[]>('/printers');
  }

  async printPDF(
    pdfBase64: string,
    printerId: number,
    options: PrintJobOptions = {}
  ): Promise<PrintJobResult> {
    try {
      const printJob = {
        printerId,
        title: options.title || 'Label Print',
        contentType: 'pdf_base64',
        content: pdfBase64,
        source: 'web-app',
        ...(options.copies && { qty: options.copies })
      };

      const result = await this.makeRequest<PrintNodeJob>('/printjobs', {
        method: 'POST',
        body: JSON.stringify(printJob),
      });

      return {
        jobId: result.id,
        success: true
      };
    } catch (error) {
      return {
        jobId: -1,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getJobStatus(jobId: number): Promise<PrintNodeJob> {
    return this.makeRequest<PrintNodeJob>(`/printjobs/${jobId}`);
  }
}

export const printNodeService = new PrintNodeService();