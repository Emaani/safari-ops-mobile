import SwiftUI

struct FleetView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                Text("Fleet")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                // Placeholder for Fleet List
                Text("Fleet List Placeholder")
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
            .navigationTitle("Fleet")
        }
    }
}

struct FleetView_Previews: PreviewProvider {
    static var previews: some View {
        FleetView()
    }
}