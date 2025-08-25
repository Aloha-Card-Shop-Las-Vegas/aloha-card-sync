import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchCards } from '@/integrations/justtcg';
import { normalizeStr, normalizeNumber, includesLoose, similarityScore } from '@/lib/cardSearch';
import type { GameKey, JObjectCard, Printing } from '@/lib/types';
import { GAME_OPTIONS } from '@/lib/types';

interface RawCardIntakeProps {
  defaultGame?: GameKey;
  defaultPrinting?: Printing;
  defaultConditions?: string;
  onPick?: (payload: {
    card: JObjectCard;
    chosenVariant?: {
      condition: string;
      printing: Printing;
      price?: number;
    };
  }) => void;
}

const PRINTINGS: Printing[] = ['Normal', 'Foil'];

export function RawCardIntake({
  defaultGame = 'pokemon',
  defaultPrinting = 'Normal',
  defaultConditions = 'NM,LP',
  onPick,
}: RawCardIntakeProps) {
  const [game, setGame] = useState<GameKey>(defaultGame);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [printing, setPrinting] = useState<Printing>(defaultPrinting);
  const [conditionCsv, setConditionCsv] = useState(defaultConditions);
  const [suggestions, setSuggestions] = useState<JObjectCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<JObjectCard | null>(null);

  const { toast } = useToast();
  const debounceRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const normalizedName = useMemo(() => normalizeStr(name), [name]);
  const normalizedNumber = useMemo(() => normalizeNumber(number), [number]);

  // Search effect
  useEffect(() => {
    if (!normalizedName) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const { data } = await searchCards({
          name: normalizedName,
          game,
          number: normalizedNumber.num,
        });

        if (controller.signal.aborted) return;

        // Filter and rank results
        const filtered = (data || []).filter(card => {
          // Name must match
          if (!includesLoose(card.name || '', normalizedName)) return false;

          // Number filter if provided
          if (normalizedNumber.num) {
            const cardNum = String(card.number || '');
            if (!cardNum) return false;

            if (normalizedNumber.denom) {
              // Exact match for "201/197" format
              const [n, d] = cardNum.split('/');
              return n === normalizedNumber.num && d === normalizedNumber.denom;
            } else {
              // Match "201" or "201/xxx"
              const [n] = cardNum.split('/');
              return n === normalizedNumber.num || cardNum === normalizedNumber.num;
            }
          }

          return true;
        });

        // Rank by similarity
        const ranked = filtered
          .map(card => ({
            card,
            score: similarityScore(card.name || '', name) + 
                   (String(card.number) === number ? 0.05 : 0),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(x => x.card);

        setSuggestions(ranked);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          const message = err.message || 'Failed to search cards';
          setError(message);
          toast({
            title: 'Search Error',
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [game, normalizedName, normalizedNumber.num, name, number, toast]);

  const findBestVariant = (card: JObjectCard) => {
    const preferences = conditionCsv.split(',').map(s => s.trim()).filter(Boolean);
    const variants = card.variants || [];

    // Condition mapping
    const conditionMap: Record<string, string> = {
      'SEALED': 'S',
      'NEAR MINT': 'NM',
      'LIGHTLY PLAYED': 'LP',
      'MODERATELY PLAYED': 'MP',
      'HEAVILY PLAYED': 'HP',
      'DAMAGED': 'DMG',
    };

    const normalizeCondition = (cond: string) => {
      const upper = normalizeStr(cond).toUpperCase();
      return conditionMap[upper] || upper;
    };

    // Find best matching variant
    for (const prefCond of preferences) {
      const variant = variants.find(v => 
        v.printing === printing && 
        normalizeCondition(String(v.condition)) === normalizeCondition(prefCond)
      );
      if (variant) return variant;
    }

    // Fallback to any variant with matching printing
    return variants.find(v => v.printing === printing) || variants[0];
  };

  const handleSuggestionClick = (card: JObjectCard) => {
    setPicked(card);
    const chosenVariant = findBestVariant(card);
    
    onPick?.({
      card,
      chosenVariant: chosenVariant ? {
        condition: String(chosenVariant.condition),
        printing: chosenVariant.printing,
        price: chosenVariant.price,
      } : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Raw Card Intake
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Game Selection */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="game">Game</Label>
            <Select value={game} onValueChange={(value: GameKey) => setGame(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="printing">Printing</Label>
            <Select value={printing} onValueChange={(value: Printing) => setPrinting(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRINTINGS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="conditions">Preferred Conditions (CSV)</Label>
            <Input
              id="conditions"
              placeholder="NM,LP,MP"
              value={conditionCsv}
              onChange={(e) => setConditionCsv(e.target.value)}
            />
          </div>
        </div>

        {/* Search Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="name">Card Name</Label>
            <Input
              id="name"
              placeholder="e.g., Charizard ex"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="number">Card Number (Optional)</Label>
            <Input
              id="number"
              placeholder="e.g., 201/197 or 201"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-base font-semibold">Suggestions</Label>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3" role="region" aria-live="polite">
            {suggestions.map(card => (
              <Button
                key={card.cardId}
                variant="outline"
                className="h-auto p-3 text-left flex flex-col items-start"
                onClick={() => handleSuggestionClick(card)}
                aria-label={`Select ${card.name} from ${card.set}`}
              >
                <img
                  src={card.images?.small || card.images?.large || '/placeholder.svg'}
                  alt={card.name}
                  className="w-full h-32 object-contain mb-2 rounded"
                  loading="lazy"
                />
                <div className="text-sm font-medium truncate w-full">{card.name}</div>
                <div className="text-xs text-muted-foreground">
                  {card.set} {card.number ? `• #${card.number}` : ''}
                </div>
              </Button>
            ))}
          </div>

          {!loading && suggestions.length === 0 && normalizedName && (
            <div className="text-center py-8 text-muted-foreground">
              No matches found for "{name}"
            </div>
          )}
        </div>

        {/* Selected Card Preview */}
        {picked && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selected Card</CardTitle>
            </CardHeader>
            <CardContent>
              <ChosenPricePanel 
                card={picked} 
                printing={printing} 
                conditionCsv={conditionCsv} 
              />
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

function ChosenPricePanel({ 
  card, 
  printing, 
  conditionCsv 
}: { 
  card: JObjectCard; 
  printing: Printing; 
  conditionCsv: string; 
}) {
  const preferences = conditionCsv.split(',').map(s => s.trim()).filter(Boolean);
  const variants = card.variants || [];
  
  const conditionMap: Record<string, string> = {
    'SEALED': 'S', 'NEAR MINT': 'NM', 'LIGHTLY PLAYED': 'LP',
    'MODERATELY PLAYED': 'MP', 'HEAVILY PLAYED': 'HP', 'DAMAGED': 'DMG'
  };
  
  const normalizeCondition = (cond: string) => {
    const upper = normalizeStr(cond).toUpperCase();
    return conditionMap[upper] || upper;
  };

  let chosenVariant = null;
  for (const pref of preferences) {
    const match = variants.find(v => 
      v.printing === printing && 
      normalizeCondition(String(v.condition)) === normalizeCondition(pref)
    );
    if (match) {
      chosenVariant = match;
      break;
    }
  }
  
  if (!chosenVariant) {
    chosenVariant = variants.find(v => v.printing === printing) || variants[0];
  }

  return (
    <div className="space-y-2">
      <div><span className="text-muted-foreground">Name:</span> {card.name}</div>
      <div><span className="text-muted-foreground">Set:</span> {card.set || '—'}</div>
      <div><span className="text-muted-foreground">Number:</span> {card.number || '—'}</div>
      <div><span className="text-muted-foreground">Printing:</span> {printing}</div>
      <div><span className="text-muted-foreground">Condition:</span> {chosenVariant?.condition || '—'}</div>
      <div><span className="text-muted-foreground">Price:</span> {
        chosenVariant?.price != null ? `$${Number(chosenVariant.price).toFixed(2)}` : '—'
      }</div>
    </div>
  );
}