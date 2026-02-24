export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string;
          full_name: string | null;
          plan: "free" | "pro" | "enterprise";
          trial_start_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email: string;
          full_name?: string | null;
          plan?: "free" | "pro" | "enterprise";
          trial_start_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          email?: string;
          full_name?: string | null;
          plan?: "free" | "pro" | "enterprise";
          trial_start_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          currency: string;
          category: string | null;
          type: "credit" | "debit";
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          currency?: string;
          category?: string | null;
          type: "credit" | "debit";
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          description?: string;
          amount?: number;
          currency?: string;
          category?: string | null;
          type?: "credit" | "debit";
          source?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          client_name: string;
          amount: number;
          currency: string;
          issued_date: string;
          due_date: string;
          status: "paid" | "unpaid" | "overdue" | "partial";
          paid_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_name: string;
          amount: number;
          currency?: string;
          issued_date: string;
          due_date: string;
          status?: "paid" | "unpaid" | "overdue" | "partial";
          paid_amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_name?: string;
          amount?: number;
          currency?: string;
          issued_date?: string;
          due_date?: string;
          status?: "paid" | "unpaid" | "overdue" | "partial";
          paid_amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      recovery_emails: {
        Row: {
          id: string;
          user_id: string;
          invoice_id: string;
          sequence_number: number;
          subject_line: string;
          body: string;
          tone: "friendly" | "professional" | "firm";
          sent: boolean;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          invoice_id: string;
          sequence_number: number;
          subject_line: string;
          body: string;
          tone: "friendly" | "professional" | "firm";
          sent?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          invoice_id?: string;
          sequence_number?: number;
          subject_line?: string;
          body?: string;
          tone?: "friendly" | "professional" | "firm";
          sent?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recovery_emails_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recovery_emails_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      briefings: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          week_start: string;
          emailed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          week_start: string;
          emailed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          week_start?: string;
          emailed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "briefings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      plan_type: "free" | "pro" | "enterprise";
      transaction_type: "credit" | "debit";
      invoice_status: "paid" | "unpaid" | "overdue" | "partial";
      email_tone: "friendly" | "professional" | "firm";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
