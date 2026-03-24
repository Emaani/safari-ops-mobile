# Safari Ops Mobile - Native Conversion Strategy
## React Native/Expo → iOS (SwiftUI) + Android (Kotlin)

**Date**: March 24, 2026  
**Current Stack**: React Native (Expo), TypeScript  
**Target Stack**: iOS (SwiftUI) + Android (Kotlin with Jetpack Compose)  
**Estimated Timeline**: 12-18 weeks (phased approach)

---

## Executive Summary

This is a **full rewrite** from cross-platform to native, not a migration. The decision trades shared code for platform-native performance, UI polish, and leverage of native SDKs. Both platforms share identical **business logic and data layer** (refactored into platform-agnostic modules), while UI/Navigation/Platform integration are 100% native.

### Why Native?
- ✅ Superior performance (especially for charting/animations)
- ✅ Native platform conventions (iOS SwiftUI, Android Material Design)
- ✅ Better offline support & battery optimization
- ✅ Simpler debugging & deployment
- ❌ 2x codebase maintenance
- ❌ Longer development per feature (iOS + Android parallel)

---

## Phase 1: Architecture Refactoring (Weeks 1-2)

### Goal
Extract all business logic into **platform-agnostic shared modules** so iOS & Android can import the same data layer.

### 1.1 Create Shared Modules Package

```
safari-ops-shared/
├── Package.swift (iOS SPM)
├── build.gradle (Android Gradle)
├── src/
│   ├── models/
│   │   ├── Vehicle.swift / Vehicle.kt
│   │   ├── Booking.swift / Booking.kt
│   │   ├── FinancialTransaction.swift / FinancialTransaction.kt
│   │   ├── Repair.swift / Repair.kt
│   │   └── CashRequisition.swift / CashRequisition.kt
│   ├── services/
│   │   ├── AuthService.swift / AuthService.kt
│   │   ├── SupabaseClient.swift / SupabaseClient.kt
│   │   ├── CurrencyService.swift / CurrencyService.kt
│   │   └── OfflineStorageService.swift / OfflineStorageService.kt
│   ├── repositories/
│   │   ├── VehicleRepository.swift / VehicleRepository.kt
│   │   ├── BookingRepository.swift / BookingRepository.kt
│   │   ├── FinanceRepository.swift / FinanceRepository.kt
│   │   └── RealTimeRepository.swift / RealTimeRepository.kt
│   ├── utilities/
│   │   ├── FilterMatchingUtility.swift / FilterMatchingUtility.kt
│   │   ├── CurrencyConverter.swift / CurrencyConverter.kt
│   │   ├── DateFormatter.swift / DateFormatter.kt
│   │   └── ValidationUtils.swift / ValidationUtils.kt
│   └── viewmodels/ (Shared calculation logic, NOT UI)
│       ├── DashboardViewModel.swift / DashboardViewModel.kt
│       ├── BookingViewModel.swift / BookingViewModel.kt
│       ├── FleetViewModel.swift / FleetViewModel.kt
│       └── FinanceViewModel.swift / FinanceViewModel.kt
└── README.md
```

### 1.2 Port Existing Code to Shared Layer

**Start with**:
1. `src/types/dashboard.ts` → Models (Vehicle, Booking, etc.)
2. `sdk/auth/AuthService.ts` → AuthService.swift / AuthService.kt
3. `src/lib/utils.ts` (matchesDashboardFilter, formatCurrency) → Utility classes
4. Calculation hooks → ViewModel classes (DashboardViewModel, etc.)

**Critical Pattern: State Management via ViewModels**

Instead of React hooks like `useDashboardData`, create **ViewModel** classes that:
- Manage state (vehicles, bookings, filter state)
- Handle data fetching & caching
- Provide Observable streams (Swift Combine / Kotlin StateFlow)
- Calculate derived values (KPIs, chart data)

Example structure (both platforms):
```swift
// iOS: DashboardViewModel.swift
class DashboardViewModel: ObservableObject {
    @Published var vehicles: [Vehicle] = []
    @Published var bookings: [Booking] = []
    @Published var financialTransactions: [FinancialTransaction] = []
    @Published var kpiValues: KPIValues?
    @Published var loading: Bool = false
    @Published var error: Error?
    
    private let vehicleRepository: VehicleRepository
    private let bookingRepository: BookingRepository
    
    func loadDashboard(monthFilter: Int?, year: Int) async {
        // Shared logic from useDashboardData.ts
    }
    
    func refreshRealtimeData() async {
        // Shared real-time sync logic
    }
}
```

```kotlin
// Android: DashboardViewModel.kt
class DashboardViewModel(
    private val vehicleRepository: VehicleRepository,
    private val bookingRepository: BookingRepository
) : ViewModel() {
    private val _vehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    val vehicles = _vehicles.asStateFlow()
    
    private val _kpiValues = MutableStateFlow<KPIValues?>(null)
    val kpiValues = _kpiValues.asStateFlow()
    
    fun loadDashboard(monthFilter: Int?, year: Int) {
        // Shared logic from useDashboardData.ts
    }
}
```

### 1.3 Supabase Client Abstraction

Create a **single abstraction layer** for Supabase that both platforms use:

```swift
// SupabaseClient.swift (shared)
protocol SupabaseClientProtocol {
    func authenticate(email: String, password: String) async throws -> AuthSession
    func fetchVehicles() async throws -> [Vehicle]
    func fetchBookings(monthFilter: Int?, year: Int) async throws -> [Booking]
    func subscribeToRealtimeUpdates(onUpdate: @escaping (RealtimeEvent) -> Void) -> Cancellable
}

class SupabaseClient: SupabaseClientProtocol {
    private let supabase: SupabaseClientSwift
    // Implementation
}
```

```kotlin
// SupabaseClient.kt (shared)
interface SupabaseClientInterface {
    suspend fun authenticate(email: String, password: String): AuthSession
    suspend fun fetchVehicles(): List<Vehicle>
    suspend fun fetchBookings(monthFilter: Int?, year: Int): List<Booking>
    fun subscribeToRealtimeUpdates(onUpdate: (RealtimeEvent) -> Unit): Job
}

class SupabaseClient : SupabaseClientInterface {
    private val client = createSupabaseClient()
    // Implementation
}
```

---

## Phase 2: iOS Implementation (Weeks 3-8)

### 2.1 Project Setup

```bash
# Create Xcode project
xcode-select --install
sudo xcode-select --reset

# Use Xcode 16+ (for latest SwiftUI features)
# New → App → SwiftUI
# Team ID: [Your Apple Developer account]
# Bundle ID: com.jackaladventures.safari-ops-mobile
```

**Key Dependencies** (Swift Package Manager):
- `supabase-swift` (Supabase client)
- `SwiftProtobuf` (for real-time data)
- `Charts` (charting library - SwiftCharts or ChartsUI)
- `Combine` (native for reactive streams)
- `os/log` (logging)

### 2.2 Project Structure

```
safari-ops-ios/
├── SafariOps.xcodeproj/
├── SafariOps/
│   ├── App/
│   │   ├── SafariOpsApp.swift (entry point)
│   │   ├── AppDelegate.swift
│   │   └── SceneDelegate.swift
│   ├── Navigation/
│   │   ├── AppTabView.swift
│   │   ├── DashboardNavigationStack.swift
│   │   ├── BookingsNavigationStack.swift
│   │   └── MoreNavigationStack.swift
│   ├── Screens/
│   │   ├── Auth/
│   │   │   └── LoginView.swift
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.swift
│   │   │   ├── KPICardView.swift
│   │   │   └── DashboardCharts.swift (sub-views)
│   │   ├── Bookings/
│   │   ├── Fleet/
│   │   ├── Finance/
│   │   └── More/
│   ├── Components/
│   │   ├── Charts/
│   │   │   ├── MonthlyRevenueChart.swift
│   │   │   ├── ExpenseCategoryChart.swift
│   │   │   ├── VehicleRevenueChart.swift
│   │   │   └── BookingStatusChart.swift
│   │   ├── KPI/
│   │   │   └── KPICard.swift
│   │   ├── Widgets/
│   │   │   ├── OutstandingPaymentsWidget.swift
│   │   │   ├── RecentBookingsWidget.swift
│   │   │   └── CurrencySelector.swift
│   │   └── Common/
│   │       ├── LoadingView.swift
│   │       ├── ErrorView.swift
│   │       └── CustomButton.swift
│   ├── Managers/
│   │   ├── NotificationManager.swift
│   │   └── OfflineManager.swift
│   ├── Utilities/
│   │   ├── Constants.swift (colors, spacing, fonts)
│   │   ├── Extensions.swift
│   │   └── Formatters.swift
│   └── Previews/
│       └── PreviewData.swift
├── SafariOpsTests/
├── Podfile (optional, for iOS SDK dependencies)
└── Package.swift (SPM manifest)
```

### 2.3 Core SwiftUI Implementation

**Navigation Stack**:
```swift
// SafariOpsApp.swift
@main
struct SafariOpsApp: App {
    @StateObject var authManager = AuthManager()
    @StateObject var notificationManager = NotificationManager()
    
    var body: some Scene {
        WindowGroup {
            if authManager.isAuthenticated {
                AppTabView()
                    .environmentObject(authManager)
                    .environmentObject(notificationManager)
            } else {
                LoginView(authManager: authManager)
            }
        }
    }
}

// AppTabView.swift
struct AppTabView: View {
    @State var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardNavigationStack()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.pie.fill")
                }
                .tag(0)
            
            BookingsNavigationStack()
                .tabItem {
                    Label("Bookings", systemImage: "calendar")
                }
                .tag(1)
            
            FleetNavigationStack()
                .tabItem {
                    Label("Fleet", systemImage: "car.fill")
                }
                .tag(2)
            
            FinanceNavigationStack()
                .tabItem {
                    Label("Finance", systemImage: "dollarsign.circle.fill")
                }
                .tag(3)
            
            MoreNavigationStack()
                .tabItem {
                    Label("More", systemImage: "ellipsis")
                }
                .tag(4)
        }
    }
}
```

**Dashboard Screen**:
```swift
// DashboardView.swift
struct DashboardView: View {
    @StateObject private var viewModel: DashboardViewModel
    @State private var selectedMonth: Int? = Calendar.current.component(.month, from: Date()) - 1
    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var selectedCurrency: Currency = .usd
    
    init() {
        let vm = DashboardViewModel(
            vehicleRepository: VehicleRepository(),
            bookingRepository: BookingRepository(),
            financeRepository: FinanceRepository()
        )
        _viewModel = StateObject(wrappedValue: vm)
    }
    
    var body: some View {
        ZStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Filter Controls
                    FilterControlView(
                        selectedMonth: $selectedMonth,
                        selectedYear: $selectedYear,
                        onFilterChanged: { 
                            Task {
                                await viewModel.loadDashboard(
                                    monthFilter: selectedMonth,
                                    year: selectedYear
                                )
                            }
                        }
                    )
                    
                    CurrencySelectorView(
                        selectedCurrency: $selectedCurrency,
                        onCurrencyChanged: { 
                            viewModel.setDisplayCurrency(selectedCurrency)
                        }
                    )
                    
                    // KPI Cards
                    if let kpis = viewModel.kpiValues {
                        VStack(spacing: 12) {
                            KPICardView(
                                label: "Total Revenue",
                                value: kpis.totalRevenue,
                                currency: selectedCurrency
                            )
                            KPICardView(
                                label: "Total Expenses",
                                value: kpis.totalExpenses,
                                currency: selectedCurrency
                            )
                            KPICardView(
                                label: "Outstanding Payments",
                                value: kpis.outstandingPayments,
                                currency: selectedCurrency
                            )
                            KPICardView(
                                label: "Fleet Utilization",
                                value: kpis.fleetUtilization,
                                currency: .none
                            )
                        }
                        .padding(.horizontal)
                    }
                    
                    // Charts
                    MonthlyRevenueChart(data: viewModel.monthlyChartData)
                        .frame(height: 300)
                    ExpenseCategoryChart(data: viewModel.expenseCategoryData)
                        .frame(height: 300)
                    
                    // Widgets
                    OutstandingPaymentsWidget(payments: viewModel.outstandingPayments)
                    RecentBookingsWidget(bookings: viewModel.recentBookings)
                }
                .padding()
            }
            
            if viewModel.loading {
                LoadingView()
            }
        }
        .task {
            await viewModel.loadDashboard(
                monthFilter: selectedMonth,
                year: selectedYear
            )
        }
        .onChange(of: selectedMonth) { _, newMonth in
            Task {
                await viewModel.loadDashboard(
                    monthFilter: newMonth,
                    year: selectedYear
                )
            }
        }
    }
}
```

**KPI Card Component**:
```swift
// KPICardView.swift
struct KPICardView: View {
    let label: String
    let value: Double
    let currency: Currency
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.gray)
            
            Text(formatCurrency(value, currency: currency))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
```

### 2.4 Charting Implementation

Use **Apple Charts** (iOS 16+) or **SwiftCharts**:

```swift
// MonthlyRevenueChart.swift
import Charts

struct MonthlyRevenueChart: View {
    let data: [MonthlyChartDataPoint]
    
    var body: some View {
        Chart(data, id: \.month) { point in
            BarMark(
                x: .value("Month", point.month),
                y: .value("Revenue", point.amount)
            )
            .foregroundStyle(Color.blue)
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: 1)) { _ in
                AxisValueLabel()
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
```

### 2.5 Push Notifications (iOS)

```swift
// NotificationManager.swift
import UserNotifications

class NotificationManager: NSObject, ObservableObject {
    @Published var notificationPermission = false
    
    func requestNotificationPermission() async {
        do {
            try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            DispatchQueue.main.async {
                self.notificationPermission = true
            }
        } catch {
            print("Notification permission denied: \(error)")
        }
    }
    
    func registerForRemoteNotifications() {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}
```

---

## Phase 3: Android Implementation (Weeks 9-14)

### 3.1 Project Setup

```bash
# Android Studio 2024+
# File → New → New Project → Mobile → Phone and Tablet
# Language: Kotlin
# Minimum API: 28 (Android 9)
# Target API: 35+ (latest)
```

**Key Dependencies** (gradle):
```kotlin
dependencies {
    // Core
    implementation "androidx.appcompat:appcompat:1.7.0"
    implementation "androidx.core:core:1.13.0"
    
    // Jetpack Compose
    implementation "androidx.compose.ui:ui:1.7.0"
    implementation "androidx.compose.material3:material3:1.2.0"
    implementation "androidx.activity:activity-compose:1.8.0"
    implementation "androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0"
    implementation "androidx.compose.runtime:runtime-livedata:1.7.0"
    
    // Navigation
    implementation "androidx.navigation:navigation-compose:2.7.0"
    
    // Supabase
    implementation "io.github.supabase:postgres-kt:1.4.0"
    implementation "io.github.supabase:realtime-kt:1.4.0"
    
    // Coroutines & Flow
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.0"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.0"
    
    // Room (local database)
    implementation "androidx.room:room-runtime:2.6.0"
    ksp "androidx.room:room-compiler:2.6.0"
    
    // Data Store (secure preferences)
    implementation "androidx.datastore:datastore-preferences:1.0.0"
    
    // Charting
    implementation "com.github.PhilJay:MPAndroidChart:v3.1.0"
    // OR Vico Charts:
    implementation "com.patrykandpatrick.vico:compose:2.0.0"
    
    // Retrofit (optional, if needed alongside Supabase)
    implementation "com.squareup.retrofit2:retrofit:2.9.0"
    
    // JSON serialization
    implementation "org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.0"
}
```

### 3.2 Project Structure

```
safari-ops-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/jackaladventures/safariops/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── SafariOpsApp.kt
│   │   │   │   ├── navigation/
│   │   │   │   │   ├── AppNavigation.kt
│   │   │   │   │   └── NavGraphs.kt
│   │   │   │   ├── screens/
│   │   │   │   │   ├── auth/
│   │   │   │   │   │   └── LoginScreen.kt
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   ├── DashboardScreen.kt
│   │   │   │   │   │   └── DashboardComponents.kt
│   │   │   │   │   ├── bookings/
│   │   │   │   │   ├── fleet/
│   │   │   │   │   ├── finance/
│   │   │   │   │   └── more/
│   │   │   │   ├── ui/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── KPICard.kt
│   │   │   │   │   │   ├── ChartComponents.kt
│   │   │   │   │   │   └── WidgetComponents.kt
│   │   │   │   │   ├── charts/
│   │   │   │   │   │   ├── MonthlyRevenueChart.kt
│   │   │   │   │   │   ├── ExpenseCategoryChart.kt
│   │   │   │   │   │   └── VehicleRevenueChart.kt
│   │   │   │   │   ├── theme/
│   │   │   │   │   │   ├── Color.kt
│   │   │   │   │   │   ├── Type.kt
│   │   │   │   │   │   └── Theme.kt
│   │   │   │   │   └── utils/
│   │   │   │   │       ├── Formatters.kt
│   │   │   │   │       └── Extensions.kt
│   │   │   │   ├── viewmodels/
│   │   │   │   │   ├── DashboardViewModel.kt
│   │   │   │   │   ├── BookingViewModel.kt
│   │   │   │   │   └── AuthViewModel.kt
│   │   │   │   ├── data/
│   │   │   │   │   ├── repositories/
│   │   │   │   │   │   ├── VehicleRepository.kt
│   │   │   │   │   │   ├── BookingRepository.kt
│   │   │   │   │   │   └── FinanceRepository.kt
│   │   │   │   │   ├── local/
│   │   │   │   │   │   ├── AppDatabase.kt
│   │   │   │   │   │   └── DAOs/
│   │   │   │   │   └── remote/
│   │   │   │   │       └── SupabaseClientConfig.kt
│   │   │   │   └── di/
│   │   │   │       └── DependencyInjection.kt
│   │   │   └── res/
│   │   │       ├── values/
│   │   │       │   └── colors.xml
│   │   │       └── drawable/
│   │   └── test/
│   ├── build.gradle.kts
│   └── AndroidManifest.xml
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

### 3.3 Core Jetpack Compose Implementation

**Main App Entry Point**:
```kotlin
// SafariOpsApp.kt
@Composable
fun SafariOpsApp() {
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState by authViewModel.authState.collectAsState()
    
    SafariOpsTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            when (authState) {
                is AuthState.Authenticated -> {
                    AppNavigation()
                }
                else -> {
                    LoginScreen(viewModel = authViewModel)
                }
            }
        }
    }
}

// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SafariOpsApp()
        }
    }
}
```

**Navigation Structure**:
```kotlin
// AppNavigation.kt
@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Filled.BarChart, "Dashboard") },
                    label = { Text("Dashboard") },
                    selected = false,
                    onClick = { navController.navigate("dashboard") }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Filled.DateRange, "Bookings") },
                    label = { Text("Bookings") },
                    selected = false,
                    onClick = { navController.navigate("bookings") }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Filled.DirectionsCar, "Fleet") },
                    label = { Text("Fleet") },
                    selected = false,
                    onClick = { navController.navigate("fleet") }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Filled.AttachMoney, "Finance") },
                    label = { Text("Finance") },
                    selected = false,
                    onClick = { navController.navigate("finance") }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Filled.MoreVert, "More") },
                    label = { Text("More") },
                    selected = false,
                    onClick = { navController.navigate("more") }
                )
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "dashboard",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("dashboard") { DashboardScreen() }
            composable("bookings") { BookingsScreen() }
            composable("fleet") { FleetScreen() }
            composable("finance") { FinanceScreen() }
            composable("more") { MoreScreen() }
        }
    }
}
```

**Dashboard Screen**:
```kotlin
// DashboardScreen.kt
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val dashboardState by viewModel.dashboardState.collectAsState()
    var selectedMonth by remember { mutableStateOf<Int?>(null) }
    var selectedYear by remember { mutableStateOf(Calendar.getInstance().get(Calendar.YEAR)) }
    var selectedCurrency by remember { mutableStateOf(Currency.USD) }
    
    LaunchedEffect(selectedMonth, selectedYear) {
        viewModel.loadDashboard(selectedMonth, selectedYear)
    }
    
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            FilterControlRow(
                selectedMonth = selectedMonth,
                selectedYear = selectedYear,
                onMonthChange = { selectedMonth = it },
                onYearChange = { selectedYear = it }
            )
        }
        
        item {
            CurrencySelectorRow(
                selectedCurrency = selectedCurrency,
                onCurrencyChange = { 
                    selectedCurrency = it
                    viewModel.setDisplayCurrency(it)
                }
            )
        }
        
        when (dashboardState) {
            is DashboardState.Loading -> {
                item {
                    LoadingIndicator()
                }
            }
            is DashboardState.Success -> {
                val state = dashboardState as DashboardState.Success
                
                item {
                    KPICardsGrid(
                        kpiValues = state.kpiValues,
                        currency = selectedCurrency
                    )
                }
                
                item {
                    MonthlyRevenueChart(
                        data = state.monthlyChartData,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp)
                    )
                }
                
                item {
                    ExpenseCategoryChart(
                        data = state.expenseCategoryData,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp)
                    )
                }
                
                item {
                    OutstandingPaymentsWidget(payments = state.outstandingPayments)
                }
                
                item {
                    RecentBookingsWidget(bookings = state.recentBookings)
                }
            }
            is DashboardState.Error -> {
                item {
                    ErrorMessage(message = (dashboardState as DashboardState.Error).message)
                }
            }
        }
    }
}

// KPI Card Component
@Composable
fun KPICardView(
    label: String,
    value: Double,
    currency: Currency
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = formatCurrency(value, currency),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
```

**ViewModel Pattern**:
```kotlin
// DashboardViewModel.kt
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val vehicleRepository: VehicleRepository,
    private val bookingRepository: BookingRepository,
    private val financeRepository: FinanceRepository,
    private val currencyService: CurrencyService
) : ViewModel() {
    
    private val _dashboardState = MutableStateFlow<DashboardState>(DashboardState.Loading)
    val dashboardState: StateFlow<DashboardState> = _dashboardState.asStateFlow()
    
    fun loadDashboard(monthFilter: Int?, year: Int) {
        viewModelScope.launch {
            try {
                val vehicles = vehicleRepository.getVehicles()
                val bookings = bookingRepository.getBookings(monthFilter, year)
                val transactions = financeRepository.getTransactions(monthFilter, year)
                
                val kpiValues = calculateKPIs(vehicles, bookings, transactions)
                val monthlyData = calculateMonthlyData(bookings)
                
                _dashboardState.value = DashboardState.Success(
                    kpiValues = kpiValues,
                    monthlyChartData = monthlyData,
                    // ... other data
                )
            } catch (e: Exception) {
                _dashboardState.value = DashboardState.Error(e.message ?: "Unknown error")
            }
        }
    }
    
    fun setDisplayCurrency(currency: Currency) {
        // Recalculate with new currency
    }
}

sealed class DashboardState {
    object Loading : DashboardState()
    data class Success(
        val kpiValues: KPIValues,
        val monthlyChartData: List<MonthlyChartData>,
        val expenseCategoryData: List<ExpenseCategoryData>,
        val outstandingPayments: List<OutstandingPayment>,
        val recentBookings: List<Booking>
    ) : DashboardState()
    data class Error(val message: String) : DashboardState()
}
```

### 3.4 Charting (Android)

**Using Vico Charts** (modern, Compose-native):
```kotlin
// MonthlyRevenueChart.kt
@Composable
fun MonthlyRevenueChart(
    data: List<MonthlyChartData>,
    modifier: Modifier = Modifier
) {
    val chartData = data.map { 
        (it.month.toFloat() to it.amount.toFloat())
    }
    
    Chart(
        chart = lineChart(),
        model = entryModelOf(
            chartData.associate { (x, y) ->
                x to y
            }
        ),
        modifier = modifier
            .padding(16.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant)
    )
}
```

### 3.5 Push Notifications (Android)

```kotlin
// NotificationService.kt
class NotificationService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val notification = remoteMessage.notification
        showNotification(
            title = notification?.title ?: "Safari Ops",
            body = notification?.body ?: ""
        )
    }
    
    private fun showNotification(title: String, body: String) {
        val notificationManager = NotificationManagerCompat.from(this)
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_notification)
            .setAutoCancel(true)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
}

// In AndroidManifest.xml
<service android:name=".services.NotificationService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

---

## Phase 4: Feature Parity & Testing (Weeks 15-16)

### 4.1 Feature Checklist

| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| **Dashboard** | ✓ | ✓ | All KPI cards, charts, widgets |
| **Bookings** | ✓ | ✓ | List, filters, details |
| **Fleet** | ✓ | ✓ | Vehicle list, status, maintenance |
| **Finance** | ✓ | ✓ | Transactions, categories, reports |
| **More** | ✓ | ✓ | Settings, notifications, profile |
| **Auth** | ✓ | ✓ | Login, logout, session mgmt |
| **Real-time Sync** | ✓ | ✓ | 500ms debounce, all tables |
| **Multi-currency** | ✓ | ✓ | USD/UGX/KES, dynamic rates |
| **Offline Support** | ✓ | ✓ | Local caching, sync on reconnect |
| **Push Notifications** | ✓ | ✓ | Badge count, deep linking |

### 4.2 Testing Strategy

```
Test Pyramid:
├── Unit Tests (40%)
│   ├── Repository tests
│   ├── ViewModel calculations
│   └── Utility functions
├── Integration Tests (35%)
│   ├── Supabase client mocking
│   ├── Real-time subscription tests
│   └── Currency conversion tests
└── UI Tests (25%)
    ├── Screen navigation
    ├── Data display accuracy
    └── User interactions
```

**iOS Testing**:
```swift
// DashboardViewModelTests.swift
import XCTest

class DashboardViewModelTests: XCTestCase {
    var viewModel: DashboardViewModel!
    var mockVehicleRepository: MockVehicleRepository!
    
    override func setUp() {
        super.setUp()
        mockVehicleRepository = MockVehicleRepository()
        viewModel = DashboardViewModel(vehicleRepository: mockVehicleRepository)
    }
    
    @MainActor
    func testLoadDashboardSuccess() async {
        // Test successful load
        await viewModel.loadDashboard(monthFilter: nil, year: 2026)
        XCTAssertEqual(viewModel.vehicles.count, 10)
        XCTAssertNil(viewModel.error)
    }
}
```

**Android Testing**:
```kotlin
// DashboardViewModelTest.kt
class DashboardViewModelTest {
    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()
    
    private lateinit var viewModel: DashboardViewModel
    private lateinit var vehicleRepository: FakeVehicleRepository
    
    @Before
    fun setup() {
        vehicleRepository = FakeVehicleRepository()
        viewModel = DashboardViewModel(vehicleRepository)
    }
    
    @Test
    fun loadDashboard_success() = runTest {
        viewModel.loadDashboard(null, 2026)
        advanceUntilIdle()
        
        val state = viewModel.dashboardState.value
        assertThat(state).isInstanceOf(DashboardState.Success::class.java)
    }
}
```

---

## Phase 5: Deployment & Migration (Weeks 17-18)

### 5.1 App Store & Play Store Submission

**iOS**:
```bash
# Build for release
xcodebuild archive \
  -workspace safari-ops-ios.xcworkspace \
  -scheme SafariOps \
  -configuration Release \
  -archivePath ./build/SafariOps.xcarchive

# Upload to TestFlight first
xcrun altool --upload-app -f ./build/SafariOps.ipa \
  -t ios -u $APPLE_ID -p $APP_SPECIFIC_PASSWORD

# Then submit to App Store Connect via Xcode → Product → Archive
```

**Android**:
```bash
# Build release APK/AAB
./gradlew bundleRelease

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore safari-ops-release.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  release

# Optimize
zipalign -v 4 app-release-unsigned.apk app-release.apk

# Upload to Play Console
# Settings → App signing → Upload signed AAB
```

### 5.2 User Migration Strategy

1. **Soft Launch**: Release iOS & Android simultaneously with React Native as fallback
2. **Feature Flags**: Use Supabase for server-side feature toggles to control native availability
3. **Gradual Rollout**: 25% → 50% → 100% over 2 weeks
4. **Feedback Collection**: In-app surveys & crash reporting (Sentry/Bugsnag)

---

## Code Sharing Strategy

### Shared Models (Both Platforms)

```kotlin
// shared/src/models/Vehicle.kt
data class Vehicle(
    val id: String,
    val licensePlate: String,
    val make: String,
    val model: String,
    val capacity: String,
    val status: VehicleStatus,
    val rating: Double? = null,
    val currentDriverId: String? = null,
    val driver: Driver? = null
)

enum class VehicleStatus {
    AVAILABLE, BOOKED, RENTED, MAINTENANCE, OUT_OF_SERVICE
}
```

```swift
// shared/src/models/Vehicle.swift
struct Vehicle: Identifiable, Codable {
    let id: String
    let licensePlate: String
    let make: String
    let model: String
    let capacity: String
    let status: VehicleStatus
    let rating: Double?
    let currentDriverId: String?
    let driver: Driver?
}

enum VehicleStatus: String, Codable {
    case available, booked, rented, maintenance, outOfService
}
```

### Shared Calculation Logic

Both platforms call the **same calculation engine**:

```kotlin
// shared/src/calculations/DashboardCalculations.kt
object DashboardCalculations {
    fun calculateKPIs(
        vehicles: List<Vehicle>,
        bookings: List<Booking>,
        transactions: List<FinancialTransaction>,
        conversionRates: Map<Currency, Double>
    ): KPIValues {
        val totalRevenue = bookings
            .filter { it.status == "Completed" }
            .sumOf { convertToBaseCurrency(it.amount, it.currency, conversionRates) }
        
        val totalExpenses = transactions
            .filter { it.type == "expense" }
            .sumOf { convertToBaseCurrency(it.amount, it.currency, conversionRates) }
        
        return KPIValues(
            totalRevenue = totalRevenue,
            totalExpenses = totalExpenses,
            profit = totalRevenue - totalExpenses,
            // ...
        )
    }
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Longer dev time (2x code)** | Strict code review, shared test suite, parallel iOS/Android teams |
| **Sync issues between platforms** | Comprehensive integration tests, feature parity checklist, version alignment |
| **User adoption friction** | Gradual rollout, in-app messaging, feature flags to disable native if issues occur |
| **Supabase SDK instability** | Pin SDK versions, use official SDKs only, maintain fallback HTTP layer |
| **Chart library compatibility** | Early spike: test Victory Native → SwiftCharts/Vico transitions thoroughly |
| **Performance regressions** | Baseline React Native perf metrics, profile each platform during dev |

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **1. Shared Architecture** | Weeks 1-2 | Shared models, ViewModels, Repositories |
| **2. iOS Implementation** | Weeks 3-8 | iOS app feature-complete (TestFlight ready) |
| **3. Android Implementation** | Weeks 9-14 | Android app feature-complete (internal testing) |
| **4. Testing & Polish** | Weeks 15-16 | Both platforms launch-ready |
| **5. Deployment** | Weeks 17-18 | Simultaneous App Store / Play Store release |

**Total: 18 weeks (~4.5 months)**

---

## Tools & Infrastructure

| Tool | Purpose | Cost |
|------|---------|------|
| **Xcode 16+** | iOS development | Free |
| **Android Studio 2024** | Android development | Free |
| **CocoaPods / SPM** | iOS dependency mgmt | Free |
| **Gradle** | Android dependency mgmt | Free |
| **Supabase** | Backend (existing) | $0-25/mo |
| **Sentry** | Crash reporting | $25/mo+ |
| **TestFlight** | iOS beta testing | Free |
| **Play Console** | Android release | One-time $25 |
| **GitHub Actions** | CI/CD for builds | Free |

---

## Success Criteria

✅ **Launch Checklist**:
- [ ] All 5 screens feature-parity with React Native
- [ ] KPI calculations match to currency conversion decimal
- [ ] Real-time sync working within 500ms window
- [ ] Push notifications working on both platforms
- [ ] Offline mode caches & syncs correctly
- [ ] <2 second dashboard load time (cold start)
- [ ] Zero critical crashes in first 100 sessions
- [ ] 90%+ user retention from React Native version

---

## Next Steps

1. **Week 1**: Start Phase 1 → Extract shared modules
2. **Week 2**: Create both iOS & Android skeleton projects
3. **Week 3**: Begin parallel iOS + Android development
4. **Week 8**: iOS feature freeze, move to testing
5. **Week 14**: Android feature freeze
6. **Week 16**: Simultaneous app store submission
7. **Week 18**: Launch to 100% of users

Would you like me to:
- Create the shared module structure scaffolding?
- Generate starter code for iOS (SwiftUI) screens?
- Generate starter code for Android (Jetpack Compose) screens?
- Create a detailed task breakdown for your team?
