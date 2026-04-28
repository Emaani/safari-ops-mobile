// Safari & Marketing type definitions mirroring Jackal Dashboard

// ─── Safari Bookings ──────────────────────────────────────────────────────────

export interface SafariBooking {
  id: string;
  booking_reference: string;
  status: 'draft' | 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  pax_count?: number;
  total_price_usd?: number;
  deposit_amount?: number;
  amount_paid?: number;
  booking_direction?: string;
  profit_margin?: number;
  checklist_sent?: boolean;
  customer_name?: string;
  customer_email?: string;
  vehicle_id?: string;
  guide_id?: string;
  client_id?: string;
  package_id?: string;
  created_at?: string;
  // Joined relations
  clients?: { company_name: string; contact_person?: string } | null;
  safari_packages?: { name: string; category?: string } | null;
  vehicles?: { license_plate: string; make?: string; model?: string } | null;
  safari_guides?: { full_name: string } | null;
}

// ─── Safari Packages ──────────────────────────────────────────────────────────

export interface SafariPackage {
  id: string;
  package_code?: string;
  name: string;
  description?: string;
  category?: string;
  country?: string;
  duration_days?: number;
  price_ugx?: number;
  price_usd?: number;
  capacity_min?: number;
  capacity_max?: number;
  is_active: boolean;
  portal_visible?: boolean;
  portal_image_url?: string;
  portal_highlight?: string;
  created_at?: string;
}

// ─── Safari Guides ────────────────────────────────────────────────────────────

export interface SafariGuide {
  id: string;
  guide_id?: string;
  full_name: string;
  phone?: string;
  email?: string;
  languages?: string[];
  status?: string;
  rating?: number;
  created_at?: string;
}

// ─── Permit Catalog ───────────────────────────────────────────────────────────

export interface PermitCatalog {
  id: string;
  permit_id?: string;
  permit_name: string;
  permit_type?: string;
  cost_usd?: number;
  cost_ugx?: number;
  validity_days?: number;
  is_active: boolean;
  created_at?: string;
}

// ─── Booking Permits (join table) ─────────────────────────────────────────────

export interface SafariBookingPermit {
  id: string;
  booking_id?: string;
  status?: string;
  quantity?: number;
  cost_per_permit?: number;
  total_cost?: number;
  currency?: string;
  safari_permits?: {
    permit_name: string;
    permit_type?: string;
    cost_usd?: number;
  } | null;
}

// ─── Portal / Marketing ───────────────────────────────────────────────────────

export interface PortalVehicle {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  capacity?: string;
  status: string;
  portal_visible?: boolean;
  portal_description?: string;
  portal_image_url?: string;
  portal_category?: string;
  daily_rate_usd?: number;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  promotion_type: string;
  link_url?: string;
  is_active: boolean;
  display_order?: number;
  start_date?: string;
  end_date?: string;
  created_at?: string;
}
