export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AuditStatus = "queued" | "running" | "completed" | "failed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audits: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          status: AuditStatus;
          brand_tokens: Json | null;
          pagespeed_data: Json | null;
          findings: Json | null;
          generated_html: string | null;
          applied_changes: Json | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          status?: AuditStatus;
          brand_tokens?: Json | null;
          pagespeed_data?: Json | null;
          findings?: Json | null;
          generated_html?: string | null;
          applied_changes?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          status?: AuditStatus;
          brand_tokens?: Json | null;
          pagespeed_data?: Json | null;
          findings?: Json | null;
          generated_html?: string | null;
          applied_changes?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_voice_caches: {
        Row: {
          url_key: string;
          voice: Json;
          created_at: string;
        };
        Insert: {
          url_key: string;
          voice: Json;
          created_at?: string;
        };
        Update: {
          url_key?: string;
          voice?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      pagespeed_caches: {
        Row: {
          url_key: string;
          signals: Json;
          created_at: string;
        };
        Insert: {
          url_key: string;
          signals: Json;
          created_at?: string;
        };
        Update: {
          url_key?: string;
          signals?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      book_principles: {
        Row: {
          id: string;
          book_title: string;
          book_author: string;
          principle: string;
          explanation: string;
          cro_application: string;
          embedding: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_title: string;
          book_author: string;
          principle: string;
          explanation: string;
          cro_application: string;
          embedding: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          book_title?: string;
          book_author?: string;
          principle?: string;
          explanation?: string;
          cro_application?: string;
          embedding?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_principles_by_book: {
        Args: {
          query_embedding: string;
          target_book: string;
          match_count: number;
        };
        Returns: {
          id: string;
          book_title: string;
          book_author: string;
          principle: string;
          explanation: string;
          cro_application: string;
          distance: number;
          similarity: number;
        }[];
      };
    };
    Enums: {
      audit_status: AuditStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
