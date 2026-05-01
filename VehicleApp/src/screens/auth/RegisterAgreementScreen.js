import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow } from '../../constants/theme';
import SuccessToast from '../../components/SuccessToast';

const wheelzyLogo = require('../../../assets/logos/wheelzy-logo.jpeg');

export default function RegisterAgreementScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, completeLogin } = useAuth();
  const draft = useMemo(() => route.params?.registerDraft || null, [route.params]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(24)).current;
  const registerTimeoutRef = useRef(null);

  useEffect(() => {
    const entranceAnimation = Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    entranceAnimation.start();

    return () => entranceAnimation.stop();
  }, [sheetOpacity, sheetTranslateY]);

  useEffect(() => () => {
    if (registerTimeoutRef.current) {
      clearTimeout(registerTimeoutRef.current);
    }
  }, []);

  const handlePressIn = () => {
    buttonScale.stopAnimation();
    Animated.timing(buttonScale, {
      toValue: 0.97,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    buttonScale.stopAnimation();
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: 110,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = async () => {
    if (loading || showSuccessToast) {
      return;
    }

    if (!draft) {
      setError('Your registration details are missing. Please go back and try again.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await authAPI.register(draft);
      const loginData = await login({
        email: draft.email,
        password: draft.password,
        deferSession: true,
      });
      setShowSuccessToast(true);
      setLoading(false);
      registerTimeoutRef.current = setTimeout(async () => {
        await completeLogin(loginData);
      }, 900);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Registration failed. Please try again.');
      setLoading(false);
    } finally {
      if (showSuccessToast) {
        return;
      }
      setLoading(false);
    }
  };

  return (
    <View style={styles.modalRoot}>
      <StatusBar style="light" />
      <SuccessToast visible={showSuccessToast} message="Registered successfully" />

      <View style={styles.keyboardWrap}>
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.content}>
            <Image source={wheelzyLogo} style={styles.logo} resizeMode="contain" />

            <Text style={styles.heading}>Welcome to Wheelzy</Text>
            <Text style={styles.bodyText}>
              Before creating your account, please confirm that you will use Wheelzy respectfully,
              provide accurate details, and follow fair booking and community behaviour at all times.
            </Text>
            <Text style={styles.bodyText}>
              This helps us keep the platform safe, trusted, and premium for every renter, buyer,
              and vehicle owner using the app.
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          <Animated.View style={[styles.actionWrap, { transform: [{ scale: buttonScale }] }]}>
            <Pressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleContinue}
              disabled={loading || showSuccessToast}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Creating account...' : 'Agree and continue'}
              </Text>
            </Pressable>
          </Animated.View>

          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardWrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    ...Shadow.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 18,
  },
  logo: {
    width: 86,
    height: 86,
    marginBottom: 18,
  },
  heading: {
    fontSize: 34,
    fontWeight: '900',
    color: '#121826',
    textAlign: 'center',
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 28,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  errorBox: {
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: Colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionWrap: {
    marginTop: 16,
  },
  primaryButton: {
    height: 58,
    borderRadius: 20,
    backgroundColor: '#ffe500',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
});
