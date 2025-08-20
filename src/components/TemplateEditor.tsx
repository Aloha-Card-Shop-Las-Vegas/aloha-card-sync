import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Move, Type, DollarSign, Hash, Calendar, Tag } from "lucide-react";
import { toast } from "sonner";

export interface TemplateElement {
  id: string;
  type: 'text' | 'price' | 'barcode' | 'date' | 'field';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  field?: string; // which data field to display
  text?: string; // static text
}

interface TemplateEditorProps {
  elements: TemplateElement[];
  onChange: (elements: TemplateElement[]) => void;
  sampleData?: Record<string, any>;
}

export default function TemplateEditor({ elements, onChange, sampleData = {} }: TemplateEditorProps) {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState(false);

  const addElement = (type: TemplateElement['type']) => {
    const newElement: TemplateElement = {
      id: `element-${Date.now()}`,
      type,
      label: getDefaultLabel(type),
      x: 10,
      y: 10 + elements.length * 30,
      width: 100,
      height: 20,
      fontSize: 12,
      field: getDefaultField(type),
      text: type === 'text' ? 'Sample Text' : undefined,
    };
    onChange([...elements, newElement]);
    setSelectedElement(newElement.id);
    toast.success(`Added ${type} element`);
  };

  const removeElement = (id: string) => {
    onChange(elements.filter(el => el.id !== id));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
    toast.success("Element removed");
  };

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    onChange(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const getDefaultLabel = (type: TemplateElement['type']): string => {
    switch (type) {
      case 'text': return 'Text';
      case 'price': return 'Price';
      case 'barcode': return 'Barcode';
      case 'date': return 'Date';
      case 'field': return 'Field';
      default: return 'Element';
    }
  };

  const getDefaultField = (type: TemplateElement['type']): string => {
    switch (type) {
      case 'price': return 'price';
      case 'barcode': return 'sku';
      case 'date': return 'created_at';
      case 'field': return 'subject';
      default: return 'subject';
    }
  };

  const getElementIcon = (type: TemplateElement['type']) => {
    switch (type) {
      case 'text': return <Type className="w-4 h-4" />;
      case 'price': return <DollarSign className="w-4 h-4" />;
      case 'barcode': return <Hash className="w-4 h-4" />;
      case 'date': return <Calendar className="w-4 h-4" />;
      case 'field': return <Tag className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  const getPreviewValue = (element: TemplateElement): string => {
    if (element.type === 'text') {
      return element.text || 'Sample Text';
    }
    if (element.field && sampleData[element.field]) {
      return String(sampleData[element.field]);
    }
    
    // Default preview values
    switch (element.type) {
      case 'price': return '$29.99';
      case 'barcode': return 'SKU123456';
      case 'date': return new Date().toLocaleDateString();
      case 'field': return element.field || 'Field Value';
      default: return 'Preview';
    }
  };

  const selectedEl = elements.find(el => el.id === selectedElement);

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Left Panel - Element List & Controls */}
      <div className="w-80 flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Elements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => addElement('text')}>
                <Type className="w-4 h-4 mr-2" />
                Text
              </Button>
              <Button variant="outline" size="sm" onClick={() => addElement('field')}>
                <Tag className="w-4 h-4 mr-2" />
                Field
              </Button>
              <Button variant="outline" size="sm" onClick={() => addElement('price')}>
                <DollarSign className="w-4 h-4 mr-2" />
                Price
              </Button>
              <Button variant="outline" size="sm" onClick={() => addElement('barcode')}>
                <Hash className="w-4 h-4 mr-2" />
                Barcode
              </Button>
              <Button variant="outline" size="sm" onClick={() => addElement('date')}>
                <Calendar className="w-4 h-4 mr-2" />
                Date
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg">Elements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {elements.map((element) => (
                <div
                  key={element.id}
                  className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                    selectedElement === element.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedElement(element.id)}
                >
                  <div className="flex items-center gap-2">
                    {getElementIcon(element.type)}
                    <span className="text-sm font-medium">{element.label}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeElement(element.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {elements.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No elements added yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Element Properties */}
        {selectedEl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Label</Label>
                <Input
                  value={selectedEl.label}
                  onChange={(e) => updateElement(selectedEl.id, { label: e.target.value })}
                />
              </div>

              {selectedEl.type === 'text' ? (
                <div>
                  <Label>Text</Label>
                  <Input
                    value={selectedEl.text || ''}
                    onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <Label>Data Field</Label>
                  <Select
                    value={selectedEl.field || ''}
                    onValueChange={(value) => updateElement(selectedEl.id, { field: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="subject">Name/Subject</SelectItem>
                      <SelectItem value="brand_title">Brand</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="sku">SKU</SelectItem>
                      <SelectItem value="lot_number">Lot Number</SelectItem>
                      <SelectItem value="grade">Grade</SelectItem>
                      <SelectItem value="psa_cert">PSA Cert</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="variant">Variant</SelectItem>
                      <SelectItem value="card_number">Card Number</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="created_at">Created Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>X Position</Label>
                  <Input
                    type="number"
                    value={selectedEl.x}
                    onChange={(e) => updateElement(selectedEl.id, { x: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Y Position</Label>
                  <Input
                    type="number"
                    value={selectedEl.y}
                    onChange={(e) => updateElement(selectedEl.id, { y: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Width</Label>
                  <Input
                    type="number"
                    value={selectedEl.width}
                    onChange={(e) => updateElement(selectedEl.id, { width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={selectedEl.height}
                    onChange={(e) => updateElement(selectedEl.id, { height: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Font Size</Label>
                <Input
                  type="number"
                  value={selectedEl.fontSize}
                  onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel - Preview Canvas */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-lg">Label Preview (2" x 1")</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="relative bg-white border-2 border-dashed border-gray-300 overflow-hidden"
            style={{ 
              width: '384px', // 2 inches at 192 DPI
              height: '192px', // 1 inch at 192 DPI
              margin: '0 auto'
            }}
          >
            {elements.map((element) => (
              <div
                key={element.id}
                className={`absolute border cursor-pointer transition-all ${
                  selectedElement === element.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-500'
                }`}
                style={{
                  left: `${element.x}px`,
                  top: `${element.y}px`,
                  width: `${element.width}px`,
                  height: `${element.height}px`,
                  fontSize: `${element.fontSize}px`,
                  lineHeight: `${element.height}px`,
                }}
                onClick={() => setSelectedElement(element.id)}
              >
                <div className="truncate px-1" title={getPreviewValue(element)}>
                  {element.type === 'barcode' ? (
                    <div className="flex items-center justify-center h-full bg-black text-white text-xs">
                      ||||| {getPreviewValue(element)}
                    </div>
                  ) : (
                    getPreviewValue(element)
                  )}
                </div>
                
                {selectedElement === element.id && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            ))}
            
            {elements.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Add elements to design your label
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}