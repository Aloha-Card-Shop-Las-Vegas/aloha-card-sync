import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { PSABulkImport } from "@/components/PSABulkImport";
import { TCGPlayerBulkImport } from "@/components/TCGPlayerBulkImport";

const BulkImport = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Bulk Import</h1>
          <p className="text-muted-foreground mt-2">Import large quantities of cards from CSV files</p>
        </div>
        
        <div className="grid gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Graded Cards (PSA)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Import PSA certificate numbers and automatically fetch card details
              </p>
            </CardHeader>
            <CardContent>
              <PSABulkImport />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw Cards (TCGPlayer)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Import card data from TCGPlayer cart/list format
              </p>
            </CardHeader>
            <CardContent>
              <TCGPlayerBulkImport />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BulkImport;