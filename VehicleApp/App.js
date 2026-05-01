import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppAlertProvider } from './src/context/AppAlertContext';
import SplashScreen from './src/components/SplashScreen';
import RootNavigator from './src/navigation/RootNavigator';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be hidden in development reloads.
});

function AppStartupGate() {
  const { loading } = useAuth();
  const [minimumDurationComplete, setMinimumDurationComplete] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showNavigator, setShowNavigator] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumDurationComplete(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const readyToDismiss = minimumDurationComplete && !loading;

  useEffect(() => {
    if (!readyToDismiss || showNavigator) {
      return undefined;
    }

    setShowNavigator(true);
    return undefined;
  }, [readyToDismiss, showNavigator]);

  return (
    <View style={styles.container}>
      {showNavigator ? (
        <View
          pointerEvents={showSplash ? 'none' : 'auto'}
          style={styles.navigatorLayer}
        >
          <StatusBar style="auto" />
          <RootNavigator />
        </View>
      ) : null}

      {showSplash ? (
        <View style={styles.splashLayer}>
          <SplashScreen
            readyToDismiss={readyToDismiss}
            onDismiss={() => setShowSplash(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppAlertProvider>
          <AuthProvider>
            <AppStartupGate />
          </AuthProvider>
        </AppAlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070c',
  },
  navigatorLayer: {
    flex: 1,
  },
  splashLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
