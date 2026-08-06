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
      accreditation_frameworks: {
        Row: {
          cloned_from_framework_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          owner_commission_id: string | null
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          cloned_from_framework_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          owner_commission_id?: string | null
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          cloned_from_framework_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          owner_commission_id?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "accreditation_frameworks_cloned_from_framework_id_fkey"
            columns: ["cloned_from_framework_id"]
            isOneToOne: false
            referencedRelation: "accreditation_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accreditation_frameworks_owner_commission_id_fkey"
            columns: ["owner_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      accreditation_standards: {
        Row: {
          code: string
          created_at: string
          description_md: string | null
          framework_id: string
          id: string
          level: number | null
          parent_id: string | null
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_md?: string | null
          framework_id: string
          id?: string
          level?: number | null
          parent_id?: string | null
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_md?: string | null
          framework_id?: string
          id?: string
          level?: number | null
          parent_id?: string | null
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accreditation_standards_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "accreditation_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accreditation_standards_parent_fkey"
            columns: ["parent_id", "framework_id"]
            isOneToOne: false
            referencedRelation: "accreditation_standards"
            referencedColumns: ["id", "framework_id"]
          },
        ]
      }
      action_item_assignments: {
        Row: {
          action_item_id: string
          assigned_at: string
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          id: string
          note: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_item_id: string
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_item_id?: string
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_assignments_item_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_assignments_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_item_checklists: {
        Row: {
          action_item_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_done: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          action_item_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          action_item_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_checklists_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_item_reminders: {
        Row: {
          action_item_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          offset_days: number | null
          reminder_type: string
          updated_at: string
        }
        Insert: {
          action_item_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          offset_days?: number | null
          reminder_type: string
          updated_at?: string
        }
        Update: {
          action_item_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          offset_days?: number | null
          reminder_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_reminders_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_item_status_history: {
        Row: {
          action_item_id: string
          changed_at: string
          changed_by: string | null
          comment: string | null
          from_status_id: string | null
          id: string
          metadata: Json
          to_status_id: string
        }
        Insert: {
          action_item_id: string
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          from_status_id?: string | null
          id?: string
          metadata?: Json
          to_status_id: string
        }
        Update: {
          action_item_id?: string
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          from_status_id?: string | null
          id?: string
          metadata?: Json
          to_status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_status_history_from_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "action_item_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_status_history_item_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_status_history_to_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "action_item_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      action_item_statuses: {
        Row: {
          archived: boolean
          category: string
          commission_id: string | null
          created_at: string
          id: string
          is_initial: boolean
          is_terminal: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category: string
          commission_id?: string | null
          created_at?: string
          id?: string
          is_initial?: boolean
          is_terminal?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category?: string
          commission_id?: string | null
          created_at?: string
          id?: string
          is_initial?: boolean
          is_terminal?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_statuses_commission_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_item_updates: {
        Row: {
          action_item_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          update_type: string
        }
        Insert: {
          action_item_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          update_type: string
        }
        Update: {
          action_item_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_updates_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_item_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_item_urgency_levels: {
        Row: {
          archived: boolean
          commission_id: string | null
          created_at: string
          id: string
          key: string
          label: string
          rank: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          commission_id?: string | null
          created_at?: string
          id?: string
          key: string
          label: string
          rank?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          commission_id?: string | null
          created_at?: string
          id?: string
          key?: string
          label?: string
          rank?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_item_urgency_levels_commission_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_items: {
        Row: {
          assigned_to: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_case_id: string | null
          source_agenda_item_id: string | null
          source_case_id: string | null
          source_case_phase_id: string | null
          source_meeting_id: string | null
          source_type: string
          status_id: string
          title: string
          updated_at: string
          urgency_id: string | null
          visibility_scope: string
        }
        Insert: {
          assigned_to?: string | null
          commission_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_case_id?: string | null
          source_agenda_item_id?: string | null
          source_case_id?: string | null
          source_case_phase_id?: string | null
          source_meeting_id?: string | null
          source_type: string
          status_id: string
          title: string
          updated_at?: string
          urgency_id?: string | null
          visibility_scope?: string
        }
        Update: {
          assigned_to?: string | null
          commission_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_case_id?: string | null
          source_agenda_item_id?: string | null
          source_case_id?: string | null
          source_case_phase_id?: string | null
          source_meeting_id?: string | null
          source_type?: string
          status_id?: string
          title?: string
          updated_at?: string
          urgency_id?: string | null
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_commission_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_linked_case_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_source_agenda_item_fkey"
            columns: ["source_agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_source_case_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_source_case_phase_fkey"
            columns: ["source_case_phase_id"]
            isOneToOne: false
            referencedRelation: "case_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_source_meeting_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_status_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "action_item_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_urgency_fkey"
            columns: ["urgency_id"]
            isOneToOne: false
            referencedRelation: "action_item_urgency_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_matrix_cells: {
        Row: {
          answer_id: string
          col_id: string
          created_at: string
          id: string
          row_id: string
          value: Json | null
        }
        Insert: {
          answer_id: string
          col_id: string
          created_at?: string
          id?: string
          row_id: string
          value?: Json | null
        }
        Update: {
          answer_id?: string
          col_id?: string
          created_at?: string
          id?: string
          row_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_matrix_cells_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_matrix_cells_col_id_fkey"
            columns: ["col_id"]
            isOneToOne: false
            referencedRelation: "form_matrix_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_matrix_cells_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "form_matrix_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_references: {
        Row: {
          answer_id: string
          commission_id: string | null
          created_at: string
          id: string
          participant_id: string | null
          profile_id: string | null
          reference_kind: string
        }
        Insert: {
          answer_id: string
          commission_id?: string | null
          created_at?: string
          id?: string
          participant_id?: string | null
          profile_id?: string | null
          reference_kind?: string
        }
        Update: {
          answer_id?: string
          commission_id?: string | null
          created_at?: string
          id?: string
          participant_id?: string | null
          profile_id?: string | null
          reference_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_references_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_references_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_references_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_references_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_risk_matrix: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          likelihood_col_id: string
          risk_score: number | null
          severity_row_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          likelihood_col_id: string
          risk_score?: number | null
          severity_row_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          likelihood_col_id?: string
          risk_score?: number | null
          severity_row_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_risk_matrix_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_risk_matrix_likelihood_col_id_fkey"
            columns: ["likelihood_col_id"]
            isOneToOne: false
            referencedRelation: "form_matrix_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_risk_matrix_severity_row_id_fkey"
            columns: ["severity_row_id"]
            isOneToOne: false
            referencedRelation: "form_matrix_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_selected_options: {
        Row: {
          answer_id: string
          option_id: string
        }
        Insert: {
          answer_id: string
          option_id: string
        }
        Update: {
          answer_id?: string
          option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_selected_options_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_selected_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "form_item_options"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          answered_at: string
          confidentiality_level: string
          form_version_id: string
          group_instance_id: string | null
          id: string
          item_id: string
          observation: string | null
          other_text: string | null
          question_key: string
          response_id: string
          value: Json | null
          value_date: string | null
          value_number: number | null
          value_time: string | null
        }
        Insert: {
          answered_at?: string
          confidentiality_level?: string
          form_version_id: string
          group_instance_id?: string | null
          id?: string
          item_id: string
          observation?: string | null
          other_text?: string | null
          question_key: string
          response_id: string
          value?: Json | null
          value_date?: string | null
          value_number?: number | null
          value_time?: string | null
        }
        Update: {
          answered_at?: string
          confidentiality_level?: string
          form_version_id?: string
          group_instance_id?: string | null
          id?: string
          item_id?: string
          observation?: string | null
          other_text?: string | null
          question_key?: string
          response_id?: string
          value?: Json | null
          value_date?: string | null
          value_number?: number | null
          value_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_group_instance_id_fkey"
            columns: ["group_instance_id"]
            isOneToOne: false
            referencedRelation: "response_group_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_item_version_key_fkey"
            columns: ["item_id", "form_version_id", "question_key"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id", "form_version_id", "question_key"]
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
      attachment_references: {
        Row: {
          attachment_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          owner_id: string
          owner_type: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          owner_id: string
          owner_type: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          owner_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachment_references_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_references_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachment_subjects: {
        Row: {
          attachment_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          participant_id: string
          role_id: string | null
        }
        Insert: {
          attachment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          participant_id: string
          role_id?: string | null
        }
        Update: {
          attachment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          participant_id?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachment_subjects_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_subjects_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_subjects_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "case_participant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          confidentiality_label: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          document_group_id: string | null
          id: string
          kind: string
          legal_hold: boolean
          mime_type: string | null
          occurred_on: string | null
          owner_id: string
          owner_type: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          scan_status: string
          sensitivity_tier: string
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          supersedes_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          confidentiality_label?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_group_id?: string | null
          id?: string
          kind?: string
          legal_hold?: boolean
          mime_type?: string | null
          occurred_on?: string | null
          owner_id: string
          owner_type: string
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          scan_status?: string
          sensitivity_tier?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket: string
          storage_path: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          confidentiality_label?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_group_id?: string | null
          id?: string
          kind?: string
          legal_hold?: boolean
          mime_type?: string | null
          occurred_on?: string | null
          owner_id?: string
          owner_type?: string
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          scan_status?: string
          sensitivity_tier?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_phi_disposed_by_fkey"
            columns: ["phi_disposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_is_admin: boolean
          commission_id: string | null
          entity_id: string
          entity_type: string
          hospital_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          organization_id: string | null
          prev_hash: string | null
          row_hash: string
          seq: number
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_is_admin?: boolean
          commission_id?: string | null
          entity_id: string
          entity_type: string
          hospital_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          prev_hash?: string | null
          row_hash: string
          seq: number
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_is_admin?: boolean
          commission_id?: string | null
          entity_id?: string
          entity_type?: string
          hospital_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          prev_hash?: string | null
          row_hash?: string
          seq?: number
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_action: {
        Row: {
          action_strength: string
          assignee_user_id: string | null
          capa_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          owner: string | null
          position: number
          root_cause_id: string | null
          status: string
          success_measure: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_strength?: string
          assignee_user_id?: string | null
          capa_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          owner?: string | null
          position: number
          root_cause_id?: string | null
          status?: string
          success_measure?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_strength?: string
          assignee_user_id?: string | null
          capa_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          owner?: string | null
          position?: number
          root_cause_id?: string | null
          status?: string
          success_measure?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_action_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_action_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_action_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_action_root_cause_id_fkey"
            columns: ["root_cause_id"]
            isOneToOne: false
            referencedRelation: "rca_root_causes"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_action_evidence: {
        Row: {
          action_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          kind: string
          storage_path: string | null
          title: string
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          kind: string
          storage_path?: string | null
          title: string
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_action_evidence_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "capa_action"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_action_evidence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_action_evidence_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_action_task: {
        Row: {
          action_id: string
          created_at: string
          description: string
          id: string
          is_done: boolean
          position: number
          updated_at: string
        }
        Insert: {
          action_id: string
          created_at?: string
          description: string
          id?: string
          is_done?: boolean
          position: number
          updated_at?: string
        }
        Update: {
          action_id?: string
          created_at?: string
          description?: string
          id?: string
          is_done?: boolean
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_action_task_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "capa_action"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_effectiveness: {
        Row: {
          capa_id: string
          created_at: string
          method_md: string | null
          updated_at: string
          verdict: string
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          capa_id: string
          created_at?: string
          method_md?: string | null
          updated_at?: string
          verdict: string
          verified_at?: string
          verified_by?: string | null
        }
        Update: {
          capa_id?: string
          created_at?: string
          method_md?: string | null
          updated_at?: string
          verdict?: string
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capa_effectiveness_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: true
            referencedRelation: "capa_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_effectiveness_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_measure: {
        Row: {
          capa_id: string
          created_at: string
          definition: string | null
          id: string
          indicator_id: string | null
          name: string
          position: number
          target: string | null
          updated_at: string
        }
        Insert: {
          capa_id: string
          created_at?: string
          definition?: string | null
          id?: string
          indicator_id?: string | null
          name: string
          position: number
          target?: string | null
          updated_at?: string
        }
        Update: {
          capa_id?: string
          created_at?: string
          definition?: string | null
          id?: string
          indicator_id?: string | null
          name?: string
          position?: number
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_measure_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_measure_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_measure_result: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          measure_id: string
          note: string | null
          period: string
          value: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          measure_id: string
          note?: string | null
          period: string
          value?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          measure_id?: string
          note?: string | null
          period?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "capa_measure_result_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_measure_result_measure_id_fkey"
            columns: ["measure_id"]
            isOneToOne: false
            referencedRelation: "capa_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_plan: {
        Row: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          lessons_learned_md: string | null
          opened_by: string | null
          source: string
          source_audit_finding_id: string | null
          source_event_id: string | null
          source_indicator_id: string | null
          source_meeting_id: string | null
          source_rca_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          classification?: string
          closed_at?: string | null
          closed_by?: string | null
          code: string
          created_at?: string
          hospital_id: string
          id?: string
          lessons_learned_md?: string | null
          opened_by?: string | null
          source: string
          source_audit_finding_id?: string | null
          source_event_id?: string | null
          source_indicator_id?: string | null
          source_meeting_id?: string | null
          source_rca_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          classification?: string
          closed_at?: string | null
          closed_by?: string | null
          code?: string
          created_at?: string
          hospital_id?: string
          id?: string
          lessons_learned_md?: string | null
          opened_by?: string | null
          source?: string
          source_audit_finding_id?: string | null
          source_event_id?: string | null
          source_indicator_id?: string | null
          source_meeting_id?: string | null
          source_rca_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_plan_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plan_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plan_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plan_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "patient_safety_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plan_source_indicator_id_fkey"
            columns: ["source_indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plan_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plan_source_rca_id_fkey"
            columns: ["source_rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
        ]
      }
      case_access_grants: {
        Row: {
          case_id: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          max_confidentiality: string | null
          principal_id: string
          read_case_content: boolean
          read_case_deliberation: boolean
          read_restricted_phi: boolean
          read_standard_phi: boolean
          reason: string | null
          reason_code: string
          revoked_at: string | null
          revoked_by: string | null
          source: string
          source_entity_id: string | null
          write_case_content: boolean
        }
        Insert: {
          case_id: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          max_confidentiality?: string | null
          principal_id: string
          read_case_content?: boolean
          read_case_deliberation?: boolean
          read_restricted_phi?: boolean
          read_standard_phi?: boolean
          reason?: string | null
          reason_code?: string
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          source_entity_id?: string | null
          write_case_content?: boolean
        }
        Update: {
          case_id?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          max_confidentiality?: string | null
          principal_id?: string
          read_case_content?: boolean
          read_case_deliberation?: boolean
          read_restricted_phi?: boolean
          read_standard_phi?: boolean
          reason?: string | null
          reason_code?: string
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          source_entity_id?: string | null
          write_case_content?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_access_grants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_access_grants_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_access_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_assignment_roles: {
        Row: {
          display_name: string
          id: string
          is_active: boolean
          key: string
          organization_id: string
          position: number
        }
        Insert: {
          display_name: string
          id?: string
          is_active?: boolean
          key: string
          organization_id: string
          position?: number
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean
          key?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_assignment_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_conflict_declarations: {
        Row: {
          case_id: string
          conflict_type: string
          declarant_id: string
          declared_at: string
          description_md: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          case_id: string
          conflict_type: string
          declarant_id: string
          declared_at?: string
          description_md?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          case_id?: string
          conflict_type?: string
          declarant_id?: string
          declared_at?: string
          description_md?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_conflict_declarations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_conflict_declarations_declarant_id_fkey"
            columns: ["declarant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_conflict_declarations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_correction_requests: {
        Row: {
          case_id: string
          case_narrative_id: string | null
          case_phase_id: string | null
          classification: string
          commission_id: string
          created_at: string
          draft_body_md: string | null
          draft_response_id: string | null
          id: string
          impact_snapshot: Json | null
          kind: string
          last_rejected_at: string | null
          last_rejected_by: string | null
          last_rejected_reason: string | null
          permitted_corrector: string | null
          predecessor_response_id: string | null
          reason: string
          requested_at: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          self_approved: boolean
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          case_narrative_id?: string | null
          case_phase_id?: string | null
          classification: string
          commission_id: string
          created_at?: string
          draft_body_md?: string | null
          draft_response_id?: string | null
          id?: string
          impact_snapshot?: Json | null
          kind: string
          last_rejected_at?: string | null
          last_rejected_by?: string | null
          last_rejected_reason?: string | null
          permitted_corrector?: string | null
          predecessor_response_id?: string | null
          reason: string
          requested_at?: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          self_approved?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          case_narrative_id?: string | null
          case_phase_id?: string | null
          classification?: string
          commission_id?: string
          created_at?: string
          draft_body_md?: string | null
          draft_response_id?: string | null
          id?: string
          impact_snapshot?: Json | null
          kind?: string
          last_rejected_at?: string | null
          last_rejected_by?: string | null
          last_rejected_reason?: string | null
          permitted_corrector?: string | null
          predecessor_response_id?: string | null
          reason?: string
          requested_at?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          self_approved?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_correction_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_case_narrative_id_fkey"
            columns: ["case_narrative_id"]
            isOneToOne: false
            referencedRelation: "case_narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_case_phase_id_fkey"
            columns: ["case_phase_id"]
            isOneToOne: false
            referencedRelation: "case_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_draft_response_id_fkey"
            columns: ["draft_response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_last_rejected_by_fkey"
            columns: ["last_rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_permitted_corrector_fkey"
            columns: ["permitted_corrector"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_predecessor_response_id_fkey"
            columns: ["predecessor_response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correction_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_custom_field_values: {
        Row: {
          case_id: string
          created_at: string
          field_type: string
          id: string
          key: string
          label: string
          options: Json
          position: number
          template_field_id: string | null
          updated_at: string
          value: Json | null
        }
        Insert: {
          case_id: string
          created_at?: string
          field_type: string
          id?: string
          key: string
          label: string
          options?: Json
          position?: number
          template_field_id?: string | null
          updated_at?: string
          value?: Json | null
        }
        Update: {
          case_id?: string
          created_at?: string
          field_type?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          position?: number
          template_field_id?: string | null
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "case_custom_field_values_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_custom_field_values_template_field_id_fkey"
            columns: ["template_field_id"]
            isOneToOne: false
            referencedRelation: "process_template_custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      case_decisions: {
        Row: {
          case_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_type: string
          id: string
          rationale_md: string | null
          status: string
          summary_md: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_type: string
          id?: string
          rationale_md?: string | null
          status?: string
          summary_md: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_type?: string
          id?: string
          rationale_md?: string | null
          status?: string
          summary_md?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_decisions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_decisions_decided_by_fkey"
            columns: ["decided_by"]
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
          occurred_time: string | null
          title: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          occurred_at?: string | null
          occurred_time?: string | null
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          occurred_at?: string | null
          occurred_time?: string | null
          title?: string | null
          updated_at?: string
          visibility?: string
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
      case_interview_interviewers: {
        Row: {
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          interview_id: string
          note: string | null
          participant_id: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          external_name?: string | null
          external_org?: string | null
          id?: string
          interview_id: string
          note?: string | null
          participant_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          external_name?: string | null
          external_org?: string | null
          id?: string
          interview_id?: string
          note?: string | null
          participant_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_interview_interviewers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_interviewers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_interviewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_interview_links: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_url: string
          id: string
          interview_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_url: string
          id?: string
          interview_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string
          id?: string
          interview_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_interview_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_links_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_links_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      case_interview_subjects: {
        Row: {
          clinical_role: string | null
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          interview_id: string
          note: string | null
          participant_id: string | null
          relationship_to_case: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clinical_role?: string | null
          created_at?: string
          external_name?: string | null
          external_org?: string | null
          id?: string
          interview_id: string
          note?: string | null
          participant_id?: string | null
          relationship_to_case: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clinical_role?: string | null
          created_at?: string
          external_name?: string | null
          external_org?: string | null
          id?: string
          interview_id?: string
          note?: string | null
          participant_id?: string | null
          relationship_to_case?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_interview_subjects_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_subjects_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_interviews: {
        Row: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          case_id: string
          case_phase_id?: string | null
          commission_id: string
          concluded_at?: string | null
          concluded_by?: string | null
          confidentiality_level?: string
          created_at?: string
          created_by?: string | null
          form_version_id?: string | null
          id?: string
          interview_category: string
          interview_number: number
          participant_id?: string | null
          registry_event_id?: string | null
          status?: string
          summary_md?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          case_id?: string
          case_phase_id?: string | null
          commission_id?: string
          concluded_at?: string | null
          concluded_by?: string | null
          confidentiality_level?: string
          created_at?: string
          created_by?: string | null
          form_version_id?: string | null
          id?: string
          interview_category?: string
          interview_number?: number
          participant_id?: string | null
          registry_event_id?: string | null
          status?: string
          summary_md?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_interviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_case_phase_id_fkey"
            columns: ["case_phase_id"]
            isOneToOne: false
            referencedRelation: "case_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_concluded_by_fkey"
            columns: ["concluded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interviews_registry_event_id_fkey"
            columns: ["registry_event_id"]
            isOneToOne: false
            referencedRelation: "case_events"
            referencedColumns: ["id"]
          },
        ]
      }
      case_narrative_revisions: {
        Row: {
          body_md: string
          case_narrative_id: string
          correction_request_id: string | null
          id: string
          revision_number: number
          snapshotted_at: string
          snapshotted_by: string | null
        }
        Insert: {
          body_md: string
          case_narrative_id: string
          correction_request_id?: string | null
          id?: string
          revision_number: number
          snapshotted_at?: string
          snapshotted_by?: string | null
        }
        Update: {
          body_md?: string
          case_narrative_id?: string
          correction_request_id?: string | null
          id?: string
          revision_number?: number
          snapshotted_at?: string
          snapshotted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_narrative_revisions_case_narrative_id_fkey"
            columns: ["case_narrative_id"]
            isOneToOne: false
            referencedRelation: "case_narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narrative_revisions_correction_request_id_fkey"
            columns: ["correction_request_id"]
            isOneToOne: false
            referencedRelation: "case_correction_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narrative_revisions_snapshotted_by_fkey"
            columns: ["snapshotted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_narrative_types: {
        Row: {
          archived: boolean
          commission_id: string
          created_at: string
          description: string | null
          id: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          commission_id: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          position: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          commission_id?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_narrative_types_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_narratives: {
        Row: {
          assigned_to: string | null
          body_md: string | null
          case_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          display_position: number
          id: string
          instructions: string | null
          is_ad_hoc: boolean
          is_expected: boolean
          narrative_type_id: string | null
          status: string
          title: string | null
          type_label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          body_md?: string | null
          case_id: string
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string | null
          display_position: number
          id?: string
          instructions?: string | null
          is_ad_hoc?: boolean
          is_expected?: boolean
          narrative_type_id?: string | null
          status?: string
          title?: string | null
          type_label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          body_md?: string | null
          case_id?: string
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string | null
          display_position?: number
          id?: string
          instructions?: string | null
          is_ad_hoc?: boolean
          is_expected?: boolean
          narrative_type_id?: string | null
          status?: string
          title?: string | null
          type_label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_narratives_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narratives_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narratives_concluded_by_fkey"
            columns: ["concluded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narratives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narratives_narrative_type_id_fkey"
            columns: ["narrative_type_id"]
            isOneToOne: false
            referencedRelation: "case_narrative_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_narratives_updated_by_fkey"
            columns: ["updated_by"]
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
      case_participant_roles: {
        Row: {
          allowed_participant_types: string[]
          case_type_id: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_primary_subject_candidate: boolean
          key: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          allowed_participant_types: string[]
          case_type_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          is_primary_subject_candidate?: boolean
          key: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          allowed_participant_types?: string[]
          case_type_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_primary_subject_candidate?: boolean
          key?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_participant_roles_case_type_id_fkey"
            columns: ["case_type_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participant_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_participants: {
        Row: {
          added_at: string
          added_by: string | null
          case_id: string
          id: string
          involvement_summary: string | null
          is_primary_subject: boolean
          participant_id: string
          removed_at: string | null
          role_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          case_id: string
          id?: string
          involvement_summary?: string | null
          is_primary_subject?: boolean
          participant_id: string
          removed_at?: string | null
          role_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          case_id?: string
          id?: string
          involvement_summary?: string | null
          is_primary_subject?: boolean
          participant_id?: string
          removed_at?: string | null
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_participants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participants_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "case_participant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_phase_allowed_results: {
        Row: {
          case_phase_id: string
          position: number
          result_id: string
        }
        Insert: {
          case_phase_id: string
          position: number
          result_id: string
        }
        Update: {
          case_phase_id?: string
          position?: number
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_phase_allowed_results_case_phase_id_fkey"
            columns: ["case_phase_id"]
            isOneToOne: false
            referencedRelation: "case_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_phase_allowed_results_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "phase_results"
            referencedColumns: ["id"]
          },
        ]
      }
      case_phase_offered_results: {
        Row: {
          case_id: string
          result_id: string
        }
        Insert: {
          case_id: string
          result_id: string
        }
        Update: {
          case_id?: string
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_phase_offered_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_phase_offered_results_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "phase_results"
            referencedColumns: ["id"]
          },
        ]
      }
      case_phases: {
        Row: {
          activated_at: string | null
          assigned_to: string | null
          assignment_role_id: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          current_response_id: string | null
          default_due_days: number | null
          display_position: number | null
          due_date: string | null
          emits_result: boolean
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          result_computed_at: string | null
          result_id: string | null
          result_override_at: string | null
          result_override_by: string | null
          result_override_id: string | null
          result_override_reason: string | null
          result_ruleset: Json | null
          result_source: string | null
          skipped_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          assigned_to?: string | null
          assignment_role_id?: string | null
          blocks?: number[]
          case_id: string
          completed_at?: string | null
          created_at?: string
          current_response_id?: string | null
          default_due_days?: number | null
          display_position?: number | null
          due_date?: string | null
          emits_result?: boolean
          form_id: string
          form_version_id: string
          id?: string
          is_ad_hoc?: boolean
          position: number
          recommend_when?: Json | null
          recommended?: boolean
          result_computed_at?: string | null
          result_id?: string | null
          result_override_at?: string | null
          result_override_by?: string | null
          result_override_id?: string | null
          result_override_reason?: string | null
          result_ruleset?: Json | null
          result_source?: string | null
          skipped_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          assigned_to?: string | null
          assignment_role_id?: string | null
          blocks?: number[]
          case_id?: string
          completed_at?: string | null
          created_at?: string
          current_response_id?: string | null
          default_due_days?: number | null
          display_position?: number | null
          due_date?: string | null
          emits_result?: boolean
          form_id?: string
          form_version_id?: string
          id?: string
          is_ad_hoc?: boolean
          position?: number
          recommend_when?: Json | null
          recommended?: boolean
          result_computed_at?: string | null
          result_id?: string | null
          result_override_at?: string | null
          result_override_by?: string | null
          result_override_id?: string | null
          result_override_reason?: string | null
          result_ruleset?: Json | null
          result_source?: string | null
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
            foreignKeyName: "case_phases_assignment_role_id_fkey"
            columns: ["assignment_role_id"]
            isOneToOne: false
            referencedRelation: "case_assignment_roles"
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
            foreignKeyName: "case_phases_current_response_id_fkey"
            columns: ["current_response_id"]
            isOneToOne: false
            referencedRelation: "responses"
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
            columns: ["form_version_id", "form_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id", "form_id"]
          },
          {
            foreignKeyName: "case_phases_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "phase_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_phases_result_override_id_fkey"
            columns: ["result_override_id"]
            isOneToOne: false
            referencedRelation: "phase_results"
            referencedColumns: ["id"]
          },
        ]
      }
      case_recusals: {
        Row: {
          case_id: string
          conflict_declaration_id: string | null
          id: string
          lift_reason_md: string | null
          lifted_at: string | null
          lifted_by: string | null
          reason_md: string | null
          recused_at: string
          recused_by: string | null
          source: string
          user_id: string
        }
        Insert: {
          case_id: string
          conflict_declaration_id?: string | null
          id?: string
          lift_reason_md?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason_md?: string | null
          recused_at?: string
          recused_by?: string | null
          source: string
          user_id: string
        }
        Update: {
          case_id?: string
          conflict_declaration_id?: string | null
          id?: string
          lift_reason_md?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason_md?: string | null
          recused_at?: string
          recused_by?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_recusals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_recusals_conflict_declaration_id_fkey"
            columns: ["conflict_declaration_id"]
            isOneToOne: false
            referencedRelation: "case_conflict_declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_recusals_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_recusals_recused_by_fkey"
            columns: ["recused_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_recusals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_referral: {
        Row: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          code: string
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decline_note?: string | null
          decline_reason_code?: string | null
          description_md?: string | null
          has_patient?: boolean
          id?: string
          last_message_at?: string | null
          parent_referral_id?: string | null
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          priority?: string
          received_at?: string | null
          received_by?: string | null
          referral_type_id?: string | null
          requested_action_id?: string | null
          requested_action_label?: string | null
          response_due_at?: string | null
          response_expected?: boolean
          sent_at?: string | null
          sent_by?: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name?: string | null
          status?: string
          subject: string
          target_case_id?: string | null
          target_commission_id?: string | null
          target_commission_name?: string | null
          target_hospital_id?: string | null
          target_hospital_name?: string | null
          target_type?: string
          type_label: string
          updated_at?: string
          waiting_on_committee_id?: string | null
          waiting_on_hospital_id?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          code?: string
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decline_note?: string | null
          decline_reason_code?: string | null
          description_md?: string | null
          has_patient?: boolean
          id?: string
          last_message_at?: string | null
          parent_referral_id?: string | null
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          priority?: string
          received_at?: string | null
          received_by?: string | null
          referral_type_id?: string | null
          requested_action_id?: string | null
          requested_action_label?: string | null
          response_due_at?: string | null
          response_expected?: boolean
          sent_at?: string | null
          sent_by?: string | null
          source_case_id?: string
          source_commission_id?: string
          source_commission_name?: string | null
          status?: string
          subject?: string
          target_case_id?: string | null
          target_commission_id?: string | null
          target_commission_name?: string | null
          target_hospital_id?: string | null
          target_hospital_name?: string | null
          target_type?: string
          type_label?: string
          updated_at?: string
          waiting_on_committee_id?: string | null
          waiting_on_hospital_id?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_referral_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_parent_referral_id_fkey"
            columns: ["parent_referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_phi_disposed_by_fkey"
            columns: ["phi_disposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_referral_type_id_fkey"
            columns: ["referral_type_id"]
            isOneToOne: false
            referencedRelation: "referral_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_requested_action_id_fkey"
            columns: ["requested_action_id"]
            isOneToOne: false
            referencedRelation: "referral_requested_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_source_commission_id_fkey"
            columns: ["source_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_target_case_id_fkey"
            columns: ["target_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_target_commission_id_fkey"
            columns: ["target_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_target_hospital_id_fkey"
            columns: ["target_hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_referral_waiting_on_hospital_id_fkey"
            columns: ["waiting_on_hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      case_reopenings: {
        Row: {
          case_id: string
          id: string
          reason: string
          reopened_at: string
          reopened_by: string | null
        }
        Insert: {
          case_id: string
          id?: string
          reason: string
          reopened_at?: string
          reopened_by?: string | null
        }
        Update: {
          case_id?: string
          id?: string
          reason?: string
          reopened_at?: string
          reopened_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_reopenings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_reopenings_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      case_type_terminology: {
        Row: {
          case_type_id: string
          help_text: string | null
          plural_label: string | null
          singular_label: string
          term_key: string
        }
        Insert: {
          case_type_id: string
          help_text?: string | null
          plural_label?: string | null
          singular_label: string
          term_key: string
        }
        Update: {
          case_type_id?: string
          help_text?: string | null
          plural_label?: string | null
          singular_label?: string
          term_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_type_terminology_case_type_id_fkey"
            columns: ["case_type_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
        ]
      }
      case_types: {
        Row: {
          created_at: string
          default_case_label: string | null
          default_confidentiality_level: string
          default_visibility_policy: string
          display_name: string
          id: string
          is_active: boolean
          key: string
          organization_id: string
          primary_subject_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_case_label?: string | null
          default_confidentiality_level?: string
          default_visibility_policy?: string
          display_name: string
          id?: string
          is_active?: boolean
          key: string
          organization_id: string
          primary_subject_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_case_label?: string | null
          default_confidentiality_level?: string
          default_visibility_policy?: string
          display_name?: string
          id?: string
          is_active?: boolean
          key?: string
          organization_id?: string
          primary_subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_votes: {
        Row: {
          case_id: string
          created_at: string
          decision_id: string
          id: string
          meeting_id: string | null
          rationale_md: string | null
          vote: string
          voted_at: string
          voter_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          decision_id: string
          id?: string
          meeting_id?: string | null
          rationale_md?: string | null
          vote: string
          voted_at?: string
          voter_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          decision_id?: string
          id?: string
          meeting_id?: string | null
          rationale_md?: string | null
          vote?: string
          voted_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_votes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_votes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "case_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_votes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        Insert: {
          case_number: number
          case_type_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commission_id: string
          confidentiality_level?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_other?: string | null
          has_patient?: boolean
          id?: string
          label?: string | null
          organization_id: string
          outcome_id?: string | null
          patient_enabled?: boolean
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          status?: string
          template_version_id?: string | null
          updated_at?: string
          visibility_policy?: string
        }
        Update: {
          case_number?: number
          case_type_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commission_id?: string
          confidentiality_level?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_other?: string | null
          has_patient?: boolean
          id?: string
          label?: string | null
          organization_id?: string
          outcome_id?: string | null
          patient_enabled?: boolean
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          status?: string
          template_version_id?: string | null
          updated_at?: string
          visibility_policy?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_case_type_id_fkey"
            columns: ["case_type_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "cases_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hospital_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "cases_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "process_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_administrativo_capabilities: {
        Row: {
          capability: string
          commission_id: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          capability: string
          commission_id: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          capability?: string
          commission_id?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_admin_cap_appointment_fk"
            columns: ["commission_id", "user_id"]
            isOneToOne: false
            referencedRelation: "commission_administrativos"
            referencedColumns: ["commission_id", "user_id"]
          },
          {
            foreignKeyName: "commission_administrativo_capabilities_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_administrativos: {
        Row: {
          appointed_at: string
          appointed_by: string | null
          commission_id: string
          user_id: string
        }
        Insert: {
          appointed_at?: string
          appointed_by?: string | null
          commission_id: string
          user_id: string
        }
        Update: {
          appointed_at?: string
          appointed_by?: string | null
          commission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_administrativos_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_charters: {
        Row: {
          commission_id: string
          controlled_document_id: string | null
          created_at: string
          created_by: string | null
          meeting_frequency: string
          updated_at: string
        }
        Insert: {
          commission_id: string
          controlled_document_id?: string | null
          created_at?: string
          created_by?: string | null
          meeting_frequency: string
          updated_at?: string
        }
        Update: {
          commission_id?: string
          controlled_document_id?: string | null
          created_at?: string
          created_by?: string | null
          meeting_frequency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_charters_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_charters_controlled_document_id_fkey"
            columns: ["controlled_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_charters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_meeting_settings: {
        Row: {
          commission_id: string
          quorum_rule_type: string
          quorum_value: number | null
          updated_at: string
        }
        Insert: {
          commission_id: string
          quorum_rule_type?: string
          quorum_value?: number | null
          updated_at?: string
        }
        Update: {
          commission_id?: string
          quorum_rule_type?: string
          quorum_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_meeting_settings_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_meeting_types: {
        Row: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          color_token?: string
          commission_id: string
          created_at?: string
          id?: string
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          color_token?: string
          commission_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_meeting_types_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_member_titles: {
        Row: {
          commission_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          commission_id: string
          created_at?: string
          id?: string
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          commission_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_member_titles_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          created_at: string
          created_by: string | null
          hospital_id: string
          id: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hospital_id: string
          id?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hospital_id?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_hospital_org_fkey"
            columns: ["hospital_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_document_versions: {
        Row: {
          approval_due_date: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          obsolete_kind: string | null
          proposed_effective_date: string | null
          review_due_date: string | null
          status: string
          storage_path: string | null
          summary_of_changes_md: string | null
          updated_at: string
          version_number: number
        }
        Insert: {
          approval_due_date?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          obsolete_kind?: string | null
          proposed_effective_date?: string | null
          review_due_date?: string | null
          status?: string
          storage_path?: string | null
          summary_of_changes_md?: string | null
          updated_at?: string
          version_number: number
        }
        Update: {
          approval_due_date?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          obsolete_kind?: string | null
          proposed_effective_date?: string | null
          review_due_date?: string | null
          status?: string
          storage_path?: string | null
          summary_of_changes_md?: string | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "controlled_document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_documents: {
        Row: {
          category: string | null
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          doc_type: string
          id: string
          review_cycle_months: number | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          commission_id: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          doc_type: string
          id?: string
          review_cycle_months?: number | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          commission_id?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          doc_type?: string
          id?: string
          review_cycle_months?: number | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controlled_documents_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "controlled_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_approvals: {
        Row: {
          approver_id: string
          approver_title: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          document_version_id: string
          id: string
          note: string | null
          signature_hash: string | null
        }
        Insert: {
          approver_id: string
          approver_title?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          document_version_id: string
          id?: string
          note?: string | null
          signature_hash?: string | null
        }
        Update: {
          approver_id?: string
          approver_title?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          document_version_id?: string
          id?: string
          note?: string | null
          signature_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_approvals_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "controlled_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_allegation_categories: {
        Row: {
          display_name: string
          id: string
          is_active: boolean
          key: string
          organization_id: string
          position: number
        }
        Insert: {
          display_name: string
          id?: string
          is_active?: boolean
          key: string
          organization_id: string
          position?: number
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean
          key?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "ethics_allegation_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_allegations: {
        Row: {
          allegation_category_id: string
          alleged_event_date: string | null
          case_id: string
          created_at: string
          created_by: string | null
          description_md: string
          id: string
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allegation_category_id: string
          alleged_event_date?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          description_md: string
          id?: string
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allegation_category_id?: string
          alleged_event_date?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          description_md?: string
          id?: string
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_allegations_allegation_category_id_fkey"
            columns: ["allegation_category_id"]
            isOneToOne: false
            referencedRelation: "ethics_allegation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_allegations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_allegations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_appeals: {
        Row: {
          appeal_reason_md: string
          case_id: string
          created_at: string
          decision_id: string
          id: string
          outcome: string | null
          outcome_rationale_md: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by_participant_id: string | null
          updated_at: string
        }
        Insert: {
          appeal_reason_md: string
          case_id: string
          created_at?: string
          decision_id: string
          id?: string
          outcome?: string | null
          outcome_rationale_md?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by_participant_id?: string | null
          updated_at?: string
        }
        Update: {
          appeal_reason_md?: string
          case_id?: string
          created_at?: string
          decision_id?: string
          id?: string
          outcome?: string | null
          outcome_rationale_md?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by_participant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_appeals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_appeals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "case_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_appeals_submitted_by_participant_id_fkey"
            columns: ["submitted_by_participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_case_details: {
        Row: {
          admissibility_decided_at: string | null
          admissibility_decided_by: string | null
          admissibility_rationale_md: string | null
          admissibility_status: string
          case_id: string
          complaint_channel: string | null
          complaint_received_at: string | null
          created_at: string
          summary_md: string | null
          updated_at: string
        }
        Insert: {
          admissibility_decided_at?: string | null
          admissibility_decided_by?: string | null
          admissibility_rationale_md?: string | null
          admissibility_status?: string
          case_id: string
          complaint_channel?: string | null
          complaint_received_at?: string | null
          created_at?: string
          summary_md?: string | null
          updated_at?: string
        }
        Update: {
          admissibility_decided_at?: string | null
          admissibility_decided_by?: string | null
          admissibility_rationale_md?: string | null
          admissibility_status?: string
          case_id?: string
          complaint_channel?: string | null
          complaint_received_at?: string | null
          created_at?: string
          summary_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_case_details_admissibility_decided_by_fkey"
            columns: ["admissibility_decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_case_details_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_decision_details: {
        Row: {
          appeal_allowed: boolean
          appeal_deadline: string | null
          case_id: string
          created_at: string
          decision_id: string
          decision_letter_document_id: string | null
          external_reporting_completed_at: string | null
          external_reporting_deadline: string | null
          external_reporting_referral_id: string | null
          external_reporting_required: boolean
          external_reporting_target: string | null
          remediation_description_md: string | null
          remediation_required: boolean
          sanction_end_date: string | null
          sanction_start_date: string | null
          sanction_type_id: string | null
          updated_at: string
        }
        Insert: {
          appeal_allowed?: boolean
          appeal_deadline?: string | null
          case_id: string
          created_at?: string
          decision_id: string
          decision_letter_document_id?: string | null
          external_reporting_completed_at?: string | null
          external_reporting_deadline?: string | null
          external_reporting_referral_id?: string | null
          external_reporting_required?: boolean
          external_reporting_target?: string | null
          remediation_description_md?: string | null
          remediation_required?: boolean
          sanction_end_date?: string | null
          sanction_start_date?: string | null
          sanction_type_id?: string | null
          updated_at?: string
        }
        Update: {
          appeal_allowed?: boolean
          appeal_deadline?: string | null
          case_id?: string
          created_at?: string
          decision_id?: string
          decision_letter_document_id?: string | null
          external_reporting_completed_at?: string | null
          external_reporting_deadline?: string | null
          external_reporting_referral_id?: string | null
          external_reporting_required?: boolean
          external_reporting_target?: string | null
          remediation_description_md?: string | null
          remediation_required?: boolean
          sanction_end_date?: string | null
          sanction_start_date?: string | null
          sanction_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_decision_details_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_decision_details_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "case_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_decision_details_decision_letter_document_id_fkey"
            columns: ["decision_letter_document_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_decision_details_external_reporting_referral_id_fkey"
            columns: ["external_reporting_referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_decision_details_sanction_type_id_fkey"
            columns: ["sanction_type_id"]
            isOneToOne: false
            referencedRelation: "ethics_sanction_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_findings: {
        Row: {
          allegation_id: string
          case_id: string
          created_at: string
          decided_at: string
          decided_by: string | null
          evidence_summary_md: string | null
          finding: string
          id: string
          rationale_md: string | null
          updated_at: string
        }
        Insert: {
          allegation_id: string
          case_id: string
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          evidence_summary_md?: string | null
          finding: string
          id?: string
          rationale_md?: string | null
          updated_at?: string
        }
        Update: {
          allegation_id?: string
          case_id?: string
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          evidence_summary_md?: string | null
          finding?: string
          id?: string
          rationale_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_findings_allegation_id_fkey"
            columns: ["allegation_id"]
            isOneToOne: true
            referencedRelation: "ethics_allegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_findings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_findings_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_hearings: {
        Row: {
          case_id: string
          complainant_present: boolean | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          hearing_type: string
          id: string
          legal_representative_present: boolean | null
          meeting_id: string | null
          outcome_md: string | null
          respondent_present: boolean | null
          scheduled_at: string | null
          summary_md: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          complainant_present?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          hearing_type: string
          id?: string
          legal_representative_present?: boolean | null
          meeting_id?: string | null
          outcome_md?: string | null
          respondent_present?: boolean | null
          scheduled_at?: string | null
          summary_md?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          complainant_present?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          hearing_type?: string
          id?: string
          legal_representative_present?: boolean | null
          meeting_id?: string | null
          outcome_md?: string | null
          respondent_present?: boolean | null
          scheduled_at?: string | null
          summary_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_hearings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_hearings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_hearings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_notifications: {
        Row: {
          acknowledged_at: string | null
          case_id: string
          created_at: string
          created_by: string | null
          delivery_method: string
          due_at: string | null
          id: string
          notes_md: string | null
          notification_type: string
          recipient_participant_id: string | null
          recipient_user_id: string | null
          related_document_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          delivery_method: string
          due_at?: string | null
          id?: string
          notes_md?: string | null
          notification_type: string
          recipient_participant_id?: string | null
          recipient_user_id?: string | null
          related_document_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          delivery_method?: string
          due_at?: string | null
          id?: string
          notes_md?: string | null
          notification_type?: string
          recipient_participant_id?: string | null
          recipient_user_id?: string | null
          related_document_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ethics_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_notifications_recipient_participant_id_fkey"
            columns: ["recipient_participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ethics_notifications_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_sanction_types: {
        Row: {
          display_name: string
          id: string
          is_active: boolean
          key: string
          organization_id: string
          position: number
        }
        Insert: {
          display_name: string
          id?: string
          is_active?: boolean
          key: string
          organization_id: string
          position?: number
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean
          key?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "ethics_sanction_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_custody: {
        Row: {
          assigned_by: string | null
          created_at: string
          event_id: string
          held_from: string
          held_until: string | null
          id: string
          note: string | null
          owner_commission_id: string | null
          owner_kind: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          event_id: string
          held_from?: string
          held_until?: string | null
          id?: string
          note?: string | null
          owner_commission_id?: string | null
          owner_kind: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          event_id?: string
          held_from?: string
          held_until?: string | null
          id?: string
          note?: string | null
          owner_commission_id?: string | null
          owner_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_custody_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_custody_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "patient_safety_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_custody_owner_commission_id_fkey"
            columns: ["owner_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_patient: {
        Row: {
          age_years: number | null
          attending: string | null
          created_at: string
          date_of_birth: string | null
          encounter_key: string | null
          encounter_ref: string | null
          event_id: string
          mrn: string | null
          name: string | null
          patient_key: string | null
          sex: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_key?: string | null
          encounter_ref?: string | null
          event_id: string
          mrn?: string | null
          name?: string | null
          patient_key?: string | null
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_key?: string | null
          encounter_ref?: string | null
          event_id?: string
          mrn?: string | null
          name?: string | null
          patient_key?: string | null
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_patient_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "patient_safety_event"
            referencedColumns: ["id"]
          },
        ]
      }
      event_triage: {
        Row: {
          created_at: string
          disposition_notes_md: string | null
          event_id: string
          harm_severity: string | null
          is_pse: boolean | null
          natural_course: boolean | null
          pse_closure_reason: string | null
          reach: string | null
          review_pathway: string | null
          sentinel_determination: boolean
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          disposition_notes_md?: string | null
          event_id: string
          harm_severity?: string | null
          is_pse?: boolean | null
          natural_course?: boolean | null
          pse_closure_reason?: string | null
          reach?: string | null
          review_pathway?: string | null
          sentinel_determination?: boolean
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          disposition_notes_md?: string | null
          event_id?: string
          harm_severity?: string | null
          is_pse?: boolean | null
          natural_course?: boolean | null
          pse_closure_reason?: string | null
          reach?: string | null
          review_pathway?: string | null
          sentinel_determination?: boolean
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_triage_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "patient_safety_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_triage_triaged_by_fkey"
            columns: ["triaged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_triage_sentinel_flags: {
        Row: {
          created_at: string
          criteria_id: string | null
          criteria_key: string
          criteria_label: string
          event_id: string
          id: string
        }
        Insert: {
          created_at?: string
          criteria_id?: string | null
          criteria_key: string
          criteria_label: string
          event_id: string
          id?: string
        }
        Update: {
          created_at?: string
          criteria_id?: string | null
          criteria_key?: string
          criteria_label?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_triage_sentinel_flags_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "pqs_sentinel_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_triage_sentinel_flags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_triage"
            referencedColumns: ["event_id"]
          },
        ]
      }
      evidence_links: {
        Row: {
          artifact_id: string
          artifact_kind: string
          commission_id: string
          id: string
          linked_at: string
          linked_by: string | null
          note: string | null
          standard_id: string
        }
        Insert: {
          artifact_id: string
          artifact_kind: string
          commission_id: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          note?: string | null
          standard_id: string
        }
        Update: {
          artifact_id?: string
          artifact_kind?: string
          commission_id?: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          note?: string | null
          standard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_links_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_links_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_links_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "accreditation_standards"
            referencedColumns: ["id"]
          },
        ]
      }
      form_block_library: {
        Row: {
          commission_id: string
          description: string | null
          id: string
          name: string
          saved_at: string
          saved_by_id: string
          saved_by_name: string
          snapshot: Json
          source_form_title: string
          source_version_number: number
        }
        Insert: {
          commission_id: string
          description?: string | null
          id?: string
          name: string
          saved_at?: string
          saved_by_id: string
          saved_by_name: string
          snapshot: Json
          source_form_title: string
          source_version_number: number
        }
        Update: {
          commission_id?: string
          description?: string | null
          id?: string
          name?: string
          saved_at?: string
          saved_by_id?: string
          saved_by_name?: string
          snapshot?: Json
          source_form_title?: string
          source_version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_block_library_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_item_options: {
        Row: {
          analytics_code: string | null
          code: string
          color_token: string | null
          created_at: string
          flagged: boolean
          form_version_id: string
          id: string
          is_exclusive: boolean
          is_other: boolean
          item_id: string
          label: string
          position: number
          risk_weight: number | null
          score: number | null
        }
        Insert: {
          analytics_code?: string | null
          code: string
          color_token?: string | null
          created_at?: string
          flagged?: boolean
          form_version_id: string
          id?: string
          is_exclusive?: boolean
          is_other?: boolean
          item_id: string
          label: string
          position: number
          risk_weight?: number | null
          score?: number | null
        }
        Update: {
          analytics_code?: string | null
          code?: string
          color_token?: string | null
          created_at?: string
          flagged?: boolean
          form_version_id?: string
          id?: string
          is_exclusive?: boolean
          is_other?: boolean
          item_id?: string
          label?: string
          position?: number
          risk_weight?: number | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_item_options_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_item_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id"]
          },
        ]
      }
      form_item_validations: {
        Row: {
          config: Json | null
          created_at: string
          form_version_id: string
          id: string
          item_id: string
          message: string | null
          position: number
          rule_type: string
          severity: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          form_version_id: string
          id?: string
          item_id: string
          message?: string | null
          position?: number
          rule_type: string
          severity?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          form_version_id?: string
          id?: string
          item_id?: string
          message?: string | null
          position?: number
          rule_type?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_item_validations_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_item_validations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id"]
          },
        ]
      }
      form_items: {
        Row: {
          config: Json | null
          content: Json | null
          created_at: string
          default_source: string | null
          default_value: Json | null
          form_version_id: string
          id: string
          is_container: boolean | null
          item_type: string
          label: string | null
          parent_is_container: boolean | null
          parent_item_id: string | null
          position: number
          question_explanation: string | null
          question_key: string | null
          required: boolean
          required_if: Json | null
          section_id: string
          visible_when: Json | null
        }
        Insert: {
          config?: Json | null
          content?: Json | null
          created_at?: string
          default_source?: string | null
          default_value?: Json | null
          form_version_id: string
          id?: string
          is_container?: boolean | null
          item_type: string
          label?: string | null
          parent_is_container?: boolean | null
          parent_item_id?: string | null
          position: number
          question_explanation?: string | null
          question_key?: string | null
          required?: boolean
          required_if?: Json | null
          section_id: string
          visible_when?: Json | null
        }
        Update: {
          config?: Json | null
          content?: Json | null
          created_at?: string
          default_source?: string | null
          default_value?: Json | null
          form_version_id?: string
          id?: string
          is_container?: boolean | null
          item_type?: string
          label?: string | null
          parent_is_container?: boolean | null
          parent_item_id?: string | null
          position?: number
          question_explanation?: string | null
          question_key?: string | null
          required?: boolean
          required_if?: Json | null
          section_id?: string
          visible_when?: Json | null
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
            foreignKeyName: "form_items_parent_item_id_fkey"
            columns: [
              "parent_item_id",
              "form_version_id",
              "parent_is_container",
            ]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id", "form_version_id", "is_container"]
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
      form_matrix_columns: {
        Row: {
          code: string
          created_at: string
          form_version_id: string
          id: string
          item_id: string
          label: string
          position: number
          weight: number | null
        }
        Insert: {
          code: string
          created_at?: string
          form_version_id: string
          id?: string
          item_id: string
          label: string
          position: number
          weight?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          form_version_id?: string
          id?: string
          item_id?: string
          label?: string
          position?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_matrix_columns_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_matrix_columns_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id"]
          },
        ]
      }
      form_matrix_rows: {
        Row: {
          code: string
          created_at: string
          form_version_id: string
          id: string
          item_id: string
          label: string
          position: number
          weight: number | null
        }
        Insert: {
          code: string
          created_at?: string
          form_version_id: string
          id?: string
          item_id: string
          label: string
          position: number
          weight?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          form_version_id?: string
          id?: string
          item_id?: string
          label?: string
          position?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_matrix_rows_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_matrix_rows_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
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
          approved_at: string | null
          approved_by: string | null
          behavior_config: Json | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          form_id: string
          id: string
          published_at: string | null
          review_due_date: string | null
          status: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          behavior_config?: Json | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          form_id: string
          id?: string
          published_at?: string | null
          review_due_date?: string | null
          status?: string
          version_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          behavior_config?: Json | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          form_id?: string
          id?: string
          published_at?: string | null
          review_due_date?: string | null
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          updated_at: string
        }
        Insert: {
          commission_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          commission_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
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
      hospital_affiliations: {
        Row: {
          created_at: string
          created_by: string | null
          ended_by: string | null
          ended_on: string | null
          hospital_employee_id: string | null
          hospital_id: string
          id: string
          organization_id: string
          principal_id: string
          started_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_by?: string | null
          ended_on?: string | null
          hospital_employee_id?: string | null
          hospital_id: string
          id?: string
          organization_id: string
          principal_id: string
          started_on?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_by?: string | null
          ended_on?: string | null
          hospital_employee_id?: string | null
          hospital_id?: string
          id?: string
          organization_id?: string
          principal_id?: string
          started_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_affiliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_affiliations_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_affiliations_hospital_id_fkey"
            columns: ["hospital_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hospital_affiliations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_affiliations_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_departments: {
        Row: {
          archived: boolean
          created_at: string
          hospital_id: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_departments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_measurements: {
        Row: {
          denominator: number | null
          entered_at: string
          entered_by: string | null
          id: string
          indicator_id: string
          note: string | null
          numerator: number | null
          period_end: string | null
          period_label: string
          period_start: string | null
          source: string
          status: string
          value: number | null
        }
        Insert: {
          denominator?: number | null
          entered_at?: string
          entered_by?: string | null
          id?: string
          indicator_id: string
          note?: string | null
          numerator?: number | null
          period_end?: string | null
          period_label: string
          period_start?: string | null
          source: string
          status?: string
          value?: number | null
        }
        Update: {
          denominator?: number | null
          entered_at?: string
          entered_by?: string | null
          id?: string
          indicator_id?: string
          note?: string | null
          numerator?: number | null
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          source?: string
          status?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_measurements_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_measurements_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          data_source: string
          denominator_label: string | null
          derived_config: Json | null
          description_md: string | null
          direction: string
          frequency: string
          id: string
          kind: string
          lower_warn: number | null
          name: string
          numerator_label: string | null
          status: string
          target_comparator: string
          target_value: number | null
          unit: string | null
          updated_at: string
          upper_warn: number | null
        }
        Insert: {
          code: string
          commission_id: string
          created_at?: string
          created_by?: string | null
          data_source?: string
          denominator_label?: string | null
          derived_config?: Json | null
          description_md?: string | null
          direction?: string
          frequency?: string
          id?: string
          kind: string
          lower_warn?: number | null
          name: string
          numerator_label?: string | null
          status?: string
          target_comparator?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          upper_warn?: number | null
        }
        Update: {
          code?: string
          commission_id?: string
          created_at?: string
          created_by?: string | null
          data_source?: string
          denominator_label?: string | null
          derived_config?: Json | null
          description_md?: string | null
          direction?: string
          frequency?: string
          id?: string
          kind?: string
          lower_warn?: number | null
          name?: string
          numerator_label?: string | null
          status?: string
          target_comparator?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          upper_warn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicators_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_session_attendance: {
        Row: {
          attendance_status: string
          created_at: string
          created_by: string | null
          id: string
          participant_id: string
          role_at_session: string | null
          session_id: string
        }
        Insert: {
          attendance_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          participant_id: string
          role_at_session?: string | null
          session_id: string
        }
        Update: {
          attendance_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          participant_id?: string
          role_at_session?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_session_attendance_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id: string
          location_text?: string | null
          meeting_url?: string | null
          modality?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          sequence_number: number
          session_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id?: string
          location_text?: string | null
          meeting_url?: string | null
          modality?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          sequence_number?: number
          session_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_summaries: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          summary_md: string | null
          version: number
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id: string
          summary_md?: string | null
          version?: number
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id?: string
          summary_md?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "interview_summaries_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_topics: {
        Row: {
          created_at: string
          display_position: number
          id: string
          interview_id: string
          topic: string
        }
        Insert: {
          created_at?: string
          display_position?: number
          id?: string
          interview_id: string
          topic: string
        }
        Update: {
          created_at?: string
          display_position?: number
          id?: string
          interview_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_topics_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discussion_notes: string | null
          id: string
          meeting_id: string
          position: number
          resolution: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discussion_notes?: string | null
          id?: string
          meeting_id: string
          position: number
          resolution?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discussion_notes?: string | null
          id?: string
          meeting_id?: string
          position?: number
          resolution?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attendance: string
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          meeting_id: string
          note: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attendance?: string
          created_at?: string
          external_name?: string | null
          external_org?: string | null
          id?: string
          meeting_id: string
          note?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attendance?: string
          created_at?: string
          external_name?: string | null
          external_org?: string | null
          id?: string
          meeting_id?: string
          note?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_cases: {
        Row: {
          agenda_item_id: string | null
          case_id: string
          created_at: string
          decision: string | null
          id: string
          meeting_id: string
          summary: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          case_id: string
          created_at?: string
          decision?: string | null
          id?: string
          meeting_id: string
          summary?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          case_id?: string
          created_at?: string
          decision?: string | null
          id?: string
          meeting_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_cases_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_cases_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_closed_session_item_readers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_closed_session_item_readers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "meeting_closed_session_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_closed_session_item_readers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_closed_session_items: {
        Row: {
          case_id: string | null
          closed_session_id: string
          created_at: string
          decision: string | null
          ended_at: string | null
          id: string
          position: number
          quorum_met: boolean
          started_at: string | null
          substance: string | null
          withdrawals: string | null
        }
        Insert: {
          case_id?: string | null
          closed_session_id: string
          created_at?: string
          decision?: string | null
          ended_at?: string | null
          id?: string
          position?: number
          quorum_met?: boolean
          started_at?: string | null
          substance?: string | null
          withdrawals?: string | null
        }
        Update: {
          case_id?: string | null
          closed_session_id?: string
          created_at?: string
          decision?: string | null
          ended_at?: string | null
          id?: string
          position?: number
          quorum_met?: boolean
          started_at?: string | null
          substance?: string | null
          withdrawals?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_closed_session_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_closed_session_items_closed_session_id_fkey"
            columns: ["closed_session_id"]
            isOneToOne: false
            referencedRelation: "meeting_closed_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_closed_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          label: string | null
          meeting_id: string
          opened_at: string
          opened_by: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          label?: string | null
          meeting_id: string
          opened_at?: string
          opened_by?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          label?: string | null
          meeting_id?: string
          opened_at?: string
          opened_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_closed_sessions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_closed_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_signatures: {
        Row: {
          attendee_id: string
          content_hash: string | null
          created_at: string
          id: string
          ip_address: unknown
          meeting_id: string
          method: string
          note: string | null
          provider_payload: Json | null
          provider_ref: string | null
          signed_at: string
          signer_id: string
          status: string
          user_agent: string | null
        }
        Insert: {
          attendee_id: string
          content_hash?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          meeting_id: string
          method?: string
          note?: string | null
          provider_payload?: Json | null
          provider_ref?: string | null
          signed_at?: string
          signer_id: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          attendee_id?: string
          content_hash?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          meeting_id?: string
          method?: string
          note?: string | null
          provider_payload?: Json | null
          provider_ref?: string | null
          signed_at?: string
          signer_id?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_signatures_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "meeting_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_signatures_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        Insert: {
          cancelled_at?: string | null
          commission_id: string
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string | null
          distributed_at?: string | null
          eligible_member_count?: number | null
          held_at?: string | null
          held_end?: string | null
          id?: string
          location_text?: string | null
          meeting_number: number
          meeting_type_id?: string | null
          meeting_url?: string | null
          minutes_md?: string | null
          modality?: string
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          present_count?: number | null
          quorum_met?: boolean | null
          quorum_rule_type?: string | null
          quorum_value?: number | null
          scheduled_end?: string | null
          scheduled_start: string
          status?: string
          title: string
          updated_at?: string
          visibility_policy?: string
        }
        Update: {
          cancelled_at?: string | null
          commission_id?: string
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string | null
          distributed_at?: string | null
          eligible_member_count?: number | null
          held_at?: string | null
          held_end?: string | null
          id?: string
          location_text?: string | null
          meeting_number?: number
          meeting_type_id?: string | null
          meeting_url?: string | null
          minutes_md?: string | null
          modality?: string
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          present_count?: number | null
          quorum_met?: boolean | null
          quorum_rule_type?: string | null
          quorum_value?: number | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: string
          title?: string
          updated_at?: string
          visibility_policy?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_concluded_by_fkey"
            columns: ["concluded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "commission_meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_phi_disposed_by_fkey"
            columns: ["phi_disposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          commission_id: string | null
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          hospital_id: string | null
          id: string
          organization_id: string | null
          principal_id: string
          role: string
          title_id: string | null
        }
        Insert: {
          commission_id?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          hospital_id?: string | null
          id?: string
          organization_id?: string | null
          principal_id: string
          role: string
          title_id?: string | null
        }
        Update: {
          commission_id?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          hospital_id?: string | null
          id?: string
          organization_id?: string | null
          principal_id?: string
          role?: string
          title_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_hospital_id_fkey"
            columns: ["hospital_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_title_id_fkey"
            columns: ["title_id", "commission_id"]
            isOneToOne: false
            referencedRelation: "commission_member_titles"
            referencedColumns: ["id", "commission_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          reminders_enabled: boolean
          surface: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reminders_enabled?: boolean
          surface: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          reminders_enabled?: boolean
          surface?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          commission_id: string | null
          created_at: string
          dedup_key: string
          entity_id: string
          entity_type: string
          id: string
          is_reminder: boolean
          kind: string
          milestone: string
          read_at: string | null
          resolved_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          commission_id?: string | null
          created_at?: string
          dedup_key: string
          entity_id: string
          entity_type: string
          id?: string
          is_reminder: boolean
          kind: string
          milestone: string
          read_at?: string | null
          resolved_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          commission_id?: string | null
          created_at?: string
          dedup_key?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_reminder?: boolean
          kind?: string
          milestone?: string
          read_at?: string | null
          resolved_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
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
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          organization_id: string
          participant_type: string
          sensitivity_class: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          organization_id: string
          participant_type: string
          sensitivity_class: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          organization_id?: string
          participant_type?: string
          sensitivity_class?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_identifiers: {
        Row: {
          age_years: number | null
          attending: string | null
          created_at: string
          date_of_birth: string | null
          encounter_key: string | null
          encounter_ref: string | null
          mrn: string | null
          name: string | null
          participant_id: string
          patient_key: string | null
          sex: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_key?: string | null
          encounter_ref?: string | null
          mrn?: string | null
          name?: string | null
          participant_id: string
          patient_key?: string | null
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_key?: string | null
          encounter_ref?: string | null
          mrn?: string | null
          name?: string | null
          participant_id?: string
          patient_key?: string | null
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_identifiers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "patient_participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      patient_participants: {
        Row: {
          created_at: string
          participant_id: string
          participant_type: string
        }
        Insert: {
          created_at?: string
          participant_id: string
          participant_type?: string
        }
        Update: {
          created_at?: string
          participant_id?: string
          participant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_participants_type_fk"
            columns: ["participant_id", "participant_type"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id", "participant_type"]
          },
        ]
      }
      patient_safety_event: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          current_owner_commission_id: string | null
          current_owner_kind: string
          description_md: string | null
          discovered_at: string | null
          event_type_id: string | null
          has_patient: boolean
          id: string
          location: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          reported_at: string
          reported_by: string | null
          reporting_commission_id: string
          status: string
          suspected_harm_level: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          case_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          code: string
          created_at?: string
          current_owner_commission_id?: string | null
          current_owner_kind?: string
          description_md?: string | null
          discovered_at?: string | null
          event_type_id?: string | null
          has_patient?: boolean
          id?: string
          location?: string | null
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          reported_at?: string
          reported_by?: string | null
          reporting_commission_id: string
          status?: string
          suspected_harm_level?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          case_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          code?: string
          created_at?: string
          current_owner_commission_id?: string | null
          current_owner_kind?: string
          description_md?: string | null
          discovered_at?: string | null
          event_type_id?: string | null
          has_patient?: boolean
          id?: string
          location?: string | null
          phi_disposed_at?: string | null
          phi_disposed_by?: string | null
          phi_disposed_reason?: string | null
          reported_at?: string
          reported_by?: string | null
          reporting_commission_id?: string
          status?: string
          suspected_harm_level?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_safety_event_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_current_owner_commission_id_fkey"
            columns: ["current_owner_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_event_type_fk"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "pqs_event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_phi_disposed_by_fkey"
            columns: ["phi_disposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_safety_event_reporting_commission_id_fkey"
            columns: ["reporting_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_xref: {
        Row: {
          commission_id: string | null
          created_at: string
          disposed_at: string | null
          disposed_reason: string | null
          encounter_key: string | null
          entity_id: string
          module: string
          patient_key: string | null
        }
        Insert: {
          commission_id?: string | null
          created_at?: string
          disposed_at?: string | null
          disposed_reason?: string | null
          encounter_key?: string | null
          entity_id: string
          module: string
          patient_key?: string | null
        }
        Update: {
          commission_id?: string | null
          created_at?: string
          disposed_at?: string | null
          disposed_reason?: string | null
          encounter_key?: string | null
          entity_id?: string
          module?: string
          patient_key?: string | null
        }
        Relationships: []
      }
      phase_results: {
        Row: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          is_adverse: boolean
          label: string
          position: number
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_results_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      pqs_department: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          name: string
          rca_default_due_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          name?: string
          rca_default_due_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          rca_default_due_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqs_department_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      pqs_event_types: {
        Row: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqs_event_types_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      pqs_sentinel_criteria: {
        Row: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqs_sentinel_criteria_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_custom_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          key: string
          label: string
          options: Json
          position: number
          required: boolean
          show_in_list: boolean
          template_version_id: string
        }
        Insert: {
          created_at?: string
          field_type: string
          id?: string
          key: string
          label: string
          options?: Json
          position?: number
          required?: boolean
          show_in_list?: boolean
          template_version_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          show_in_list?: boolean
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_custom_fields_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "process_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_narratives: {
        Row: {
          created_at: string
          display_position: number
          id: string
          instructions: string | null
          is_expected: boolean
          narrative_type_id: string
          template_version_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          display_position: number
          id?: string
          instructions?: string | null
          is_expected?: boolean
          narrative_type_id: string
          template_version_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          display_position?: number
          id?: string
          instructions?: string | null
          is_expected?: boolean
          narrative_type_id?: string
          template_version_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_template_narratives_narrative_type_id_fkey"
            columns: ["narrative_type_id"]
            isOneToOne: false
            referencedRelation: "case_narrative_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_narratives_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "process_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_outcomes: {
        Row: {
          created_at: string
          outcome_id: string
          position: number
          template_version_id: string
        }
        Insert: {
          created_at?: string
          outcome_id: string
          position?: number
          template_version_id: string
        }
        Update: {
          created_at?: string
          outcome_id?: string
          position?: number
          template_version_id?: string
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
            foreignKeyName: "process_template_outcomes_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "process_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_phase_allowed_results: {
        Row: {
          position: number
          result_id: string
          template_phase_id: string
        }
        Insert: {
          position: number
          result_id: string
          template_phase_id: string
        }
        Update: {
          position?: number
          result_id?: string
          template_phase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_phase_allowed_results_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "phase_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_phase_allowed_results_template_phase_id_fkey"
            columns: ["template_phase_id"]
            isOneToOne: false
            referencedRelation: "process_template_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_phase_offered_results: {
        Row: {
          result_id: string
          template_phase_id: string
        }
        Insert: {
          result_id: string
          template_phase_id: string
        }
        Update: {
          result_id?: string
          template_phase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_phase_offered_results_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "phase_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_phase_offered_results_template_phase_id_fkey"
            columns: ["template_phase_id"]
            isOneToOne: false
            referencedRelation: "process_template_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_phases: {
        Row: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          display_position: number | null
          emits_result: boolean
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          result_ruleset: Json | null
          template_version_id: string
          title: string | null
        }
        Insert: {
          blocks?: number[]
          created_at?: string
          default_due_days?: number | null
          display_position?: number | null
          emits_result?: boolean
          form_id: string
          id?: string
          position: number
          recommend_when?: Json | null
          result_ruleset?: Json | null
          template_version_id: string
          title?: string | null
        }
        Update: {
          blocks?: number[]
          created_at?: string
          default_due_days?: number | null
          display_position?: number | null
          emits_result?: boolean
          form_id?: string
          id?: string
          position?: number
          recommend_when?: Json | null
          result_ruleset?: Json | null
          template_version_id?: string
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
            foreignKeyName: "process_template_phases_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "process_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_versions: {
        Row: {
          case_type_id: string | null
          collects_patient: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          published_at: string | null
          status: string
          template_id: string
          title: string
          version_number: number
        }
        Insert: {
          case_type_id?: string | null
          collects_patient?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          status?: string
          template_id: string
          title: string
          version_number: number
        }
        Update: {
          case_type_id?: string | null
          collects_patient?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          status?: string
          template_id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_template_versions_case_type_id_fkey"
            columns: ["case_type_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_versions_template_id_fkey"
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
          id: string
          updated_at: string
        }
        Insert: {
          commission_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          commission_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
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
      professional_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          issuing_authority: string | null
          key: string
          label_pt: string
          position: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          issuing_authority?: string | null
          key: string
          label_pt: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          issuing_authority?: string | null
          key?: string
          label_pt?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      professional_credentials: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          issuing_authority: string
          issuing_country: string
          issuing_state: string
          registration_number: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          issuing_authority: string
          issuing_country: string
          issuing_state: string
          registration_number: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          issuing_authority?: string
          issuing_country?: string
          issuing_state?: string
          registration_number?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_participants: {
        Row: {
          created_at: string
          participant_id: string
          participant_type: string
          professional_profile_id: string
        }
        Insert: {
          created_at?: string
          participant_id: string
          participant_type?: string
          professional_profile_id: string
        }
        Update: {
          created_at?: string
          participant_id?: string
          participant_type?: string
          professional_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_participants_professional_profile_id_fkey"
            columns: ["professional_profile_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_participants_type_fk"
            columns: ["participant_id", "participant_type"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id", "participant_type"]
          },
        ]
      }
      professional_profiles: {
        Row: {
          affiliation_status: string | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          license_number: string | null
          license_region: string | null
          link_state: string
          organization_id: string
          professional_type: string | null
          redacted_at: string | null
          redacted_by: string | null
          retention_pin_reason: string | null
          retention_pinned_at: string | null
          specialty: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliation_status?: string | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          license_number?: string | null
          license_region?: string | null
          link_state?: string
          organization_id: string
          professional_type?: string | null
          redacted_at?: string | null
          redacted_by?: string | null
          retention_pin_reason?: string | null
          retention_pinned_at?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliation_status?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          license_number?: string | null
          license_region?: string | null
          link_state?: string
          organization_id?: string
          professional_type?: string | null
          redacted_at?: string | null
          redacted_by?: string | null
          retention_pin_reason?: string | null
          retention_pinned_at?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_profiles_redacted_by_fkey"
            columns: ["redacted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          email_confirmed_at: string | null
          full_name: string
          home_organization_id: string | null
          id: string
          is_active: boolean
          is_admin: boolean
          must_change_password: boolean
          professional_category_id: string | null
          suspended_until: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string
          home_organization_id?: string | null
          id: string
          is_active?: boolean
          is_admin?: boolean
          must_change_password?: boolean
          professional_category_id?: string | null
          suspended_until?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string
          home_organization_id?: string | null
          id?: string
          is_active?: boolean
          is_admin?: boolean
          must_change_password?: boolean
          professional_category_id?: string | null
          suspended_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_organization_id_fkey"
            columns: ["home_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_professional_category_id_fkey"
            columns: ["professional_category_id"]
            isOneToOne: false
            referencedRelation: "professional_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rca: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detected: string | null
          due_date: string | null
          event_id: string
          expected_md: string | null
          id: string
          impact: string | null
          scope: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          summary_md: string | null
          updated_at: string
          what_md: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detected?: string | null
          due_date?: string | null
          event_id: string
          expected_md?: string | null
          id?: string
          impact?: string | null
          scope?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          summary_md?: string | null
          updated_at?: string
          what_md?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detected?: string | null
          due_date?: string | null
          event_id?: string
          expected_md?: string | null
          id?: string
          impact?: string | null
          scope?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          summary_md?: string | null
          updated_at?: string
          what_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rca_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "patient_safety_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_evidence: {
        Row: {
          citation_label: string | null
          cited_document_id: string | null
          cited_interview_id: string | null
          cited_meeting_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          kind: string
          rca_id: string
          storage_path: string | null
          title: string
        }
        Insert: {
          citation_label?: string | null
          cited_document_id?: string | null
          cited_interview_id?: string | null
          cited_meeting_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          kind: string
          rca_id: string
          storage_path?: string | null
          title: string
        }
        Update: {
          citation_label?: string | null
          cited_document_id?: string | null
          cited_interview_id?: string | null
          cited_meeting_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          rca_id?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_evidence_cited_document_id_fkey"
            columns: ["cited_document_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_evidence_cited_interview_id_fkey"
            columns: ["cited_interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_evidence_cited_meeting_id_fkey"
            columns: ["cited_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_evidence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_evidence_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_evidence_rca_id_fkey"
            columns: ["rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_factors: {
        Row: {
          category: string
          created_at: string
          id: string
          is_key: boolean
          position: number
          rca_id: string
          text: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_key?: boolean
          position: number
          rca_id: string
          text: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_key?: boolean
          position?: number
          rca_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_factors_rca_id_fkey"
            columns: ["rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_members: {
        Row: {
          created_at: string
          external_name: string | null
          id: string
          rca_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          external_name?: string | null
          id?: string
          rca_id: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          external_name?: string | null
          id?: string
          rca_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rca_members_rca_id_fkey"
            columns: ["rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_root_causes: {
        Row: {
          category: string | null
          classification: string
          created_at: string
          id: string
          position: number
          rca_id: string
          text: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          classification?: string
          created_at?: string
          id?: string
          position: number
          rca_id: string
          text: string
          type?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          classification?: string
          created_at?: string
          id?: string
          position?: number
          rca_id?: string
          text?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_root_causes_rca_id_fkey"
            columns: ["rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_timeline_entries: {
        Row: {
          created_at: string
          description: string
          id: string
          occurred_at: string
          position: number
          rca_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          occurred_at: string
          position: number
          rca_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          occurred_at?: string
          position?: number
          rca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_timeline_entries_rca_id_fkey"
            columns: ["rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_why_chains: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          rca_id: string
          root_text: string | null
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          factor_id: string
          id?: string
          rca_id: string
          root_text?: string | null
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          rca_id?: string
          root_text?: string | null
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_why_chains_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: true
            referencedRelation: "rca_factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_why_chains_rca_id_fkey"
            columns: ["rca_id"]
            isOneToOne: false
            referencedRelation: "rca"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignee_user_id: string
          assignment_role: string
          cancelled_at: string | null
          commission_id: string
          completed_at: string | null
          due_at: string | null
          id: string
          referral_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_user_id: string
          assignment_role: string
          cancelled_at?: string | null
          commission_id: string
          completed_at?: string | null
          due_at?: string | null
          id?: string
          referral_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_user_id?: string
          assignment_role?: string
          cancelled_at?: string | null
          commission_id?: string
          completed_at?: string | null
          due_at?: string | null
          id?: string
          referral_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_assignments_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_assignments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_assignments_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_case_links: {
        Row: {
          case_id: string
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          referral_id: string
          relationship_type: string
        }
        Insert: {
          case_id: string
          commission_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          referral_id: string
          relationship_type: string
        }
        Update: {
          case_id?: string
          commission_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          referral_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_case_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_case_links_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_case_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_case_links_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_internal_notes: {
        Row: {
          author_user_id: string | null
          body: string
          committee_id: string
          created_at: string
          id: string
          redacted_at: string | null
          redacted_by: string | null
          redacted_reason: string | null
          referral_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          committee_id: string
          created_at?: string
          id?: string
          redacted_at?: string | null
          redacted_by?: string | null
          redacted_reason?: string | null
          referral_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          committee_id?: string
          created_at?: string
          id?: string
          redacted_at?: string | null
          redacted_by?: string | null
          redacted_reason?: string | null
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_internal_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_internal_notes_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_internal_notes_redacted_by_fkey"
            columns: ["redacted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_internal_notes_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          in_reply_to_message_id: string | null
          message_type: string
          redacted_at: string | null
          redacted_by: string | null
          redacted_reason: string | null
          referral_id: string
          sender_commission_id: string | null
          sender_user_id: string | null
          sequence_number: number
          supersedes_message_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          in_reply_to_message_id?: string | null
          message_type?: string
          redacted_at?: string | null
          redacted_by?: string | null
          redacted_reason?: string | null
          referral_id: string
          sender_commission_id?: string | null
          sender_user_id?: string | null
          sequence_number: number
          supersedes_message_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          in_reply_to_message_id?: string | null
          message_type?: string
          redacted_at?: string | null
          redacted_by?: string | null
          redacted_reason?: string | null
          referral_id?: string
          sender_commission_id?: string | null
          sender_user_id?: string | null
          sequence_number?: number
          supersedes_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_messages_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_patient: {
        Row: {
          age_years: number | null
          attending: string | null
          created_at: string
          date_of_birth: string | null
          encounter_key: string | null
          encounter_ref: string | null
          mrn: string | null
          name: string | null
          patient_key: string | null
          referral_id: string
          sex: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_key?: string | null
          encounter_ref?: string | null
          mrn?: string | null
          name?: string | null
          patient_key?: string | null
          referral_id: string
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_key?: string | null
          encounter_ref?: string | null
          mrn?: string | null
          name?: string | null
          patient_key?: string | null
          referral_id?: string
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_patient_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_read_receipts: {
        Row: {
          acknowledged_at: string | null
          delivered_at: string | null
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          delivered_at?: string | null
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          delivered_at?: string | null
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "referral_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_reply: {
        Row: {
          acknowledged_only: boolean
          created_at: string
          outcome_label: string | null
          referral_id: string
          replied_at: string | null
          replied_by: string | null
          reply_outcome_id: string | null
          result_md: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_only?: boolean
          created_at?: string
          outcome_label?: string | null
          referral_id: string
          replied_at?: string | null
          replied_by?: string | null
          reply_outcome_id?: string | null
          result_md?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_only?: boolean
          created_at?: string
          outcome_label?: string | null
          referral_id?: string
          replied_at?: string | null
          replied_by?: string | null
          reply_outcome_id?: string | null
          result_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_reply_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reply_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reply_reply_outcome_id_fkey"
            columns: ["reply_outcome_id"]
            isOneToOne: false
            referencedRelation: "reply_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_reply_attachment: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          referral_id: string
          size_bytes: number | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          referral_id: string
          size_bytes?: number | null
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          referral_id?: string
          size_bytes?: number | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_reply_attachment_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reply_attachment_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_requested_actions: {
        Row: {
          color_token: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          color_token?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_resolutions: {
        Row: {
          created_at: string
          final_reply_id: string | null
          follow_up_required: boolean
          id: string
          referral_id: string
          reopened_at: string | null
          reopened_by: string | null
          reopened_reason: string | null
          resolution_number: number
          resolved_at: string
          resolved_by_commission_id: string
          resolved_by_user_id: string | null
          summary_md: string | null
        }
        Insert: {
          created_at?: string
          final_reply_id?: string | null
          follow_up_required?: boolean
          id?: string
          referral_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          reopened_reason?: string | null
          resolution_number: number
          resolved_at?: string
          resolved_by_commission_id: string
          resolved_by_user_id?: string | null
          summary_md?: string | null
        }
        Update: {
          created_at?: string
          final_reply_id?: string | null
          follow_up_required?: boolean
          id?: string
          referral_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          reopened_reason?: string | null
          resolution_number?: number
          resolved_at?: string
          resolved_by_commission_id?: string
          resolved_by_user_id?: string | null
          summary_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_resolutions_final_reply_id_fkey"
            columns: ["final_reply_id"]
            isOneToOne: false
            referencedRelation: "referral_reply"
            referencedColumns: ["referral_id"]
          },
          {
            foreignKeyName: "referral_resolutions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_resolutions_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_resolutions_resolved_by_commission_id_fkey"
            columns: ["resolved_by_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_resolutions_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_shared_item: {
        Row: {
          created_at: string
          frozen_body_md: string | null
          frozen_mime_type: string | null
          frozen_size_bytes: number | null
          frozen_storage_path: string | null
          frozen_title: string | null
          id: string
          kind: string
          position: number
          referral_id: string
          source_document_id: string | null
          source_narrative_id: string | null
        }
        Insert: {
          created_at?: string
          frozen_body_md?: string | null
          frozen_mime_type?: string | null
          frozen_size_bytes?: number | null
          frozen_storage_path?: string | null
          frozen_title?: string | null
          id?: string
          kind: string
          position?: number
          referral_id: string
          source_document_id?: string | null
          source_narrative_id?: string | null
        }
        Update: {
          created_at?: string
          frozen_body_md?: string | null
          frozen_mime_type?: string | null
          frozen_size_bytes?: number | null
          frozen_storage_path?: string | null
          frozen_title?: string | null
          id?: string
          kind?: string
          position?: number
          referral_id?: string
          source_document_id?: string | null
          source_narrative_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_shared_item_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "case_referral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_shared_item_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_shared_item_source_narrative_id_fkey"
            columns: ["source_narrative_id"]
            isOneToOne: false
            referencedRelation: "case_narratives"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_types: {
        Row: {
          color_token: string | null
          created_at: string
          default_response_expected: boolean
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string
          default_response_expected?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          color_token?: string | null
          created_at?: string
          default_response_expected?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      reply_outcomes: {
        Row: {
          color_token: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          color_token?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      response_group_instances: {
        Row: {
          created_at: string
          group_item_id: string
          id: string
          parent_instance_id: string | null
          position: number
          response_id: string
        }
        Insert: {
          created_at?: string
          group_item_id: string
          id?: string
          parent_instance_id?: string | null
          position: number
          response_id: string
        }
        Update: {
          created_at?: string
          group_item_id?: string
          id?: string
          parent_instance_id?: string | null
          position?: number
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_group_instances_group_item_id_fkey"
            columns: ["group_item_id"]
            isOneToOne: false
            referencedRelation: "form_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_group_instances_parent_instance_id_fkey"
            columns: ["parent_instance_id"]
            isOneToOne: false
            referencedRelation: "response_group_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_group_instances_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
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
          supersedes_id: string | null
          target_case_participant_id: string | null
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
          supersedes_id?: string | null
          target_case_participant_id?: string | null
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
          supersedes_id?: string | null
          target_case_participant_id?: string | null
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
          {
            foreignKeyName: "responses_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_target_case_participant_id_fkey"
            columns: ["target_case_participant_id"]
            isOneToOne: false
            referencedRelation: "case_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          commission_id: string
          id: string
          note_md: string | null
          standard_id: string
          status: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          commission_id: string
          id?: string
          note_md?: string | null
          standard_id: string
          status: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          commission_id?: string
          id?: string
          note_md?: string | null
          standard_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_assessments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_assessments_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "accreditation_standards"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_ownerships: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          hospital_id: string
          id: string
          responsible_commission_id: string
          standard_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          hospital_id: string
          id?: string
          responsible_commission_id: string
          standard_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          hospital_id?: string
          id?: string
          responsible_commission_id?: string
          standard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_ownerships_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_ownerships_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_ownerships_responsible_commission_id_fkey"
            columns: ["responsible_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_ownerships_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "accreditation_standards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_referral: {
        Args: { p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      acknowledge_ethics_notification: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      acknowledge_event: {
        Args: { p_event_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          current_owner_commission_id: string | null
          current_owner_kind: string
          description_md: string | null
          discovered_at: string | null
          event_type_id: string | null
          has_patient: boolean
          id: string
          location: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          reported_at: string
          reported_by: string | null
          reporting_commission_id: string
          status: string
          suspected_harm_level: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_safety_event"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      action_items_enabled: { Args: never; Returns: boolean }
      activate_phase: {
        Args: {
          p_assigned_to: string
          p_case_phase_id: string
          p_due_date?: string
        }
        Returns: {
          activated_at: string | null
          assigned_to: string | null
          assignment_role_id: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          current_response_id: string | null
          default_due_days: number | null
          display_position: number | null
          due_date: string | null
          emits_result: boolean
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          result_computed_at: string | null
          result_id: string | null
          result_override_at: string | null
          result_override_by: string | null
          result_override_id: string | null
          result_override_reason: string | null
          result_ruleset: Json | null
          result_source: string | null
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
      add_ad_hoc_narrative: {
        Args: {
          p_assigned_to?: string
          p_case_id: string
          p_instructions?: string
          p_narrative_type_id?: string
          p_new_type_label?: string
          p_title?: string
        }
        Returns: {
          assigned_to: string | null
          body_md: string | null
          case_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          display_position: number
          id: string
          instructions: string | null
          is_ad_hoc: boolean
          is_expected: boolean
          narrative_type_id: string | null
          status: string
          title: string | null
          type_label: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_narratives"
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
          assignment_role_id: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          current_response_id: string | null
          default_due_days: number | null
          display_position: number | null
          due_date: string | null
          emits_result: boolean
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          result_computed_at: string | null
          result_id: string | null
          result_override_at: string | null
          result_override_by: string | null
          result_override_id: string | null
          result_override_reason: string | null
          result_ruleset: Json | null
          result_source: string | null
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
      add_capa_action: {
        Args: {
          p_action_strength?: string
          p_assignee_user_id?: string
          p_capa_id: string
          p_due_date?: string
          p_owner?: string
          p_root_cause_id?: string
          p_success_measure?: string
          p_title: string
        }
        Returns: {
          action_strength: string
          assignee_user_id: string | null
          capa_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          owner: string | null
          position: number
          root_cause_id: string | null
          status: string
          success_measure: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_capa_action_evidence: {
        Args: {
          p_action_id: string
          p_external_url?: string
          p_kind: string
          p_storage_path?: string
          p_title: string
        }
        Returns: {
          action_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          kind: string
          storage_path: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_capa_action_task: {
        Args: { p_action_id: string; p_description: string }
        Returns: {
          action_id: string
          created_at: string
          description: string
          id: string
          is_done: boolean
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action_task"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_capa_measure: {
        Args: {
          p_capa_id: string
          p_definition?: string
          p_name: string
          p_target?: string
        }
        Returns: {
          capa_id: string
          created_at: string
          definition: string | null
          id: string
          indicator_id: string | null
          name: string
          position: number
          target: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_measure"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_case_participant: {
        Args: {
          p_case_id: string
          p_involvement_summary?: string
          p_is_primary_subject?: boolean
          p_participant_id: string
          p_role_id: string
        }
        Returns: string
      }
      add_ethics_allegation: {
        Args: {
          p_alleged_event_date?: string
          p_case_id: string
          p_category_id: string
          p_description_md: string
          p_severity?: string
        }
        Returns: string
      }
      add_group_instance: {
        Args: { p_group_item_id: string; p_response_id: string }
        Returns: {
          created_at: string
          group_item_id: string
          id: string
          parent_instance_id: string | null
          position: number
          response_id: string
        }
        SetofOptions: {
          from: "*"
          to: "response_group_instances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_interview_interviewer: {
        Args: {
          p_external_name?: string
          p_external_org?: string
          p_interview_id: string
          p_note?: string
          p_role?: string
          p_user_id?: string
        }
        Returns: {
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          interview_id: string
          note: string | null
          participant_id: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_interview_interviewers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_interview_subject: {
        Args: {
          p_clinical_role?: string
          p_external_name?: string
          p_external_org?: string
          p_interview_id: string
          p_note?: string
          p_relationship_to_case?: string
          p_user_id?: string
        }
        Returns: {
          clinical_role: string | null
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          interview_id: string
          note: string | null
          participant_id: string | null
          relationship_to_case: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_interview_subjects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_meeting_attendee: {
        Args: {
          p_attendance?: string
          p_external_name?: string
          p_external_org?: string
          p_meeting_id: string
          p_note?: string
          p_role?: string
          p_user_id?: string
        }
        Returns: {
          attendance: string
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          meeting_id: string
          note: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meeting_attendees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_pqs_member: {
        Args: { p_hospital_id: string; p_user_id: string }
        Returns: undefined
      }
      add_rca_evidence: {
        Args: {
          p_citation_label?: string
          p_citation_target?: string
          p_cited_entity_id?: string
          p_external_url?: string
          p_kind: string
          p_rca_id: string
          p_storage_path?: string
          p_title: string
        }
        Returns: {
          citation_label: string | null
          cited_document_id: string | null
          cited_interview_id: string | null
          cited_meeting_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          kind: string
          rca_id: string
          storage_path: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_rca_factor: {
        Args: { p_category: string; p_rca_id: string; p_text: string }
        Returns: {
          category: string
          created_at: string
          id: string
          is_key: boolean
          position: number
          rca_id: string
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_factors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_rca_member: {
        Args: {
          p_external_name?: string
          p_rca_id: string
          p_role: string
          p_user_id?: string
        }
        Returns: {
          created_at: string
          external_name: string | null
          id: string
          rca_id: string
          role: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rca_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_rca_root_cause: {
        Args: {
          p_category?: string
          p_classification?: string
          p_rca_id: string
          p_text: string
          p_type?: string
        }
        Returns: {
          category: string | null
          classification: string
          created_at: string
          id: string
          position: number
          rca_id: string
          text: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_root_causes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_rca_timeline_entry: {
        Args: { p_description: string; p_occurred_at: string; p_rca_id: string }
        Returns: {
          created_at: string
          description: string
          id: string
          occurred_at: string
          position: number
          rca_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_timeline_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_referral_reply_attachment: {
        Args: {
          p_mime_type?: string
          p_referral_id: string
          p_size_bytes?: number
          p_storage_path: string
          p_title: string
        }
        Returns: {
          created_at: string
          id: string
          mime_type: string | null
          referral_id: string
          size_bytes: number | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referral_reply_attachment"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_referral_shared_item: {
        Args: {
          p_kind: string
          p_referral_id: string
          p_source_document_id?: string
          p_source_narrative_id?: string
        }
        Returns: {
          created_at: string
          frozen_body_md: string | null
          frozen_mime_type: string | null
          frozen_size_bytes: number | null
          frozen_storage_path: string | null
          frozen_title: string | null
          id: string
          kind: string
          position: number
          referral_id: string
          source_document_id: string | null
          source_narrative_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referral_shared_item"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_reserved_item: {
        Args: {
          p_case_id?: string
          p_decision?: string
          p_quorum_met?: boolean
          p_reader_uids?: string[]
          p_session_id: string
          p_substance?: string
          p_withdrawals?: string
        }
        Returns: string
      }
      add_template_narrative: {
        Args: {
          p_instructions?: string
          p_is_expected?: boolean
          p_narrative_type_id: string
          p_template_version_id: string
          p_title?: string
        }
        Returns: {
          created_at: string
          display_position: number
          id: string
          instructions: string | null
          is_expected: boolean
          narrative_type_id: string
          template_version_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_narratives"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_template_phase: {
        Args: {
          p_allowed_result_ids?: Json
          p_blocks?: number[]
          p_default_due_days?: number
          p_emits_result?: boolean
          p_form_id: string
          p_recommend_when?: Json
          p_result_ruleset?: Json
          p_template_version_id: string
          p_title?: string
        }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          display_position: number | null
          emits_result: boolean
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          result_ruleset: Json | null
          template_version_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_capa_action: {
        Args: { p_action_id: string; p_status: string }
        Returns: {
          action_strength: string
          assignee_user_id: string | null
          capa_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          owner: string | null
          position: number
          root_cause_id: string | null
          status: string
          success_measure: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_committee_action_item: {
        Args: { p_comment?: string; p_id: string; p_to_status_id: string }
        Returns: {
          assigned_to: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_case_id: string | null
          source_agenda_item_id: string | null
          source_case_id: string | null
          source_case_phase_id: string | null
          source_meeting_id: string | null
          source_type: string
          status_id: string
          title: string
          updated_at: string
          urgency_id: string | null
          visibility_scope: string
        }
        SetofOptions: {
          from: "*"
          to: "action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      affiliate_person: {
        Args: {
          p_employee_id?: string
          p_hospital: string
          p_started_on?: string
          p_user: string
        }
        Returns: string
      }
      affiliate_person_for: {
        Args: {
          p_actor: string
          p_employee_id?: string
          p_hospital: string
          p_started_on?: string
          p_user: string
        }
        Returns: string
      }
      appoint_administrativo: {
        Args: { p_commission_id: string; p_user_id: string }
        Returns: undefined
      }
      appoint_technical_director: {
        Args: { p_hospital: string; p_user: string }
        Returns: undefined
      }
      approve_correction: {
        Args: { p_note?: string; p_request_id: string }
        Returns: undefined
      }
      approve_document: {
        Args: { p_note?: string; p_version_id: string }
        Returns: {
          approver_id: string
          approver_title: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          document_version_id: string
          id: string
          note: string | null
          signature_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_approvals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_case_assignment_role: {
        Args: { p_role_id: string }
        Returns: undefined
      }
      archive_case_narrative_type: {
        Args: { p_narrative_type_id: string }
        Returns: {
          archived: boolean
          commission_id: string
          created_at: string
          description: string | null
          id: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_narrative_types"
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
      archive_ethics_allegation_category: {
        Args: { p_category_id: string }
        Returns: undefined
      }
      archive_ethics_sanction_type: {
        Args: { p_type_id: string }
        Returns: undefined
      }
      archive_event_type: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_event_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_indicator: {
        Args: { p_id: string }
        Returns: {
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          data_source: string
          denominator_label: string | null
          derived_config: Json | null
          description_md: string | null
          direction: string
          frequency: string
          id: string
          kind: string
          lower_warn: number | null
          name: string
          numerator_label: string | null
          status: string
          target_comparator: string
          target_value: number | null
          unit: string | null
          updated_at: string
          upper_warn: number | null
        }
        SetofOptions: {
          from: "*"
          to: "indicators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_meeting_type: {
        Args: { p_type_id: string }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commission_meeting_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_phase_result: {
        Args: { p_result_id: string }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          is_adverse: boolean
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "phase_results"
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
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_sentinel_criterion: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_sentinel_criteria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_case_tag: {
        Args: { p_case_id: string; p_tag_id: string }
        Returns: undefined
      }
      assign_ethics_remediation: {
        Args: {
          p_assigned_to?: string
          p_decision_id: string
          p_description?: string
          p_due_date?: string
          p_title: string
        }
        Returns: string
      }
      assign_hospital_admin: {
        Args: { p_hospital: string; p_user: string }
        Returns: undefined
      }
      assign_member_title: {
        Args: { p_member_id: string; p_title_id?: string }
        Returns: undefined
      }
      assign_narrative: {
        Args: { p_assignee: string; p_narrative: string }
        Returns: undefined
      }
      assign_nsp_coordinator: {
        Args: { p_hospital: string; p_user: string }
        Returns: undefined
      }
      assign_nsp_org_admin: {
        Args: { p_org: string; p_user: string }
        Returns: undefined
      }
      assign_org_admin: {
        Args: { p_org: string; p_user: string }
        Returns: undefined
      }
      assign_referral_reviewer: {
        Args: {
          p_assignee_user_id: string
          p_assignment_role: string
          p_commission_id: string
          p_due_at?: string
          p_referral_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          assignee_user_id: string
          assignment_role: string
          cancelled_at: string | null
          commission_id: string
          completed_at: string | null
          due_at: string | null
          id: string
          referral_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      audit_trail_enabled: { Args: never; Returns: boolean }
      bulk_create_cases: {
        Args: {
          p_deadline: string
          p_phase_scope: string
          p_rows: Json
          p_template_id: string
        }
        Returns: number
      }
      can_dispose_referral_phi: {
        Args: { p_referral_id: string }
        Returns: boolean
      }
      cancel_capa_plan: {
        Args: { p_capa_id: string }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          lessons_learned_md: string | null
          opened_by: string | null
          source: string
          source_audit_finding_id: string | null
          source_event_id: string | null
          source_indicator_id: string | null
          source_meeting_id: string | null
          source_rca_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_case: {
        Args: { p_case_id: string }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_ethics_notification: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      cancel_event: {
        Args: { p_event_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          current_owner_commission_id: string | null
          current_owner_kind: string
          description_md: string | null
          discovered_at: string | null
          event_type_id: string | null
          has_patient: boolean
          id: string
          location: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          reported_at: string
          reported_by: string | null
          reporting_commission_id: string
          status: string
          suspected_harm_level: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_safety_event"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_interview: {
        Args: { p_interview_id: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_interviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_meeting: {
        Args: { p_meeting_id: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_referral_assignment: {
        Args: { p_assignment_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          assignee_user_id: string
          assignment_role: string
          cancelled_at: string | null
          commission_id: string
          completed_at: string | null
          due_at: string | null
          id: string
          referral_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_session: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "interview_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      capa_kpis: {
        Args: never
        Returns: {
          closed_ytd: number
          in_verification: number
          open_count: number
          overdue_actions: number
        }[]
      }
      capa_viewer_can_manage: { Args: { p_capa_id: string }; Returns: boolean }
      case_action_items_kpis: {
        Args: { p_commission_id: string }
        Returns: {
          completed_ytd: number
          open: number
          overdue: number
        }[]
      }
      case_narratives_enabled: { Args: never; Returns: boolean }
      case_patient_enabled: { Args: never; Returns: boolean }
      case_phase_results_enabled: { Args: never; Returns: boolean }
      case_tag_report: {
        Args: { p_commission_id: string; p_from?: string; p_to?: string }
        Returns: {
          case_count: number
          color_token: string
          name: string
          tag_id: string
        }[]
      }
      case_viewer_capabilities: { Args: { p_case_id: string }; Returns: Json }
      cases_extras_enabled: { Args: never; Returns: boolean }
      cast_case_vote: {
        Args: { p_decision_id: string; p_rationale_md?: string; p_vote: string }
        Returns: string
      }
      clone_form_version: {
        Args: { p_source_version_id: string }
        Returns: string
      }
      clone_framework: {
        Args: { p_commission: string; p_framework: string }
        Returns: {
          cloned_from_framework_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          owner_commission_id: string | null
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "accreditation_frameworks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clone_template_version: {
        Args: { p_source_version_id: string }
        Returns: string
      }
      close_capa_plan: {
        Args: { p_capa_id: string; p_lessons_learned_md?: string }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          lessons_learned_md: string | null
          opened_by: string | null
          source: string
          source_audit_finding_id: string | null
          source_event_id: string | null
          source_indicator_id: string | null
          source_meeting_id: string | null
          source_rca_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_case: {
        Args: { p_case_id: string }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
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
      complete_capa_action: {
        Args: { p_action_id: string }
        Returns: {
          action_strength: string
          assignee_user_id: string | null
          capa_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          owner: string | null
          position: number
          root_cause_id: string | null
          status: string
          success_measure: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_committee_action_item: {
        Args: { p_id: string }
        Returns: {
          assigned_to: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_case_id: string | null
          source_agenda_item_id: string | null
          source_case_id: string | null
          source_case_phase_id: string | null
          source_meeting_id: string | null
          source_type: string
          status_id: string
          title: string
          updated_at: string
          urgency_id: string | null
          visibility_scope: string
        }
        SetofOptions: {
          from: "*"
          to: "action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_ethics_hearing: {
        Args: {
          p_complainant_present?: boolean
          p_hearing_id: string
          p_legal_representative_present?: boolean
          p_outcome_md: string
          p_respondent_present?: boolean
          p_summary_md: string
        }
        Returns: undefined
      }
      complete_rca: {
        Args: { p_rca_id: string }
        Returns: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detected: string | null
          due_date: string | null
          event_id: string
          expected_md: string | null
          id: string
          impact: string | null
          scope: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          summary_md: string | null
          updated_at: string
          what_md: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rca"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_session: {
        Args: { p_actual_end?: string; p_session_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "interview_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_derived_measurement: {
        Args: {
          p_denominator?: number
          p_indicator: string
          p_period_end?: string
          p_period_label: string
          p_period_start?: string
        }
        Returns: {
          denominator: number | null
          entered_at: string
          entered_by: string | null
          id: string
          indicator_id: string
          note: string | null
          numerator: number | null
          period_end: string | null
          period_label: string
          period_start: string | null
          source: string
          status: string
          value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "indicator_measurements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_due_notifications: { Args: never; Returns: number }
      conclude_interview: {
        Args: { p_interview_id: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_interviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conclude_meeting: {
        Args: { p_held_at?: string; p_held_end?: string; p_meeting_id: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conclude_narrative: { Args: { p_narrative: string }; Returns: undefined }
      conclude_referral: {
        Args: {
          p_acknowledged_only?: boolean
          p_referral_id: string
          p_reply_outcome_id?: string
          p_result_md?: string
        }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_triage: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          disposition_notes_md: string | null
          event_id: string
          harm_severity: string | null
          is_pse: boolean | null
          natural_course: boolean | null
          pse_closure_reason: string | null
          reach: string | null
          review_pathway: string | null
          sentinel_determination: boolean
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_triage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      count_open_cases_for_board: {
        Args: { p_commission_id: string }
        Returns: number
      }
      create_attachment: {
        Args: {
          p_confidentiality_label?: string
          p_description?: string
          p_kind?: string
          p_mime_type?: string
          p_occurred_on?: string
          p_owner_id: string
          p_owner_type: string
          p_sensitivity_tier?: string
          p_sha256?: string
          p_size_bytes?: number
          p_storage_path: string
          p_title: string
        }
        Returns: {
          confidentiality_label: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          document_group_id: string | null
          id: string
          kind: string
          legal_hold: boolean
          mime_type: string | null
          occurred_on: string | null
          owner_id: string
          owner_type: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          scan_status: string
          sensitivity_tier: string
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          supersedes_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case: {
        Args: {
          p_case_type_id?: string
          p_commission_id: string
          p_department_id?: string
          p_department_other?: string
          p_label?: string
          p_outcome_ids?: string[]
          p_patient_enabled?: boolean
        }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case_assignment_role: {
        Args: { p_display_name: string; p_key: string; p_org: string }
        Returns: string
      }
      create_case_decision: {
        Args: {
          p_case_id: string
          p_decision_type: string
          p_rationale_md?: string
          p_summary_md: string
        }
        Returns: string
      }
      create_case_from_template: {
        Args: {
          p_case_type_id?: string
          p_custom_fields?: Json
          p_department_id?: string
          p_department_other?: string
          p_label?: string
          p_template_id: string
        }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case_narrative_type: {
        Args: {
          p_commission_id: string
          p_description?: string
          p_label: string
        }
        Returns: {
          archived: boolean
          commission_id: string
          created_at: string
          description: string | null
          id: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_narrative_types"
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
      create_committee_action_item: {
        Args: {
          p_agenda_item_id?: string
          p_assigned_to?: string
          p_case_id?: string
          p_commission: string
          p_description?: string
          p_due_date?: string
          p_meeting_id?: string
          p_source_case_phase_id?: string
          p_source_type: string
          p_title?: string
          p_urgency_id?: string
          p_visibility_scope?: string
        }
        Returns: {
          assigned_to: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_case_id: string | null
          source_agenda_item_id: string | null
          source_case_id: string | null
          source_case_phase_id: string | null
          source_meeting_id: string | null
          source_type: string
          status_id: string
          title: string
          updated_at: string
          urgency_id: string | null
          visibility_scope: string
        }
        SetofOptions: {
          from: "*"
          to: "action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_committee_action_item_checklist: {
        Args: {
          p_action_item_id: string
          p_sort_order?: number
          p_title: string
        }
        Returns: {
          action_item_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_done: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "action_item_checklists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_committee_action_item_reminder: {
        Args: {
          p_action_item_id: string
          p_offset_days?: number
          p_reminder_type: string
        }
        Returns: {
          action_item_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          offset_days: number | null
          reminder_type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "action_item_reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_committee_action_item_update: {
        Args: {
          p_action_item_id: string
          p_body: string
          p_update_type: string
        }
        Returns: {
          action_item_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          update_type: string
        }
        SetofOptions: {
          from: "*"
          to: "action_item_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_controlled_document: {
        Args: {
          p_category?: string
          p_commission: string
          p_description?: string
          p_doc_type: string
          p_review_cycle_months?: number
          p_tags?: string[]
          p_title: string
        }
        Returns: {
          category: string | null
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          doc_type: string
          id: string
          review_cycle_months: number | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "controlled_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_ethics_allegation_category: {
        Args: { p_display_name: string; p_key: string; p_org: string }
        Returns: string
      }
      create_ethics_sanction_type: {
        Args: { p_display_name: string; p_key: string; p_org: string }
        Returns: string
      }
      create_event_type: {
        Args: {
          p_description?: string
          p_hospital_id?: string
          p_key: string
          p_label: string
        }
        Returns: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_event_types"
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
      create_framework: {
        Args: {
          p_description?: string
          p_key: string
          p_name: string
          p_owner_commission?: string
          p_version?: string
        }
        Returns: {
          cloned_from_framework_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          owner_commission_id: string | null
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "accreditation_frameworks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_indicator: {
        Args: {
          p_commission: string
          p_data_source?: string
          p_denominator_label?: string
          p_derived_config?: Json
          p_description_md?: string
          p_direction?: string
          p_frequency?: string
          p_kind: string
          p_lower_warn?: number
          p_name: string
          p_numerator_label?: string
          p_target_comparator?: string
          p_target_value?: number
          p_unit?: string
          p_upper_warn?: number
        }
        Returns: {
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          data_source: string
          denominator_label: string | null
          derived_config: Json | null
          description_md: string | null
          direction: string
          frequency: string
          id: string
          kind: string
          lower_warn: number | null
          name: string
          numerator_label: string | null
          status: string
          target_comparator: string
          target_value: number | null
          unit: string | null
          updated_at: string
          upper_warn: number | null
        }
        SetofOptions: {
          from: "*"
          to: "indicators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_interview: {
        Args: {
          p_case_id: string
          p_case_phase_id?: string
          p_confidentiality_level?: string
          p_interview_category?: string
          p_title?: string
        }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_interviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_meeting: {
        Args: {
          p_commission_id: string
          p_location_text?: string
          p_meeting_type_id?: string
          p_meeting_url?: string
          p_modality?: string
          p_scheduled_end?: string
          p_scheduled_start?: string
          p_title: string
        }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_meeting_agenda_item: {
        Args: {
          p_description?: string
          p_discussion_notes?: string
          p_meeting_id: string
          p_resolution?: string
          p_title: string
        }
        Returns: string
      }
      create_meeting_type: {
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
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commission_meeting_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_member_title: {
        Args: { p_commission_id: string; p_name: string }
        Returns: {
          commission_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commission_member_titles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_phase_result: {
        Args: {
          p_color_token?: string
          p_commission_id: string
          p_is_adverse?: boolean
          p_label: string
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
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "phase_results"
          isOneToOne: true
          isSetofReturn: false
        }
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
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_professional_profile: {
        Args: {
          p_affiliation_status?: string
          p_full_name: string
          p_license_number?: string
          p_license_region?: string
          p_org: string
          p_professional_type?: string
          p_specialty?: string
          p_user_id?: string
        }
        Returns: string
      }
      create_referral_draft: {
        Args: {
          p_description_md?: string
          p_parent_referral_id?: string
          p_priority?: string
          p_referral_type_id: string
          p_requested_action_id?: string
          p_response_due_at?: string
          p_response_expected?: boolean
          p_source_case_id: string
          p_subject: string
          p_target_commission_id: string
          p_target_hospital_id?: string
        }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_referral_internal_note: {
        Args: { p_body: string; p_committee_id: string; p_referral_id: string }
        Returns: {
          author_user_id: string | null
          body: string
          committee_id: string
          created_at: string
          id: string
          redacted_at: string | null
          redacted_by: string | null
          redacted_reason: string | null
          referral_id: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_internal_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_referral_requested_action: {
        Args: {
          p_color_token?: string
          p_description?: string
          p_key: string
          p_label: string
          p_position?: number
        }
        Returns: {
          color_token: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_requested_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sentinel_criterion: {
        Args: {
          p_description?: string
          p_hospital_id?: string
          p_key: string
          p_label: string
        }
        Returns: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_sentinel_criteria"
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
          option_code: string
          option_count: number
          option_label: string
          question_key: string
          section_position: number
          section_title: string
        }[]
      }
      dashboard_entity_references: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          denominator: number
          item_position: number
          label: string
          n: number
          question_key: string
          ref_count: number
          reference_kind: string
          section_position: number
          section_title: string
          target_id: string
          target_label: string
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
      dashboard_matrix_cells: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          cell_count: number
          col_code: string
          col_label: string
          col_position: number
          denominator: number
          item_position: number
          label: string
          n: number
          question_key: string
          row_code: string
          row_label: string
          row_position: number
          section_position: number
          section_title: string
        }[]
      }
      dashboard_risk_scores: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          average: number
          item_position: number
          label: string
          likelihood_code: string
          likelihood_label: string
          likelihood_position: number
          maximum: number
          minimum: number
          n: number
          pair_count: number
          question_key: string
          score: number
          section_position: number
          section_title: string
          severity_code: string
          severity_label: string
          severity_position: number
        }[]
      }
      dashboard_submissions_over_time: {
        Args: { p_form_id: string; p_from?: string; p_to?: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      decide_admissibility: {
        Args: { p_case_id: string; p_rationale_md: string; p_status: string }
        Returns: undefined
      }
      declare_conflict: {
        Args: {
          p_case_id: string
          p_conflict_type: string
          p_description_md: string
        }
        Returns: string
      }
      decline_referral: {
        Args: {
          p_decline_reason_code?: string
          p_note?: string
          p_referral_id: string
        }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_ad_hoc_case_narrative: {
        Args: { p_narrative_id: string }
        Returns: undefined
      }
      delete_ad_hoc_case_phase: {
        Args: { p_phase_id: string }
        Returns: undefined
      }
      delete_block_library_entry: {
        Args: { p_library_entry_id: string }
        Returns: undefined
      }
      delete_capa_action_evidence: {
        Args: { p_evidence_id: string }
        Returns: undefined
      }
      delete_committee_action_item: {
        Args: { p_id: string }
        Returns: undefined
      }
      delete_committee_action_item_checklist: {
        Args: { p_id: string }
        Returns: undefined
      }
      delete_committee_action_item_reminder: {
        Args: { p_id: string }
        Returns: undefined
      }
      delete_meeting_agenda_item: {
        Args: { p_agenda_item_id: string }
        Returns: undefined
      }
      delete_member_title: { Args: { p_title_id: string }; Returns: undefined }
      delete_rca_evidence: {
        Args: { p_evidence_id: string }
        Returns: undefined
      }
      delete_section_moving_items: {
        Args: { p_section_id: string; p_target_section_id: string }
        Returns: undefined
      }
      delete_standard: { Args: { p_standard: string }; Returns: undefined }
      discard_response: { Args: { p_response_id: string }; Returns: undefined }
      discard_template_draft: {
        Args: { p_template_version_id: string }
        Returns: undefined
      }
      dispose_attachment_phi: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      dispose_case_phi: {
        Args: { p_case_id: string; p_reason: string }
        Returns: undefined
      }
      dispose_event_phi: {
        Args: { p_event_id: string; p_reason: string }
        Returns: undefined
      }
      dispose_meeting_minutes: {
        Args: { p_meeting_id: string; p_reason: string }
        Returns: undefined
      }
      dispose_referral_phi: {
        Args: { p_reason: string; p_referral_id: string }
        Returns: undefined
      }
      distribute_meeting: {
        Args: { p_meeting_id: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      documents_due_for_review: {
        Args: { p_commission: string }
        Returns: {
          code: string
          commission_id: string
          commission_name: string
          document_id: string
          form_version_id: string
          is_overdue: boolean
          review_due_date: string
          source_kind: string
          title: string
        }[]
      }
      draft_version_of_template: {
        Args: { p_template_id: string }
        Returns: string
      }
      end_affiliation: {
        Args: { p_ended_on?: string; p_hospital: string; p_user: string }
        Returns: string
      }
      end_affiliation_for: {
        Args: {
          p_actor: string
          p_ended_on?: string
          p_hospital: string
          p_user: string
        }
        Returns: string
      }
      evidence_candidates: {
        Args: { p_commission: string; p_kind: string; p_query?: string }
        Returns: {
          id: string
          label: string
          sublabel: string
        }[]
      }
      file_correction_request: {
        Args: {
          p_case_narrative_id: string
          p_case_phase_id: string
          p_classification: string
          p_kind: string
          p_permitted_corrector?: string
          p_reason: string
        }
        Returns: string
      }
      get_case_detail: { Args: { p_case_id: string }; Returns: Json }
      get_case_meeting_links: {
        Args: { p_case_id: string }
        Returns: {
          agenda_item_id: string | null
          case_id: string
          created_at: string
          decision: string | null
          id: string
          meeting_id: string
          summary: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "meeting_cases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_case_patient: { Args: { p_case_id: string }; Returns: Json }
      get_case_patients: { Args: { p_case_id: string }; Returns: Json }
      get_case_professional: {
        Args: { p_participant_id: string }
        Returns: Json
      }
      get_ethics_case_procedure: { Args: { p_case_id: string }; Returns: Json }
      get_event_patient: { Args: { p_event_id: string }; Returns: Json }
      get_feature_flags: { Args: never; Returns: Json }
      get_meeting_agenda_items: {
        Args: { p_meeting_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          discussion_notes: string | null
          id: string
          meeting_id: string
          position: number
          resolution: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "meeting_agenda_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_meeting_cases: {
        Args: { p_meeting_id: string }
        Returns: {
          agenda_item_id: string | null
          case_id: string
          created_at: string
          decision: string | null
          id: string
          meeting_id: string
          summary: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "meeting_cases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_member_overview: { Args: { p_commission: string }; Returns: Json }
      get_participant_patient: {
        Args: { p_participant_id: string }
        Returns: Json
      }
      get_patient_trajectory_for_entity: {
        Args: { p_entity_id: string; p_module: string }
        Returns: Json
      }
      get_referral_attachment_path: {
        Args: { p_attachment_id: string }
        Returns: string
      }
      get_referral_detail: { Args: { p_referral_id: string }; Returns: Json }
      get_referral_patient: { Args: { p_referral_id: string }; Returns: Json }
      get_referral_snapshot_document_path: {
        Args: { p_shared_item_id: string }
        Returns: string
      }
      get_reserved_session_items: {
        Args: { p_meeting_id: string }
        Returns: {
          case_id: string
          closed_session_id: string
          decision: string
          ended_at: string
          id: string
          item_position: number
          process_number: number
          quorum_met: boolean
          started_at: string
          substance: string
          withdrawals: string
        }[]
      }
      get_response_for_signoff: {
        Args: { p_response_id: string }
        Returns: Json
      }
      get_response_validation_errors: {
        Args: { p_response_id: string }
        Returns: {
          group_instance_id: string
          item_id: string
          message: string
          rule_id: string
          rule_type: string
          severity: string
        }[]
      }
      get_standard_assessment: {
        Args: { p_commission: string; p_standard: string }
        Returns: {
          assessed_at: string
          assessed_by_name: string
          note_md: string
          status: string
        }[]
      }
      grant_case_access: {
        Args: {
          p_case: string
          p_expires_at?: string
          p_level?: string
          p_read_restricted_phi?: boolean
          p_read_standard_phi?: boolean
          p_reason?: string
          p_user: string
        }
        Returns: undefined
      }
      grant_member_capability: {
        Args: {
          p_capability: string
          p_commission_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      grant_role: {
        Args: {
          p_role: string
          p_scope_id: string
          p_scope_type: string
          p_title_id?: string
          p_user: string
        }
        Returns: undefined
      }
      grant_role_for: {
        Args: {
          p_actor: string
          p_role: string
          p_scope_id: string
          p_scope_type: string
          p_title_id?: string
          p_user: string
        }
        Returns: undefined
      }
      hospital_document_register: {
        Args: {
          p_doc_type?: string
          p_hospital: string
          p_review_overdue_only?: boolean
          p_status?: string
        }
        Returns: {
          code: string
          commission_id: string
          commission_name: string
          current_version_number: number
          doc_type: string
          document_id: string
          effective_date: string
          is_review_overdue: boolean
          review_due_date: string
          status: string
          title: string
        }[]
      }
      hospital_indicator_rollup: {
        Args: { p_hospital: string }
        Returns: {
          commission_id: string
          commission_name: string
          no_data: number
          off_target: number
          on_target: number
          total: number
        }[]
      }
      hospital_readiness: {
        Args: { p_framework: string; p_hospital: string }
        Returns: {
          consolidated_status: string
          evidence_atencao: number
          evidence_restrita: number
          evidence_valida: number
          evidence_vencida: number
          level: number
          resolution: string
          responsible_commission_id: string
          standard_code: string
          standard_id: string
          standard_title: string
        }[]
      }
      indicator_kpis: {
        Args: { p_commission: string }
        Returns: {
          no_data: number
          off_target: number
          on_target: number
          total: number
        }[]
      }
      indicator_series: {
        Args: { p_from?: string; p_indicator: string; p_to?: string }
        Returns: {
          period_label: string
          period_start: string
          status: string
          target: number
          value: number
        }[]
      }
      insert_block_from_library: {
        Args: { p_library_entry_id: string; p_section_id: string }
        Returns: Json
      }
      interview_viewer_can_write: {
        Args: { p_interview_id: string }
        Returns: boolean
      }
      interviews_enabled: { Args: never; Returns: boolean }
      is_nsp_coordinator_of_self: {
        Args: { p_hospital_id: string }
        Returns: boolean
      }
      is_nsp_org_admin_of_self: { Args: { p_org_id: string }; Returns: boolean }
      is_pqs_member_of_self: {
        Args: { p_hospital_id: string }
        Returns: boolean
      }
      is_pqs_member_self: { Args: never; Returns: boolean }
      issue_decision: { Args: { p_decision_id: string }; Returns: undefined }
      issue_ethics_notification: {
        Args: {
          p_case_id: string
          p_delivery_method: string
          p_due_at?: string
          p_notes_md?: string
          p_notification_type: string
          p_recipient_participant_id?: string
          p_recipient_user_id?: string
          p_related_document_id?: string
        }
        Returns: string
      }
      lift_recusal: {
        Args: { p_reason_md: string; p_recusal_id: string }
        Returns: undefined
      }
      link_evidence: {
        Args: {
          p_artifact: string
          p_commission: string
          p_kind: string
          p_note?: string
          p_standard: string
        }
        Returns: {
          artifact_id: string
          artifact_kind: string
          commission_id: string
          id: string
          linked_at: string
          linked_by: string | null
          note: string | null
          standard_id: string
        }
        SetofOptions: {
          from: "*"
          to: "evidence_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      link_meeting_case: {
        Args: {
          p_agenda_item_id?: string
          p_case_id: string
          p_decision?: string
          p_meeting_id: string
          p_summary?: string
        }
        Returns: string
      }
      link_referral_case: {
        Args: { p_referral_id: string; p_target_case_id?: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      link_referral_related_case: {
        Args: {
          p_case_id: string
          p_referral_id: string
          p_relationship_type: string
        }
        Returns: {
          case_id: string
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          referral_id: string
          relationship_type: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_case_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_addable_commission_members: {
        Args: { p_commission_id: string; p_search?: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      list_approver_candidates: {
        Args: { p_commission: string }
        Returns: {
          id: string
          name: string
          title: string
        }[]
      }
      list_audit_filter_actors: {
        Args: { p_commission?: string }
        Returns: {
          actor_id: string
          full_name: string
        }[]
      }
      list_case_access: {
        Args: { p_case: string }
        Returns: {
          expires_at: string
          granted_at: string
          level: string
          max_confidentiality: string
          read_restricted_phi: boolean
          read_standard_phi: boolean
          reason: string
          user_id: string
        }[]
      }
      list_cases_board: {
        Args: { p_commission_id: string; p_limit?: number }
        Returns: {
          case_id: string
          case_number: number
          closed_at: string
          created_at: string
          label: string
          open_narrative_count: number
          outcome: Json
          outcome_id: string
          phases: Json
          status: string
        }[]
      }
      list_commission_documents: {
        Args: { p_commission: string }
        Returns: {
          approvals_signed_count: number
          approvals_total_count: number
          category: string
          code: string
          commission_id: string
          created_at: string
          current_version_id: string
          current_version_number: number
          description: string
          doc_type: string
          effective_date: string
          has_open_revision: boolean
          hospital_id: string
          id: string
          obsolete_kind: string
          review_cycle_months: number
          review_due_date: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      list_hospital_eligible_users_for_pqs: {
        Args: { p_hospital_id: string }
        Returns: Json
      }
      list_my_action_items: { Args: { p_commission: string }; Returns: Json }
      list_my_assigned_capa_actions: {
        Args: never
        Returns: {
          action_strength: string
          capa_id: string
          due_date: string
          id: string
          owner: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      list_my_cases: { Args: { p_commission: string }; Returns: Json }
      list_my_nsp_hospitals: { Args: never; Returns: Json }
      list_my_referral_assignments: { Args: never; Returns: Json }
      list_org_eligible_users: { Args: { p_org_id: string }; Returns: Json }
      list_org_people: {
        Args: { p_cpf?: string; p_org_id: string; p_search?: string }
        Returns: {
          affiliations: Json
          email: string
          full_name: string
          is_active: boolean
          professional_category: string
          user_id: string
        }[]
      }
      list_pqs_members: { Args: { p_hospital_id: string }; Returns: Json }
      list_referral_internal_notes: {
        Args: { p_referral_id: string }
        Returns: Json
      }
      list_referral_target_commissions: {
        Args: { p_source_commission_id: string }
        Returns: {
          id: string
          name: string
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
      log_audit_access: {
        Args: {
          p_action: string
          p_commission: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_summary: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_document_obsolete: {
        Args: { p_document_id: string }
        Returns: {
          category: string | null
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          doc_type: string
          id: string
          review_cycle_months: number | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "controlled_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_meeting_held: {
        Args: { p_held_at?: string; p_held_end?: string; p_meeting_id: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      meeting_cadence_status: { Args: { p_commission: string }; Returns: Json }
      meetings_enabled: { Args: never; Returns: boolean }
      my_pending_meeting_signatures: {
        Args: never
        Returns: {
          attendee_id: string
          meeting_id: string
          meeting_number: number
          scheduled_start: string
          title: string
        }[]
      }
      no_show_session: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "interview_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify_safety_event: {
        Args: {
          p_case_id?: string
          p_description_md?: string
          p_discovered_at?: string
          p_event_type_id?: string
          p_location?: string
          p_reporting_commission_id: string
          p_suspected_harm_level?: string
          p_title: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          current_owner_commission_id: string | null
          current_owner_kind: string
          description_md: string | null
          discovered_at: string | null
          event_type_id: string | null
          has_patient: boolean
          id: string
          location: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          reported_at: string
          reported_by: string | null
          reporting_commission_id: string
          status: string
          suspected_harm_level: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_safety_event"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      nsp_org_capa_rollup: { Args: { p_org_id: string }; Returns: Json }
      nsp_org_event_rollup: { Args: { p_org_id: string }; Returns: Json }
      nsp_org_roster: { Args: { p_org_id: string }; Returns: Json }
      open_attachment: {
        Args: { p_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      open_capa_plan: {
        Args: {
          p_classification?: string
          p_hospital_id?: string
          p_source: string
          p_source_id?: string
        }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          lessons_learned_md: string | null
          opened_by: string | null
          source: string
          source_audit_finding_id: string | null
          source_event_id: string | null
          source_indicator_id: string | null
          source_meeting_id: string | null
          source_rca_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      open_ethics_external_referral: {
        Args: {
          p_decision_id: string
          p_description_md: string
          p_referral_type_id: string
          p_subject: string
          p_target_commission_id: string
        }
        Returns: string
      }
      open_reserved_session: { Args: { p_meeting_id: string }; Returns: string }
      patient_access_audit: {
        Args: { p_encounter?: string; p_hospital_id?: string; p_mrn?: string }
        Returns: Json
      }
      patient_index_enabled: { Args: never; Returns: boolean }
      patient_safety_enabled: { Args: never; Returns: boolean }
      patient_xref_count: {
        Args: { p_entity_id: string; p_module: string }
        Returns: number
      }
      post_referral_message: {
        Args: {
          p_body?: string
          p_message_type?: string
          p_referral_id: string
        }
        Returns: {
          body: string
          created_at: string
          id: string
          in_reply_to_message_id: string | null
          message_type: string
          redacted_at: string | null
          redacted_by: string | null
          redacted_reason: string | null
          referral_id: string
          sender_commission_id: string | null
          sender_user_id: string | null
          sequence_number: number
          supersedes_message_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referral_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pqs_inbox: {
        Args: {
          p_cursor_id?: string
          p_cursor_reported_at?: string
          p_limit?: number
          p_reporting_commission_id?: string
          p_status?: string
          p_suspected_harm_level?: string
        }
        Returns: {
          acknowledged_at: string
          case_id: string
          case_number: number
          code: string
          current_owner_commission_id: string
          current_owner_kind: string
          id: string
          reported_at: string
          reporting_commission_id: string
          reporting_commission_name: string
          status: string
          suspected_harm_level: string
          title: string
        }[]
      }
      processless_cases_enabled: { Args: never; Returns: boolean }
      provide_referral_information: {
        Args: { p_body: string; p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_document: {
        Args: {
          p_effective_date?: string
          p_expiry_date?: string
          p_review_due_date?: string
          p_version_id: string
        }
        Returns: {
          approval_due_date: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          obsolete_kind: string | null
          proposed_effective_date: string | null
          review_due_date: string | null
          status: string
          storage_path: string | null
          summary_of_changes_md: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "controlled_document_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_form_version: {
        Args: {
          p_approved_by?: string
          p_effective_date?: string
          p_form_version_id: string
          p_review_cycle_months?: number
          p_review_due_date?: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          behavior_config: Json | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          form_id: string
          id: string
          published_at: string | null
          review_due_date: string | null
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
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "process_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_template_version: {
        Args: { p_template_version_id: string }
        Returns: {
          case_type_id: string | null
          collects_patient: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          published_at: string | null
          status: string
          template_id: string
          title: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "process_template_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rca_writer_can_write: { Args: { p_rca_id: string }; Returns: boolean }
      readiness_evidence: {
        Args: { p_commission: string; p_standard: string }
        Returns: {
          artifact_id: string
          artifact_kind: string
          id: string
          label: string
          linked_at: string
          linked_by_name: string
          note: string
          restricted: boolean
          standard_id: string
          status: string
        }[]
      }
      readiness_report: {
        Args: { p_commission: string; p_framework: string }
        Returns: {
          assessment_status: string
          evidence_atencao: number
          evidence_restrita: number
          evidence_valida: number
          evidence_vencida: number
          level: number
          standard_code: string
          standard_id: string
          standard_title: string
        }[]
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
          assignment_role_id: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          current_response_id: string | null
          default_due_days: number | null
          display_position: number | null
          due_date: string | null
          emits_result: boolean
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          result_computed_at: string | null
          result_id: string | null
          result_override_at: string | null
          result_override_by: string | null
          result_override_id: string | null
          result_override_reason: string | null
          result_ruleset: Json | null
          result_source: string | null
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
      receive_referral: {
        Args: { p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reclassify_attachment: {
        Args: { p_id: string; p_new_label?: string; p_new_tier: string }
        Returns: {
          confidentiality_label: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          document_group_id: string | null
          id: string
          kind: string
          legal_hold: boolean
          mime_type: string | null
          occurred_on: string | null
          owner_id: string
          owner_type: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          scan_status: string
          sensitivity_tier: string
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          supersedes_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_recommendations: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      reconcile_item_options: {
        Args: { p_item_id: string; p_options: Json }
        Returns: undefined
      }
      record_capa_effectiveness: {
        Args: { p_capa_id: string; p_method_md?: string; p_verdict: string }
        Returns: {
          capa_id: string
          created_at: string
          method_md: string | null
          updated_at: string
          verdict: string
          verified_at: string
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "capa_effectiveness"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_capa_measure_result: {
        Args: {
          p_measure_id: string
          p_note?: string
          p_period: string
          p_value?: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          measure_id: string
          note: string | null
          period: string
          value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "capa_measure_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_ethics_finding: {
        Args: {
          p_allegation_id: string
          p_evidence_summary_md?: string
          p_finding: string
          p_rationale_md?: string
        }
        Returns: string
      }
      record_indicator_measurement: {
        Args: {
          p_denominator?: number
          p_indicator: string
          p_note?: string
          p_numerator: number
          p_period_end?: string
          p_period_label: string
          p_period_start?: string
        }
        Returns: {
          denominator: number | null
          entered_at: string
          entered_by: string | null
          id: string
          indicator_id: string
          note: string | null
          numerator: number | null
          period_end: string | null
          period_label: string
          period_start: string | null
          source: string
          status: string
          value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "indicator_measurements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_recusal: {
        Args: {
          p_case_id: string
          p_conflict_declaration_id?: string
          p_reason_md: string
          p_user_id: string
        }
        Returns: string
      }
      record_referral_message_receipt: {
        Args: { p_event: string; p_message_id: string }
        Returns: {
          acknowledged_at: string | null
          delivered_at: string | null
          message_id: string
          read_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_read_receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_session_attendance: {
        Args: {
          p_attendance_status?: string
          p_participant_id: string
          p_role_at_session?: string
          p_session_id: string
        }
        Returns: string
      }
      redact_professional_profile: {
        Args: { p_profile_id: string; p_reason: string }
        Returns: undefined
      }
      redact_referral_message: {
        Args: { p_message_id: string; p_reason: string }
        Returns: {
          body: string
          created_at: string
          id: string
          in_reply_to_message_id: string | null
          message_type: string
          redacted_at: string | null
          redacted_by: string | null
          redacted_reason: string | null
          referral_id: string
          sender_commission_id: string | null
          sender_user_id: string | null
          sequence_number: number
          supersedes_message_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referral_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redact_referral_note: {
        Args: { p_note_id: string; p_reason: string }
        Returns: {
          author_user_id: string | null
          body: string
          committee_id: string
          created_at: string
          id: string
          redacted_at: string | null
          redacted_by: string | null
          redacted_reason: string | null
          referral_id: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_internal_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reference_candidates: {
        Args: { p_item_id: string; p_query?: string; p_response_id: string }
        Returns: {
          label: string
          sublabel: string
          target_id: string
        }[]
      }
      referrals_enabled: { Args: never; Returns: boolean }
      reject_correction: {
        Args: { p_reason: string; p_request_id: string }
        Returns: undefined
      }
      reject_document: {
        Args: { p_note?: string; p_version_id: string }
        Returns: {
          approver_id: string
          approver_title: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          document_version_id: string
          id: string
          note: string | null
          signature_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_approvals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remind_document_approver: {
        Args: { p_approver_id: string; p_version_id: string }
        Returns: boolean
      }
      remove_capa_action: { Args: { p_action_id: string }; Returns: undefined }
      remove_capa_action_task: {
        Args: { p_task_id: string }
        Returns: undefined
      }
      remove_capa_measure: {
        Args: { p_measure_id: string }
        Returns: undefined
      }
      remove_case_participant: {
        Args: { p_case_participant_id: string }
        Returns: undefined
      }
      remove_group_instance: {
        Args: { p_instance_id: string; p_response_id: string }
        Returns: undefined
      }
      remove_interview_interviewer: {
        Args: { p_interviewer_id: string }
        Returns: undefined
      }
      remove_interview_subject: {
        Args: { p_subject_id: string }
        Returns: undefined
      }
      remove_meeting_attendee: {
        Args: { p_attendee_id: string }
        Returns: undefined
      }
      remove_pqs_member: {
        Args: { p_hospital_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_rca_factor: { Args: { p_factor_id: string }; Returns: undefined }
      remove_rca_member: { Args: { p_member_id: string }; Returns: undefined }
      remove_rca_root_cause: {
        Args: { p_root_cause_id: string }
        Returns: undefined
      }
      remove_rca_timeline_entry: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      remove_referral_shared_item: {
        Args: { p_shared_item_id: string }
        Returns: undefined
      }
      remove_template_narrative: {
        Args: { p_narrative_id: string }
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
      rename_meeting_type: {
        Args: { p_color_token: string; p_name: string; p_type_id: string }
        Returns: {
          archived: boolean
          color_token: string
          commission_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commission_meeting_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rename_member_title: {
        Args: { p_name: string; p_title_id: string }
        Returns: {
          commission_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commission_member_titles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_capa_plan: {
        Args: { p_capa_id: string }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          lessons_learned_md: string | null
          opened_by: string | null
          source: string
          source_audit_finding_id: string | null
          source_event_id: string | null
          source_indicator_id: string | null
          source_meeting_id: string | null
          source_rca_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_case: {
        Args: { p_case_id: string; p_reason: string }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_interview: {
        Args: { p_interview_id: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_interviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_meeting: {
        Args: { p_meeting_id: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_rca: {
        Args: { p_rca_id: string }
        Returns: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detected: string | null
          due_date: string | null
          event_id: string
          expected_md: string | null
          id: string
          impact: string | null
          scope: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          summary_md: string | null
          updated_at: string
          what_md: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rca"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_referral: {
        Args: { p_reason: string; p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_triage: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          disposition_notes_md: string | null
          event_id: string
          harm_severity: string | null
          is_pse: boolean | null
          natural_course: boolean | null
          pse_closure_reason: string | null
          reach: string | null
          review_pathway: string | null
          sentinel_determination: boolean
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_triage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reorder_case_layout_template: {
        Args: { p_ordered: Json; p_template_version_id: string }
        Returns: undefined
      }
      reorder_case_narrative_types: {
        Args: { p_commission_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_case_outcomes: {
        Args: { p_commission_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_departments: {
        Args: { p_hospital_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_event_types: {
        Args: { p_hospital_id?: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_group_instances: {
        Args: {
          p_group_item_id: string
          p_instance_ids: string[]
          p_response_id: string
        }
        Returns: undefined
      }
      reorder_item: {
        Args: { p_direction: string; p_item_id: string }
        Returns: undefined
      }
      reorder_meeting_agenda_item: {
        Args: { p_agenda_item_id: string; p_direction: string }
        Returns: undefined
      }
      reorder_member_titles: {
        Args: { p_commission_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_phase_results: {
        Args: { p_commission_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_rca_timeline: {
        Args: { p_ordered_ids: string[]; p_rca_id: string }
        Returns: undefined
      }
      reorder_section: {
        Args: { p_direction: string; p_section_id: string }
        Returns: undefined
      }
      reorder_sentinel_criteria: {
        Args: { p_hospital_id?: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_template_phase: {
        Args: { p_direction: string; p_phase_id: string }
        Returns: undefined
      }
      request_referral_information: {
        Args: { p_body: string; p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_referral: {
        Args: {
          p_follow_up?: boolean
          p_referral_id: string
          p_summary_md?: string
        }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resubmit_correction: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      review_correction: { Args: { p_request_id: string }; Returns: undefined }
      review_ethics_appeal: {
        Args: {
          p_appeal_id: string
          p_outcome?: string
          p_outcome_rationale_md?: string
          p_status: string
        }
        Returns: undefined
      }
      revoke_administrativo: {
        Args: { p_commission_id: string; p_user_id: string }
        Returns: undefined
      }
      revoke_case_access: {
        Args: { p_case: string; p_user: string }
        Returns: undefined
      }
      revoke_hospital_admin: {
        Args: { p_hospital: string; p_user: string }
        Returns: undefined
      }
      revoke_member_capability: {
        Args: {
          p_capability: string
          p_commission_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      revoke_nsp_coordinator: {
        Args: { p_hospital: string; p_user: string }
        Returns: undefined
      }
      revoke_nsp_org_admin: {
        Args: { p_org: string; p_user: string }
        Returns: undefined
      }
      revoke_org_admin: {
        Args: { p_org: string; p_user: string }
        Returns: undefined
      }
      revoke_role: {
        Args: {
          p_role: string
          p_scope_id: string
          p_scope_type: string
          p_user: string
        }
        Returns: undefined
      }
      revoke_role_for: {
        Args: {
          p_actor: string
          p_role: string
          p_scope_id: string
          p_scope_type: string
          p_user: string
        }
        Returns: undefined
      }
      save_block_to_library: {
        Args: { p_description?: string; p_item_id: string; p_name: string }
        Returns: {
          commission_id: string
          description: string | null
          id: string
          name: string
          saved_at: string
          saved_by_id: string
          saved_by_name: string
          snapshot: Json
          source_form_title: string
          source_version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "form_block_library"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_correction_draft_body: {
        Args: { p_body_md: string; p_request_id: string }
        Returns: undefined
      }
      save_narrative_body: {
        Args: { p_body_md: string; p_narrative: string }
        Returns: undefined
      }
      save_referral_patient: {
        Args: {
          p_age_years?: number
          p_attending?: string
          p_date_of_birth?: string
          p_encounter_ref?: string
          p_mrn?: string
          p_name?: string
          p_referral_id: string
          p_sex?: string
          p_unit?: string
        }
        Returns: undefined
      }
      save_section_answers: {
        Args: {
          p_answers?: Json
          p_clear_item_ids?: string[]
          p_instance_answers?: Json
          p_matrix_cells?: Json
          p_observations?: Json
          p_other_text?: Json
          p_references?: Json
          p_response_id: string
          p_risk_matrix?: Json
          p_section_id: string
          p_selections?: Json
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
          supersedes_id: string | null
          target_case_participant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_triage: {
        Args: {
          p_disposition_notes_md?: string
          p_event_id: string
          p_harm_severity?: string
          p_is_pse?: boolean
          p_natural_course?: boolean
          p_pse_closure_reason?: string
          p_reach?: string
          p_review_pathway?: string
          p_sentinel_criteria_ids?: string[]
        }
        Returns: {
          created_at: string
          disposition_notes_md: string | null
          event_id: string
          harm_severity: string | null
          is_pse: boolean | null
          natural_course: boolean | null
          pse_closure_reason: string | null
          reach: string | null
          review_pathway: string | null
          sentinel_determination: boolean
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_triage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_ethics_hearing: {
        Args: {
          p_case_id: string
          p_hearing_type: string
          p_meeting_id?: string
          p_scheduled_at?: string
        }
        Returns: string
      }
      schedule_session: {
        Args: {
          p_interview_id: string
          p_location_text?: string
          p_meeting_url?: string
          p_modality?: string
          p_scheduled_end?: string
          p_scheduled_start?: string
          p_session_type?: string
        }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "interview_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_patient_xref: {
        Args: { p_encounter?: string; p_hospital_id?: string; p_mrn?: string }
        Returns: Json
      }
      seed_expected_meeting_attendees: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
      seed_selected_meeting_attendees: {
        Args: { p_meeting_id: string; p_user_ids: string[] }
        Returns: undefined
      }
      send_referral: {
        Args: { p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      session_context: { Args: never; Returns: Json }
      set_capa_action_task_done: {
        Args: { p_is_done: boolean; p_task_id: string }
        Returns: {
          action_id: string
          created_at: string
          description: string
          id: string
          is_done: boolean
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action_task"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_case_confidentiality: {
        Args: { p_case_id: string; p_level: string }
        Returns: undefined
      }
      set_case_offered_outcomes: {
        Args: { p_case_id: string; p_outcome_ids: string[] }
        Returns: undefined
      }
      set_case_outcome: {
        Args: { p_case_id: string; p_outcome_id?: string }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_case_participant_role: {
        Args: { p_case_participant_id: string; p_role_id: string }
        Returns: undefined
      }
      set_case_patient: {
        Args: {
          p_age_years?: number
          p_attending?: string
          p_case_id: string
          p_date_of_birth?: string
          p_encounter_ref?: string
          p_mrn?: string
          p_name?: string
          p_sex?: string
          p_unit?: string
        }
        Returns: undefined
      }
      set_case_phase_assignment_role: {
        Args: { p_phase_id: string; p_role_id?: string }
        Returns: undefined
      }
      set_case_phase_result_override: {
        Args: {
          p_case_phase_id: string
          p_reason?: string
          p_result_id: string
        }
        Returns: undefined
      }
      set_case_visibility: {
        Args: { p_case_id: string; p_policy: string }
        Returns: undefined
      }
      set_document_version_file: {
        Args: {
          p_expiry_date?: string
          p_storage_path: string
          p_summary_of_changes_md?: string
          p_version_id: string
        }
        Returns: {
          approval_due_date: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          obsolete_kind: string | null
          proposed_effective_date: string | null
          review_due_date: string | null
          status: string
          storage_path: string | null
          summary_of_changes_md: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "controlled_document_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_ethics_decision_details: {
        Args: {
          p_appeal_allowed?: boolean
          p_appeal_deadline?: string
          p_decision_id: string
          p_external_reporting_deadline?: string
          p_external_reporting_required?: boolean
          p_external_reporting_target?: string
          p_remediation_description_md?: string
          p_remediation_required?: boolean
          p_sanction_end_date?: string
          p_sanction_start_date?: string
          p_sanction_type_id?: string
        }
        Returns: undefined
      }
      set_event_patient: {
        Args: {
          p_age_years?: number
          p_attending?: string
          p_date_of_birth?: string
          p_encounter_ref?: string
          p_event_id: string
          p_mrn?: string
          p_name?: string
          p_sex?: string
          p_unit?: string
        }
        Returns: undefined
      }
      set_framework_status: {
        Args: { p_framework: string; p_status: string }
        Returns: undefined
      }
      set_indicator_target: {
        Args: {
          p_id: string
          p_lower_warn?: number
          p_target_comparator: string
          p_target_value: number
          p_upper_warn?: number
        }
        Returns: {
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          data_source: string
          denominator_label: string | null
          derived_config: Json | null
          description_md: string | null
          direction: string
          frequency: string
          id: string
          kind: string
          lower_warn: number | null
          name: string
          numerator_label: string | null
          status: string
          target_comparator: string
          target_value: number | null
          unit: string | null
          updated_at: string
          upper_warn: number | null
        }
        SetofOptions: {
          from: "*"
          to: "indicators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_interview_confidentiality: {
        Args: { p_interview_id: string; p_level: string }
        Returns: undefined
      }
      set_interview_interviewer_participant: {
        Args: { p_interviewer_id: string; p_participant_id: string }
        Returns: undefined
      }
      set_interview_participant: {
        Args: { p_interview_id: string; p_participant_id: string }
        Returns: undefined
      }
      set_interview_subject_participant: {
        Args: { p_participant_id: string; p_subject_id: string }
        Returns: undefined
      }
      set_item_validations: {
        Args: { p_item_id: string; p_rules: Json }
        Returns: undefined
      }
      set_meeting_held_window: {
        Args: { p_held_at: string; p_held_end?: string; p_meeting_id: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_meeting_quorum_met: {
        Args: { p_meeting_id: string; p_quorum_met: boolean }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_notification_preferences: {
        Args: { p_enabled: boolean; p_surface: string }
        Returns: undefined
      }
      set_participant_patient: {
        Args: {
          p_age_years?: number
          p_attending?: string
          p_case_id: string
          p_date_of_birth?: string
          p_encounter_ref?: string
          p_mrn?: string
          p_name?: string
          p_participant_id?: string
          p_role_id?: string
          p_sex?: string
          p_unit?: string
        }
        Returns: string
      }
      set_pqs_rca_due_window: {
        Args: { p_days: number; p_hospital_id: string }
        Returns: number
      }
      set_primary_subject: {
        Args: { p_case_participant_id: string }
        Returns: undefined
      }
      set_process_outcomes: {
        Args: { p_outcome_ids: string[]; p_template_version_id: string }
        Returns: undefined
      }
      set_professional_link_state: {
        Args: { p_link_state: string; p_profile_id: string; p_user_id?: string }
        Returns: undefined
      }
      set_rca_factor_key: {
        Args: { p_factor_id: string; p_is_key: boolean }
        Returns: {
          category: string
          created_at: string
          id: string
          is_key: boolean
          position: number
          rca_id: string
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_factors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_rca_why_root: {
        Args: { p_factor_id: string; p_root_text: string }
        Returns: {
          created_at: string
          factor_id: string
          id: string
          rca_id: string
          root_text: string | null
          steps: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_why_chains"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_rca_why_step: {
        Args: { p_factor_id: string; p_index: number; p_text: string }
        Returns: {
          created_at: string
          factor_id: string
          id: string
          rca_id: string
          root_text: string | null
          steps: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_why_chains"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_referral_deadline: {
        Args: { p_referral_id: string; p_response_due_at?: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_referral_patient: {
        Args: {
          p_age_years?: number
          p_attending?: string
          p_date_of_birth?: string
          p_encounter_ref?: string
          p_mrn?: string
          p_name?: string
          p_referral_id: string
          p_sex?: string
          p_unit?: string
        }
        Returns: undefined
      }
      set_standard_assessment: {
        Args: {
          p_commission: string
          p_note_md?: string
          p_standard: string
          p_status: string
        }
        Returns: {
          assessed_at: string
          assessed_by: string | null
          commission_id: string
          id: string
          note_md: string | null
          standard_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "standard_assessments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_standard_ownership: {
        Args: { p_commission?: string; p_hospital: string; p_standard: string }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          hospital_id: string
          id: string
          responsible_commission_id: string
          standard_id: string
        }
        SetofOptions: {
          from: "*"
          to: "standard_ownerships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_template_case_type: {
        Args: { p_case_type_id?: string; p_template_version_id: string }
        Returns: undefined
      }
      set_template_collects_patient: {
        Args: { p_collects: boolean; p_template_version_id: string }
        Returns: undefined
      }
      set_template_phase_blocks: {
        Args: { p_blocks: number[]; p_phase_id: string }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          display_position: number | null
          emits_result: boolean
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          result_ruleset: Json | null
          template_version_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_meeting: {
        Args: { p_attendee_id: string; p_method?: string; p_note?: string }
        Returns: {
          attendee_id: string
          content_hash: string | null
          created_at: string
          id: string
          ip_address: unknown
          meeting_id: string
          method: string
          note: string | null
          provider_payload: Json | null
          provider_ref: string | null
          signed_at: string
          signer_id: string
          status: string
          user_agent: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meeting_signatures"
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
          assignment_role_id: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          current_response_id: string | null
          default_due_days: number | null
          display_position: number | null
          due_date: string | null
          emits_result: boolean
          form_id: string
          form_version_id: string
          id: string
          is_ad_hoc: boolean
          position: number
          recommend_when: Json | null
          recommended: boolean
          result_computed_at: string | null
          result_id: string | null
          result_override_at: string | null
          result_override_by: string | null
          result_override_id: string | null
          result_override_reason: string | null
          result_ruleset: Json | null
          result_source: string | null
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
      soft_delete_attachment: { Args: { p_id: string }; Returns: undefined }
      start_correction_draft: {
        Args: { p_request_id: string }
        Returns: string
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
          supersedes_id: string | null
          target_case_participant_id: string | null
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
          supersedes_id: string | null
          target_case_participant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_referral_review: {
        Args: { p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_session: {
        Args: { p_session_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "interview_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_document_for_approval: {
        Args: {
          p_approval_due_date?: string
          p_approvers: Json
          p_proposed_effective_date?: string
          p_version_id: string
        }
        Returns: {
          approval_due_date: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          obsolete_kind: string | null
          proposed_effective_date: string | null
          review_due_date: string | null
          status: string
          storage_path: string | null
          summary_of_changes_md: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "controlled_document_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_ethics_appeal: {
        Args: {
          p_appeal_reason_md: string
          p_case_id: string
          p_decision_id: string
          p_submitted_by_participant_id?: string
        }
        Returns: string
      }
      submit_rca_for_review: {
        Args: { p_rca_id: string }
        Returns: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detected: string | null
          due_date: string | null
          event_id: string
          expected_md: string | null
          id: string
          impact: string | null
          scope: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          summary_md: string | null
          updated_at: string
          what_md: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rca"
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
          supersedes_id: string | null
          target_case_participant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_targeted_case_response: {
        Args: { p_response_id: string }
        Returns: undefined
      }
      suggest_carry_forward: { Args: { p_commission: string }; Returns: Json }
      supersede_document: {
        Args: { p_document_id: string }
        Returns: {
          approval_due_date: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          obsolete_kind: string | null
          proposed_effective_date: string | null
          review_due_date: string | null
          status: string
          storage_path: string | null
          summary_of_changes_md: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "controlled_document_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      supersede_response: {
        Args: { p_reason: string; p_response_id: string }
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
          supersedes_id: string | null
          target_case_participant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      target_case_response: {
        Args: { p_case_participant_id: string; p_response_id: string }
        Returns: undefined
      }
      toggle_committee_action_item_checklist: {
        Args: { p_id: string; p_is_done: boolean }
        Returns: {
          action_item_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_done: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "action_item_checklists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_event_custody: {
        Args: {
          p_event_id: string
          p_note?: string
          p_to_commission_id?: string
          p_to_owner_kind: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          current_owner_commission_id: string | null
          current_owner_kind: string
          description_md: string | null
          discovered_at: string | null
          event_type_id: string | null
          has_patient: boolean
          id: string
          location: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          reported_at: string
          reported_by: string | null
          reporting_commission_id: string
          status: string
          suspected_harm_level: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_safety_event"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      triage_disposition: {
        Args: { p_event_id: string }
        Returns: {
          event_id: string
          is_pse: boolean
          is_sentinel: boolean
          rca_due_date: string
          reached: boolean
          review_pathway: string
          severe: boolean
          verdict: string
        }[]
      }
      unassign_case_tag: {
        Args: { p_case_id: string; p_tag_id: string }
        Returns: undefined
      }
      unassign_narrative: { Args: { p_narrative: string }; Returns: undefined }
      unlink_evidence: { Args: { p_link: string }; Returns: undefined }
      unlink_meeting_case: {
        Args: { p_case_link_id: string }
        Returns: undefined
      }
      unlink_referral_case: { Args: { p_link_id: string }; Returns: undefined }
      update_affiliation: {
        Args: {
          p_clear_employee_id?: boolean
          p_employee_id?: string
          p_hospital: string
          p_started_on?: string
          p_user: string
        }
        Returns: string
      }
      update_affiliation_for: {
        Args: {
          p_actor: string
          p_clear_employee_id?: boolean
          p_employee_id?: string
          p_hospital: string
          p_started_on?: string
          p_user: string
        }
        Returns: string
      }
      update_block_library_entry: {
        Args: {
          p_description?: string
          p_library_entry_id: string
          p_name: string
        }
        Returns: {
          commission_id: string
          description: string | null
          id: string
          name: string
          saved_at: string
          saved_by_id: string
          saved_by_name: string
          snapshot: Json
          source_form_title: string
          source_version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "form_block_library"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_capa_action: {
        Args: {
          p_action_id: string
          p_action_strength?: string
          p_assignee_user_id?: string
          p_due_date?: string
          p_owner?: string
          p_root_cause_id?: string
          p_success_measure?: string
          p_title: string
        }
        Returns: {
          action_strength: string
          assignee_user_id: string | null
          capa_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          owner: string | null
          position: number
          root_cause_id: string | null
          status: string
          success_measure: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_action"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_capa_measure: {
        Args: {
          p_definition?: string
          p_measure_id: string
          p_name: string
          p_target?: string
        }
        Returns: {
          capa_id: string
          created_at: string
          definition: string | null
          id: string
          indicator_id: string | null
          name: string
          position: number
          target: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_measure"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_capa_plan: {
        Args: { p_capa_id: string; p_classification: string }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          lessons_learned_md: string | null
          opened_by: string | null
          source: string
          source_audit_finding_id: string | null
          source_event_id: string | null
          source_indicator_id: string | null
          source_meeting_id: string | null
          source_rca_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "capa_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_case_custom_field_values: {
        Args: { p_case_id: string; p_values: Json }
        Returns: undefined
      }
      update_case_meta: {
        Args: {
          p_case_id: string
          p_department_id?: string
          p_department_other?: string
          p_label?: string
        }
        Returns: {
          case_number: number
          case_type_id: string | null
          closed_at: string | null
          closed_by: string | null
          commission_id: string
          confidentiality_level: string
          created_at: string
          created_by: string | null
          department_id: string | null
          department_other: string | null
          has_patient: boolean
          id: string
          label: string | null
          organization_id: string
          outcome_id: string | null
          patient_enabled: boolean
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_case_narrative_body: {
        Args: { p_body_md: string; p_narrative_id: string }
        Returns: {
          assigned_to: string | null
          body_md: string | null
          case_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          display_position: number
          id: string
          instructions: string | null
          is_ad_hoc: boolean
          is_expected: boolean
          narrative_type_id: string | null
          status: string
          title: string | null
          type_label: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_narratives"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_case_narrative_type: {
        Args: {
          p_description: string
          p_label: string
          p_narrative_type_id: string
        }
        Returns: {
          archived: boolean
          commission_id: string
          created_at: string
          description: string | null
          id: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_narrative_types"
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
      update_committee_action_item: {
        Args: {
          p_assigned_to?: string
          p_description?: string
          p_due_date?: string
          p_id: string
          p_title: string
          p_urgency_id?: string
          p_visibility_scope?: string
        }
        Returns: {
          assigned_to: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_case_id: string | null
          source_agenda_item_id: string | null
          source_case_id: string | null
          source_case_phase_id: string | null
          source_meeting_id: string | null
          source_type: string
          status_id: string
          title: string
          updated_at: string
          urgency_id: string | null
          visibility_scope: string
        }
        SetofOptions: {
          from: "*"
          to: "action_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_committee_action_item_checklist: {
        Args: { p_id: string; p_sort_order?: number; p_title: string }
        Returns: {
          action_item_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_done: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "action_item_checklists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_committee_action_item_reminder: {
        Args: { p_id: string; p_is_active: boolean }
        Returns: {
          action_item_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          offset_days: number | null
          reminder_type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "action_item_reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_controlled_document: {
        Args: {
          p_category?: string
          p_description?: string
          p_doc_type: string
          p_id: string
          p_review_cycle_months?: number
          p_tags?: string[]
          p_title: string
        }
        Returns: {
          category: string | null
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          doc_type: string
          id: string
          review_cycle_months: number | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "controlled_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_ethics_allegation: {
        Args: {
          p_allegation_id: string
          p_alleged_event_date?: string
          p_category_id?: string
          p_description_md?: string
          p_severity?: string
          p_status?: string
        }
        Returns: undefined
      }
      update_event: {
        Args: {
          p_description_md?: string
          p_discovered_at?: string
          p_event_id: string
          p_event_type_id?: string
          p_location?: string
          p_suspected_harm_level?: string
          p_title: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string | null
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          current_owner_commission_id: string | null
          current_owner_kind: string
          description_md: string | null
          discovered_at: string | null
          event_type_id: string | null
          has_patient: boolean
          id: string
          location: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          reported_at: string
          reported_by: string | null
          reporting_commission_id: string
          status: string
          suspected_harm_level: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_safety_event"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_event_type: {
        Args: { p_description?: string; p_id: string; p_label: string }
        Returns: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_event_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_framework: {
        Args: {
          p_description?: string
          p_framework: string
          p_name?: string
          p_version?: string
        }
        Returns: {
          cloned_from_framework_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          owner_commission_id: string | null
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "accreditation_frameworks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_indicator: {
        Args: {
          p_data_source: string
          p_denominator_label?: string
          p_derived_config?: Json
          p_description_md?: string
          p_direction: string
          p_frequency: string
          p_id: string
          p_kind: string
          p_lower_warn?: number
          p_name: string
          p_numerator_label?: string
          p_target_comparator: string
          p_target_value?: number
          p_unit?: string
          p_upper_warn?: number
        }
        Returns: {
          code: string
          commission_id: string
          created_at: string
          created_by: string | null
          data_source: string
          denominator_label: string | null
          derived_config: Json | null
          description_md: string | null
          direction: string
          frequency: string
          id: string
          kind: string
          lower_warn: number | null
          name: string
          numerator_label: string | null
          status: string
          target_comparator: string
          target_value: number | null
          unit: string | null
          updated_at: string
          upper_warn: number | null
        }
        SetofOptions: {
          from: "*"
          to: "indicators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_interview: {
        Args: {
          p_case_phase_id?: string
          p_confidentiality_level?: string
          p_interview_category?: string
          p_interview_id: string
          p_title?: string
        }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_interviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_interview_interviewer: {
        Args: {
          p_external_name?: string
          p_external_org?: string
          p_interviewer_id: string
          p_note?: string
          p_role: string
        }
        Returns: {
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          interview_id: string
          note: string | null
          participant_id: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_interview_interviewers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_interview_subject: {
        Args: {
          p_clinical_role?: string
          p_external_name?: string
          p_external_org?: string
          p_note?: string
          p_relationship_to_case?: string
          p_subject_id: string
        }
        Returns: {
          clinical_role: string | null
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          interview_id: string
          note: string | null
          participant_id: string | null
          relationship_to_case: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_interview_subjects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_interview_summary: {
        Args: { p_interview_id: string; p_summary_md: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          confidentiality_level: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_category: string
          interview_number: number
          participant_id: string | null
          registry_event_id: string | null
          status: string
          summary_md: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "case_interviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_meeting: {
        Args: {
          p_location_text?: string
          p_meeting_id: string
          p_meeting_type_id?: string
          p_meeting_url?: string
          p_minutes_md?: string
          p_modality: string
          p_scheduled_end?: string
          p_scheduled_start: string
          p_title: string
        }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_meeting_agenda_item: {
        Args: {
          p_agenda_item_id: string
          p_description?: string
          p_discussion_notes?: string
          p_resolution?: string
          p_title: string
        }
        Returns: string
      }
      update_meeting_attendee: {
        Args: {
          p_attendance: string
          p_attendee_id: string
          p_external_name?: string
          p_external_org?: string
          p_note?: string
          p_role: string
        }
        Returns: {
          attendance: string
          created_at: string
          external_name: string | null
          external_org: string | null
          id: string
          meeting_id: string
          note: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meeting_attendees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_meeting_minutes: {
        Args: { p_meeting_id: string; p_minutes_md: string }
        Returns: {
          cancelled_at: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          distributed_at: string | null
          eligible_member_count: number | null
          held_at: string | null
          held_end: string | null
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
          visibility_policy: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_meeting_settings: {
        Args: {
          p_commission_id: string
          p_quorum_rule_type: string
          p_quorum_value?: number
        }
        Returns: {
          commission_id: string
          quorum_rule_type: string
          quorum_value: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commission_meeting_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_phase_result: {
        Args: {
          p_color_token: string
          p_is_adverse: boolean
          p_label: string
          p_result_id: string
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
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "phase_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_professional_profile: {
        Args: {
          p_affiliation_status?: string
          p_full_name?: string
          p_license_number?: string
          p_license_region?: string
          p_professional_type?: string
          p_profile_id: string
          p_specialty?: string
        }
        Returns: undefined
      }
      update_rca: {
        Args: {
          p_detected?: string
          p_expected_md?: string
          p_impact?: string
          p_rca_id: string
          p_scope?: string
          p_summary_md?: string
          p_what_md?: string
        }
        Returns: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detected: string | null
          due_date: string | null
          event_id: string
          expected_md: string | null
          id: string
          impact: string | null
          scope: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          summary_md: string | null
          updated_at: string
          what_md: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rca"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_rca_factor: {
        Args: { p_factor_id: string; p_text: string }
        Returns: {
          category: string
          created_at: string
          id: string
          is_key: boolean
          position: number
          rca_id: string
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_factors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_rca_member_role: {
        Args: { p_member_id: string; p_role: string }
        Returns: {
          created_at: string
          external_name: string | null
          id: string
          rca_id: string
          role: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rca_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_rca_root_cause: {
        Args: {
          p_category?: string
          p_classification?: string
          p_root_cause_id: string
          p_text: string
          p_type?: string
        }
        Returns: {
          category: string | null
          classification: string
          created_at: string
          id: string
          position: number
          rca_id: string
          text: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_root_causes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_rca_timeline_entry: {
        Args: {
          p_description: string
          p_entry_id: string
          p_occurred_at: string
        }
        Returns: {
          created_at: string
          description: string
          id: string
          occurred_at: string
          position: number
          rca_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rca_timeline_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_referral_assignment: {
        Args: {
          p_assignment_id: string
          p_assignment_role?: string
          p_due_at?: string
          p_status?: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          assignee_user_id: string
          assignment_role: string
          cancelled_at: string | null
          commission_id: string
          completed_at: string | null
          due_at: string | null
          id: string
          referral_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_referral_draft: {
        Args: {
          p_description_md?: string
          p_priority?: string
          p_referral_id: string
          p_referral_type_id: string
          p_requested_action_id?: string
          p_response_due_at?: string
          p_response_expected?: boolean
          p_subject: string
        }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_referral_requested_action: {
        Args: {
          p_color_token?: string
          p_description?: string
          p_id: string
          p_is_active?: boolean
          p_label: string
          p_position?: number
        }
        Returns: {
          color_token: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_requested_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_sentinel_criterion: {
        Args: { p_description?: string; p_id: string; p_label: string }
        Returns: {
          created_at: string
          description: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_sentinel_criteria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_session: {
        Args: {
          p_location_text?: string
          p_meeting_url?: string
          p_modality?: string
          p_scheduled_end?: string
          p_scheduled_start?: string
          p_session_id: string
          p_session_type?: string
        }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          location_text: string | null
          meeting_url: string | null
          modality: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          sequence_number: number
          session_type: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "interview_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_template_narrative: {
        Args: {
          p_clear_instructions?: boolean
          p_clear_title?: boolean
          p_instructions?: string
          p_is_expected?: boolean
          p_narrative_id: string
          p_title?: string
        }
        Returns: {
          created_at: string
          display_position: number
          id: string
          instructions: string | null
          is_expected: boolean
          narrative_type_id: string
          template_version_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_narratives"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_template_phase: {
        Args: {
          p_allowed_result_ids?: Json
          p_blocks?: number[]
          p_clear_allowed_result_ids?: boolean
          p_clear_blocks?: boolean
          p_clear_default_due_days?: boolean
          p_clear_recommend_when?: boolean
          p_clear_result_ruleset?: boolean
          p_default_due_days?: number
          p_emits_result?: boolean
          p_form_id?: string
          p_phase_id: string
          p_recommend_when?: Json
          p_result_ruleset?: Json
          p_title?: string
        }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          display_position: number | null
          emits_result: boolean
          form_id: string
          id: string
          position: number
          recommend_when: Json | null
          result_ruleset: Json | null
          template_version_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "process_template_phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_commission_charter: {
        Args: {
          p_commission: string
          p_controlled_document_id?: string
          p_meeting_frequency: string
        }
        Returns: Json
      }
      upsert_ethics_case_details: {
        Args: {
          p_case_id: string
          p_complaint_channel?: string
          p_complaint_received_at?: string
          p_summary_md?: string
        }
        Returns: {
          admissibility_decided_at: string | null
          admissibility_decided_by: string | null
          admissibility_rationale_md: string | null
          admissibility_status: string
          case_id: string
          complaint_channel: string | null
          complaint_received_at: string | null
          created_at: string
          summary_md: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ethics_case_details"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_matrix_axes: {
        Args: { p_columns: Json; p_item_id: string; p_rows: Json }
        Returns: undefined
      }
      upsert_standard: {
        Args: {
          p_code: string
          p_description_md?: string
          p_framework: string
          p_id?: string
          p_level?: number
          p_parent?: string
          p_position?: number
          p_title: string
        }
        Returns: {
          code: string
          created_at: string
          description_md: string | null
          framework_id: string
          id: string
          level: number | null
          parent_id: string | null
          position: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "accreditation_standards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_visible_when: {
        Args: { p_form_version_id: string }
        Returns: boolean
      }
      verify_audit_chain: {
        Args: {
          p_commission?: string
          p_hospital?: string
          p_organization?: string
        }
        Returns: {
          broken_seq: number
          ok: boolean
        }[]
      }
      void_decision: {
        Args: { p_decision_id: string; p_reason: string }
        Returns: undefined
      }
      withdraw_correction: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      withdraw_referral: {
        Args: { p_referral_id: string }
        Returns: {
          code: string
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decline_note: string | null
          decline_reason_code: string | null
          description_md: string | null
          has_patient: boolean
          id: string
          last_message_at: string | null
          parent_referral_id: string | null
          phi_disposed_at: string | null
          phi_disposed_by: string | null
          phi_disposed_reason: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          referral_type_id: string | null
          requested_action_id: string | null
          requested_action_label: string | null
          response_due_at: string | null
          response_expected: boolean
          sent_at: string | null
          sent_by: string | null
          source_case_id: string
          source_commission_id: string
          source_commission_name: string | null
          status: string
          subject: string
          target_case_id: string | null
          target_commission_id: string | null
          target_commission_name: string | null
          target_hospital_id: string | null
          target_hospital_name: string | null
          target_type: string
          type_label: string
          updated_at: string
          waiting_on_committee_id: string | null
          waiting_on_hospital_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_referral"
          isOneToOne: true
          isSetofReturn: false
        }
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

