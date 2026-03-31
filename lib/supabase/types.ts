// Supabase-related TypeScript types for the Project Command Center.
// New types are additive and do not modify existing runtime behaviour.

export type UUID = string

export interface Project {
  id: UUID
  name: string
  description: string | null
  owner_id: UUID | null
  start_date: string | null
  end_date: string | null
  status: "planned" | "active" | "delayed" | "completed"
  created_at: string
}

export interface Milestone {
  id: UUID
  stream_id: UUID | null
  project_id: UUID | null
  title: string
  weight_percent: number | null
  status: "planned" | "active" | "completed"
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export interface SprintStream {
  sprint_id: UUID
  stream_id: UUID
}

