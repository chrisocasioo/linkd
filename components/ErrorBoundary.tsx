import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error.message}</Text>
            <Text style={styles.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0F', padding: 24, paddingTop: 60 },
  title: { color: '#ff4444', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  scroll: { flex: 1 },
  message: { color: '#fff', fontSize: 14, marginBottom: 12 },
  stack: { color: '#888', fontSize: 11, fontFamily: 'monospace' },
});
