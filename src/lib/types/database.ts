export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      answers: {
        Row: {
          id: string
          item_id: string
          question_key: string
          response_id: string
          value: Json | null
        }
        Insert: {
          id?: string
          item_id: string
          question_key: string
          response_id: string
          value?: Json | null
        }
        Update: {
          id?: string
          item_id?: string
          question_key?: string
          response_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      case_action_items: {
        Row: {
          assigned_to: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          source_case_phase_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          source_case_phase_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          source_case_phase_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_action_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_action_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_action_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_action_items_source_case_phase_id_fkey"
            columns: ["source_case_phase_id"]
            isOneToOne: false
            referencedRelation: "case_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          doc_type: string
          id: string
          mime_type: string | null
          occurred_at: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          doc_type?: string
          id?: string
          mime_type?: string | null
          occurred_at?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          doc_type?: string
          id?: string
          mime_type?: string | null
          occurred_at?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_events: {
        Row: {
          body: string
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          occurred_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          occurred_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          occurred_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_offered_outcomes: {
        Row: {
          case_id: string
          created_at: string
          outcome_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          outcome_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          outcome_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_offered_outcomes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_offered_outcomes_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "case_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      case_outcomes: {
        Row: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          is_adverse: boolean
          label: string
          position: number
          requires_action_plan: boolean
          updated_at: string
        }
        Insert: {
          archived?: boolean
          color_token?: string
          commission_id: string
          created_at?: string
          id?: string
          is_adverse?: boolean
          label: string
          position: number
          requires_action_plan?: boolean
          updated_at?: string
        }
        Update: {
          archived?: boolean
          color_token?: string
          commission_id?: string
          created_at?: string
          id?: string
          is_adverse?: boolean
          label?: string
          position?: number
          requires_action_plan?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_outcomes_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_phases: {
        Row: {
          activated_at: string | null
          assigned_to: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          due_date: string | null
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          skipped_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          assigned_to?: string | null
          blocks?: number[]
          case_id: string
          completed_at?: string | null
          created_at?: string
          default_due_days?: number | null
          due_date?: string | null
          form_id: string
          form_version_id: string
          id?: string
          is_ad_hoc?: boolean
          position: number
          recommend_when?: Json | null
          recommended?: boolean
          skipped_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          assigned_to?: string | null
          blocks?: number[]
          case_id?: string
          completed_at?: string | null
          created_at?: string
          default_due_days?: number | null
          due_date?: string | null
          form_id?: string
          form_version_id?: string
          id?: string
          is_ad_hoc?: boolean
          position?: number
          recommend_when?: Json | null
          recommended?: boolean
          skipped_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_phases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_phases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_phases_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_phases_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          case_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          case_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          case_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tag_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tag_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "case_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tags: {
        Row: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          archived?: boolean
          color_token?: string
          commission_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          archived?: boolean
          color_token?: string
          commission_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tags_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: number
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          outcome_id: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          case_number: number
          closed_at?: string | null
          closed_by?: string | null
          commission_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          outcome_id?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          case_number?: number
          closed_at?: string | null
          closed_by?: string | null
          commission_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          outcome_id?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "case_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_members: {
        Row: {
          commission_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          commission_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          commission_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_members_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_items: {
        Row: {
          content: Json | null
          created_at: string
          form_version_id: string
          id: string
          item_type: string
          label: string | null
          options: Json | null
          position: number
          question_explanation: string | null
          question_key: string | null
          required: boolean
          section_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          form_version_id: string
          id?: string
          item_type: string
          label?: string | null
          options?: Json | null
          position: number
          question_explanation?: string | null
          question_key?: string | null
          required?: boolean
          section_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          form_version_id?: string
          id?: string
          item_type?: string
          label?: string | null
          options?: Json | null
          position?: number
          question_explanation?: string | null
          question_key?: string | null
          required?: boolean
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_items_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sections: {
        Row: {
          description: string | null
          form_version_id: string
          id: string
          is_default: boolean
          position: number
          requires_signoff: boolean
          signoff_role: string | null
          title: string | null
          visible_when: Json | null
        }
        Insert: {
          description?: string | null
          form_version_id: string
          id?: string
          is_default?: boolean
          position: number
          requires_signoff?: boolean
          signoff_role?: string | null
          title?: string | null
          visible_when?: Json | null
        }
        Update: {
          description?: string | null
          form_version_id?: string
          id?: string
          is_default?: boolean
          position?: number
          requires_signoff?: boolean
          signoff_role?: string | null
          title?: string | null
          visible_when?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          published_at: string | null
          status: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_id: string
          id?: string
          published_at?: string | null
          status?: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_id?: string
          id?: string
          published_at?: string | null
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          commission_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
        }
        Insert: {
          commission_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          commission_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_outcomes: {
        Row: {
          created_at: string
          outcome_id: string
          position: number
          template_id: string
        }
        Insert: {
          created_at?: string
          outcome_id: string
          position?: number
          template_id: string
        }
        Update: {
          created_at?: string
          outcome_id?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_outcomes_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "case_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_outcomes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_phases: {
        Row: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          template_id: string
          title: string | null
        }
        Insert: {
          blocks?: number[]
          created_at?: string
          default_due_days?: number | null
          form_id: string
          id?: string
          position: number
          recommend_when?: Json | null
          template_id: string
          title?: string | null
        }
        Update: {
          blocks?: number[]
          created_at?: string
          default_due_days?: number | null
          form_id?: string
          id?: string
          position?: number
          recommend_when?: Json | null
          template_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_template_phases_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          commission_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          commission_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          commission_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_admin?: boolean
        }
        Relationships: []
      }
      response_section_signoffs: {
        Row: {
          id: string
          note: string | null
          response_id: string
          section_id: string
          signed_at: string
          signed_by: string
        }
        Insert: {
          id?: string
          note?: string | null
          response_id: string
          section_id: string
          signed_at?: string
          signed_by: string
        }
        Update: {
          id?: string
          note?: string | null
          response_id?: string
          section_id?: string
          signed_at?: string
          signed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_section_signoffs_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_section_signoffs_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_section_signoffs_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          case_phase_id: string | null
          commission_id: string
          created_by: string
          form_version_id: string
          id: string
          last_section_id: string | null
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          case_phase_id?: string | null
          commission_id: string
          created_by: string
          form_version_id: string
          id?: string
          last_section_id?: string | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          case_phase_id?: string | null
          commission_id?: string
          created_by?: string
          form_version_id?: string
          id?: string
          last_section_id?: string | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_case_phase_id_fkey"
            columns: ["case_phase_id"]
            isOneToOne: false
            referencedRelation: "case_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_last_section_id_fkey"
            columns: ["last_section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_phase: {
        Args: {
          p_assigned_to: string
          p_case_phase_id: string
          p_due_date?: string
        }
        Returns: {
          activated_at: string | null
          assigned_to: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          due_date: string | null
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          skipped_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_ad_hoc_phase: {
        Args: {
          p_assigned_to?: string
          p_case_id: string
          p_form_id: string
          p_recommend_when?: Json
          p_title?: string
        }
        Returns: {
          activated_at: string | null
          assigned_to: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          due_date: string | null
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          skipped_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_template_phase: {
        Args: {
          p_blocks?: number[]
          p_default_due_days?: number
          p_form_id: string
          p_recommend_when?: Json
          p_template_id: string
          p_title?: string
        }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          template_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_action_item: {
        Args: { p_action_item_id: string; p_status: string }
        Returns: {
          assigned_to: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          source_case_phase_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_case_outcome: {
        Args: { p_outcome_id: string }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          is_adverse: boolean
          label: string
          position: number
          requires_action_plan: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_outcomes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_case_tag: {
        Args: { p_tag_id: string }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "case_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_process_template: {
        Args: { p_template_id: string }
        Returns: {
          commission_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_case_tag: {
        Args: { p_case_id: string; p_tag_id: string }
        Returns: undefined
      }
      cancel_case: {
        Args: { p_case_id: string }
        Returns: {
          case_number: number
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          outcome_id: string | null
          status: string
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      case_action_items_kpis: {
        Args: { p_commission_id: string }
        Returns: {
          completed_ytd: number
          open: number
          overdue: number
        }[]
      }
      case_tag_report: {
        Args: { p_commission_id: string; p_from?: string; p_to?: string }
        Returns: {
          case_count: number
          color_token: string
          name: string
          tag_id: string
        }[]
      }
      cases_extras_enabled: { Args: never; Returns: boolean }
      clone_form_version: {
        Args: { p_source_version_id: string }
        Returns: string
      }
      close_case: {
        Args: { p_case_id: string }
        Returns: {
          case_number: number
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          outcome_id: string | null
          status: string
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commission_overview: {
        Args: never
        Returns: {
          commission_id: string
          commission_name: string
          form_count: number
          slug: string
          submitted_count: number
          submitted_last_30_days: number
        }[]
      }
      complete_action_item: {
        Args: { p_action_item_id: string }
        Returns: {
          assigned_to: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          source_case_phase_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_action_item: {
        Args: {
          p_assigned_to?: string
          p_case_id: string
          p_description?: string
          p_due_date?: string
          p_source_case_phase_id?: string
          p_title: string
        }
        Returns: {
          assigned_to: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          source_case_phase_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case_from_template: {
        Args: { p_label?: string; p_template_id: string }
        Returns: {
          case_number: number
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          outcome_id: string | null
          status: string
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case_outcome: {
        Args: {
          p_color_token?: string
          p_commission_id: string
          p_is_adverse?: boolean
          p_label: string
          p_requires_action_plan?: boolean
        }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          is_adverse: boolean
          label: string
          position: number
          requires_action_plan: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_outcomes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case_tag: {
        Args: {
          p_color_token?: string
          p_commission_id: string
          p_name: string
        }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "case_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_form: {
        Args: {
          p_commission_id: string
          p_description?: string
          p_title: string
        }
        Returns: {
          form_id: string
          version_id: string
        }[]
      }
      create_process_template: {
        Args: {
          p_commission_id: string
          p_description?: string
          p_title: string
        }
        Returns: {
          commission_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      dashboard_completion_by_member: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          count: number
          member_id: string
          name: string
        }[]
      }
      dashboard_distributions: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          denominator: number
          item_position: number
          item_type: string
          label: string
          n: number
          option_count: number
          option_value: string
          question_key: string
          section_position: number
          section_title: string
        }[]
      }
      dashboard_export_rows: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          answers: Json
          member_name: string
          response_id: string
          signoffs: Json
          submitted_at: string
          version_number: number
        }[]
      }
      dashboard_form_totals: {
        Args: { p_commission_id: string; p_from?: string; p_to?: string }
        Returns: {
          form_id: string
          last_submitted_at: string
          title: string
          total_submitted: number
        }[]
      }
      dashboard_free_text: {
        Args: {
          p_form_id: string
          p_from?: string
          p_limit?: number
          p_to?: string
        }
        Returns: {
          item_position: number
          label: string
          question_key: string
          sample_value: string
          section_position: number
          section_title: string
          total: number
        }[]
      }
      dashboard_submissions_over_time: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      delete_section_moving_items: {
        Args: { p_section_id: string; p_target_section_id: string }
        Returns: undefined
      }
      get_case_detail: { Args: { p_case_id: string }; Returns: Json }
      get_response_for_signoff: {
        Args: { p_response_id: string }
        Returns: Json
      }
      list_cases_board: {
        Args: { p_commission_id: string }
        Returns: {
          case_id: string
          case_number: number
          closed_at: string
          created_at: string
          label: string
          outcome: Json
          outcome_id: string
          phases: Json
          status: string
        }[]
      }
      list_signoff_queue: {
        Args: { p_commission_id: string }
        Returns: {
          form_id: string
          form_title: string
          pending_count: number
          respondent_id: string
          respondent_name: string
          response_id: string
          section_id: string
          section_title: string
          started_at: string
          updated_at: string
          version_number: number
        }[]
      }
      publish_form_version: {
        Args: { p_form_version_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          published_at: string | null
          status: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "form_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_process_template: {
        Args: { p_template_id: string }
        Returns: {
          commission_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reassign_phase: {
        Args: {
          p_case_phase_id: string
          p_due_date?: string
          p_new_assignee: string
        }
        Returns: {
          activated_at: string | null
          assigned_to: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          due_date: string | null
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          skipped_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_recommendations: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      remove_template_phase: {
        Args: { p_phase_id: string }
        Returns: undefined
      }
      rename_case_tag: {
        Args: { p_color_token: string; p_name: string; p_tag_id: string }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "case_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reorder_case_outcomes: {
        Args: { p_commission_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_item: {
        Args: { p_direction: string; p_item_id: string }
        Returns: undefined
      }
      reorder_section: {
        Args: { p_direction: string; p_section_id: string }
        Returns: undefined
      }
      reorder_template_phase: {
        Args: { p_direction: string; p_phase_id: string }
        Returns: undefined
      }
      save_section_answers: {
        Args: {
          p_answers?: Json
          p_clear_item_ids?: string[]
          p_response_id: string
          p_section_id: string
        }
        Returns: {
          case_phase_id: string | null
          commission_id: string
          created_by: string
          form_version_id: string
          id: string
          last_section_id: string | null
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_case_outcome: {
        Args: { p_case_id: string; p_outcome_id?: string }
        Returns: {
          case_number: number
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          outcome_id: string | null
          status: string
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_process_outcomes: {
        Args: { p_outcome_ids: string[]; p_template_id: string }
        Returns: undefined
      }
      set_template_phase_blocks: {
        Args: { p_blocks: number[]; p_phase_id: string }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          template_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_section: {
        Args: { p_note?: string; p_response_id: string; p_section_id: string }
        Returns: {
          id: string
          note: string | null
          response_id: string
          section_id: string
          signed_at: string
          signed_by: string
        }
        SetofOptions: {
          from: "*"
          to: "response_section_signoffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      skip_phase: {
        Args: { p_case_phase_id: string }
        Returns: {
          activated_at: string | null
          assigned_to: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          due_date: string | null
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          skipped_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_or_resume_phase: {
        Args: { p_case_phase_id: string }
        Returns: {
          case_phase_id: string | null
          commission_id: string
          created_by: string
          form_version_id: string
          id: string
          last_section_id: string | null
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_or_resume_response: {
        Args: { p_form_version_id: string }
        Returns: {
          case_phase_id: string | null
          commission_id: string
          created_by: string
          form_version_id: string
          id: string
          last_section_id: string | null
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_response: {
        Args: { p_response_id: string }
        Returns: {
          case_phase_id: string | null
          commission_id: string
          created_by: string
          form_version_id: string
          id: string
          last_section_id: string | null
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unassign_case_tag: {
        Args: { p_case_id: string; p_tag_id: string }
        Returns: undefined
      }
      update_action_item: {
        Args: {
          p_action_item_id: string
          p_assigned_to?: string
          p_description?: string
          p_due_date?: string
          p_title: string
        }
        Returns: {
          assigned_to: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          source_case_phase_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_case_outcome: {
        Args: {
          p_color_token: string
          p_is_adverse: boolean
          p_label: string
          p_outcome_id: string
          p_requires_action_plan: boolean
        }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          is_adverse: boolean
          label: string
          position: number
          requires_action_plan: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_outcomes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_template_phase: {
        Args: {
          p_blocks?: number[]
          p_clear_blocks?: boolean
          p_clear_default_due_days?: boolean
          p_clear_recommend_when?: boolean
          p_default_due_days?: number
          p_form_id?: string
          p_phase_id: string
          p_recommend_when?: Json
          p_title?: string
        }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          template_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_visible_when: {
        Args: { p_form_version_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

