export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ─── Enums ───────────────────────────────────────────────────────────────────

export type ClientType = 'individual' | 'company'
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined'
export type ProjectStatus = 'scheduled' | 'in_progress' | 'completed'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue'
export type ItemType = 'product' | 'service' | 'custom'
export type PricingType = 'per_each' | 'per_job'
export type ImagePhase = 'before' | 'progress' | 'after'
export type ActivityType = 'status_change' | 'task_completed' | 'photo_uploaded' | 'note_added' | 'member_assigned'
export type MemberStatus = 'active' | 'inactive'
export type PaymentMethod = 'eft' | 'cash' | 'card' | 'other'

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  logo_url: string | null
  address: string | null
  city: string | null
  province: string | null
  vat_number: string | null
  vat_rate: number        // default 0.15
  travel_cost_per_km: number   // default 4.50
  travel_free_radius_km: number // default 20
  payment_terms: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  workspace_id: string
  user_id: string | null
  name: string
  role: string
  email: string
  phone: string | null
  status: MemberStatus
  is_field_worker: boolean
  avatar_url: string | null
  created_at: string
}

export interface Client {
  id: string
  workspace_id: string
  type: ClientType
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  province: string | null
  created_at: string
}

export interface Product {
  id: string
  workspace_id: string
  name: string
  subtitle: string | null
  sku: string | null
  category: string | null
  cost_price: number
  markup_pct: number
  selling_price: number
  stock_qty: number
  created_at: string
}

export interface Service {
  id: string
  workspace_id: string
  name: string
  pricing_type: PricingType
  cost_price: number
  markup_pct: number
  selling_price: number
  duration_hours: number | null
  description: string | null
  created_at: string
}

export interface QuoteLineItem {
  id: string
  quote_id: string
  sort_order: number
  item_type: ItemType
  product_id: string | null
  service_id: string | null
  name: string
  description: string | null
  qty: number
  unit_price: number
  discount_pct: number
  line_total: number
}

export interface Quote {
  id: string
  workspace_id: string
  number: string
  client_id: string | null
  instant_client_name: string | null
  instant_client_phone: string | null
  site_address: string | null
  status: QuoteStatus
  notes_client: string | null
  notes_internal: string | null
  discount: number
  valid_days: number
  travel_distance_km: number
  travel_cost_per_km: number
  travel_free_radius_km: number
  travel_cost: number
  subtotal: number
  vat_amount: number
  total: number
  public_token: string
  created_at: string
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  valid_until: string
  // joined
  client?: Client
  line_items?: QuoteLineItem[]
}

export interface ProjectTask {
  id: string
  project_id: string
  sort_order: number
  title: string
  description: string | null
  assignee_id: string | null
  completed: boolean
  completed_at: string | null
  due_date: string | null
  created_at: string
  // joined
  assignee?: TeamMember
}

export interface ProjectImage {
  id: string
  project_id: string
  phase: ImagePhase
  label: string | null
  storage_url: string
  uploaded_by_id: string | null
  uploaded_at: string
}

export interface ProjectActivity {
  id: string
  project_id: string
  type: ActivityType
  description: string
  actor_id: string | null
  created_at: string
  // joined
  actor?: TeamMember
}

export interface Project {
  id: string
  workspace_id: string
  number: string
  name: string
  client_id: string
  quote_id: string | null
  site_address: string | null
  distance_from_office_km: number | null
  status: ProjectStatus
  progress_pct: number
  started_at: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  description: string | null
  created_at: string
  // joined
  client?: Client
  tasks?: ProjectTask[]
  images?: ProjectImage[]
  activity?: ProjectActivity[]
  team?: TeamMember[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  sort_order: number
  item_type: ItemType
  product_id: string | null
  service_id: string | null
  name: string
  description: string | null
  qty: number
  unit_price: number
  discount_pct: number
  line_total: number
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  method: PaymentMethod
  reference: string | null
  paid_at: string
  description: string | null
  created_at: string
}

export interface Invoice {
  id: string
  workspace_id: string
  number: string
  client_id: string
  project_id: string | null
  quote_id: string | null
  status: InvoiceStatus
  invoice_date: string
  sent_at: string | null
  due_date: string
  subtotal: number
  discount: number
  vat_amount: number
  total: number
  amount_paid: number
  balance_due: number
  payment_terms: string | null
  created_at: string
  // joined
  client?: Client
  project?: Project
  line_items?: InvoiceLineItem[]
  payments?: Payment[]
}

export interface CalendarEvent {
  id: string
  workspace_id: string
  title: string
  project_id: string | null
  assignee_id: string | null
  start_date: string
  end_date: string
  notes: string | null
  created_at: string
  // joined
  project?: Pick<Project, 'id' | 'number' | 'name'>
  assignee?: Pick<TeamMember, 'id' | 'name' | 'role'>
}

export interface WhatsAppMessage {
  id: string
  workspace_id: string
  client_id: string | null
  from_number: string
  body: string
  is_voice_note: boolean
  transcription: string | null
  received_at: string
  // joined
  client?: Client
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export interface StatCard {
  label: string
  value: string | number
  sub?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  icon?: React.ElementType
}

export interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}
