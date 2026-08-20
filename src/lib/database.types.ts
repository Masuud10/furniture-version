// GENERATED FILE — do not edit by hand.
//
// Produced by `npm run db:types:local` (scripts/gen-types.mjs), which
// introspects the schema built from supabase/migrations. The canonical
// generator is `supabase gen types typescript`; it needs Docker, which is not
// available here. Regenerate after every migration — a stale file is a
// compile error waiting to happen, which is the point.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          recipient_name: string;
          phone: string;
          line1: string;
          line2: string | null;
          city: string;
          region: string | null;
          landmark: string | null;
          delivery_zone_id: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          recipient_name: string;
          phone: string;
          line1: string;
          line2?: string | null;
          city: string;
          region?: string | null;
          landmark?: string | null;
          delivery_zone_id?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string | null;
          recipient_name?: string;
          phone?: string;
          line1?: string;
          line2?: string | null;
          city?: string;
          region?: string | null;
          landmark?: string | null;
          delivery_zone_id?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_delivery_zone_id_fkey";
            columns: ["delivery_zone_id"];
            isOneToOne: false;
            referencedRelation: "delivery_zones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          variant_id: string | null;
          qty: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          variant_id?: string | null;
          qty: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          variant_id?: string | null;
          qty?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_zones: {
        Row: {
          id: string;
          name: string;
          fee_minor: number;
          active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          fee_minor: number;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          fee_minor?: number;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: string;
          product_id: string;
          kind: string;
          provider: string;
          provider_ref: string | null;
          storage_path: string | null;
          poster_path: string | null;
          alt_text: string;
          width: number | null;
          height: number | null;
          duration_s: number | null;
          blur_data_url: string | null;
          position: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          kind: string;
          provider?: string;
          provider_ref?: string | null;
          storage_path?: string | null;
          poster_path?: string | null;
          alt_text: string;
          width?: number | null;
          height?: number | null;
          duration_s?: number | null;
          blur_data_url?: string | null;
          position?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          kind?: string;
          provider?: string;
          provider_ref?: string | null;
          storage_path?: string | null;
          poster_path?: string | null;
          alt_text?: string;
          width?: number | null;
          height?: number | null;
          duration_s?: number | null;
          blur_data_url?: string | null;
          position?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_assets_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          actor_id: string | null;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          to_status: Database["public"]["Enums"]["order_status"];
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          actor_id?: string | null;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          to_status: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          actor_id?: string | null;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          to_status?: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          name_snapshot: string;
          variant_snapshot: string | null;
          image_snapshot: string | null;
          unit_price_minor: number;
          qty: number;
          line_total_minor: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          name_snapshot: string;
          variant_snapshot?: string | null;
          image_snapshot?: string | null;
          unit_price_minor: number;
          qty: number;
          line_total_minor: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          name_snapshot?: string;
          variant_snapshot?: string | null;
          image_snapshot?: string | null;
          unit_price_minor?: number;
          qty?: number;
          line_total_minor?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["order_status"];
          to_status: Database["public"]["Enums"]["order_status"];
          requires_reason: boolean;
          label: string;
        };
        Insert: {
          from_status: Database["public"]["Enums"]["order_status"];
          to_status: Database["public"]["Enums"]["order_status"];
          requires_reason?: boolean;
          label: string;
        };
        Update: {
          from_status?: Database["public"]["Enums"]["order_status"];
          to_status?: Database["public"]["Enums"]["order_status"];
          requires_reason?: boolean;
          label?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          status: Database["public"]["Enums"]["order_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          cancellation_reason: Database["public"]["Enums"]["cancellation_reason"] | null;
          subtotal_minor: number;
          delivery_fee_minor: number;
          total_minor: number;
          currency: string;
          delivery_address: Json;
          delivery_zone_name: string;
          contact_phone: string;
          customer_note: string | null;
          admin_note: string | null;
          idempotency_key: string;
          placed_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          user_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          cancellation_reason?: Database["public"]["Enums"]["cancellation_reason"] | null;
          subtotal_minor: number;
          delivery_fee_minor: number;
          total_minor: number;
          currency?: string;
          delivery_address: Json;
          delivery_zone_name: string;
          contact_phone: string;
          customer_note?: string | null;
          admin_note?: string | null;
          idempotency_key: string;
          placed_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          cancellation_reason?: Database["public"]["Enums"]["cancellation_reason"] | null;
          subtotal_minor?: number;
          delivery_fee_minor?: number;
          total_minor?: number;
          currency?: string;
          delivery_address?: Json;
          delivery_zone_name?: string;
          contact_phone?: string;
          customer_note?: string | null;
          admin_note?: string | null;
          idempotency_key?: string;
          placed_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          price_delta_minor: number;
          sku: string | null;
          stock_qty: number | null;
          swatch_hex: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          price_delta_minor?: number;
          sku?: string | null;
          stock_qty?: number | null;
          swatch_hex?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          price_delta_minor?: number;
          sku?: string | null;
          stock_qty?: number | null;
          swatch_hex?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          summary: string | null;
          description_md: string | null;
          category_id: string | null;
          base_price_minor: number;
          currency: string;
          status: string;
          lead_time_days: number;
          stock_qty: number | null;
          dimensions: Json | null;
          materials: string[];
          care_notes: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          search_vector: unknown | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          summary?: string | null;
          description_md?: string | null;
          category_id?: string | null;
          base_price_minor: number;
          currency?: string;
          status?: string;
          lead_time_days?: number;
          stock_qty?: number | null;
          dimensions?: Json | null;
          materials?: string[];
          care_notes?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          summary?: string | null;
          description_md?: string | null;
          category_id?: string | null;
          base_price_minor?: number;
          currency?: string;
          status?: string;
          lead_time_days?: number;
          stock_qty?: number | null;
          dimensions?: Json | null;
          materials?: string[];
          care_notes?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          phone_verified: boolean;
          role: string;
          no_show_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          role?: string;
          no_show_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          role?: string;
          no_show_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_settings: {
        Row: {
          id: boolean;
          order_confirmation_threshold_minor: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          order_confirmation_threshold_minor?: number;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          order_confirmation_threshold_minor?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<PropertyKey, never>;
    Functions: {
      advance_order_status: {
        Args: {
          p_order_id: string;
          p_to: Database["public"]["Enums"]["order_status"];
          p_note?: string;
          p_reason?: Database["public"]["Enums"]["cancellation_reason"];
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      mark_order_paid: {
        Args: {
          p_order_id: string;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      place_order: {
        Args: {
          p_idempotency_key: string;
          p_address_id: string;
          p_items: Json;
          p_customer_note?: string;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      set_order_admin_note: {
        Args: {
          p_order_id: string;
          p_note: string;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
    };
    Enums: {
      cancellation_reason: "customer_changed_mind" | "customer_unreachable" | "customer_no_show" | "out_of_stock" | "delivery_not_possible" | "damaged_in_transit" | "merchant_error";
      order_status: "pending_confirmation" | "confirmed" | "in_production" | "ready_for_delivery" | "out_for_delivery" | "delivered" | "cancelled" | "returned";
      payment_status: "unpaid" | "paid";
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type FunctionArgs<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Args"];
export type FunctionReturns<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Returns"];
