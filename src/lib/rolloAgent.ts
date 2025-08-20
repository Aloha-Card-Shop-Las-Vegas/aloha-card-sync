// Rollo Print Agent SDK
export type Target = { 
  ip?: string; 
  printer_name?: string 
};

export type PrintJob = {
  template_id: string;
  data: Record<string, string>;
  target: Target;
  copies?: number;
};

export type Template = {
  id: string;
  name: string;
  description?: string;
  fields: string[];
};

export type PrintResponse = {
  status: string;
  bytes: number;
  copies: number;
};

export type BatchPrintResponse = {
  status: string;
  total_jobs: number;
  successful: number;
  failed: number;
};

const BASE_URL = "http://127.0.0.1:9410";

// Agent Detection
export async function detectAgent(baseUrl = BASE_URL, timeoutMs = 800): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    clearTimeout(timeout);
    console.log('Agent detection failed:', error);
    return false;
  }
}

// Generic API call helper
async function callAgent<T>(path: string, body: any, token: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `Agent error ${response.status}: ${text}`;
    
    // Parse specific error messages
    try {
      const errorData = JSON.parse(text);
      if (errorData.missing_fields) {
        errorMessage = `Missing required fields: ${errorData.missing_fields.join(', ')}`;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Keep the original error message if parsing fails
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

// Generic GET helper
async function getFromAgent<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent error ${response.status}: ${text}`);
  }

  return response.json();
}

// Print single label
export async function printLabel(job: PrintJob, token: string): Promise<PrintResponse> {
  return callAgent("/print", job, token);
}

// Print batch of labels
export async function printBatch(jobs: PrintJob[], token: string): Promise<BatchPrintResponse> {
  return callAgent("/print-batch", jobs, token);
}

// Get available templates
export async function getTemplates(token: string): Promise<Template[]> {
  return getFromAgent("/templates", token);
}

// Get specific template
export async function getTemplate(templateId: string, token: string): Promise<any> {
  return getFromAgent(`/templates/${templateId}`, token);
}

// Verify token by calling templates endpoint
export async function verifyToken(token: string): Promise<boolean> {
  try {
    await getTemplates(token);
    return true;
  } catch (error) {
    console.log('Token verification failed:', error);
    return false;
  }
}

// Storage helpers
export function saveToken(token: string): void {
  localStorage.setItem("rolloToken", token);
}

export function getToken(): string {
  return localStorage.getItem("rolloToken") || "";
}

export function saveTarget(target: Target): void {
  localStorage.setItem("rolloTarget", JSON.stringify(target));
}

export function getTarget(): Target | null {
  const saved = localStorage.getItem("rolloTarget");
  return saved ? JSON.parse(saved) : null;
}

export function saveTemplateId(templateId: string): void {
  localStorage.setItem("rolloTemplateId", templateId);
}

export function getTemplateId(): string {
  return localStorage.getItem("rolloTemplateId") || "price-2x1-v1";
}
