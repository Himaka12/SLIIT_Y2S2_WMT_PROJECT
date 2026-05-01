import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Shadow } from '../../constants/theme';

const onboardingBackground = require('../../../assets/images/auth/onboarding-1.jpeg');

export default function OnboardingIntroScreen({ navigation }) {
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(34)).current;
  const contentScale = useRef(new Animated.Value(0.98)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const isNavigating = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isNavigating.current = false;
      buttonScale.setValue(1);
    }, [buttonScale])
  );

  useEffect(() => {
    const entranceAnimation = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    entranceAnimation.start();

    return () => entranceAnimation.stop();
  }, [contentOpacity, contentScale, contentTranslateY]);

  const handlePressIn = () => {
    if (isNavigating.current) {
      return;
    }

    buttonScale.stopAnimation();
    Animated.timing(buttonScale, {
      toValue: 0.94,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (isNavigating.current) {
      return;
    }

    buttonScale.stopAnimation();
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: 120,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = () => {
    if (isNavigating.current) {
      return;
    }

    isNavigating.current = true;
    buttonScale.stopAnimation();

    Animated.timing(buttonScale, {
      toValue: 0.94,
      duration: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    navigation.navigate('Login');
  };

  return (
    <ImageBackground source={onboardingBackground} style={styles.background} resizeMode="cover">
      <View pointerEvents="none" style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }, { scale: contentScale }],
            },
          ]}
        >
          <View style={styles.copyBlock}>
            <Text style={styles.heading}>
              Buy a <Text style={styles.highlight}>Ferrari</Text>{'\n'}
              luxury car
            </Text>
            <Text style={styles.supportingText}>
              Find and experience the emotion of our luxury cars at a low price.
            </Text>
          </View>

          <Animated.View style={[styles.buttonWrap, { transform: [{ scale: buttonScale }] }]}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleContinue}
              hitSlop={10}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaArrow}>{'\u2192'}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 26,
    gap: 18,
  },
  copyBlock: {
    flex: 1,
    maxWidth: 290,
    paddingRight: 8,
  },
  heading: {
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -1.2,
  },
  highlight: {
    color: '#ffe500',
  },
  supportingText: {
    marginTop: 18,
    maxWidth: 270,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '500',
  },
  buttonWrap: {
    zIndex: 2,
    elevation: 3,
    marginBottom: 10,
  },
  ctaButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#ffe500',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  ctaArrow: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0a0a0a',
    marginTop: -2,
  },
});
