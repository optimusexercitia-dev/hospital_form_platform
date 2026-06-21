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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_is_admin: boolean
          commission_id: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
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
          id?: string
          metadata?: Json
          occurred_at?: string
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
          id?: string
          metadata?: Json
          occurred_at?: string
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
      case_access: {
        Row: {
          case_id: string
          granted_at: string
          granted_by: string | null
          level: string
          user_id: string
        }
        Insert: {
          case_id: string
          granted_at?: string
          granted_by?: string | null
          level: string
          user_id: string
        }
        Update: {
          case_id?: string
          granted_at?: string
          granted_by?: string | null
          level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_access_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      case_interview_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          interview_id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          interview_id: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          interview_id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_interview_attachments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_attachments_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "case_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_interview_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
            foreignKeyName: "case_interview_interviewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          conducted_at?: string | null
          created_at?: string
          created_by?: string | null
          form_version_id?: string | null
          id?: string
          interview_number: number
          location_text?: string | null
          meeting_url?: string | null
          modality?: string
          registry_event_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
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
          conducted_at?: string | null
          created_at?: string
          created_by?: string | null
          form_version_id?: string | null
          id?: string
          interview_number?: number
          location_text?: string | null
          meeting_url?: string | null
          modality?: string
          registry_event_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
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
            foreignKeyName: "case_interviews_registry_event_id_fkey"
            columns: ["registry_event_id"]
            isOneToOne: false
            referencedRelation: "case_events"
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
      case_phases: {
        Row: {
          activated_at: string | null
          assigned_to: string | null
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          display_position: number | null
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
          display_position?: number | null
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
          display_position?: number | null
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
          encounter_ref: string | null
          event_id: string
          mrn: string | null
          name: string | null
          sex: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_ref?: string | null
          event_id: string
          mrn?: string | null
          name?: string | null
          sex?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          age_years?: number | null
          attending?: string | null
          created_at?: string
          date_of_birth?: string | null
          encounter_ref?: string | null
          event_id?: string
          mrn?: string | null
          name?: string | null
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
      meeting_action_items: {
        Row: {
          assigned_to: string | null
          case_id: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          source_agenda_item_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_id?: string | null
          commission_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          source_agenda_item_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_id?: string | null
          commission_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          source_agenda_item_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_source_agenda_item_id_fkey"
            columns: ["source_agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
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
      meeting_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kind: string
          meeting_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: string
          meeting_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: string
          meeting_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attachments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attachments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
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
          id?: string
          location_text?: string | null
          meeting_number: number
          meeting_type_id?: string | null
          meeting_url?: string | null
          minutes_md?: string | null
          modality?: string
          present_count?: number | null
          quorum_met?: boolean | null
          quorum_rule_type?: string | null
          quorum_value?: number | null
          scheduled_end?: string | null
          scheduled_start: string
          status?: string
          title: string
          updated_at?: string
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
          id?: string
          location_text?: string | null
          meeting_number?: number
          meeting_type_id?: string | null
          meeting_url?: string | null
          minutes_md?: string | null
          modality?: string
          present_count?: number | null
          quorum_met?: boolean | null
          quorum_rule_type?: string | null
          quorum_value?: number | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: string
          title?: string
          updated_at?: string
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
      pqs_department: {
        Row: {
          created_at: string
          id: string
          name: string
          rca_default_due_days: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          rca_default_due_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rca_default_due_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      pqs_event_types: {
        Row: {
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
          created_at?: string
          description?: string | null
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
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      pqs_members: {
        Row: {
          added_at: string
          added_by: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqs_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqs_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pqs_sentinel_criteria: {
        Row: {
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
          created_at?: string
          description?: string | null
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
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      process_template_narratives: {
        Row: {
          created_at: string
          display_position: number
          id: string
          instructions: string | null
          is_expected: boolean
          narrative_type_id: string
          template_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          display_position: number
          id?: string
          instructions?: string | null
          is_expected?: boolean
          narrative_type_id: string
          template_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          display_position?: number
          id?: string
          instructions?: string | null
          is_expected?: boolean
          narrative_type_id?: string
          template_id?: string
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
            foreignKeyName: "process_template_narratives_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
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
          display_position: number | null
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
          display_position?: number | null
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
          display_position?: number | null
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
            referencedRelation: "case_documents"
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
          display_position: number | null
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
          display_position: number | null
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
      add_interview_attachment: {
        Args: {
          p_external_url?: string
          p_interview_id: string
          p_kind: string
          p_mime_type?: string
          p_size_bytes?: number
          p_storage_path?: string
          p_title: string
        }
        Returns: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          interview_id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_interview_attachments"
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
      add_meeting_attachment: {
        Args: {
          p_kind: string
          p_meeting_id: string
          p_mime_type?: string
          p_size_bytes?: number
          p_storage_path: string
          p_title: string
        }
        Returns: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kind: string
          meeting_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meeting_attachments"
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
        Args: { p_user_id: string }
        Returns: {
          added_at: string
          added_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pqs_members"
          isOneToOne: true
          isSetofReturn: false
        }
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
      add_template_narrative: {
        Args: {
          p_instructions?: string
          p_is_expected?: boolean
          p_narrative_type_id: string
          p_template_id: string
          p_title?: string
        }
        Returns: {
          created_at: string
          display_position: number
          id: string
          instructions: string | null
          is_expected: boolean
          narrative_type_id: string
          template_id: string
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
          display_position: number | null
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
      advance_meeting_action_item: {
        Args: { p_action_item_id: string; p_status: string }
        Returns: {
          assigned_to: string | null
          case_id: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          source_agenda_item_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meeting_action_items"
          isOneToOne: true
          isSetofReturn: false
        }
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
      archive_event_type: {
        Args: { p_id: string }
        Returns: {
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
          to: "pqs_event_types"
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
      archive_sentinel_criterion: {
        Args: { p_id: string }
        Returns: {
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
          to: "pqs_sentinel_criteria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_case_tag: {
        Args: { p_case_id: string; p_tag_id: string }
        Returns: undefined
      }
      assign_narrative: {
        Args: { p_assignee: string; p_narrative: string }
        Returns: undefined
      }
      audit_trail_enabled: { Args: never; Returns: boolean }
      cancel_capa_plan: {
        Args: { p_capa_id: string }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
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
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
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
      case_access_enabled: { Args: never; Returns: boolean }
      case_action_items_kpis: {
        Args: { p_commission_id: string }
        Returns: {
          completed_ytd: number
          open: number
          overdue: number
        }[]
      }
      case_narratives_enabled: { Args: never; Returns: boolean }
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
      clone_form_version: {
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
      complete_meeting_action_item: {
        Args: { p_action_item_id: string }
        Returns: {
          assigned_to: string | null
          case_id: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          source_agenda_item_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meeting_action_items"
          isOneToOne: true
          isSetofReturn: false
        }
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
      conclude_interview: {
        Args: { p_interview_id: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conclude_narrative: { Args: { p_narrative: string }; Returns: undefined }
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
      create_event_type: {
        Args: { p_description?: string; p_key: string; p_label: string }
        Returns: {
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
      create_interview: {
        Args: {
          p_case_id: string
          p_case_phase_id?: string
          p_location_text?: string
          p_meeting_url?: string
          p_modality?: string
          p_scheduled_end?: string
          p_scheduled_start?: string
          p_title?: string
        }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_meeting_action_item: {
        Args: {
          p_assigned_to?: string
          p_case_id?: string
          p_description?: string
          p_due_date?: string
          p_meeting_id: string
          p_source_agenda_item_id?: string
          p_title: string
        }
        Returns: {
          assigned_to: string | null
          case_id: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          source_agenda_item_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meeting_action_items"
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
        }
        SetofOptions: {
          from: "*"
          to: "meeting_agenda_items"
          isOneToOne: true
          isSetofReturn: false
        }
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
      create_sentinel_criterion: {
        Args: { p_description?: string; p_key: string; p_label: string }
        Returns: {
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
      delete_capa_action_evidence: {
        Args: { p_evidence_id: string }
        Returns: undefined
      }
      delete_interview_attachment: {
        Args: { p_attachment_id: string }
        Returns: undefined
      }
      delete_meeting_agenda_item: {
        Args: { p_agenda_item_id: string }
        Returns: undefined
      }
      delete_meeting_attachment: {
        Args: { p_attachment_id: string }
        Returns: undefined
      }
      delete_rca_evidence: {
        Args: { p_evidence_id: string }
        Returns: undefined
      }
      delete_section_moving_items: {
        Args: { p_section_id: string; p_target_section_id: string }
        Returns: undefined
      }
      dispose_event_phi: {
        Args: { p_event_id: string; p_reason: string }
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_case_detail: { Args: { p_case_id: string }; Returns: Json }
      get_event_patient: { Args: { p_event_id: string }; Returns: Json }
      get_response_for_signoff: {
        Args: { p_response_id: string }
        Returns: Json
      }
      grant_case_access: {
        Args: { p_case: string; p_level: string; p_user: string }
        Returns: undefined
      }
      interview_viewer_can_write: {
        Args: { p_interview_id: string }
        Returns: boolean
      }
      interviews_enabled: { Args: never; Returns: boolean }
      link_meeting_case: {
        Args: {
          p_agenda_item_id?: string
          p_case_id: string
          p_decision?: string
          p_meeting_id: string
          p_summary?: string
        }
        Returns: {
          agenda_item_id: string | null
          case_id: string
          created_at: string
          decision: string | null
          id: string
          meeting_id: string
          summary: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meeting_cases"
          isOneToOne: true
          isSetofReturn: false
        }
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
      list_my_cases: { Args: { p_commission: string }; Returns: Json }
      list_pqs_members: { Args: never; Returns: Json }
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
      mark_meeting_held: {
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      open_capa_plan: {
        Args: {
          p_classification?: string
          p_source: string
          p_source_id?: string
        }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
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
      patient_safety_enabled: { Args: never; Returns: boolean }
      pqs_inbox: {
        Args: {
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
      rca_writer_can_write: { Args: { p_rca_id: string }; Returns: boolean }
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
          display_position: number | null
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
      remove_capa_action: { Args: { p_action_id: string }; Returns: undefined }
      remove_capa_action_task: {
        Args: { p_task_id: string }
        Returns: undefined
      }
      remove_capa_measure: {
        Args: { p_measure_id: string }
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
      remove_pqs_member: { Args: { p_user_id: string }; Returns: undefined }
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
      reopen_capa_plan: {
        Args: { p_capa_id: string }
        Returns: {
          classification: string
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
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
      reopen_interview: {
        Args: { p_interview_id: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_narrative: { Args: { p_narrative: string }; Returns: undefined }
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
        Args: { p_ordered: Json; p_template_id: string }
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
      reorder_event_types: {
        Args: { p_ordered_ids: string[] }
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
      reorder_rca_timeline: {
        Args: { p_ordered_ids: string[]; p_rca_id: string }
        Returns: undefined
      }
      reorder_section: {
        Args: { p_direction: string; p_section_id: string }
        Returns: undefined
      }
      reorder_sentinel_criteria: {
        Args: { p_ordered_ids: string[] }
        Returns: undefined
      }
      reorder_template_phase: {
        Args: { p_direction: string; p_phase_id: string }
        Returns: undefined
      }
      revoke_case_access: {
        Args: { p_case: string; p_user: string }
        Returns: undefined
      }
      save_narrative_body: {
        Args: { p_body_md: string; p_narrative: string }
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
      schedule_interview: {
        Args: {
          p_interview_id: string
          p_scheduled_end?: string
          p_scheduled_start: string
        }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
      seed_expected_meeting_attendees: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_pqs_rca_due_window: { Args: { p_days: number }; Returns: number }
      set_process_outcomes: {
        Args: { p_outcome_ids: string[]; p_template_id: string }
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
      set_template_phase_blocks: {
        Args: { p_blocks: number[]; p_phase_id: string }
        Returns: {
          blocks: number[]
          created_at: string
          default_due_days: number | null
          display_position: number | null
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
          blocks: number[]
          case_id: string
          completed_at: string | null
          created_at: string
          default_due_days: number | null
          display_position: number | null
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
      start_interview: {
        Args: { p_interview_id: string }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "responses"
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
      unlink_meeting_case: {
        Args: { p_case_link_id: string }
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
      update_interview: {
        Args: {
          p_case_phase_id?: string
          p_interview_id: string
          p_location_text?: string
          p_meeting_url?: string
          p_modality?: string
          p_scheduled_end?: string
          p_scheduled_start?: string
          p_title?: string
        }
        Returns: {
          cancelled_at: string | null
          case_id: string
          case_phase_id: string | null
          commission_id: string
          concluded_at: string | null
          concluded_by: string | null
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          conducted_at: string | null
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          interview_number: number
          location_text: string | null
          meeting_url: string | null
          modality: string
          registry_event_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_meeting_action_item: {
        Args: {
          p_action_item_id: string
          p_assigned_to?: string
          p_description?: string
          p_due_date?: string
          p_title: string
        }
        Returns: {
          assigned_to: string | null
          case_id: string | null
          commission_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          source_agenda_item_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meeting_action_items"
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
        }
        SetofOptions: {
          from: "*"
          to: "meeting_agenda_items"
          isOneToOne: true
          isSetofReturn: false
        }
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
          id: string
          location_text: string | null
          meeting_number: number
          meeting_type_id: string | null
          meeting_url: string | null
          minutes_md: string | null
          modality: string
          present_count: number | null
          quorum_met: boolean | null
          quorum_rule_type: string | null
          quorum_value: number | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string
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
      update_sentinel_criterion: {
        Args: { p_description?: string; p_id: string; p_label: string }
        Returns: {
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
          to: "pqs_sentinel_criteria"
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
          template_id: string
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
          display_position: number | null
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
      verify_audit_chain: {
        Args: { p_commission?: string }
        Returns: {
          broken_seq: number
          ok: boolean
        }[]
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

