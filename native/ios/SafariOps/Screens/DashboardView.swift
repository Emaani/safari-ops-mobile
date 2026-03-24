import SwiftUI

struct DashboardView: View {
    @State private var selectedMonth: Int? = Calendar.current.component(.month, from: Date()) - 1
    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    Text("Dashboard")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    // Placeholder for KPI Cards
                    HStack(spacing: 16) {
                        KPICardView(label: "Total Revenue", value: 12000, currency: .usd)
                        KPICardView(label: "Total Expenses", value: 8000, currency: .usd)
                    }

                    // Placeholder for Charts
                    Text("Charts Placeholder")
                        .frame(height: 200)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(12)

                    // Placeholder for Widgets
                    Text("Widgets Placeholder")
                        .frame(height: 100)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(12)
                }
                .padding()
            }
            .navigationTitle("Dashboard")
        }
    }
}

struct KPICardView: View {
    let label: String
    let value: Double
    let currency: Currency

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.gray)

            Text("\(currency.symbol)\(value, specifier: "%.2f")")
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

enum Currency: String {
    case usd = "$"
    case ugx = "UGX"
    case kes = "KES"

    var symbol: String {
        switch self {
        case .usd: return "$"
        case .ugx: return "UGX"
        case .kes: return "KES"
        }
    }
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
    }
}