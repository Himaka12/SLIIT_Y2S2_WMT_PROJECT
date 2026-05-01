import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { Colors, Shadow } from '../constants/theme';

const wheelzyLogo = require('../../assets/logos/wheelzy-logo.jpeg');

export default function SplashScreen({ readyToDismiss, onDismiss }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoTranslateY = useRef(new Animated.Value(22)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;
  const accentOpacity = useRef(new Animated.Value(0.2)).current;

  const [entranceComplete, setEntranceComplete] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  const hideNativeSplash = useCallback(async () => {
    if (!layoutReady || !logoReady || nativeSplashHidden) {
      return;
    }

    try {
      await ExpoSplashScreen.hideAsync();
    } catch (_) {
      // Ignore if the native splash is already hidden.
    }

    setNativeSplashHidden(true);
  }, [layoutReady, logoReady, nativeSplashHidden]);

  useEffect(() => {
    const entranceAnimation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 55,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 850,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(accentOpacity, {
        toValue: 0.55,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    entranceAnimation.start(() => {
      setEntranceComplete(true);
    });

    return () => entranceAnimation.stop();
  }, [accentOpacity, logoOpacity, logoScale, logoTranslateY]);

  useEffect(() => {
    hideNativeSplash();
  }, [hideNativeSplash]);

  useEffect(() => {
    if (!readyToDismiss || !entranceComplete) {
      return undefined;
    }

    const exitAnimation = Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(screenScale, {
        toValue: 1.035,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    exitAnimation.start(({ finished }) => {
      if (finished) {
        onDismiss?.();
      }
    });

    return () => exitAnimation.stop();
  }, [entranceComplete, onDismiss, readyToDismiss, screenOpacity, screenScale]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: screenOpacity, transform: [{ scale: screenScale }] },
      ]}
      onLayout={() => setLayoutReady(true)}
    >
      <StatusBar style="light" />

      <View style={styles.backgroundLayer}>
        <Animated.View style={[styles.accentRingLarge, { opacity: accentOpacity }]} />
        <Animated.View style={[styles.accentRingSmall, { opacity: accentOpacity }]} />
        <View style={styles.glowOrbTop} />
        <View style={styles.glowOrbBottom} />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: logoOpacity,
            transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
          },
        ]}
      >
        <View style={styles.logoCard}>
          <Image
            source={wheelzyLogo}
            style={styles.logo}
            resizeMode="contain"
            onLoadEnd={() => setLogoReady(true)}
          />
        </View>

        <Text style={styles.brandName}>Wheelzy</Text>
        <Text style={styles.tagline}>Drive the next move.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentRingLarge: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 1,
    borderColor: 'rgba(255, 203, 45, 0.22)',
  },
  accentRingSmall: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  glowOrbTop: {
    position: 'absolute',
    top: '22%',
    left: '16%',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 203, 45, 0.12)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: '18%',
    right: '14%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCard: {
    width: 176,
    height: 176,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...Shadow.lg,
  },
  logo: {
    width: 138,
    height: 138,
  },
  brandName: {
    marginTop: 28,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#ffffff',
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.62)',
  },
});
