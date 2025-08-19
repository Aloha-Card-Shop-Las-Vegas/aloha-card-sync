export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          data: Json | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          category_id: number | null
          created_at: string | null
          data: Json | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          data?: Json | null
          id: number
          name: string
          updated_at?: string | null
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          data?: Json | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_items: {
        Row: {
          brand_title: string | null
          card_number: string | null
          category: string | null
          cost: number | null
          created_at: string
          deleted_at: string | null
          deleted_reason: string | null
          grade: string | null
          id: string
          lot_number: string
          price: number | null
          printed_at: string | null
          psa_cert: string | null
          pushed_at: string | null
          quantity: number
          shopify_inventory_item_id: string | null
          shopify_product_id: string | null
          shopify_variant_id: string | null
          sku: string | null
          subject: string | null
          updated_at: string
          variant: string | null
          year: string | null
        }
        Insert: {
          brand_title?: string | null
          card_number?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          grade?: string | null
          id?: string
          lot_number?: string
          price?: number | null
          printed_at?: string | null
          psa_cert?: string | null
          pushed_at?: string | null
          quantity?: number
          shopify_inventory_item_id?: string | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          sku?: string | null
          subject?: string | null
          updated_at?: string
          variant?: string | null
          year?: string | null
        }
        Update: {
          brand_title?: string | null
          card_number?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          grade?: string | null
          id?: string
          lot_number?: string
          price?: number | null
          printed_at?: string | null
          psa_cert?: string | null
          pushed_at?: string | null
          quantity?: number
          shopify_inventory_item_id?: string | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          sku?: string | null
          subject?: string | null
          updated_at?: string
          variant?: string | null
          year?: string | null
        }
        Relationships: []
      }
      label_templates: {
        Row: {
          canvas: Json
          created_at: string
          data: Json | null
          id: string
          is_default: boolean | null
          name: string
          template_type: string | null
          updated_at: string
        }
        Insert: {
          canvas: Json
          created_at?: string
          data?: Json | null
          id?: string
          is_default?: boolean | null
          name: string
          template_type?: string | null
          updated_at?: string
        }
        Update: {
          canvas?: Json
          created_at?: string
          data?: Json | null
          id?: string
          is_default?: boolean | null
          name?: string
          template_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          printer_id: number | null
          printer_name: string | null
          printnode_job_id: number | null
          status: string
          tspl_code: string
          updated_at: string | null
          workstation_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          printer_id?: number | null
          printer_name?: string | null
          printnode_job_id?: number | null
          status?: string
          tspl_code: string
          updated_at?: string | null
          workstation_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          printer_id?: number | null
          printer_name?: string | null
          printnode_job_id?: number | null
          status?: string
          tspl_code?: string
          updated_at?: string | null
          workstation_id?: string
        }
        Relationships: []
      }
      printer_settings: {
        Row: {
          bridge_port: number | null
          created_at: string | null
          id: string
          selected_printer_id: number | null
          selected_printer_name: string | null
          updated_at: string | null
          use_printnode: boolean | null
          workstation_id: string
        }
        Insert: {
          bridge_port?: number | null
          created_at?: string | null
          id?: string
          selected_printer_id?: number | null
          selected_printer_name?: string | null
          updated_at?: string | null
          use_printnode?: boolean | null
          workstation_id: string
        }
        Update: {
          bridge_port?: number | null
          created_at?: string | null
          id?: string
          selected_printer_id?: number | null
          selected_printer_name?: string | null
          updated_at?: string | null
          use_printnode?: boolean | null
          workstation_id?: string
        }
        Relationships: []
      }
      product_sync_status: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          last_sync_at: string | null
          product_id: number | null
          shopify_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          product_id?: number | null
          shopify_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          product_id?: number | null
          shopify_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sync_status_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          group_id: number | null
          id: number
          name: string
          tcgcsv_data: Json | null
          tcgplayer_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: number | null
          id: number
          name: string
          tcgcsv_data?: Json | null
          tcgplayer_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: number | null
          id?: number
          name?: string
          tcgcsv_data?: Json | null
          tcgplayer_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_sync_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ins: {
        Row: {
          card_number: string | null
          condition: string | null
          cost_each: number | null
          created_at: string
          id: string
          language: string | null
          name: string | null
          price_each: number | null
          printing: string | null
          product_id: number | null
          quantity: number | null
          rarity: string | null
          set: string | null
          set_code: string | null
          sku: string | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          card_number?: string | null
          condition?: string | null
          cost_each?: number | null
          created_at?: string
          id?: string
          language?: string | null
          name?: string | null
          price_each?: number | null
          printing?: string | null
          product_id?: number | null
          quantity?: number | null
          rarity?: string | null
          set?: string | null
          set_code?: string | null
          sku?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          card_number?: string | null
          condition?: string | null
          cost_each?: number | null
          created_at?: string
          id?: string
          language?: string | null
          name?: string | null
          price_each?: number | null
          printing?: string | null
          product_id?: number | null
          quantity?: number | null
          rarity?: string | null
          set?: string | null
          set_code?: string | null
          sku?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      group_sync_status: {
        Row: {
          category_id: number | null
          id: number | null
          is_fully_synced: boolean | null
          name: string | null
          synced_products: number | null
          total_products: number | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_lot_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_template_default: {
        Args: { template_id: string; template_type_param: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      sync_status: "pending" | "synced" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      sync_status: ["pending", "synced", "error"],
    },
  },
} as const
