import SwiftUI

struct MoreView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                Text("More")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                // Placeholder for Settings
                Text("Settings Placeholder")
                    .frame(height: 300)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(12)

                // Placeholder for Profile
                Text("Profile Placeholder")
                    .frame(height: 100)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(12)
            }
            .padding()
            .navigationTitle("More")
        }
    }
}

struct MoreView_Previews: PreviewProvider {
    static var previews: some View {
        MoreView()
    }
}