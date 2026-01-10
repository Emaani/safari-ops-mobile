// Type definitions mirroring web Dashboard

export type Currency = 'USD' | 'UGX' | 'KES';

export type BookingStatus = 'Confirmed' | 'In-Progress' | 'Completed' | 'Cancelled' | 'Pending';

export type VehicleStatus = 'available' | 'booked' | 'rented' | 'maintenance' | 'out_of_service';

export type CRStatus = 'Completed' | 'Approved' | 'Resolved' | 'Pending' | 'Rejected' | 'Cancelled' | 'Declined';

export type TransactionType = 'income' | 'expense';

export type StandardExpenseCategory = 'Operating Expense' | 'Petty Cash' | 'Fleet Supplies' | 'Admin Costs' | 'Safari Expense';

export type VehicleCapacity = '7 Seater' | '5 Seater' | 'Other';

export type TimeFilter = 'year' | 'quarter' | 'month' | 'specific' | 'all';

export interface Vehicle {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  capacity: string;
  status: VehicleStatus;
  rating?: number;
  current_driver_id?: string;
  drivers?: {
    full_name: string;
  };
}

export interface Booking {
  id: string;
  booking_reference?: string;
  booking_number?: string; // Alias for backwards compatibility
  start_date: string;
  end_date: string;
  status: BookingStatus;
  amount_paid: number;
  total_amount: number;
  total_cost?: number; // Alias for backwards compatibility
  currency: Currency;
  assigned_vehicle_id?: string;
  assigned_user_id?: string;
  assigned_to?: string;
  client_id?: string;
  actual_client_id?: string;
  client_name?: string;
  created_at?: string; // Booking creation date (for Recent Bookings sorting)
  client?: {
    company_name: string;
  };
  profiles?: {
    full_name: string;
  };
}

export interface Repair {
  id: string;
  vehicle_id: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reported_at: string;
  estimated_cost?: number;
  vehicles?: {
    license_plate: string;
  };
}

export interface FinancialTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  transaction_type: TransactionType;
  category?: string;
  currency: Currency;
  description?: string;
  reference_number?: string;
  status: string;
}

export interface CashRequisition {
  id: string;
  cr_number: string;
  total_cost: number;
  currency: Currency;
  status: CRStatus;
  date_needed: string;
  expense_category: string;
  date_completed?: string;
  created_at: string;
  amount_usd?: number;
}

export interface SafariBooking {
  id: string;
  total_price_usd: number;
  total_price_ugx: number;
  total_expenses_usd: number;
  total_expenses_ugx: number;
  vehicle_hire_cost_usd: number;
  vehicle_hire_cost_ugx: number;
  start_date: string;
  end_date?: string;
  amount_paid?: number;
  currency?: Currency;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  created_at: string;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
}

export interface ExpenseCategoryData {
  category: StandardExpenseCategory;
  amount: number;
}

export interface VehicleRevenueData {
  id: string;
  name: string;
  fullName: string;
  revenue: number;
  trips: number;
  capacity: VehicleCapacity;
}

export interface ClientPerformanceData {
  [clientId: string]: {
    id: string;
    name: string;
    bookingCount: number;
    totalRevenue: number;
    avgBookingValue: number;
  };
}

export interface DashboardKPIs {
  totalRevenue: number;
  revenueMTD: number;
  revenueYTD: number;
  totalExpenses: number;
  activeBookings: number;
  fleetUtilization: number;
  vehiclesHired: number;
  vehiclesMaintenance: number;
  vehiclesAvailable: number;
  outstandingPayments: number;
}
