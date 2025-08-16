import { supabase } from "@/integrations/supabase/client";

export interface PrinterSettings {
  user_id: string;
  workstation_id: string;
  preferred_printer?: string;
  bridge_port?: number;
  last_seen?: string;
}

export interface PrintJob {
  id?: string;
  user_id?: string;
  workstation_id?: string;
  status?: 'queued' | 'sent' | 'error' | 'reprinted';
  copies?: number;
  language?: string;
  payload: string;
  error?: string;
  created_at?: string;
}

export interface TSPLJob {
  tspl: string;
  copies?: number;
}

// Generate workstation ID from browser fingerprint
export function generateWorkstationId(): string {
  const stored = localStorage.getItem('workstation_id');
  if (stored) return stored;
  
  const userAgent = navigator.userAgent;
  const screenRes = `${screen.width}x${screen.height}`;
  const random = Math.random().toString(36).substring(2, 8);
  const workstationId = `${userAgent.slice(0, 20)}-${screenRes}-${random}`.replace(/[^a-zA-Z0-9-]/g, '');
  
  localStorage.setItem('workstation_id', workstationId);
  return workstationId;
}

// Fetch available printers from local bridge
export async function fetchPrinters(port: number = 17777): Promise<string[]> {
  const response = await fetch(`http://127.0.0.1:${port}/printers`, { 
    method: 'GET' 
  });
  
  if (!response.ok) {
    throw new Error('Bridge offline or unreachable');
  }
  
  const printers = await response.json();
  return Array.isArray(printers) ? printers.map(p => typeof p === 'string' ? p : p.name) : [];
}

// Send TSPL to local bridge
export async function sendTSPL(tspl: string, options: {
  printerName?: string;
  copies?: number;
  port?: number;
} = {}): Promise<void> {
  const { printerName = '', copies = 1, port = 17777 } = options;
  
  const params = new URLSearchParams({
    printerName,
    copies: String(copies)
  });
  
  const response = await fetch(`http://127.0.0.1:${port}/print?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: tspl
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Print job failed');
  }
}

// Supabase printer settings functions
export async function getPrinterSettings(workstationId: string): Promise<PrinterSettings | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('printer_settings')
    .select('*')
    .eq('user_id', user.user.id)
    .eq('workstation_id', workstationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertPrinterSettings(settings: Partial<PrinterSettings>): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('printer_settings')
    .upsert({
      ...settings,
      user_id: user.user.id,
      last_seen: new Date().toISOString()
    });

  if (error) throw error;
}

export async function insertPrintJob(job: Omit<PrintJob, 'id' | 'created_at'>): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      ...job,
      user_id: user.user.id
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function updatePrintJobStatus(
  id: string, 
  status: PrintJob['status'], 
  error?: string
): Promise<void> {
  const updateData: any = { status };
  if (error !== undefined) updateData.error = error;

  const { error: updateError } = await supabase
    .from('print_jobs')
    .update(updateData)
    .eq('id', id);

  if (updateError) throw updateError;
}

// Batch printing with error handling
export async function printBatch(
  jobs: TSPLJob[], 
  context: {
    workstationId: string;
    printerName?: string;
    port?: number;
    onProgress?: (current: number, total: number) => void;
    onError?: (error: string) => void;
  }
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    
    try {
      // Insert job record
      const jobId = await insertPrintJob({
        workstation_id: context.workstationId,
        status: 'queued',
        copies: job.copies || 1,
        language: 'TSPL',
        payload: job.tspl
      });

      try {
        // Send to printer
        await sendTSPL(job.tspl, {
          printerName: context.printerName,
          copies: job.copies,
          port: context.port
        });

        await updatePrintJobStatus(jobId, 'sent');
        success++;
      } catch (printError) {
        const errorMsg = printError instanceof Error ? printError.message : 'Print failed';
        await updatePrintJobStatus(jobId, 'error', errorMsg);
        context.onError?.(errorMsg);
        failed++;
      }
    } catch (dbError) {
      context.onError?.(dbError instanceof Error ? dbError.message : 'Database error');
      failed++;
    }

    context.onProgress?.(i + 1, jobs.length);
  }

  return { success, failed };
}