import { supabase } from "@/integrations/supabase/client";

interface PrinterSettings {
  id: string;
  workstation_id: string;
  selected_printer_name?: string;
  use_printnode: boolean;
  bridge_port: number;
  created_at?: string;
  updated_at?: string;
}

interface PrintJob {
  id: string;
  workstation_id: string;
  template_id?: string;
  data: Record<string, any>;
  target: { ip?: string; printer_name?: string };
  copies: number;
  status: 'queued' | 'printing' | 'printed' | 'failed';
  tspl_body?: string;
  created_at?: string;
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

// Legacy functions for backward compatibility (but not recommended for new code)
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
  const { data, error } = await supabase
    .from('printer_settings')
    .select('*')
    .eq('workstation_id', workstationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertPrinterSettings(settings: Partial<PrinterSettings> & { workstation_id: string }): Promise<void> {
  const { error } = await supabase
    .from('printer_settings')
    .upsert({
      ...settings,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

// New Supabase Queue System - Template-based print jobs
export async function queueTemplateJob(job: {
  workstationId: string;
  templateId: string;
  data: Record<string, any>;
  printerName?: string;
  copies?: number;
}): Promise<string> {
  console.log('Queueing template print job:', job);
  
  try {
    const { data, error } = await supabase
      .from('print_jobs')
      .insert([{
        workstation_id: job.workstationId,
        template_id: job.templateId,
        data: job.data,
        target: job.printerName 
          ? { printer_name: job.printerName }
          : { ip: '192.168.1.50' }, // Default IP
        copies: job.copies || 1,
        status: 'queued',
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Error queueing template print job:', error);
      throw error;
    }

    console.log('Template print job queued successfully:', data.id);
    return data.id;
  } catch (error) {
    console.error('Failed to queue template print job:', error);
    throw error;
  }
}

// Raw TSPL print jobs (for one-offs)
export async function queueRawTSPLJob(job: {
  workstationId: string;
  tsplBody: string;
  data?: Record<string, any>;
  printerName?: string;
  copies?: number;
}): Promise<string> {
  console.log('Queueing raw TSPL print job:', job);
  
  try {
    const { data, error } = await supabase
      .from('print_jobs')
      .insert([{
        workstation_id: job.workstationId,
        tspl_body: job.tsplBody,
        data: job.data || {},
        target: job.printerName 
          ? { printer_name: job.printerName }
          : { ip: '192.168.1.50' }, // Default IP
        copies: job.copies || 1,
        status: 'queued',
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Error queueing raw TSPL print job:', error);
      throw error;
    }

    console.log('Raw TSPL print job queued successfully:', data.id);
    return data.id;
  } catch (error) {
    console.error('Failed to queue raw TSPL print job:', error);
    throw error;
  }
}

// Batch template jobs
export async function queueTemplateBatch(
  jobs: Array<{
    workstationId: string;
    templateId: string;
    data: Record<string, any>;
    printerName?: string;
    copies?: number;
  }>
): Promise<string[]> {
  console.log('Queueing batch template print jobs:', jobs.length);
  
  try {
    const batchData = jobs.map(job => ({
      workstation_id: job.workstationId,
      template_id: job.templateId,
      data: job.data,
      target: job.printerName 
        ? { printer_name: job.printerName }
        : { ip: '192.168.1.50' }, // Default IP
      copies: job.copies || 1,
      status: 'queued' as const,
    }));

    const { data, error } = await supabase
      .from('print_jobs')
      .insert(batchData)
      .select('id');

    if (error) {
      console.error('Error queueing batch template print jobs:', error);
      throw error;
    }

    const ids = data.map(row => row.id);
    console.log('Batch template print jobs queued successfully:', ids);
    return ids;
  } catch (error) {
    console.error('Failed to queue batch template print jobs:', error);
    throw error;
  }
}

// Legacy functions for backward compatibility (deprecated - use template-based functions above)
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
      tspl_body: job.payload, // Use tspl_body for raw TSPL
      data: {}, // Empty data object
      target: job.printer_name ? { printer_name: job.printer_name } : { ip: '192.168.1.50' },
      copies: job.copies,
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
  if (errorMessage !== undefined) updateData.error = errorMessage;

  const { error: updateError } = await supabase
    .from('print_jobs')
    .update(updateData)
    .eq('id', id);

  if (updateError) throw updateError;
}

// Queue-based print job creation (deprecated - use queueRawTSPLJob instead)
export async function queuePrintJob(job: {
  workstationId: string;
  tsplCode: string;
  printerName?: string;
  copies?: number;
}): Promise<string> {
  return queueRawTSPLJob({
    workstationId: job.workstationId,
    tsplBody: job.tsplCode,
    printerName: job.printerName,
    copies: job.copies,
  });
}

// Queue multiple print jobs (deprecated - use queueTemplateBatch instead)
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