import { LabelData } from '@/lib/labelRenderer';

export interface CardItem {
  id?: string;
  title?: string;
  sku?: string;
  price?: string; // Changed to string to match Index.tsx CardItem type
  lot?: string;
  grade?: string;
  year?: string;
  brandTitle?: string;
  cardNumber?: string;
  subject?: string;
  variant?: string;
}

/**
 * Build title from card parts
 */
export function buildTitleFromParts(
  year?: string, 
  brand?: string, 
  cardNumber?: string, 
  subject?: string, 
  variant?: string
): string {
  const parts = [year, brand, cardNumber, subject, variant].filter(Boolean);
  return parts.join(' ');
}

/**
 * Centralized function to build LabelData from CardItem
 * This ensures consistent data mapping between preview and printing
 */
export function buildLabelDataFromItem(item: CardItem): LabelData {
  return {
    title: buildTitleFromParts(item.year, item.brandTitle, item.cardNumber, item.subject, item.variant),
    sku: item.sku || item.id?.toString() || 'NO-SKU',
    price: item.price?.toString() || '',
    lot: item.lot || '',
    condition: item.grade || '',
    barcode: item.sku || item.id?.toString() || 'NO-SKU'
  };
}