import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/Navigation";
import { PSABulkImport } from "@/components/PSABulkImport";
import { TCGPlayerBulkImport } from "@/components/TCGPlayerBulkImport";

const BulkImport = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Bulk Import</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="graded" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="graded">Graded Cards (PSA)</TabsTrigger>
                <TabsTrigger value="raw">Raw Cards (TCGPlayer)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="graded" className="mt-6">
                <PSABulkImport />
              </TabsContent>
              
              <TabsContent value="raw" className="mt-6">
                <TCGPlayerBulkImport />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkImport;