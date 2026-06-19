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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          amount: number
          child_id: string
          created_at: string
          created_by: string
          family_id: string
          id: string
          note: string | null
          occurred_on: string
          recurring_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["txn_source"]
          status: Database["public"]["Enums"]["txn_status"]
          task_instance_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
        }
        Insert: {
          amount: number
          child_id: string
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          note?: string | null
          occurred_on?: string
          recurring_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["txn_source"]
          status?: Database["public"]["Enums"]["txn_status"]
          task_instance_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
        }
        Update: {
          amount?: number
          child_id?: string
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          note?: string | null
          occurred_on?: string
          recurring_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["txn_source"]
          status?: Database["public"]["Enums"]["txn_status"]
          task_instance_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          display_name: string
          email: string
          family_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          display_name: string
          email: string
          family_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          display_name?: string
          email?: string
          family_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          family_id: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          family_id?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          family_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_pocket_money: {
        Row: {
          active: boolean
          amount: number
          child_id: string
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: number | null
          end_date: string | null
          family_id: string
          id: string
          last_run_on: string | null
          note: string | null
          recurrence: Database["public"]["Enums"]["pm_recurrence"]
          start_date: string
        }
        Insert: {
          active?: boolean
          amount: number
          child_id: string
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: number | null
          end_date?: string | null
          family_id: string
          id?: string
          last_run_on?: string | null
          note?: string | null
          recurrence: Database["public"]["Enums"]["pm_recurrence"]
          start_date?: string
        }
        Update: {
          active?: boolean
          amount?: number
          child_id?: string
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: number | null
          end_date?: string | null
          family_id?: string
          id?: string
          last_run_on?: string | null
          note?: string | null
          recurrence?: Database["public"]["Enums"]["pm_recurrence"]
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_pocket_money_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          assignee_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          family_id: string
          id: string
          reject_note: string | null
          reward_override: number | null
          status: Database["public"]["Enums"]["instance_status"]
          task_id: string
          verified_at: string | null
          verifier_id: string | null
        }
        Insert: {
          assignee_id: string
          completed_at?: string | null
          created_at?: string
          due_date: string
          family_id: string
          id?: string
          reject_note?: string | null
          reward_override?: number | null
          status?: Database["public"]["Enums"]["instance_status"]
          task_id: string
          verified_at?: string | null
          verifier_id?: string | null
        }
        Update: {
          assignee_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          family_id?: string
          id?: string
          reject_note?: string | null
          reward_override?: number | null
          status?: Database["public"]["Enums"]["instance_status"]
          task_id?: string
          verified_at?: string | null
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          assignee_id: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          family_id: string
          id: string
          recurrence_config: Json
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          reward_amount: number
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assignee_id: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          family_id: string
          id?: string
          recurrence_config?: Json
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          reward_amount?: number
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assignee_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          family_id?: string
          id?: string
          recurrence_config?: Json
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          reward_amount?: number
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_family_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "parent" | "kid"
      instance_status: "pending" | "submitted" | "approved" | "rejected"
      pm_recurrence: "weekly" | "monthly"
      recurrence_type: "once" | "daily" | "weekly" | "monthly" | "custom"
      txn_source: "manual" | "task_reward" | "recurring" | "request"
      txn_status: "pending" | "approved" | "rejected"
      txn_type: "income" | "expense"
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
      app_role: ["parent", "kid"],
      instance_status: ["pending", "submitted", "approved", "rejected"],
      pm_recurrence: ["weekly", "monthly"],
      recurrence_type: ["once", "daily", "weekly", "monthly", "custom"],
      txn_source: ["manual", "task_reward", "recurring", "request"],
      txn_status: ["pending", "approved", "rejected"],
      txn_type: ["income", "expense"],
    },
  },
} as const
