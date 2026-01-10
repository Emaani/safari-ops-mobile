# VIBECODE PROMPT: Build Remaining Mobile App Tabs

## 🎯 OBJECTIVE
Build 5 additional tabs for the Safari Ops Mobile App to match the web application exactly. Use the same data fetching patterns that work for Fleet Utilization in the Dashboard.

---

## ✅ WHAT'S WORKING (Use as Reference)

**Dashboard Tab - Fleet Utilization Card**
- **Status**: ✅ WORKING PERFECTLY
- **Data Source**: `vehicles` table from Supabase
- **Query**: `supabase.from('vehicles').select('*')`
- **Calculation**: Count by status (booked, rented, available, maintenance, out_of_service)
- **Why it works**: Uses same pattern that should work for all tabs

**Key Success Pattern:**
```typescript
// This pattern WORKS - use it everywhere:
const { data: vehicles } = await supabase
  .from('vehicles')
  .select('id, license_plate, make, model, capacity, status');

// Calculate from fetched data
const vehiclesHired = vehicles.filter(v => v.status === 'booked' || v.status === 'rented').length;
```

---

## 📋 TABS TO BUILD

### 1. Fleet Tab ⚙️
**Purpose**: Complete fleet management and vehicle details

**Features Required**:
- **Vehicle List** (like web Fleet Management tab)
  - All vehicles with status badges
  - License plate, make, model, capacity
  - Current driver assignment
  - Maintenance status
  - Search and filter by status

- **Vehicle Details View** (modal/screen)
  - Full vehicle information
  - Maintenance history
  - Booking history
  - Current status
  - Driver assignment

- **Quick Stats Cards**
  - Total Fleet Count
  - Available Now
  - On Safari
  - In Maintenance
  - Out of Service

- **Maintenance Tracker**
  - Upcoming maintenance
  - Overdue maintenance
  - Maintenance costs (last 30 days)

**Data Sources** (use same patterns as Fleet Utilization):
```typescript
// Vehicles
await supabase.from('vehicles').select('*')

// Repairs
await supabase.from('repairs').select('*').eq('vehicle_id', vehicleId)

// Bookings (for vehicle history)
await supabase.from('bookings').select('*').eq('assigned_vehicle_id', vehicleId)
```

---

### 2. Bookings Tab 📅
**Purpose**: Complete booking management

**Features Required**:
- **Bookings List** (filterable)
  - All bookings with status badges
  - Client name, dates, vehicle assigned
  - Amount paid vs total cost
  - Filter by status: All, Confirmed, In-Progress, Completed, Pending
  - Search by booking number or client

- **Booking Details View** (modal/screen)
  - Full booking information
  - Client details
  - Vehicle assignment
  - Payment status
  - Dates and itinerary
  - Documents/receipts

- **Quick Stats Cards**
  - Total Bookings (current month)
  - Active Bookings
  - Confirmed Bookings
  - Pending Approvals
  - Revenue (current month)

- **Calendar View** (optional, nice-to-have)
  - Monthly calendar with bookings
  - Color-coded by status

**Data Sources**:
```typescript
// Bookings
await supabase.from('bookings').select(`
  *,
  profiles:assigned_user_id(full_name),
  clients:actual_client_id(company_name),
  vehicles:assigned_vehicle_id(license_plate, make, model)
`)

// Filter by status
.eq('status', selectedStatus)
```

---

### 3. Safari Tab 🦁
**Purpose**: Safari-specific operations and tracking

**Features Required**:
- **Active Safaris**
  - Currently ongoing safaris
  - Safari details (destination, dates)
  - Vehicle assigned
  - Driver assigned
  - Client information

- **Safari History**
  - Completed safaris
  - Performance metrics
  - Client feedback/ratings

- **Safari Planning**
  - Upcoming safaris (next 7/30 days)
  - Vehicle availability check
  - Driver availability

- **Quick Stats Cards**
  - Active Safaris Today
  - Completed This Month
  - Upcoming This Week
  - Average Safari Duration

**Data Sources**:
```typescript
// Safari Bookings (if table exists)
await supabase.from('safari_bookings').select('*')

// OR use bookings table filtered for safari type
await supabase.from('bookings')
  .select('*')
  .eq('booking_type', 'safari') // if such column exists
```

---

### 4. Finance Tab 💰
**Purpose**: Financial tracking and reports

**Features Required**:
- **Financial Overview Cards**
  - Total Revenue (MTD/YTD)
  - Total Expenses (MTD/YTD)
  - Net Profit (MTD/YTD)
  - Outstanding Payments

- **Transactions List**
  - All financial transactions
  - Filter by type (income/expense)
  - Filter by date range
  - Search by description/reference

- **Transaction Details View**
  - Full transaction information
  - Category, amount, date
  - Reference number
  - Related booking/CR

- **Cash Requisitions List**
  - All CRs with status
  - Filter by status
  - Amount and category
  - Approval status

- **Charts**
  - Monthly revenue trend
  - Expense categories breakdown
  - Income vs expenses comparison

**Data Sources** (SAME AS DASHBOARD):
```typescript
// Transactions
await supabase.from('financial_transactions').select('*')

// Cash Requisitions
await supabase.from('cash_requisitions')
  .select('*')
  .eq('soft_deleted', false)
```

---

### 5. More Tab ⚙️
**Purpose**: Settings, profile, and additional features

**Features Required**:
- **Profile Section**
  - User name and email
  - Profile picture
  - Role/permissions

- **Settings**
  - Currency preference (USD/UGX/KES)
  - Notification settings
  - Language (if multi-language)
  - Theme (light/dark if implemented)

- **Quick Actions**
  - Create New Booking (navigate to form)
  - Add Vehicle (navigate to form)
  - Submit CR (navigate to form)
  - Generate Report

- **App Information**
  - Version number
  - Last sync time
  - About Safari Ops
  - Help & Support

- **Logout Button**

**Data Sources**:
```typescript
// User Profile
await supabase.from('profiles').select('*').eq('id', userId).single()

// App Settings (local storage)
AsyncStorage.getItem('settings')
```

---

## 🛠️ TECHNICAL REQUIREMENTS

### Use Existing Infrastructure ✅
All tabs MUST use the existing working patterns:

1. **Supabase Client**: `src/lib/supabase.ts` (already configured)
2. **Type Definitions**: Add new types to `src/types/dashboard.ts`
3. **Utility Functions**: Use `src/lib/utils.ts` for formatting
4. **Currency Conversion**: Use `src/hooks/useExchangeRate.ts`

### Data Fetching Pattern (FROM WORKING FLEET UTILIZATION)
```typescript
// Create dedicated hooks for each tab
// Example: src/hooks/useFleetData.ts

export function useFleetData() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = useCallback(async () => {
    console.log('[FleetData] Fetching vehicles...');

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('license_plate');

    if (error) {
      console.error('[FleetData] Error:', error);
      return;
    }

    console.log(`[FleetData] Fetched ${data.length} vehicles`);
    setVehicles(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, []);

  return { vehicles, loading, refetch: fetchVehicles };
}
```

### Real-time Sync Pattern
```typescript
// Use existing useDashboardRealtimeSync pattern
// Example: useFleetRealtimeSync

export function useFleetRealtimeSync(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('fleet-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => {
          console.log('[FleetSync] Vehicle data changed');
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
```

### Component Structure
```
src/
├── screens/
│   ├── DashboardScreen.tsx ✅ (already built)
│   ├── FleetScreen.tsx (NEW)
│   ├── BookingsScreen.tsx (NEW)
│   ├── SafariScreen.tsx (NEW)
│   ├── FinanceScreen.tsx (NEW)
│   └── MoreScreen.tsx (NEW)
├── components/
│   ├── fleet/
│   │   ├── VehicleCard.tsx
│   │   ├── VehicleDetailModal.tsx
│   │   └── MaintenanceTracker.tsx
│   ├── bookings/
│   │   ├── BookingCard.tsx
│   │   ├── BookingDetailModal.tsx
│   │   └── StatusBadge.tsx
│   ├── safari/
│   │   ├── SafariCard.tsx
│   │   └── SafariDetailModal.tsx
│   └── finance/
│       ├── TransactionCard.tsx
│       ├── CRCard.tsx
│       └── FinancialCharts.tsx
└── hooks/
    ├── useDashboardData.ts ✅ (already built)
    ├── useFleetData.ts (NEW)
    ├── useBookingsData.ts (NEW)
    ├── useSafariData.ts (NEW)
    └── useFinanceData.ts (NEW)
```

---

## 🎨 UI/UX REQUIREMENTS

### Consistent Design
- **Colors**: Match Dashboard exactly
- **Spacing**: 16px padding, 12px gap between cards
- **Fonts**: Same as Dashboard (system default)
- **Cards**: White background, rounded corners (12px), shadow
- **Status Badges**: Color-coded (green=active, blue=confirmed, red=cancelled, etc.)

### Navigation
Update `App.tsx` to include all tabs:
```typescript
<Tab.Navigator>
  <Tab.Screen name="Dashboard" component={DashboardScreen} />
  <Tab.Screen name="Fleet" component={FleetScreen} />
  <Tab.Screen name="Bookings" component={BookingsScreen} />
  <Tab.Screen name="Safari" component={SafariScreen} />
  <Tab.Screen name="Finance" component={FinanceScreen} />
  <Tab.Screen name="More" component={MoreScreen} />
</Tab.Navigator>
```

### Tab Icons
Use simple SVG icons (similar to Dashboard icon):
- Fleet: Truck icon
- Bookings: Calendar icon
- Safari: Compass/Map icon
- Finance: Dollar sign icon
- More: Three dots icon

---

## 🔍 CRITICAL DEBUGGING

### Add Comprehensive Logging (like Dashboard)
Every screen MUST have:
```typescript
console.log('[ScreenName] Component mounted');
console.log('[ScreenName] Fetching data...');
console.log('[ScreenName] Fetched X items');
console.log('[ScreenName] Error:', error);
```

### Handle Empty States
```typescript
{loading && <ActivityIndicator />}
{!loading && data.length === 0 && (
  <Text>No items found</Text>
)}
{!loading && data.length > 0 && (
  <FlatList data={data} ... />
)}
```

### Handle Errors Gracefully
```typescript
{error && (
  <View>
    <Text>Error loading data</Text>
    <Button title="Retry" onPress={refetch} />
  </View>
)}
```

---

## ✅ IMPLEMENTATION CHECKLIST

For EACH tab:
- [ ] Create screen component
- [ ] Create data hook (useXData)
- [ ] Create real-time sync hook (useXRealtimeSync)
- [ ] Add comprehensive logging
- [ ] Add loading states
- [ ] Add empty states
- [ ] Add error states
- [ ] Add pull-to-refresh
- [ ] Create reusable card components
- [ ] Add navigation tab icon
- [ ] Test on iOS
- [ ] Test on Android
- [ ] Verify data matches web app

---

## 🚀 DELIVERABLES

1. **5 Complete Tab Screens** (Fleet, Bookings, Safari, Finance, More)
2. **Data Hooks** for each tab
3. **Reusable Components** (cards, modals, lists)
4. **Updated Navigation** with all tabs
5. **Tab Icons** (SVG)
6. **Comprehensive Logging** for debugging
7. **Documentation** for each tab

---

## 📊 SUCCESS CRITERIA

The mobile app is complete when:
- ✅ All 6 tabs functional (Dashboard + 5 new)
- ✅ Data fetches successfully on all tabs
- ✅ Real-time updates work on all tabs
- ✅ UI matches web app design
- ✅ No crashes or errors
- ✅ Loading/empty/error states handled
- ✅ Pull-to-refresh works on all tabs
- ✅ Navigation between tabs smooth
- ✅ Works on iOS and Android

---

## 🔥 FINAL DIRECTIVE

Build all 5 tabs using the EXACT SAME PATTERN that makes Fleet Utilization work in the Dashboard.

**DO NOT:**
- Change the Supabase client configuration
- Use different query patterns
- Skip logging
- Skip error handling

**DO:**
- Copy the working Fleet Utilization fetch pattern
- Add comprehensive logging everywhere
- Handle all edge cases (loading, empty, error)
- Use existing infrastructure (hooks, utils, types)
- Match web app functionality exactly

**Build until all tabs are production-ready. 🚀**
