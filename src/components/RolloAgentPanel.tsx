import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, TestTube, Settings, WifiOff, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { 
  detectAgent, 
  verifyToken, 
  printLabel, 
  getTemplates,
  saveToken, 
  getToken, 
  saveTarget, 
  getTarget, 
  saveTemplateId, 
  getTemplateId,
  type Target,
  type Template,
  type PrintResponse
} from "@/lib/rolloAgent";

type SetupStep = 'detect' | 'token' | 'target' | 'test' | 'complete';

export function RolloAgentPanel() {
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('detect');
  const [token, setToken] = useState<string>('');
  const [target, setTarget] = useState<Target>({ ip: '' });
  const [templateId, setTemplateId] = useState<string>('price-2x1-v1');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [testing, setTesting] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    initializeSetup();
  }, []);

  const initializeSetup = async () => {
    // Load saved settings
    const savedToken = getToken();
    const savedTarget = getTarget();
    const savedTemplateId = getTemplateId();
    
    if (savedToken) setToken(savedToken);
    if (savedTarget) setTarget(savedTarget);
    if (savedTemplateId) setTemplateId(savedTemplateId);

    // Check agent status
    await checkAgent();
    
    // If we have saved settings, verify they work
    if (savedToken && savedTarget) {
      const tokenValid = await verifyToken(savedToken);
      if (tokenValid) {
        setSetupStep('complete');
        await loadTemplates(savedToken);
      } else {
        setSetupStep('token');
      }
    }
  };

  const checkAgent = async () => {
    setChecking(true);
    const online = await detectAgent();
    setAgentOnline(online);
    setChecking(false);
    
    if (online && setupStep === 'detect') {
      setSetupStep('token');
    }
  };

  const verifyAndSaveToken = async () => {
    if (!token.trim()) {
      toast.error('Please enter a token');
      return;
    }

    setChecking(true);
    const valid = await verifyToken(token.trim());
    setChecking(false);

    if (valid) {
      saveToken(token.trim());
      await loadTemplates(token.trim());
      setSetupStep('target');
      toast.success('Token verified successfully');
    } else {
      toast.error('Invalid token. Please check and try again.');
    }
  };

  const loadTemplates = async (tokenToUse: string) => {
    try {
      const templateList = await getTemplates(tokenToUse);
      setTemplates(templateList);
      
      // Set default template if available
      if (templateList.length > 0 && !templateList.find(t => t.id === templateId)) {
        setTemplateId(templateList[0].id);
        saveTemplateId(templateList[0].id);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    }
  };

  const saveTargetSettings = () => {
    if (!target.ip && !target.printer_name) {
      toast.error('Please specify either an IP address or printer name');
      return;
    }

    saveTarget(target);
    saveTemplateId(templateId);
    setSetupStep('test');
    toast.success('Target settings saved');
  };

  const runTestPrint = async () => {
    setTesting(true);
    
    try {
      const result: PrintResponse = await printLabel({
        template_id: templateId,
        data: {
          product_name: "TEST PRINT",
          price: "12.99",
          sku: "TEST-001",
          variant: `${new Date().toLocaleTimeString()}`
        },
        target: target,
        copies: 1
      }, token);

      toast.success(`Test print successful! Printed ${result.bytes} bytes`);
      setSetupStep('complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Test print failed';
      toast.error(`Test print failed: ${errorMsg}`);
      
      // If it's a 401, go back to token step
      if (errorMsg.includes('401')) {
        setSetupStep('token');
      }
    } finally {
      setTesting(false);
    }
  };

  const resetSetup = () => {
    setSetupStep('detect');
    setToken('');
    setTarget({ ip: '' });
    localStorage.removeItem('rolloToken');
    localStorage.removeItem('rolloTarget');
    localStorage.removeItem('rolloTemplateId');
    checkAgent();
  };

  const getStepIcon = (step: SetupStep) => {
    if (step === setupStep) {
      return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
    
    switch (step) {
      case 'detect':
        return agentOnline ? <CheckCircle className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />;
      case 'token':
        return token && getToken() ? <CheckCircle className="h-4 w-4 text-green-500" /> : null;
      case 'target':
        return (target.ip || target.printer_name) && getTarget() ? <CheckCircle className="h-4 w-4 text-green-500" /> : null;
      case 'test':
      case 'complete':
        return setupStep === 'complete' ? <CheckCircle className="h-4 w-4 text-green-500" /> : null;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Rollo Print Agent
          {agentOnline ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="h-3 w-3" />
              Offline
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Setup Steps */}
        <div className="space-y-3">
          {/* Step 1: Agent Detection */}
          <div className="flex items-center gap-3">
            {getStepIcon('detect')}
            <span className={setupStep === 'detect' ? 'font-medium' : 'text-muted-foreground'}>
              1. Agent Detection
            </span>
            {setupStep === 'detect' && (
              <Button size="sm" onClick={checkAgent} disabled={checking}>
                {checking ? 'Checking...' : 'Retry'}
              </Button>
            )}
          </div>

          {!agentOnline && setupStep === 'detect' && (
            <div className="ml-7 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700 mb-2">
                Rollo Print Agent not found at http://127.0.0.1:9410
              </p>
              <p className="text-xs text-red-600">
                Please install and run the Rollo Print Agent, then click 'Retry'.
              </p>
            </div>
          )}

          {/* Step 2: Token Verification */}
          {(setupStep === 'token' || setupStep === 'target' || setupStep === 'test' || setupStep === 'complete') && (
            <div className="flex items-center gap-3">
              {getStepIcon('token')}
              <span className={setupStep === 'token' ? 'font-medium' : 'text-muted-foreground'}>
                2. Token Verification
              </span>
            </div>
          )}

          {setupStep === 'token' && (
            <div className="ml-7 space-y-3">
              <div>
                <Label htmlFor="agent-token">Agent Token</Label>
                <Input
                  id="agent-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your ROLLO_AGENT_TOKEN"
                />
              </div>
              <Button onClick={verifyAndSaveToken} disabled={checking}>
                {checking ? 'Verifying...' : 'Verify Token'}
              </Button>
            </div>
          )}

          {/* Step 3: Target Configuration */}
          {(setupStep === 'target' || setupStep === 'test' || setupStep === 'complete') && (
            <div className="flex items-center gap-3">
              {getStepIcon('target')}
              <span className={setupStep === 'target' ? 'font-medium' : 'text-muted-foreground'}>
                3. Printer Target
              </span>
            </div>
          )}

          {setupStep === 'target' && (
            <div className="ml-7 space-y-3">
              <div>
                <Label htmlFor="printer-ip">Printer IP Address</Label>
                <Input
                  id="printer-ip"
                  value={target.ip || ''}
                  onChange={(e) => setTarget({ ...target, ip: e.target.value, printer_name: '' })}
                  placeholder="e.g., 192.168.1.50"
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">OR</div>
              <div>
                <Label htmlFor="printer-name">Printer Name (USB)</Label>
                <Input
                  id="printer-name"
                  value={target.printer_name || ''}
                  onChange={(e) => setTarget({ ...target, printer_name: e.target.value, ip: '' })}
                  placeholder="e.g., Rollo_USB"
                />
              </div>
              <div>
                <Label htmlFor="template-select">Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name || template.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveTargetSettings}>
                Save Settings
              </Button>
            </div>
          )}

          {/* Step 4: Test Print */}
          {(setupStep === 'test' || setupStep === 'complete') && (
            <div className="flex items-center gap-3">
              {getStepIcon('test')}
              <span className={setupStep === 'test' ? 'font-medium' : 'text-muted-foreground'}>
                4. Test Print
              </span>
            </div>
          )}

          {setupStep === 'test' && (
            <div className="ml-7">
              <Button onClick={runTestPrint} disabled={testing} className="gap-2">
                <TestTube className="h-4 w-4" />
                {testing ? 'Testing...' : 'Send Test Print'}
              </Button>
            </div>
          )}

          {/* Setup Complete */}
          {setupStep === 'complete' && (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-700">Setup Complete!</span>
            </div>
          )}
        </div>

        {setupStep === 'complete' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                <strong>Target:</strong> {target.ip ? `IP: ${target.ip}` : `Printer: ${target.printer_name}`}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Template:</strong> {templateId}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={runTestPrint} disabled={testing} variant="outline">
                  <TestTube className="h-4 w-4 mr-2" />
                  {testing ? 'Testing...' : 'Test Print'}
                </Button>
                <Button size="sm" onClick={resetSetup} variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Reconfigure
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Agent Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Connects to Rollo Print Agent at http://127.0.0.1:9410
          <br />
          {templates.length > 0 && `${templates.length} template${templates.length !== 1 ? 's' : ''} available`}
        </div>
      </CardContent>
    </Card>
  );
}