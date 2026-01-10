# VIBECODE PROMPT: Safari Ops Mobile Dashboard - 1:1 Web Replica

## 🎯 OBJECTIVE
Build a complete React Native (Expo) mobile Dashboard that is a **1:1 functional and visual replica** of the web Dashboard located at:
`d:\Projects\Jackalwild\Jackaldashboard\safari-ops-central\src\components\tabs\HomeDashboard.tsx`

## 🔴 NON-NEGOTIABLE RULES
1. The web Dashboard is the **source of truth**
2. All charts and KPIs must use **identical data, queries, filters, and calculations**
3. No metric may be computed differently on mobile
4. No placeholder or approximated chart data
5. If a chart differs visually or numerically → implementation is incorrect

---

## 📁 PROJECT CONTEXT

### Current Status
- ✅ Expo TypeScript app initialized at `d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile\`
- ✅ Dependencies installed: @supabase/supabase-js, victory-native, react-navigation
- ✅ Infrastructure files created:
  - `src/lib/supabase.ts` (Supabase client)
  - `src/types/dashboard.ts` (TypeScript types)
  - `src/lib/utils.ts` (Utility functions)
  - `src/hooks/useExchangeRate.ts` (Currency conversion hook)
- ✅ Complete specification: `IMPLEMENTATION_SPEC.md`

### Supabase Configuration
- **URL**: https://ohlbioostgjxuwnaxjgk.supabase.co
- **Key**: Already configured in `src/lib/supabase.ts`
- **Tables**: vehicles, bookings, repairs, cash_requisitions, financial_transactions, exchange_rates

---

## 📊 WEB DASHBOARD ANALYSIS (MANDATORY READING)

### KPI Cards (4 Total) - EXACT CALCULATIONS REQUIRED

#### KPI 1: Total Revenue
**Calculation Logic** (Lines 615-675 in HomeDashboard.tsx):
```typescript
// Step 1: Filter revenue-eligible bookings
revenueEligibleBookings = bookings.filter(b =>
  (b.status === 'Completed' || b.status === 'In-Progress' ||
   (b.status === 'Confirmed' && b.amount_paid > 0)) &&
  b.amount_paid > 0 &&
  matchesDashboardFilter(b.start_date, dashboardMonthFilter, dashboardFilterYear)
)

// Step 2: Sum booking revenue
totalBookingRevenue = revenueEligibleBookings.reduce((sum, b) => {
  const amountInUSD = convertToBaseCurrency(b.amount_paid, b.currency, conversionRates)
  return sum + amountInUSD
}, 0)

// Step 3: Sum transaction revenue
totalTransactionRevenue = financialTransactions
  .filter(t =>
    t.transaction_type === 'income' &&
    t.status !== 'cancelled' &&
    matchesDashboardFilter(t.transaction_date, dashboardMonthFilter, dashboardFilterYear)
  )
  .reduce((sum, t) => {
    const amountInUSD = convertToBaseCurrency(t.amount, t.currency, conversionRates)
    return sum + amountInUSD
  }, 0)

// Step 4: Total revenue in display currency
totalRevenue = convertFromBaseCurrency(
  totalBookingRevenue + totalTransactionRevenue,
  displayCurrency,
  conversionRates
)

// Step 5: Calculate MTD (current month only)
revenueMTD = calculateRevenueForMonth(currentMonth, currentYear)

// Step 6: Calculate YTD (current year only)
revenueYTD = calculateRevenueForYear(currentYear)
```

**Display**: `formatCurrency(totalRevenue, currency)`
**Subtitle**: `"MTD: ${formatCurrency(revenueMTD)} | YTD: ${formatCurrency(revenueYTD)}"`

---

#### KPI 2: Total Expenses
**Calculation Logic** (Lines 687-741 in HomeDashboard.tsx):
```typescript
// Step 1: Filter valid CRs
validCRStatuses = ['Completed', 'Approved', 'Resolved']
dashboardFilteredCRs = cashRequisitions.filter(cr =>
  (cr.date_completed !== null || validCRStatuses.includes(cr.status)) &&
  !['Rejected', 'Cancelled', 'Declined'].includes(cr.status) &&
  matchesDashboardFilter(cr.created_at, dashboardMonthFilter, dashboardFilterYear)
)

// Step 2: Sum CR expenses (use amount_usd if available, else convert total_cost)
crExpenses = dashboardFilteredCRs.reduce((sum, cr) => {
  const amountInUSD = cr.amount_usd
    ? cr.amount_usd
    : convertToBaseCurrency(cr.total_cost, cr.currency, conversionRates)
  return sum + amountInUSD
}, 0)

// Step 3: Filter expense transactions (exclude CR duplicates)
expenseTransactions = financialTransactions.filter(t =>
  t.transaction_type === 'expense' &&
  t.status !== 'cancelled' &&
  !t.reference_number?.startsWith('CR-') && // Exclude CR duplicates
  matchesDashboardFilter(t.transaction_date, dashboardMonthFilter, dashboardFilterYear)
)

// Step 4: Sum expense transactions
expenseTransactionSum = expenseTransactions.reduce((sum, t) => {
  const amountInUSD = convertToBaseCurrency(t.amount, t.currency, conversionRates)
  return sum + amountInUSD
}, 0)

// Step 5: Total expenses in display currency
totalExpenses = convertFromBaseCurrency(
  crExpenses + expenseTransactionSum,
  displayCurrency,
  conversionRates
)
```

**Display**: `formatCurrency(totalExpenses, currency)`

---

#### KPI 3: Fleet Utilization
**Calculation Logic** (Lines 560-598 in HomeDashboard.tsx):
```typescript
// Step 1: Count vehicles by status
vehiclesHired = vehicles.filter(v =>
  v.status === 'booked' || v.status === 'rented'
).length

vehiclesMaintenance = vehicles.filter(v =>
  v.status === 'maintenance' || v.status === 'out_of_service'
).length

vehiclesAvailable = vehicles.filter(v =>
  v.status === 'available'
).length

// Step 2: Calculate utilization percentage
totalFleet = vehicles.length
fleetUtilization = totalFleet > 0
  ? Math.round((vehiclesHired / totalFleet) * 100)
  : 0
```

**Display**: `${fleetUtilization}%`
**Subtitle**: `"${vehiclesHired} Hired | ${vehiclesMaintenance} Maintenance | ${vehiclesAvailable} Available"`

---

#### KPI 4: Active Bookings
**Calculation Logic** (Lines 535-552 in HomeDashboard.tsx):
```typescript
if (dashboardMonthFilter === 'all') {
  // All-time active bookings
  activeBookings = bookings.filter(b => {
    const now = new Date()
    const startDate = new Date(b.start_date)
    const endDate = new Date(b.end_date)

    return b.status === 'In-Progress' ||
           (b.status === 'Confirmed' && now >= startDate && now <= endDate)
  }).length
} else {
  // Month-filtered active bookings
  activeBookings = bookings.filter(b =>
    (b.status === 'In-Progress' || b.status === 'Confirmed') &&
    matchesDashboardFilter(b.start_date, dashboardMonthFilter, dashboardFilterYear)
  ).length
}
```

**Display**: `${activeBookings}`

---

### Charts (5 Total) - EXACT DATA SOURCES REQUIRED

#### Chart 1: Revenue vs Expenses (Line Chart)
**Location**: Lines 1743-1805 in HomeDashboard.tsx
**Filter**: INDEPENDENT (has its own year/month/quarter selector)

**Calculation Logic** (Lines 756-840):
```typescript
// Initialize monthly data
monthlyData = Array.from({ length: 12 }, (_, i) => ({
  month: getMonthAbbreviation(i), // "Jan", "Feb", ...
  revenue: 0,
  expenses: 0
}))

// Calculate for selected time period
for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
  // REVENUE CALCULATION
  // 1. Booking revenue for this month
  monthBookingRevenue = bookings
    .filter(b =>
      (b.status === 'Completed' || b.status === 'In-Progress' ||
       (b.status === 'Confirmed' && b.amount_paid > 0)) &&
      b.amount_paid > 0 &&
      matchesRevenueExpenseFilter(b.start_date, monthIndex, selectedYear)
    )
    .reduce((sum, b) => sum + convertToBaseCurrency(b.amount_paid, b.currency, rates), 0)

  // 2. Transaction revenue for this month
  monthTransactionRevenue = financialTransactions
    .filter(t =>
      t.transaction_type === 'income' &&
      t.status !== 'cancelled' &&
      matchesRevenueExpenseFilter(t.transaction_date, monthIndex, selectedYear)
    )
    .reduce((sum, t) => sum + convertToBaseCurrency(t.amount, t.currency, rates), 0)

  // EXPENSE CALCULATION
  // 1. CR expenses for this month
  monthCRExpenses = cashRequisitions
    .filter(cr =>
      (cr.date_completed || ['Completed', 'Approved', 'Resolved'].includes(cr.status)) &&
      !['Rejected', 'Cancelled', 'Declined'].includes(cr.status) &&
      matchesRevenueExpenseFilter(cr.created_at, monthIndex, selectedYear)
    )
    .reduce((sum, cr) => {
      const amount = cr.amount_usd || convertToBaseCurrency(cr.total_cost, cr.currency, rates)
      return sum + amount
    }, 0)

  // 2. Transaction expenses for this month (exclude CR duplicates)
  monthTransactionExpenses = financialTransactions
    .filter(t =>
      t.transaction_type === 'expense' &&
      t.status !== 'cancelled' &&
      !t.reference_number?.startsWith('CR-') &&
      matchesRevenueExpenseFilter(t.transaction_date, monthIndex, selectedYear)
    )
    .reduce((sum, t) => sum + convertToBaseCurrency(t.amount, t.currency, rates), 0)

  // Convert to display currency
  monthlyData[monthIndex].revenue = convertFromBaseCurrency(
    monthBookingRevenue + monthTransactionRevenue,
    displayCurrency,
    rates
  )

  monthlyData[monthIndex].expenses = convertFromBaseCurrency(
    monthCRExpenses + monthTransactionExpenses,
    displayCurrency,
    rates
  )
}
```

**Visual Requirements**:
- Victory Native LineChart
- Two lines: Revenue (blue #6FA2E5), Expenses (red #FF8688)
- Clickable legend to toggle line visibility
- X-axis: Month abbreviations
- Y-axis: Formatted currency (compact notation)
- Height: 220px
- Responsive width: Dimensions.get('window').width - 32

**Filter UI** (above chart):
- Time Filter: Picker with options ["Year", "Quarter", "Month", "Specific"]
- Year Selector: Picker with years [2020-2026]
- Month Multi-Selector: (if "Specific" selected) Checkboxes for all 12 months

---

#### Chart 2: Expense Categories (Bar Chart)
**Location**: Lines 1866-1914 in HomeDashboard.tsx
**Filter**: INDEPENDENT (has its own year/month/quarter selector)

**Calculation Logic** (Lines 868-914):
```typescript
// Step 1: Filter CRs by time filter
filteredCRs = cashRequisitions.filter(cr =>
  (cr.date_completed || ['Completed', 'Approved', 'Resolved'].includes(cr.status)) &&
  !['Rejected', 'Cancelled', 'Declined'].includes(cr.status) &&
  matchesExpenseCategoryFilter(cr.created_at, expenseCategoryTimeFilter, selectedMonths, selectedYear)
)

// Step 2: Group by normalized category
categoryMap = {}
filteredCRs.forEach(cr => {
  const category = normalizeExpenseCategory(cr.expense_category)
  const amountUSD = cr.amount_usd || convertToBaseCurrency(cr.total_cost, cr.currency, rates)

  if (!categoryMap[category]) {
    categoryMap[category] = 0
  }
  categoryMap[category] += amountUSD
})

// Step 3: Convert to array and sort
expenseCategories = Object.entries(categoryMap)
  .map(([category, amount]) => ({
    category: category as StandardExpenseCategory,
    amount: convertFromBaseCurrency(amount, displayCurrency, rates)
  }))
  .filter(item => item.amount > 0)
  .sort((a, b) => b.amount - a.amount) // Descending

// Standard categories (if missing, they won't appear):
// "Fleet Supplies", "Operating Expense", "Admin Costs", "Petty Cash", "Safari Expense"
```

**Visual Requirements**:
- Victory Native BarChart
- X-axis: Category names (rotated -45°)
- Y-axis: Amount in display currency
- Bar colors: Dynamic based on category
- Height: 220px
- Clickable bars (future: open detail dialog)

**Filter UI**:
- Same as Revenue vs Expenses chart

---

#### Chart 3: Top Revenue Vehicles (Dual-Axis Bar Chart)
**Location**: Lines 2003-2094 in HomeDashboard.tsx
**Filter**: INDEPENDENT + Capacity Filter

**Calculation Logic** (Lines 916-986):
```typescript
// Step 1: Filter revenue-eligible bookings with vehicle assignment
filteredBookings = bookings.filter(b =>
  b.assigned_vehicle_id &&
  (b.status === 'Completed' || b.status === 'In-Progress' ||
   (b.status === 'Confirmed' && b.amount_paid > 0)) &&
  b.amount_paid > 0 &&
  matchesRevenueTimeFilter(b.start_date, revenueTimeFilter, selectedMonths, selectedYear)
)

// Step 2: Group by vehicle
vehicleRevenueMap = {}
filteredBookings.forEach(b => {
  const vehicleId = b.assigned_vehicle_id
  const vehicle = vehicles.find(v => v.id === vehicleId)

  if (!vehicle) return

  if (!vehicleRevenueMap[vehicleId]) {
    vehicleRevenueMap[vehicleId] = {
      id: vehicleId,
      name: vehicle.license_plate,
      fullName: `${vehicle.make} ${vehicle.model} (${vehicle.license_plate})`,
      revenue: 0,
      trips: 0,
      capacity: normalizeVehicleCapacity(vehicle.capacity)
    }
  }

  const amountUSD = convertToBaseCurrency(b.amount_paid, b.currency, rates)
  vehicleRevenueMap[vehicleId].revenue += amountUSD
  vehicleRevenueMap[vehicleId].trips += 1
})

// Step 3: Convert to array, filter by capacity, sort by revenue
topVehiclesData = Object.values(vehicleRevenueMap)
  .filter(v => {
    if (capacityFilter === 'all') return true
    if (capacityFilter === '7seater') return v.capacity === '7 Seater'
    if (capacityFilter === '5seater') return v.capacity === '5 Seater'
    return true
  })
  .map(v => ({
    ...v,
    revenue: convertFromBaseCurrency(v.revenue, displayCurrency, rates)
  }))
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 10) // Top 10
```

**Visual Requirements**:
- Victory Native VictoryChart with VictoryGroup
- **Dual Y-Axes**:
  - Left axis: Revenue (VictoryBar)
  - Right axis: Trip count (VictoryBar)
- Bar colors:
  - Revenue: Purple (#9333ea) for 7 Seater, Green (#10b981) for 5 Seater
  - Trips: Amber (#f59e0b) for 7 Seater, Blue (#3b82f6) for 5 Seater
- X-axis: Vehicle license plates (rotated -45°)
- Height: 240px
- Custom tooltip showing vehicle fullName, revenue, trips

**Filter UI**:
- Time Filter: ["Year", "Quarter", "Month", "Specific"]
- Year + Month selectors
- Capacity Filter: ["All", "7 Seater", "5 Seater"]

---

#### Chart 4: Fleet Status (Donut Chart)
**Location**: FleetStatusCard component

**Calculation Logic**:
```typescript
statusCounts = {
  booked: vehicles.filter(v => v.status === 'booked').length,
  rented: vehicles.filter(v => v.status === 'rented').length,
  available: vehicles.filter(v => v.status === 'available').length,
  maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  out_of_service: vehicles.filter(v => v.status === 'out_of_service').length
}

// Convert to chart data
donutData = [
  { x: 'Booked', y: statusCounts.booked, color: '#3b82f6' },
  { x: 'Rented', y: statusCounts.rented, color: '#10b981' },
  { x: 'Available', y: statusCounts.available, color: '#6b7280' },
  { x: 'Maintenance', y: statusCounts.maintenance, color: '#f59e0b' },
  { x: 'Out of Service', y: statusCounts.out_of_service, color: '#ef4444' }
].filter(item => item.y > 0)
```

**Visual Requirements**:
- Victory Native VictoryPie with innerRadius (donut)
- Color-coded by status
- Center label: Total fleet count
- Height: 200px

---

#### Chart 5: 7 Seater vs 5 Seater Comparison (Bar Chart)
**Location**: Lines 2643-2711 in HomeDashboard.tsx
**Filter**: INDEPENDENT ("All" or "Specific")

**Calculation Logic** (Lines 988-1090):
```typescript
// Get bookings for capacity comparison
filteredBookings = bookings.filter(b =>
  b.assigned_vehicle_id &&
  (b.status === 'Completed' || b.status === 'In-Progress' ||
   (b.status === 'Confirmed' && b.amount_paid > 0)) &&
  b.amount_paid > 0 &&
  matchesCapacityComparisonFilter(b.start_date, capacityComparisonTimeFilter, selectedMonths, selectedYear)
)

// Group by vehicle and calculate
vehicleStats = {}
filteredBookings.forEach(b => {
  const vehicle = vehicles.find(v => v.id === b.assigned_vehicle_id)
  if (!vehicle) return

  const capacity = normalizeVehicleCapacity(vehicle.capacity)
  if (capacity === 'Other') return

  if (!vehicleStats[b.assigned_vehicle_id]) {
    vehicleStats[b.assigned_vehicle_id] = {
      capacity,
      revenue: 0,
      trips: 0
    }
  }

  const amountUSD = convertToBaseCurrency(b.amount_paid, b.currency, rates)
  vehicleStats[b.assigned_vehicle_id].revenue += amountUSD
  vehicleStats[b.assigned_vehicle_id].trips += 1
})

// Aggregate by capacity
sevenSeaterTotal = Object.values(vehicleStats)
  .filter(v => v.capacity === '7 Seater')
  .reduce((sum, v) => sum + v.revenue, 0)

fiveSeaterTotal = Object.values(vehicleStats)
  .filter(v => v.capacity === '5 Seater')
  .reduce((sum, v) => sum + v.revenue, 0)

// Convert to display currency
capacityComparisonData = [
  { name: '7 Seater', value: convertFromBaseCurrency(sevenSeaterTotal, displayCurrency, rates) },
  { name: '5 Seater', value: convertFromBaseCurrency(fiveSeaterTotal, displayCurrency, rates) }
]

// Also calculate trip counts
sevenSeaterTrips = Object.values(vehicleStats)
  .filter(v => v.capacity === '7 Seater')
  .reduce((sum, v) => sum + v.trips, 0)

fiveSeaterTrips = Object.values(vehicleStats)
  .filter(v => v.capacity === '5 Seater')
  .reduce((sum, v) => sum + v.trips, 0)

tripComparisonData = [
  { name: '7 Seater', value: sevenSeaterTrips },
  { name: '5 Seater', value: fiveSeaterTrips }
]
```

**Visual Requirements**:
- Two side-by-side bar charts
- Chart 1: Revenue comparison
- Chart 2: Trip count comparison
- Colors: Purple (7S), Green (5S)
- Height: 180px each

---

### Widgets

#### Outstanding Payments Card
```typescript
outstandingPayments = bookings
  .filter(b =>
    (b.status === 'Confirmed' || b.status === 'In-Progress') &&
    b.amount_paid < b.total_cost
  )
  .reduce((sum, b) => {
    const outstanding = b.total_cost - b.amount_paid
    const outstandingUSD = convertToBaseCurrency(outstanding, b.currency, rates)
    return sum + outstandingUSD
  }, 0)

outstandingCount = bookings.filter(b =>
  (b.status === 'Confirmed' || b.status === 'In-Progress') &&
  b.amount_paid < b.total_cost
).length
```

#### Recent Bookings Widget
```typescript
recentBookings = bookings
  .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
  .slice(0, 10)
  .map(b => ({
    id: b.id,
    booking_number: b.booking_number,
    start_date: formatDateDMY(b.start_date),
    status: b.status,
    amount: formatCurrency(b.amount_paid, b.currency),
    statusColor: getStatusColor(b.status)
  }))
```

---

## 🔄 REALTIME SYNC (MANDATORY)

**Implementation**: `src/hooks/useDashboardRealtimeSync.ts`

```typescript
export function useDashboardRealtimeSync(onUpdate: () => void) {
  useEffect(() => {
    const tables = [
      'bookings',
      'vehicles',
      'repairs',
      'cash_requisitions',
      'financial_transactions',
      'exchange_rates'
    ]

    const channels = tables.map(table => {
      return supabase
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table
          },
          debounce(() => {
            console.log(`${table} updated, refetching...`)
            onUpdate()
          }, 500)
        )
        .subscribe()
    })

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [onUpdate])
}

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout
  return (...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
```

---

## 📱 MOBILE UI SPECIFICATION

### Main Dashboard Screen Layout

```typescript
<SafeAreaView style={styles.container}>
  <ScrollView
    refreshControl={
      <RefreshControl refreshing={loading} onRefresh={fetchAllData} />
    }
  >
    {/* Header */}
    <View style={styles.header}>
      <Text style={styles.title}>Dashboard</Text>
      <View style={styles.filterRow}>
        <Picker
          selectedValue={dashboardMonthFilter}
          onValueChange={setDashboardMonthFilter}
        >
          <Picker.Item label="All Time" value="all" />
          <Picker.Item label="January" value={0} />
          {/* ... all months */}
        </Picker>
        <Picker
          selectedValue={currency}
          onValueChange={setCurrency}
        >
          <Picker.Item label="USD" value="USD" />
          <Picker.Item label="UGX" value="UGX" />
          <Picker.Item label="KES" value="KES" />
        </Picker>
      </View>
    </View>

    {/* KPI Cards Grid */}
    <View style={styles.kpiGrid}>
      <KPICard title="Total Revenue" value={...} subtitle={...} />
      <KPICard title="Total Expenses" value={...} subtitle={...} />
      <KPICard title="Fleet Utilization" value={...} subtitle={...} />
      <KPICard title="Active Bookings" value={...} subtitle={...} />
    </View>

    {/* Outstanding Payments Card */}
    <OutstandingPaymentsCard amount={...} count={...} />

    {/* Recent Bookings Widget */}
    <RecentBookingsWidget bookings={recentBookings} />

    {/* Fleet Status Chart */}
    <FleetStatusChart data={donutData} />

    {/* Revenue vs Expenses Chart */}
    <RevenueExpensesChart
      data={monthlyDataEnhanced}
      onFilterChange={...}
    />

    {/* Expense Categories Chart */}
    <ExpenseCategoriesChart
      data={expenseCategories}
      onFilterChange={...}
    />

    {/* Top Revenue Vehicles Chart */}
    <TopVehiclesChart
      data={topVehiclesData}
      onFilterChange={...}
    />

    {/* Capacity Comparison Charts */}
    <CapacityComparisonChart
      revenueData={capacityComparisonData}
      tripData={tripComparisonData}
      onFilterChange={...}
    />
  </ScrollView>
</SafeAreaView>
```

### KPI Card Component

```typescript
interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  icon?: string
  iconColor?: string
  onPress?: () => void
}

export function KPICard({ title, value, subtitle, icon, iconColor, onPress }: KPICardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.iconContainer}>
        {/* Icon component */}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  )
}
```

---

## 🎨 STYLING REQUIREMENTS

### Colors (Match Web Exactly)
```typescript
export const colors = {
  // Chart colors
  revenue: '#6FA2E5',
  expenses: '#FF8688',
  sevenSeaterPrimary: '#9333ea', // purple
  sevenSeaterSecondary: '#f59e0b', // amber
  fiveSeaterPrimary: '#10b981', // green
  fiveSeaterSecondary: '#3b82f6', // blue

  // Status colors
  completed: '#10b981',
  inProgress: '#f59e0b',
  confirmed: '#3b82f6',
  pending: '#6b7280',
  cancelled: '#ef4444',

  // Fleet status colors
  booked: '#3b82f6',
  rented: '#10b981',
  available: '#6b7280',
  maintenance: '#f59e0b',
  outOfService: '#ef4444',

  // UI colors
  background: '#f9fafb',
  cardBackground: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
}
```

### Spacing
```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}
```

### Typography
```typescript
export const typography = {
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Data Layer ✅
- [ ] `src/hooks/useDashboardData.ts` - Fetch all Supabase data
  - fetchVehicles()
  - fetchBookings() with dashboard filter
  - fetchRepairs()
  - fetchTransactions() with dashboard filter
  - fetchCashRequisitions() with dashboard filter
  - fetchProfiles() and fetchClients() for name mapping
  - Return all data + loading + error states

- [ ] `src/hooks/useDashboardRealtimeSync.ts` - Realtime subscriptions
  - Subscribe to 6 tables
  - Debounce 500ms
  - Trigger callback on update

- [ ] `src/hooks/useDashboardCalculations.ts` - Calculate KPIs and chart data
  - calculateKPIs() - All 4 KPIs with exact web logic
  - calculateMonthlyRevenueExpenses() - For line chart
  - calculateExpenseCategories() - For bar chart
  - calculateTopVehicles() - For dual-axis chart
  - calculateFleetStatus() - For donut chart
  - calculateCapacityComparison() - For comparison charts
  - calculateOutstandingPayments()
  - getRecentBookings()

### Phase 2: Components ✅
- [ ] `src/components/kpi/KPICard.tsx` - Reusable KPI card
  - Props: title, value, subtitle, icon, iconColor, onPress
  - Styled with shadow and gradient
  - TouchableOpacity wrapper

- [ ] `src/components/charts/RevenueExpensesChart.tsx` - Line chart
  - Victory Native LineChart
  - Filter UI above chart
  - Independent filter state
  - Clickable legend
  - Blue/Red lines

- [ ] `src/components/charts/ExpenseCategoriesChart.tsx` - Bar chart
  - Victory Native BarChart
  - Filter UI above chart
  - Independent filter state
  - Sorted descending

- [ ] `src/components/charts/TopVehiclesChart.tsx` - Dual-axis bar chart
  - VictoryChart with VictoryGroup
  - Dual Y-axes
  - Filter UI with time + capacity
  - Color-coded by capacity

- [ ] `src/components/charts/FleetStatusChart.tsx` - Donut chart
  - VictoryPie with innerRadius
  - Color-coded by status
  - Center label

- [ ] `src/components/charts/CapacityComparisonChart.tsx` - Comparison bars
  - Two side-by-side bar charts
  - Revenue + Trips

- [ ] `src/components/widgets/OutstandingPaymentsCard.tsx`
  - Display amount + count
  - TouchableOpacity for detail view

- [ ] `src/components/widgets/RecentBookingsWidget.tsx`
  - List of recent bookings
  - Status badges
  - Formatted dates

### Phase 3: Main Screen ✅
- [ ] `src/screens/DashboardScreen.tsx`
  - SafeAreaView + ScrollView
  - Pull-to-refresh
  - Global filters (month, currency)
  - All KPI cards
  - All charts
  - All widgets
  - Loading states
  - Error handling

### Phase 4: Navigation ✅
- [ ] `App.tsx`
  - React Navigation setup
  - Bottom tabs
  - Dashboard as home screen

### Phase 5: Verification ✅
- [ ] `src/lib/dashboardSync.ts` - Diagnostic logging
  - Log all KPI values
  - Log all chart data points
  - Log filter states
  - Log exchange rates used
  - Compare with web Dashboard

---

## 🔍 VERIFICATION REQUIREMENTS

Before completing, verify:

1. **KPI Parity**
   - [ ] Total Revenue matches web (within $1 due to rounding)
   - [ ] Total Expenses matches web (within $1 due to rounding)
   - [ ] Fleet Utilization percentage matches web exactly
   - [ ] Active Bookings count matches web exactly

2. **Chart Data Parity**
   - [ ] Revenue vs Expenses: All 12 months match web values
   - [ ] Expense Categories: All categories + amounts match web
   - [ ] Top Vehicles: Top 10 vehicles + revenue + trips match web
   - [ ] Fleet Status: All status counts match web
   - [ ] Capacity Comparison: 7S vs 5S totals match web

3. **Filter Behavior**
   - [ ] Global dashboard filter affects KPIs correctly
   - [ ] Each chart's independent filter works correctly
   - [ ] Currency conversion matches web exactly
   - [ ] Month/Year selectors work correctly

4. **Realtime Updates**
   - [ ] Data refreshes when any of 6 tables update
   - [ ] Debounce works (no rapid refetches)
   - [ ] Pull-to-refresh works

5. **UI/UX**
   - [ ] All charts render smoothly
   - [ ] No placeholder or mock data
   - [ ] Empty states handled
   - [ ] Loading states shown
   - [ ] Responsive on all screen sizes

---

## 🚀 EXECUTION INSTRUCTIONS FOR VIBECODE

### Step 1: Read the Web Dashboard
First, thoroughly read and analyze:
- `d:\Projects\Jackalwild\Jackaldashboard\safari-ops-central\src\components\tabs\HomeDashboard.tsx` (focus on lines 535-2711)

### Step 2: Implement Data Layer
Create the three core hooks:
1. `useDashboardData.ts` - All Supabase queries
2. `useDashboardRealtimeSync.ts` - Realtime subscriptions
3. `useDashboardCalculations.ts` - All calculation logic (EXACT replicas of web)

### Step 3: Implement Components
Create all chart and widget components using Victory Native.

### Step 4: Implement Main Screen
Assemble everything in `DashboardScreen.tsx`.

### Step 5: Test & Verify
Run diagnostic logging to compare mobile vs web values.

---

## 💡 CRITICAL REMINDERS

1. **DO NOT** approximate or simplify calculations
2. **DO NOT** use placeholder data
3. **DO NOT** mix filter contexts (global vs independent)
4. **DO** use exact same Supabase queries as web
5. **DO** convert all amounts to USD before aggregating
6. **DO** convert back to display currency after aggregating
7. **DO** exclude CR duplicates from expense transactions
8. **DO** use amount_usd when available for CRs
9. **DO** apply revenue eligibility criteria exactly
10. **DO** debounce realtime updates to 500ms

---

## ✅ SUCCESS CRITERIA

The mobile Dashboard is complete when:
- All KPI values match web Dashboard (verified side-by-side)
- All chart data matches web Dashboard (verified point-by-point)
- All filters work independently and correctly
- Currency conversion matches web exactly
- Realtime updates work smoothly
- UI is responsive and performant
- No TypeScript errors
- No runtime errors
- App runs on iOS and Android
- Pull-to-refresh works
- No mock or placeholder data

---

## 📞 SUPPORT

If you encounter any ambiguity or need clarification on calculations, refer back to:
- Web Dashboard: `HomeDashboard.tsx` (lines 535-2711)
- Implementation Spec: `IMPLEMENTATION_SPEC.md`
- Utility functions: `src/lib/utils.ts`

The web Dashboard is the source of truth. When in doubt, match the web logic exactly.

---

## 🎯 FINAL DELIVERABLE

A complete, production-ready React Native mobile Dashboard that is a **pixel-perfect, calculation-perfect, behavior-perfect replica** of the web Dashboard.

The Dashboard must pass a 1:1 parity verification test where all values match exactly.

**Good luck! Build with precision. 🚀**
