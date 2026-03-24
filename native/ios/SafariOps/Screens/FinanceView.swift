import SwiftUI

struct FinanceView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                Text("Finance")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                // Placeholder for Finance Overview
                Text("Finance Overview Placeholder")
                    .frame(height: 300)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(12)

                // Placeholder for Filters
                Text("Filters Placeholder")
                    .frame(height: 100)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(12)
            }
            .padding()
            .navigationTitle("Finance")
        }
    }
}

struct FinanceView_Previews: PreviewProvider {
    static var previews: some View {
        FinanceView()
    }
}