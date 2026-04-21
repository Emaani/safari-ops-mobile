/**
 * ErrorBoundary
 *
 * Catches unhandled JS errors in the render tree so the app shows a graceful
 * recovery screen instead of a white crash. Required for App Store compliance.
 */
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev; in production you would send to Sentry / Crashlytics
    console.error('[ErrorBoundary] Uncaught error:', error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={s.root}>
          <View style={s.card}>
            <Text style={s.icon}>⚠️</Text>
            <Text style={s.title}>Something went wrong</Text>
            <Text style={s.body}>
              The app encountered an unexpected error. Please tap below to try again.
            </Text>
            {__DEV__ && this.state.error && (
              <ScrollView style={s.devBox}>
                <Text style={s.devText}>{this.state.error.message}</Text>
              </ScrollView>
            )}
            <TouchableOpacity style={s.btn} onPress={this.handleReset} activeOpacity={0.85}>
              <Text style={s.btnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#f6f2eb', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:    { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 },
  icon:    { fontSize: 48, marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '800', color: '#181512', marginBottom: 10, textAlign: 'center' },
  body:    { fontSize: 14, color: '#7f7565', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  devBox:  { backgroundColor: '#f0ebe2', borderRadius: 8, padding: 10, marginBottom: 16, maxHeight: 120, width: '100%' },
  devText: { fontSize: 11, color: '#c96d4d', fontFamily: 'Courier' },
  btn:     { backgroundColor: '#1f4d45', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
