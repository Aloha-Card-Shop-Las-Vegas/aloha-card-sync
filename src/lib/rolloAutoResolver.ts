import { printNodeService } from './printNodeService';
import { toast } from 'sonner';

interface RolloPrinter {
  id: number;
  name: string;
  description: string;
  capabilities: string[];
  default: boolean;
  createTimestamp: string;
  state: string;
}

class RolloAutoResolver {
  private cachedPrinterId: number | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Auto-resolves the best Rollo printer available
   * Returns the printer ID or null if none found
   */
  async resolveRolloPrinter(): Promise<{ id: number; name: string } | null> {
    // Use cache if recent
    if (this.cachedPrinterId && Date.now() - this.lastCheck < this.CACHE_DURATION) {
      console.log(`🔄 Using cached Rollo printer ID: ${this.cachedPrinterId}`);
      
      // Verify cached printer still exists
      try {
        const printers = await printNodeService.getPrinters();
        const cachedPrinter = printers.find(p => p.id === this.cachedPrinterId);
        if (cachedPrinter && this.isRolloPrinter(cachedPrinter)) {
          return { id: cachedPrinter.id, name: cachedPrinter.name };
        } else {
          console.log(`❌ Cached printer ${this.cachedPrinterId} no longer available, refreshing...`);
          this.cachedPrinterId = null;
        }
      } catch (error) {
        console.error('Failed to verify cached printer:', error);
        this.cachedPrinterId = null;
      }
    }

    try {
      console.log('🔍 Searching for Rollo printers...');
      const allPrinters = await printNodeService.getPrinters();
      
      // Filter for Rollo printers only
      const rolloPrinters = allPrinters.filter(p => this.isRolloPrinter(p));
      
      if (rolloPrinters.length === 0) {
        console.warn('⚠️ No Rollo printers found');
        toast.error('No Rollo printers found. Please check your PrintNode setup.');
        return null;
      }

      // Priority order for Rollo models
      const preferredModels = [
        'Rollo X1038',
        'Rollo X1042', 
        'Rollo Printer',
        'ROLLO'
      ];

      // Find best printer based on priority
      let selectedPrinter: RolloPrinter | null = null;
      
      for (const model of preferredModels) {
        selectedPrinter = rolloPrinters.find(p => 
          p.name.toLowerCase().includes(model.toLowerCase())
        ) || null;
        if (selectedPrinter) break;
      }

      // Fallback to first available Rollo if no preferred model found
      if (!selectedPrinter) {
        selectedPrinter = rolloPrinters[0];
      }

      // Cache the result
      this.cachedPrinterId = selectedPrinter.id;
      this.lastCheck = Date.now();

      console.log(`✅ Auto-selected Rollo printer: ${selectedPrinter.name} (ID: ${selectedPrinter.id})`);
      toast.success(`Auto-selected Rollo printer: ${selectedPrinter.name}`);
      
      return { id: selectedPrinter.id, name: selectedPrinter.name };
    } catch (error) {
      console.error('Failed to resolve Rollo printer:', error);
      toast.error('Failed to connect to PrintNode. Check your connection.');
      return null;
    }
  }

  /**
   * Determines if a printer is a Rollo model
   */
  private isRolloPrinter(printer: any): boolean {
    const name = printer.name.toLowerCase();
    const rolloKeywords = ['rollo', 'x1038', 'x1042'];
    
    // Must contain Rollo keyword
    const hasRolloKeyword = rolloKeywords.some(keyword => name.includes(keyword));
    
    // Exclude specific problematic models
    const excludedModels = ['x1040', 'x1243221259'];
    const isExcluded = excludedModels.some(model => name.includes(model));
    
    return hasRolloKeyword && !isExcluded;
  }

  /**
   * Force refresh the cached printer
   */
  refreshCache(): void {
    this.cachedPrinterId = null;
    this.lastCheck = 0;
    console.log('🔄 Rollo printer cache cleared');
  }

  /**
   * Get current cached printer ID (for display purposes)
   */
  getCachedPrinterId(): number | null {
    return this.cachedPrinterId;
  }
}

export const rolloAutoResolver = new RolloAutoResolver();