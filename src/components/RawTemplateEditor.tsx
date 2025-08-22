import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePrintNode } from '@/hooks/usePrintNode';

const DEFAULT_ZPL = `^XA
^PW406
^LL203
^FO10,8^A0N,20,20^FDSKU: {{sku}}^FS
^FO10,40^BY{{module_width}},2,120^BCN,120,Y,N,N^FD{{barcode}}^FS
^XZ`;

const DEFAULT_TSPL = `SIZE 2,1
DENSITY 10
SPEED 4
DIRECTION 1
CLS
TEXT 10,8,"0",0,1,1,"SKU: {{sku}}"
BARCODE 10,36,"128",110,1,0,{{module_width}},6,"{{barcode}}"
PRINT 1`;

export function RawTemplateEditor() {
  const { printRAW, selectedPrinterId, isConnected } = usePrintNode();
  const [engine, setEngine] = useState<'ZPL' | 'TSPL'>('ZPL');
  const [template, setTemplate] = useState(DEFAULT_ZPL);
  const [values, setValues] = useState<Record<string, string>>({
    sku: "ABC-123",
    barcode: "ABC123456789",
    module_width: "2",
  });
  const [isLoading, setIsLoading] = useState(false);

  const detectTokens = (template: string): string[] => {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const tokens = new Set<string>();
    let match;
    while ((match = regex.exec(template)) !== null) {
      tokens.add(match[1]);
    }
    return Array.from(tokens);
  };

  const interpolateTemplate = (template: string, values: Record<string, string>): string => {
    const tokens = detectTokens(template);
    let result = template;
    
    for (const token of tokens) {
      const value = values[token];
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        throw new Error(`Missing required variable: ${token}`);
      }
      const regex = new RegExp(`{{\\s*${token}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  };

  const addSizeGuards = (template: string, engine: 'ZPL' | 'TSPL'): string => {
    if (engine === 'ZPL') {
      const hasPW = /\^PW\d+/.test(template);
      const hasLL = /\^LL\d+/.test(template);
      if (!hasPW || !hasLL) {
        const header = `^XA\n^PW406\n^LL203\n`;
        const body = template.replace(/^\s*\^XA/, "").replace(/\^XZ\s*$/, "");
        return `${header}${body}\n^XZ`;
      }
    } else if (engine === 'TSPL') {
      const hasSIZE = /(^|\n)\s*SIZE\s+2\s*,\s*1\b/i.test(template);
      if (!hasSIZE) {
        return `SIZE 2,1\n${template.trim()}`;
      }
    }
    return template;
  };

  const onEngineChange = (newEngine: 'ZPL' | 'TSPL') => {
    setEngine(newEngine);
    setTemplate(newEngine === 'ZPL' ? DEFAULT_ZPL : DEFAULT_TSPL);
  };

  const handlePrint = async () => {
    if (!selectedPrinterId) {
      toast.error('Select a PrintNode printer first');
      return;
    }

    try {
      setIsLoading(true);
      const interpolated = interpolateTemplate(template, values);
      const guarded = addSizeGuards(interpolated, engine);
      
      const result = await printRAW(guarded, {
        title: `Raw ${engine} Label`,
        copies: 1
      });

      if (result.success) {
        toast.success(`Raw ${engine} label sent to PrintNode (Job ID: ${result.jobId})`);
      } else {
        throw new Error(result.error || 'Print failed');
      }
    } catch (error: any) {
      toast.error(`Raw template print failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const tokens = useMemo(() => detectTokens(template), [template]);
  const preview = useMemo(() => {
    try {
      return interpolateTemplate(template, values);
    } catch {
      return template;
    }
  }, [template, values]);

  return (
    <Card className="shadow-aloha">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Raw Template Print
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {engine}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-sm font-medium">Engine</Label>
            <Select value={engine} onValueChange={onEngineChange}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ZPL">ZPL</SelectItem>
                <SelectItem value="TSPL">TSPL</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handlePrint}
              disabled={isLoading || !selectedPrinterId || !isConnected}
              className="ml-auto bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              {isLoading ? "Printing..." : "Print Raw"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Template</Label>
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="font-mono text-xs h-48 resize-none"
                placeholder="Paste your ZPL/TSPL template here..."
              />
              <p className="text-xs text-muted-foreground">
                Use {engine === 'ZPL' ? '^PW406 and ^LL203' : 'SIZE 2,1'} for 2×1 labels. 
                Server auto-adds if missing.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Variables</Label>
              <div className="space-y-2 max-h-32 overflow-auto">
                {tokens.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No <code>{"{{tokens}}"}</code> detected in template.
                  </div>
                )}
                {tokens.map((token) => (
                  <div key={token} className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">{token}</Label>
                    <Input
                      className="text-xs h-8"
                      value={values[token] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [token]: e.target.value }))
                      }
                      placeholder={`Enter ${token}`}
                    />
                  </div>
                ))}
              </div>

              <Label className="text-sm font-medium mt-4">Preview</Label>
              <pre className="text-xs bg-muted p-2 rounded h-24 overflow-auto font-mono">
                {preview}
              </pre>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
            <strong>Raw Template Printing:</strong> Paste ZPL or TSPL templates with {"{{tokens}}"} for variable interpolation. 
            This sends raw printer commands directly to PrintNode for maximum precision and speed.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}