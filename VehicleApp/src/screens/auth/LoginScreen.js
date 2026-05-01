import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Spacing, Shadow } from '../../constants/theme';
import SuccessToast from '../../components/SuccessToast';

const wheelzyLogo = require('../../../assets/logos/wheelzy-logo.jpeg');
const LOGIN_PREMIUM_OFFER_KEY = 'wheelzy_login_premium_offer';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, completeLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const ctaScale = useRef(new Animated.Value(1)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(24)).current;
  const loginTimeoutRef = useRef(null);

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
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }
  }, []);

  const dismiss = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('OnboardingIntro');
  };

  const animateButtonIn = () => {
    ctaScale.stopAnimation();
    Animated.timing(ctaScale, {
      toValue: 0.97,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const animateButtonOut = () => {
    ctaScale.stopAnimation();
    Animated.spring(ctaScale, {
      toValue: 1,
      tension: 110,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    if (loading || showSuccessToast) {
      return;
    }

    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await login({ email: email.trim(), password, deferSession: true });
      console.log('User Loged! ', data);
      if (String(data?.role || '').toUpperCase() === 'CUSTOMER') {
        await AsyncStorage.setItem(
          LOGIN_PREMIUM_OFFER_KEY,
          JSON.stringify({
            createdAt: Date.now(),
            isPremium: Boolean(data?.isPremium),
          }),
        );
      }
      setShowSuccessToast(true);
      setLoading(false);
      loginTimeoutRef.current = setTimeout(async () => {
        await completeLogin(data);
      }, 900);
    } catch (err) {
      if (err?.response?.status === 503) {
        setError(err?.response?.data?.message || 'The backend is starting up or MongoDB is unavailable. Please wait a few seconds and try again.');
      } else if (!err?.response && (err?.code === 'ECONNABORTED' || /network error|timeout/i.test(err?.message || ''))) {
        setError('Cannot reach the backend. Make sure vehicle-express is running, the phone and laptop are on the same network, and MongoDB Atlas allows your current IP.');
      } else {
        setError(err?.response?.data?.message || err.message || 'Invalid credentials. Please try again.');
      }
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
      <SuccessToast visible={showSuccessToast} message="Login successful" topOffset={16} />

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
          <Pressable onPress={dismiss} style={styles.closeButton} hitSlop={14}>
            <Text style={styles.closeText}>{'\u00D7'}</Text>
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.content}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
            <Image source={wheelzyLogo} style={styles.logo} resizeMode="contain" />

            <Text style={styles.heading}>Log in or sign up</Text>
            <Text style={styles.subheading}>Access bookings, wishlist, reviews, and premium vehicle offers.</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(21,39,66,0.45)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(21,39,66,0.45)"
                    secureTextEntry={!showPw}
                    style={styles.passwordInput}
                  />
                  <Pressable onPress={() => setShowPw((current) => !current)} hitSlop={8}>
                    <Text style={styles.passwordToggle}>{showPw ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
              <Pressable
                style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
                onPressIn={animateButtonIn}
                onPressOut={animateButtonOut}
                onPress={handleLogin}
                disabled={loading || showSuccessToast}
              >
                <Text style={styles.ctaText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
              </Pressable>
            </Animated.View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
                <Text style={styles.footerLink}>Register here</Text>
              </Pressable>
            </View>
          </ScrollView>
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
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    minHeight: '68%',
    maxHeight: '76%',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    ...Shadow.lg,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
    elevation: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  closeText: {
    fontSize: 34,
    lineHeight: 34,
    color: Colors.text,
    fontWeight: '300',
  },
  content: {
    flexGrow: 1,
    paddingTop: 26,
    paddingBottom: 18,
  },
  logo: {
    width: 86,
    height: 86,
    alignSelf: 'center',
    marginBottom: 22,
  },
  heading: {
    fontSize: 34,
    fontWeight: '900',
    color: '#121826',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subheading: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  errorBox: {
    marginTop: 22,
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
  },
  form: {
    marginTop: 24,
    gap: 14,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 4,
  },
  input: {
    height: 58,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d6dbe4',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    fontSize: 16,
    color: Colors.text,
  },
  passwordField: {
    height: 58,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d6dbe4',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  passwordToggle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.premium,
  },
  ctaWrap: {
    marginTop: 22,
  },
  ctaButton: {
    height: 58,
    borderRadius: 20,
    backgroundColor: '#ffe500',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  ctaButtonDisabled: {
    opacity: 0.72,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.1,
  },
  footerRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    color: Colors.muted,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
});
