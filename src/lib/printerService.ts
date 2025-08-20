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

  const { data, error } = await (supabase as any)
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

  const { error } = await (supabase as any)
    .from('printer_settings')
    .upsert({
      ...settings,
      user_id: user.user.id,
      last_seen: new Date().toISOString()
    });

  if (error) throw error;
}

export async function insertPrintJob(job: {
  workstation_id: string;
  status: string;
  copies: number;
  language: string;
  payload: string;
  printer_name?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      workstation_id: job.workstation_id,
      status: job.status,
      tspl_code: job.payload, // Map payload to tspl_code field
      printer_name: job.printer_name,
      payload_type: job.language,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function updatePrintJobStatus(
  id: string, 
  status: string, 
  errorMessage?: string
): Promise<void> {
  const updateData: any = { status };
  if (errorMessage !== undefined) updateData.error_message = errorMessage;

  const { error: updateError } = await supabase
    .from('print_jobs')
    .update(updateData)
    .eq('id', id);

  if (updateError) throw updateError;
}

// Queue-based print job creation (no direct printing)
export async function queuePrintJob(job: {
  workstationId: string;
  tsplCode: string;
  printerName?: string;
  copies?: number;
}): Promise<string> {
  const jobId = await insertPrintJob({
    workstation_id: job.workstationId,
    status: 'queued',
    copies: job.copies || 1,
    language: 'ROLLO_AGENT',
    payload: job.tsplCode,
    printer_name: job.printerName
  });

  console.log(`Queued print job ${jobId} for workstation ${job.workstationId}`);
  return jobId;
}

// Queue multiple print jobs
export async function queuePrintBatch(
  jobs: Array<{
    workstationId: string;
    tsplCode: string;
    printerName?: string;
    copies?: number;
  }>
): Promise<string[]> {
  const jobIds: string[] = [];
  
  for (const job of jobs) {
    const jobId = await queuePrintJob(job);
    jobIds.push(jobId);
  }
  
  console.log(`Queued ${jobIds.length} print jobs`);
  return jobIds;
}