# Safari Ops – Figma Export Guide

## Design Tokens → Figma

### Option A: Token Studio (Recommended)
1. Install the **Token Studio** plugin in Figma
2. Open plugin → **Load from file** → select `figma/tokens.json`
3. Apply tokens — colors, spacing, typography, and radii will auto-populate your Figma variables
4. Use **Sync** to keep tokens updated as you iterate

### Option B: Figma Variables (native, Figma v117+)
1. In Figma, open **Local Variables** panel
2. Manually create Color, Number, and String variables matching `tokens.json`
3. Group by the token path (e.g. `color/brand/primary`)

---

## Android Jetpack Compose → Figma (Google Relay)

1. Install the **Relay for Figma** plugin:
   `https://www.figma.com/community/plugin/1095441495163427612/relay-for-figma`

2. In Android Studio, add the Relay Gradle plugin:
   ```kotlin
   // build.gradle.kts (module)
   plugins {
       id("com.google.relay") version "0.3.12"
   }
   ```

3. Every `@Composable` marked with `@Preview` in this project can be pushed to Figma
   using Relay's **Generate UI Package** flow:
   - Right-click the composable file → **Relay** → **Push to Figma**
   - Figma will create a matching component frame

4. Key composables ready for Relay export:
   - `KpiCard` → Figma: "KPI Card"
   - `StatusBadge` → Figma: "Status Badge"
   - `SoFilterChip` → Figma: "Filter Chip"
   - `BookingCard` → Figma: "Booking Card"
   - `VehicleCard` → Figma: "Vehicle Card"
   - `TransactionCard` → Figma: "Transaction Card"
   - `FinanceSummaryCard` → Figma: "Finance Summary Card"
   - `AvatarInitials` → Figma: "Avatar"
   - `EmptyState` → Figma: "Empty State"
   - `SoPrimaryButton` → Figma: "Primary Button"

---

## iOS SwiftUI → Figma

SwiftUI doesn't have a Relay equivalent, but use these approaches:

### Option 1: Screenshots → Figma
1. Run the iOS app in Xcode Simulator (any iPhone 15 Pro simulator)
2. Screenshot each screen (`Cmd+S` in Simulator)
3. Paste into Figma and trace/redraw components using token values

### Option 2: Inspect preview colors manually
- All SwiftUI colors use `AppColors.swift` tokens which map 1:1 to `tokens.json`
- Match `Color.soBlue` → `#3B82F6`, etc.

### Option 3: SwiftUI Introspect + Figma
- Use the **SwiftUI Introspect** approach with a custom Figma exporter (community tools in beta)

---

## Recommended Figma File Structure

```
Safari Ops Mobile
├── 📁 Design Tokens        ← import tokens.json here
├── 📁 Components           ← atoms & molecules
│   ├── KPI Card
│   ├── Status Badge
│   ├── Filter Chip
│   ├── Search Bar
│   ├── Booking Card
│   ├── Vehicle Card
│   ├── Transaction Card
│   ├── Avatar
│   ├── Primary Button
│   └── Empty State
├── 📁 Screens – iOS
│   ├── Login
│   ├── Dashboard
│   ├── Bookings
│   ├── Fleet
│   ├── Finance
│   └── Settings
└── 📁 Screens – Android
    ├── Login
    ├── Dashboard
    ├── Bookings
    ├── Fleet
    ├── Finance
    └── Settings
```
