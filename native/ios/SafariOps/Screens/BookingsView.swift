import SwiftUI

struct BookingsView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                Text("Bookings")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                // Placeholder for Booking List
                Text("Booking List Placeholder")
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
            .navigationTitle("Bookings")
        }
    }
}

struct BookingsView_Previews: PreviewProvider {
    static var previews: some View {
        BookingsView()
    }
}