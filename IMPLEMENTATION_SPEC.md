# Safari Ops Mobile Dashboard - Complete Implementation Specification

## CRITICAL REQUIREMENT
The mobile Dashboard must be a **1:1 functional and visual replica** of the web Dashboard at [HomeDashboard.tsx](d:\Projects\Jackalwild\Jackaldashboard\safari-ops-central\src\components\tabs\HomeDashboard.tsx).

## PROJECT CONTEXT

### Existing Infrastructure (COMPLETED)
✅ Expo TypeScript app initialized
✅ Dependencies installed: @supabase/supabase-js, victory-native, react-navigation
✅ Supabase client configured: `src/lib/supabase.ts`
✅ Type definitions created: `src/types/dashboard.ts`
✅ Utility functions created: `src/lib/utils.ts`
✅ Exchange rate hook created: `src/hooks/useExchangeRate.ts`

### Supabase Configuration
- **URL**: https://ohlbioostgjxuwnaxjgk.supabase.co
- **Key**: (already configured in src/lib/supabase.ts)
- **Storage**: AsyncStorage (React Native compatible)

---

## WEB DASHBOARD ANALYSIS COMPLETE

I have analyzed the web Dashboard comprehensively. Here are the **EXACT** requirements:

### KPI Cards (4 Total)

#### 1. Total Revenue
- **Calculation**:
  ```typescript
  totalBookingRevenue = sum(booking.amount_paid) where:
    - status IN ['Completed', 'In-Progress'] OR (status = 'Confirmed' AND amount_paid > 0)
    - amount_paid > 0
    - filtered by dashboardMonthFilter

  totalTransactionRevenue = sum(financial_transactions.amount) where:
    - transaction_type = 'income'
    - status != 'cancelled'
    - filtered by dashboardMonthFilter

  totalRevenue = totalBookingRevenue + totalTransactionRevenue (converted to selected currency)
  ```
- **MTD**: Same calculation for current month only
- **YTD**: Same calculation for current year only
- **Subtitle**: "MTD: $X | YTD: $Y"

#### 2. Total Expenses
- **Calculation**:
  ```typescript
  crExpenses = sum(cr.amount_usd || convert(cr.total_cost)) where:
    - date_completed NOT NULL OR status IN ['Completed', 'Approved', 'Resolved']
    - status NOT IN ['Rejected', 'Cancelled', 'Declined']
    - filtered by dashboardMonthFilter (created_at)

  expenseTransactions = sum(financial_transactions.amount) where:
    - transaction_type = 'expense'
    - status != 'cancelled'
    - NOT duplicate CR references
    - filtered by dashboardMonthFilter

  totalExpenses = crExpenses + expenseTransactions (converted to selected currency)
  ```

#### 3. Fleet Utilization
- **Calculation**:
  ```typescript
  vehiclesHired = vehicles where status IN ['booked', 'rented']
  vehiclesMaintenance = vehicles where status IN ['maintenance', 'out_of_service']
  vehiclesAvailable = vehicles where status = 'available'

  fleetUtilization = (vehiclesHired.length / vehicles.length) * 100
  ```
- **Subtitle**: "X Hired | Y Maintenance | Z Available"

#### 4. Active Bookings
- **Calculation**:
  ```typescript
  if dashboardMonthFilter = "all":
    activeBookings = bookings where:
      - status = 'In-Progress' OR
      - (status = 'Confirmed' AND now BETWEEN start_date AND end_date)
  else:
    activeBookings = bookings in selected month where:
      - status IN ['In-Progress', 'Confirmed']
  ```

---

### Charts (5 Total)

#### Chart 1: Revenue vs Expenses (Line Chart - INDEPENDENT FILTER)
- **Data Points**: Monthly data (Jan-Dec)
- **Calculation** (EXACT):
  ```typescript
  for each month in selected year:
    monthBookingRevenue = sum(booking.amount_paid) for revenue-eligible bookings
    monthTransactionRevenue = sum(financial_transaction.amount) where transaction_type = 'income'
    monthCRExpenses = sum(cr.amount_usd || convert(cr.total_cost))
    monthTransactionExpenses = sum(expense_transactions) excluding CR duplicates

    monthlyData[month] = {
      month: "Jan" | "Feb" | ...,
      revenue: monthBookingRevenue + monthTransactionRevenue,
      expenses: monthCRExpenses + monthTransactionExpenses
    }
  ```
- **Filter Options**: Year / Quarter / Month / Specific Months
- **Independent from main dashboard filter**
- **Visual**: Blue line (revenue #6FA2E5), Red line (expenses #FF8688)
- **Legend**: Clickable to toggle visibility

#### Chart 2: Expense Categories (Bar Chart - INDEPENDENT FILTER)
- **Data Points**: 5 standard categories (sorted by amount desc)
- **Calculation** (EXACT):
  ```typescript
  filteredCRs = CRs where:
    - status IN ['Completed', 'Approved', 'Resolved'] OR date_completed NOT NULL
    - status NOT IN ['Rejected', 'Cancelled', 'Declined']
    - created_at matches selected time filter

  expenseCategories = groupBy(filteredCRs, normalizeExpenseCategory):
    - Fleet Supplies
    - Operating Expense
    - Admin Costs
    - Petty Cash
    - Safari Expense

  amount = sum(cr.amount_usd || convert(cr.total_cost))
  sorted descending, filter amount > 0
  ```
- **Filter Options**: Year / Quarter / Month / Specific Months
- **Independent from main dashboard filter**

#### Chart 3: Top Revenue Vehicles (Dual-Axis Bar Chart - INDEPENDENT FILTER)
- **Data Points**: Top vehicles by revenue
- **Calculation** (EXACT):
  ```typescript
  filteredBookings = bookings where:
    - assigned_vehicle_id NOT NULL
    - status IN ['Completed', 'In-Progress'] OR (status = 'Confirmed' AND amount_paid > 0)
    - filtered by revenueTimeFilter

  grouped by vehicle_id:
    revenue = sum(amount_paid) converted to selected currency
    trips = count of bookings
    capacity = normalized from vehicle.capacity

  sorted: descending by revenue
  filtered: by capacityFilter (all/7seater/5seater)
  ```
- **Dual Y-Axes**: Revenue (left), Trip count (right)
- **Filter Options**:
  - Time: Year / Quarter / Month / Specific
  - Capacity: All / 7 Seater / 5 Seater
- **Colors**: Purple/Green (7S/5S revenue), Amber/Blue (7S/5S trips)

#### Chart 4: Fleet Status (Donut Chart)
- **Data Points**: Vehicle status breakdown
- **Calculation**:
  ```typescript
  statusCounts = {
    booked: count(vehicles where status = 'booked'),
    rented: count(vehicles where status = 'rented'),
    available: count(vehicles where status = 'available'),
    maintenance: count(vehicles where status = 'maintenance'),
    out_of_service: count(vehicles where status = 'out_of_service')
  }
  ```
- **Uses main dashboard filter context**

#### Chart 5: 7 Seater vs 5 Seater Comparison (Bar Chart - INDEPENDENT FILTER)
- **Data Points**: Revenue and trip comparison
- **Calculation**:
  ```typescript
  sevenSeaterVehicles = aggregate vehicle revenue by capacity "7 Seater"
  fiveSeaterVehicles = aggregate vehicle revenue by capacity "5 Seater"

  capacityComparisonData = [
    { name: "7 Seater", value: sum(7S revenue) },
    { name: "5 Seater", value: sum(5S revenue) }
  ]
  ```
- **Filter Options**: All / Specific Months

---

### Widgets

#### Outstanding Payments Card
- **Calculation**:
  ```typescript
  outstandingPayments = sum(booking.total_cost - booking.amount_paid) where:
    - status IN ['Confirmed', 'In-Progress']
    - amount_paid < total_cost
  ```

#### Recent Bookings Widget
- **Shows**: Last 5-10 bookings
- **Sorted**: start_date descending
- **Displays**: booking_number, start_date, status badge, amount

---

## FILTER SYSTEM (CRITICAL)

### Global Dashboard Filter
- **State**: `dashboardMonthFilter` (0-11 or "all"), `dashboardFilterYear`
- **Applies to**:
  - KPI cards
  - Bookings fetch
  - Transactions fetch
  - Cash Requisitions fetch
  - Fleet status (context)

### Independent Chart Filters
1. **Revenue vs Expenses**: Own time filter + year + months
2. **Expense Categories**: Own time filter + year + months
3. **Top Revenue Vehicles**: Own time filter + year + months + capacity filter
4. **Capacity Comparison**: Own time filter + year + months

**DO NOT mix filters** - Each chart must maintain its own filter state independently.

---

## REALTIME SYNC (MANDATORY)

**Implementation Required**:
```typescript
// Hook: useDashboardRealtimeSync
Tables to subscribe: [
  'bookings',
  'vehicles',
  'repairs',
  'cash_requisitions',
  'financial_transactions',
  'exchange_rates'
]

Debounce: 500ms
On update: Refetch all Dashboard data
```

**Trigger refetch on**:
- Initial mount
- Tab focus
- Realtime update event
- Manual pull-to-refresh

---

## DATA FETCHING QUERIES (EXACT REPLICATION)

### Vehicles Query
```typescript
supabase
  .from('vehicles')
  .select('id, license_plate, make, model, capacity, status, rating, current_driver_id, drivers(full_name)')
  .order('license_plate', { ascending: true })
```

### Bookings Query
```typescript
let query = supabase
  .from('bookings')
  .select('id, booking_number, start_date, end_date, status, amount_paid, total_cost, currency, assigned_vehicle_id, assigned_user_id, client_id, actual_client_id')
  .order('start_date', { ascending: false });

if (dashboardMonthFilter !== 'all') {
  // Apply month filter to start_date
  query = query.gte('start_date', firstDayOfMonth).lte('start_date', lastDayOfMonth);
}

// Then fetch profiles and clients to map names
```

### Repairs Query
```typescript
supabase
  .from('repairs')
  .select('*, vehicles(license_plate)')
  .in('status', ['open', 'in_progress'])
  .order('priority', { ascending: false })
  .order('reported_at', { ascending: false })
```

### Transactions Query
```typescript
let query = supabase
  .from('financial_transactions')
  .select('id, transaction_date, amount, transaction_type, category, currency, description, reference_number, status')
  .neq('status', 'cancelled')
  .order('transaction_date', { ascending: true });

if (dashboardMonthFilter !== 'all') {
  query = query.gte('transaction_date', firstDayOfMonth).lte('transaction_date', lastDayOfMonth);
}
```

### Cash Requisitions Query
```typescript
let query = supabase
  .from('cash_requisitions')
  .select('id, cr_number, total_cost, currency, status, date_needed, expense_category, date_completed, created_at, amount_usd')
  .eq('soft_deleted', false)
  .not('status', 'in', ['Declined', 'Rejected'])
  .order('created_at', { ascending: true });

if (dashboardMonthFilter !== 'all') {
  query = query.gte('created_at', firstDayOfMonth).lte('created_at', lastDayOfMonth);
}
```

---

## MOBILE UI REQUIREMENTS

### Layout
- **ScrollView** for entire Dashboard
- **Pull-to-refresh** support
- **Responsive** padding/margins
- **Card-based** design with shadows

### KPI Cards
- **4-card grid** (2x2 on mobile)
- Icon + Title + Value + Subtitle
- Gradient backgrounds matching web
- TouchableOpacity for interactions

### Charts
- **Victory Native** for all charts
- Responsive width (screen width - 32)
- Height: 220px for line/bar, 200px for donut
- **Filters above each chart**
- Smooth animations

### Colors (Match Web Exactly)
- Revenue: #6FA2E5
- Expenses: #FF8688
- 7 Seater: #9333ea (purple) / #f59e0b (amber)
- 5 Seater: #10b981 (green) / #3b82f6 (blue)
- Status colors: (see getStatusColor in utils.ts)

---

## IMPLEMENTATION ORDER

1. ✅ **Infrastructure** (DONE)
   - Supabase client
   - Types
   - Utils
   - Exchange rate hook

2. **Data Layer** (NEXT)
   - `src/hooks/useDashboardData.ts` - Main data fetching hook
   - `src/hooks/useDashboardRealtimeSync.ts` - Realtime subscription hook
   - `src/hooks/useDashboardCalculations.ts` - KPI and chart calculations

3. **Components**
   - `src/components/kpi/KPICard.tsx` - Reusable KPI card
   - `src/components/charts/RevenueExpensesChart.tsx` - Line chart with independent filter
   - `src/components/charts/ExpenseCategoriesChart.tsx` - Bar chart with independent filter
   - `src/components/charts/TopVehiclesChart.tsx` - Dual-axis bar chart with filters
   - `src/components/charts/FleetStatusChart.tsx` - Donut chart
   - `src/components/charts/CapacityComparisonChart.tsx` - Comparison bar chart

4. **Main Screen**
   - `src/screens/DashboardScreen.tsx` - Main Dashboard screen with all components

5. **Navigation**
   - `App.tsx` - Set up navigation with Dashboard as home screen

6. **Parity Verification**
   - `src/lib/dashboardSync.ts` - Diagnostic logging system

---

## VERIFICATION CHECKLIST

Before marking complete, verify:

- [ ] All 4 KPI cards show identical values to web Dashboard
- [ ] Revenue vs Expenses chart matches web data point-by-point
- [ ] Expense Categories chart matches web amounts exactly
- [ ] Top Revenue Vehicles chart matches web vehicle rankings
- [ ] Fleet Status donut shows same counts as web
- [ ] All filters work independently
- [ ] Currency conversion matches web exactly (USD/UGX/KES)
- [ ] Realtime updates trigger data refresh
- [ ] Pull-to-refresh works
- [ ] No placeholder or mock data
- [ ] All charts animate smoothly
- [ ] Empty states handled gracefully

---

## DELIVERABLE

A complete, production-ready mobile Dashboard screen that:
1. Fetches the same data as web Dashboard
2. Calculates metrics identically
3. Displays charts with identical values
4. Updates in real-time
5. Works offline-first with Supabase
6. Performs well on iOS and Android

**The mobile Dashboard must pass a 1:1 parity check with the web Dashboard.**

---

## NEXT STEP

Build the complete implementation using this specification. Start with the data layer hooks, then components, then the main screen.
