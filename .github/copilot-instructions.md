# Safari Ops Mobile Dashboard - Copilot Instructions

## Project Overview
React Native (Expo) mobile dashboard - a **1:1 replica** of the web Safari Ops Dashboard. Fetches data from Supabase with real-time subscriptions, renders 4 KPI cards and 5 interactive charts, supports multi-currency (USD/UGX/KES) with dynamic exchange rates.

## Architecture Essentials

### Data Flow Architecture
1. **Data Layer** (`useDashboardData.ts`): Fetches from 5 core Supabase tables (vehicles, bookings, repairs, financial_transactions, cash_requisitions) with monthly filtering via `matchesDashboardFilter` utility
2. **Real-time Subscriptions** (`useDashboardRealtimeSync.ts`): 500ms debounced updates across 6 tables, debouncing prevents excessive re-renders
3. **Calculations** (`useDashboardCalculations.ts`): Uses `useMemo` extensively to compute KPIs and chart data from raw data
4. **Display** (`DashboardScreen.tsx`): Consumes hooks, renders KPI cards, charts, and widgets with filter controls

### Key Service Boundaries
- **Supabase Client** (`lib/supabase.ts`): Single instance with AsyncStorage persistence for React Native
- **Currency Conversion** (`useExchangeRate.ts`): Fetches exchange rates on mount, provides `convertToBaseCurrency` (USD) and `convertFromBaseCurrency` functions
- **Type Definitions** (`types/dashboard.ts`): Mirrors web schema exactly - critical for Supabase joins

### Critical Patterns

#### 1. Filter Matching - "Global Filter"
```typescript
// In useDashboardData.ts, all fetches use matchesDashboardFilter:
const records = data.filter(r => matchesDashboardFilter(r.transaction_date, dashboardMonthFilter, dashboardFilterYear))
// dashboardMonthFilter: 0-11 for specific month, 'all' for all months
// This prevents filtering at multiple layers - FILTER ONCE in data fetching
```

#### 2. Real-time Sync Pattern
- Subscribe to 6 tables: `bookings`, `vehicles`, `repairs`, `cash_requisitions`, `financial_transactions`, `exchange_rates`
- **500ms debounce** prevents hammering re-fetches during bulk updates
- Debounce timer managed in `useRef` - clear before setting new timer
- Cleanup subscriptions in useEffect return

#### 3. Calculations with useMemo
- `useDashboardCalculations.ts` computes everything via `useMemo` with complete dependency arrays
- Returns: `KPIValues`, `monthlyData`, `expenseCategoryData`, `vehicleRevenueData`, etc.
- Dependencies include: vehicles, bookings, repairs, financialTransactions, cashRequisitions, conversionRates, displayCurrency, all filter states
- **Never** mutate original data arrays - always `.filter()`, `.map()`, `.reduce()`

#### 4. Multi-Currency Pattern
```typescript
// All amounts stored in database as original currency (amount, currency fields)
// Convert to USD in calculations: convertToBaseCurrency(amount, sourceCurrency, conversionRates)
// Display: convertFromBaseCurrency(usdAmount, displayCurrency, conversionRates)
// Exchange rates from exchange_rates table, fetched on component mount
```

#### 5. Component Composition
- **KPICard**: Takes `value`, `label`, `currency` props, formats via `formatCurrency(amount, currency)`
- **Charts** (Victory Native): Take pre-computed data arrays, chart-specific props (e.g., `expenseCategoryData: {category, amount}[]`)
- **Widgets**: OutstandingPaymentsCard, RecentBookingsWidget - self-contained, consume pre-calculated data

## Developer Workflows

### Setup & Running
```bash
npm install
npm start              # Starts Expo dev server
npm run android/ios    # Launch on simulator/emulator
# Press 'i'/'a'/'w' in terminal for iOS/Android/Web respectively
```

### Adding New Data
1. Add table to `types/dashboard.ts` (follow existing interfaces)
2. Add fetch function to `useDashboardData.ts`
3. Add filter logic: `records.filter(r => matchesDashboardFilter(...))`
4. Add real-time subscription to `useDashboardRealtimeSync.ts` (table name)
5. Update `useDashboardCalculations.ts` return type and calculations

### Adding New Charts
1. Create component in `src/components/charts/YourChart.tsx` using Victory Native
2. Compute data in `useDashboardCalculations.ts` as new return property
3. Render in `DashboardScreen.tsx` with computed data
4. Example data structure: `{label: string, amount: number, fill?: string}[]`

### Debugging Tips
- All data fetches log `[DashboardData #${fetchId}]` - search console for fetch ID progression
- Real-time updates log `[Dashboard Realtime] table changed: INSERT|UPDATE|DELETE`
- Filter behavior logged via `matchesDashboardFilter` calls
- Use `console.log` with prefixes for feature debugging, they'll be visible in Expo CLI

## Project-Specific Conventions

### Naming & Structure
- Hooks follow `use[Feature]` pattern: `useDashboardData`, `useDashboardCalculations`, `useDashboardRealtimeSync`
- Components follow feature-based organization: `components/charts/`, `components/kpi/`, `components/widgets/`
- Screen files named `[Feature]Screen.tsx`
- Types co-located in `types/` folder - don't scatter types across files

### Import Ordering
```typescript
// React & React Native
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';

// Third-party
import { supabase } from '../lib/supabase';

// Project hooks
import { useDashboardData } from '../hooks/useDashboardData';

// Project components
import { KPICard } from '../components/kpi/KPICard';

// Types
import type { Currency } from '../types/dashboard';
```

### Styling
- No CSS frameworks - use `StyleSheet.create()` with inline styles
- Color constants in component files (e.g., `COLORS` object in DashboardScreen)
- Responsive sizing via `Dimensions.get('window').width`
- All colors hex codes (e.g., `#3b82f6`, `#f3f4f6`)

## External Dependencies
- **Supabase** (`@supabase/supabase-js`): PostgreSQL backend, real-time subscriptions
- **React Navigation** (`@react-navigation/bottom-tabs`): Tab-based navigation (future: multi-tab support)
- **Victory Native** (`victory-native`): Charting library for React Native
- **Expo** (`expo`): Framework and dev server

## Red Flags & Gotchas
1. **Double-fetching on startup**: Check `hasFetchedRef` logic in `useDashboardData` to avoid redundant requests
2. **Filter year type mismatch**: `dashboardFilterYear` is `number`, not string - check comparisons
3. **Chart data format**: Victory Native charts expect specific data structures - see component props
4. **Supabase joins**: Only works with select statements like `select('...', 'tableName(columns)')`
5. **Real-time debounce**: If updates feel laggy, increase `DEBOUNCE_MS` (currently 500ms)
6. **Currency not set**: Always initialize `selectedCurrency` state before rendering KPI cards

## File Reference Map
- **Data fetching**: `src/hooks/useDashboardData.ts`
- **Real-time logic**: `src/hooks/useDashboardRealtimeSync.ts`
- **All calculations**: `src/hooks/useDashboardCalculations.ts`
- **Exchange rates**: `src/hooks/useExchangeRate.ts`
- **Utilities**: `src/lib/utils.ts` (filter matching, formatting, normalization)
- **Main screen**: `src/screens/DashboardScreen.tsx` (717 lines - entry point)
- **Type definitions**: `src/types/dashboard.ts` (143 lines)
