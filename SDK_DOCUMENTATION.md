
# Jackal Adventures Mobile SDK

**Version 1.0.0** | **Platform: iOS & Android** | **Framework: React Native + Expo**

A comprehensive, production-ready SDK for building mobile applications with the Jackal Adventures platform. Includes Push Notifications, Messaging, Live Updates, Offline Sync, and API Services.

---

## 🚀 Features

### ✅ **Push Notifications**
- Expo push notification integration
- Token management and registration
- Local and remote notifications
- Badge count management
- Custom notification handlers
- Background notification support

### ✅ **Messaging Service**
- Real-time in-app messaging
- Channel-based communication (Direct, Group, Broadcast)
- Message history and search
- Read receipts
- Participant management
- Unread count tracking

### ✅ **Live Updates (Realtime Sync)**
- Supabase Realtime integration
- Real-time table subscriptions
- Broadcast channels
- Presence tracking (online/offline status)
- Event-driven architecture
- Automatic reconnection

### ✅ **Offline Sync**
- Automatic queue management
- Conflict resolution
- Retry logic with exponential backoff
- Network status monitoring
- Persistent storage
- Background synchronization

### ✅ **API Services**
- RESTful API client
- Authentication integration
- Request/response interceptors
- Error handling
- Retry mechanism
- Type-safe requests

### ✅ **Additional Services**
- Authentication (Supabase Auth)
- Local storage management
- Network monitoring
- Device information
- Comprehensive logging
- React hooks for easy integration

---

## 📦 Installation

### Prerequisites

Ensure you have the following dependencies in your `package.json`:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.89.0",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "expo": "~54.0.31",
    "expo-device": "^8.0.10",
    "expo-notifications": "^0.32.16",
    "expo-constants": "^18.0.4",
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

### Install the SDK

```bash
# Install dependencies
npm install

# The SDK is located in the sdk/ directory
# Import from sdk/index.ts in your application
```

---

## 🔧 Quick Start

### 1. Initialize the SDK

```typescript
import { JackalSDK } from './sdk';

// Initialize with your Supabase credentials
const sdk = JackalSDK.initialize({
  supabase: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key',
  },
  eas: {
    projectId: 'your-eas-project-id', // From app.json
  },
  api: {
    baseUrl: 'https://api.jackaladventures.com',
    timeout: 30000,
    retryAttempts: 3,
  },
  offline: {
    enabled: true,
    syncInterval: 30000, // 30 seconds
    maxQueueSize: 1000,
  },
  logging: {
    level: 'info',
    enabled: true,
  },
});

// Start background services
await sdk.start();
```

### 2. Authentication

```typescript
// Sign in
const session = await sdk.auth.signIn('user@example.com', 'password');

// Get current user
const user = await sdk.getCurrentUser();

// Check if authenticated
const isAuth = await sdk.isAuthenticated();

// Sign out
await sdk.auth.signOut();
```

### 3. Push Notifications

```typescript
// Initialize push notifications (automatically done on SDK start if authenticated)
await sdk.pushNotifications.initialize();

// Listen for notifications
sdk.pushNotifications.addNotificationReceivedListener((notification) => {
  console.log('Notification received:', notification);
});

// Listen for notification taps
sdk.pushNotifications.addNotificationResponseListener((response) => {
  console.log('Notification tapped:', response);
  // Handle navigation
});

// Schedule a local notification
await sdk.pushNotifications.scheduleNotification({
  title: 'Safari Reminder',
  body: 'Your booking starts in 1 hour',
  data: { bookingId: '123' },
});

// Set badge count
await sdk.pushNotifications.setBadgeCount(5);
```

### 4. Messaging

```typescript
// Send a message
const message = await sdk.messaging.sendMessage(
  'channel-id',
  'Hello, team!',
  'text'
);

// Get messages from a channel
const messages = await sdk.messaging.getMessages({
  channelId: 'channel-id',
  limit: 50,
});

// Subscribe to new messages
const unsubscribe = sdk.messaging.subscribeToChannel('channel-id', (message) => {
  console.log('New message:', message);
});

// Mark channel as read
await sdk.messaging.markChannelAsRead('channel-id');

// Get unread count
const unreadCount = await sdk.messaging.getUnreadCount();
```

### 5. Live Updates (Realtime)

```typescript
// Subscribe to table changes
const unsubscribe = await sdk.realtime.subscribeToTable(
  'bookings',
  (event) => {
    console.log('Booking updated:', event);
    // event.type: 'INSERT' | 'UPDATE' | 'DELETE'
    // event.newRecord: the new data
    // event.oldRecord: the old data (for UPDATE and DELETE)
  },
  {
    schema: 'public',
    event: '*', // or 'INSERT', 'UPDATE', 'DELETE'
  }
);

// Subscribe to broadcast channel
const unsubscribe2 = await sdk.realtime.subscribeToBroadcast(
  'dashboard-updates',
  'metrics',
  (payload) => {
    console.log('Dashboard metrics updated:', payload);
  }
);

// Broadcast a message
await sdk.realtime.broadcast('dashboard-updates', 'metrics', {
  totalRevenue: 150000,
  activeBookings: 25,
});

// Subscribe to presence
const unsubscribe3 = await sdk.realtime.subscribeToPresence(
  'admin-room',
  (user) => console.log('User joined:', user),
  (user) => console.log('User left:', user)
);
```

### 6. Offline Sync

```typescript
// Add an operation to the sync queue
await sdk.offlineSync.addOperation('CREATE', 'bookings', {
  customer_name: 'John Doe',
  safari_date: '2026-02-01',
  status: 'confirmed',
});

// Sync now (manual trigger)
await sdk.offlineSync.syncNow();

// Get sync status
const status = sdk.offlineSync.getStatus();
console.log('Pending operations:', status.pendingOperations);
console.log('Last sync:', status.lastSyncTime);

// Get pending operations
const pending = sdk.offlineSync.getPendingOperations();

// Retry failed operations
await sdk.offlineSync.retryFailedOperations();
```

### 7. API Services

```typescript
// Make API calls
const response = await sdk.api.get('/bookings');
const bookings = response.data;

// POST request
const newBooking = await sdk.api.post('/bookings', {
  customer_name: 'Jane Smith',
  safari_date: '2026-03-15',
});

// PATCH request
await sdk.api.patch(`/bookings/${bookingId}`, {
  status: 'completed',
});

// DELETE request
await sdk.api.delete(`/bookings/${bookingId}`);
```

---

## 🎯 React Hooks

The SDK provides React hooks for seamless integration with your React Native components:

### useAuth

```typescript
import { useAuth } from './sdk';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut, loading } = useAuth();

  return (
    <View>
      {isAuthenticated ? (
        <>
          <Text>Welcome, {user?.email}</Text>
          <Button title="Sign Out" onPress={signOut} />
        </>
      ) : (
        <Button title="Sign In" onPress={() => signIn(email, password)} />
      )}
    </View>
  );
}
```

### usePushNotifications

```typescript
import { usePushNotifications } from './sdk';

function NotificationComponent() {
  const {
    isInitialized,
    currentToken,
    badgeCount,
    setBadgeCount,
    scheduleNotification,
  } = usePushNotifications();

  return (
    <View>
      <Text>Badge Count: {badgeCount}</Text>
      <Button
        title="Schedule Notification"
        onPress={() =>
          scheduleNotification({
            title: 'Test',
            body: 'This is a test notification',
          })
        }
      />
    </View>
  );
}
```

### useRealtime

```typescript
import { useRealtime } from './sdk';

function RealtimeComponent() {
  const [bookings, setBookings] = useState([]);

  useRealtime(
    'bookings',
    (event) => {
      if (event.type === 'INSERT') {
        setBookings((prev) => [...prev, event.newRecord]);
      } else if (event.type === 'UPDATE') {
        setBookings((prev) =>
          prev.map((b) => (b.id === event.newRecord.id ? event.newRecord : b))
        );
      }
    },
    {
      event: '*',
    }
  );

  return <BookingList bookings={bookings} />;
}
```

### useOfflineSync

```typescript
import { useOfflineSync } from './sdk';

function OfflineIndicator() {
  const { status, syncNow, isOnline, pendingOperations } = useOfflineSync();

  return (
    <View>
      <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
      <Text>Pending: {pendingOperations}</Text>
      <Button title="Sync Now" onPress={syncNow} disabled={!isOnline} />
    </View>
  );
}
```

---

## 📱 iOS Distribution

### Build for iOS

```bash
# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Log in to Expo
eas login

# Configure build
eas build:configure

# Build for iOS (development)
eas build --platform ios --profile development

# Build for iOS (production/App Store)
eas build --platform ios --profile production
```

### TestFlight Distribution

```bash
# Build and submit to App Store Connect
eas submit --platform ios --latest
```

### Create a Shareable Build

```bash
# Create an ad-hoc build for sharing
eas build --platform ios --profile preview
```

Users can download the build via:
1. **Expo Go App** (for development builds)
2. **TestFlight** (for beta testing)
3. **Direct IPA Download** (for ad-hoc builds)
4. **App Store** (for production)

---

## 🏗️ SDK Architecture

```
sdk/
├── index.ts                          # Main SDK exports
├── core/
│   └── JackalSDK.ts                  # Core SDK class
├── auth/
│   └── AuthService.ts                # Authentication service
├── notifications/
│   └── PushNotificationService.ts    # Push notifications
├── messaging/
│   └── MessagingService.ts           # In-app messaging
├── realtime/
│   └── RealtimeService.ts            # Live updates
├── offline/
│   └── OfflineSyncService.ts         # Offline sync
├── api/
│   └── APIService.ts                 # API client
├── data/
│   ├── DashboardService.ts           # Dashboard data
│   ├── BookingsService.ts            # Bookings
│   ├── FleetService.ts               # Fleet management
│   └── FinanceService.ts             # Financial data
├── storage/
│   └── StorageService.ts             # Local storage
├── utils/
│   ├── Logger.ts                     # Logging utility
│   ├── NetworkMonitor.ts             # Network status
│   └── DeviceInfo.ts                 # Device information
└── hooks/
    ├── useAuth.ts                    # Auth hook
    ├── usePushNotifications.ts       # Notifications hook
    ├── useMessaging.ts               # Messaging hook
    ├── useRealtime.ts                # Realtime hook
    ├── useOfflineSync.ts             # Offline sync hook
    ├── useDashboard.ts               # Dashboard hook
    ├── useBookings.ts                # Bookings hook
    ├── useFleet.ts                   # Fleet hook
    └── useFinance.ts                 # Finance hook
```

---

## 🔐 Security Features

### Authentication
- ✅ Supabase Auth integration
- ✅ JWT token management
- ✅ Auto-refresh tokens
- ✅ Secure storage (AsyncStorage)
- ✅ Role-based access control

### Data Protection
- ✅ HTTPS for all API calls
- ✅ Encrypted local storage
- ✅ Secure credential handling
- ✅ Token expiration handling

### Network Security
- ✅ SSL/TLS encryption
- ✅ Certificate pinning (optional)
- ✅ Request signing
- ✅ Rate limiting support

---

## 📊 Error Handling

```typescript
try {
  const bookings = await sdk.api.get('/bookings');
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Network error - queue for offline sync
    await sdk.offlineSync.addOperation('GET', 'bookings', {});
  } else if (error.code === 'UNAUTHORIZED') {
    // Auth error - sign out
    await sdk.auth.signOut();
  } else {
    // Other error
    sdk.logger.error('Error fetching bookings', error);
  }
}
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- sdk/notifications

# Run with coverage
npm test -- --coverage
```

### Manual Testing

```bash
# Start the dev server
npm run start

# Open in iOS simulator
npm run ios

# Open on physical device
# Scan QR code with Expo Go app
```

---

## 📖 API Reference

### JackalSDK

| Method | Description |
|--------|-------------|
| `initialize(config)` | Initialize SDK with configuration |
| `getInstance()` | Get SDK singleton instance |
| `start()` | Start background services |
| `stop()` | Stop background services |
| `getHealthStatus()` | Get SDK health status |
| `getCurrentUser()` | Get current authenticated user |
| `isAuthenticated()` | Check if user is authenticated |

### Push Notifications

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize push notifications |
| `requestPermissions()` | Request notification permissions |
| `scheduleNotification(payload)` | Schedule a local notification |
| `setBadgeCount(count)` | Set app badge count |
| `getCurrentToken()` | Get current push token |

### Messaging

| Method | Description |
|--------|-------------|
| `sendMessage(channelId, content)` | Send a message |
| `getMessages(filter)` | Get messages |
| `subscribeToChannel(channelId, callback)` | Subscribe to channel |
| `markAsRead(messageId)` | Mark message as read |
| `getUnreadCount()` | Get unread message count |

### Realtime

| Method | Description |
|--------|-------------|
| `subscribeToTable(table, callback)` | Subscribe to table changes |
| `subscribeToBroadcast(channel, event, callback)` | Subscribe to broadcast |
| `broadcast(channel, event, payload)` | Broadcast a message |
| `subscribeToPresence(channel, onJoin, onLeave)` | Subscribe to presence |

### Offline Sync

| Method | Description |
|--------|-------------|
| `addOperation(type, resource, data)` | Add operation to queue |
| `syncNow()` | Sync immediately |
| `getStatus()` | Get sync status |
| `getPendingOperations()` | Get pending operations |
| `retryFailedOperations()` | Retry failed operations |

---

## 🎨 Customization

### Custom Logger

```typescript
const sdk = JackalSDK.initialize({
  // ... other config
  logging: {
    level: 'debug', // 'error' | 'warn' | 'info' | 'debug'
    enabled: true,
  },
});

// Access logger
sdk.logger.info('Custom log message');
sdk.logger.error('Error occurred', error);
```

### Custom API Interceptors

```typescript
// Add request interceptor
sdk.api.addRequestInterceptor((config) => {
  config.headers['X-Custom-Header'] = 'value';
  return config;
});

// Add response interceptor
sdk.api.addResponseInterceptor((response) => {
  console.log('Response:', response);
  return response;
});
```

---

## 🚀 Production Checklist

- [ ] Configure Supabase URL and keys
- [ ] Set EAS Project ID in app.json
- [ ] Configure push notification certificates
- [ ] Set up API base URL
- [ ] Enable offline sync
- [ ] Configure logging level
- [ ] Test on physical iOS device
- [ ] Test push notifications
- [ ] Test offline functionality
- [ ] Test real-time updates
- [ ] Build production version
- [ ] Submit to App Store
- [ ] Set up crash reporting
- [ ] Monitor SDK health

---

## 📝 License

MIT License - See LICENSE file for details

---

## 💬 Support

- **Email**: support@jackaladventures.com
- **Documentation**: https://docs.jackaladventures.com/sdk
- **GitHub Issues**: https://github.com/jackaladventures/mobile-sdk/issues

---

## 🔄 Version History

### v1.0.0 (2026-01-18)
- ✅ Initial release
- ✅ Push Notifications
- ✅ Messaging Service
- ✅ Live Updates (Realtime)
- ✅ Offline Sync
- ✅ API Services
- ✅ React Hooks
- ✅ iOS Support

---

## 👨‍💻 Contributors

Built with ❤️ by the Jackal Adventures Team

---

**Ready to build amazing mobile apps with Jackal Adventures SDK!** 🎉
