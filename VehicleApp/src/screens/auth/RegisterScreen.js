import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Colors, Radius, Shadow } from '../../constants/theme';

const wheelzyLogo = require('../../../assets/logos/wheelzy-logo.jpeg');

const initialForm = {
  fullName: '',
  email: '',
  contactNumber: '',
  password: '',
};

const initialTouched = {
  fullName: false,
  email: false,
  contactNumber: false,
  password: false,
};

const passwordRulesFor = (password) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /[0-9]/.test(password),
  symbol: /[^A-Za-z0-9]/.test(password),
});

const getPasswordStrength = (password) => {
  const score = Object.values(passwordRulesFor(password)).filter(Boolean).length;

  if (!password) {
    return { label: '', color: '#d9dde5', progress: 0 };
  }

  if (score <= 2) {
    return { label: 'Weak', color: '#ef4444', progress: 1 };
  }

  if (score <= 4) {
    return { label: 'Medium', color: '#f59e0b', progress: 2 };
  }

  return { label: 'Strong', color: '#16a34a', progress: 3 };
};

const validateFullName = (value) => (!value.trim() ? 'Full name is required.' : '');

const validateEmail = (value) => {
  const email = value.trim();

  if (!email) {
    return 'Email address is required.';
  }

  if (!email.includes('@') || !email.toLowerCase().includes('.com')) {
    return 'Enter a valid email address with "@" and ".com".';
  }

  return '';
};

const validatePhone = (value) => {
  if (!value.trim()) {
    return 'Phone number is required.';
  }

  if (!/^\d{10}$/.test(value)) {
    return 'Phone number must be exactly 10 digits.';
  }

  return '';
};

const validatePassword = (value) => {
  if (!value) {
    return 'Password is required.';
  }

  const rules = passwordRulesFor(value);
  if (!Object.values(rules).every(Boolean)) {
    return 'Use 8+ chars with uppercase, lowercase, number, and symbol.';
  }

  return '';
};

const validateField = (field, value) => {
  if (field === 'fullName') return validateFullName(value);
  if (field === 'email') return validateEmail(value);
  if (field === 'contactNumber') return validatePhone(value);
  if (field === 'password') return validatePassword(value);
  return '';
};

export default function RegisterScreen() {
  const navigation = useNavigation();
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState(initialTouched);
  const [errors, setErrors] = useState(initialTouched);
  const [showPw, setShowPw] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const ctaScale = useRef(new Animated.Value(1)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(24)).current;

  const passwordRules = useMemo(() => passwordRulesFor(form.password), [form.password]);
  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

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

  const dismiss = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Login');
  };

  const setFieldValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));

    if (touched[field] || field === 'password') {
      setErrors((current) => ({
        ...current,
        [field]: validateField(field, value),
      }));
    }
  };

  const handlePhoneChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setFieldValue('contactNumber', digitsOnly);
  };

  const handleBlur = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: validateField(field, form[field]),
    }));
  };

  const handlePressIn = () => {
    ctaScale.stopAnimation();
    Animated.timing(ctaScale, {
      toValue: 0.97,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    ctaScale.stopAnimation();
    Animated.spring(ctaScale, {
      toValue: 1,
      tension: 110,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const validateAllFields = () => {
    const nextTouched = {
      fullName: true,
      email: true,
      contactNumber: true,
      password: true,
    };

    const nextErrors = {
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      contactNumber: validatePhone(form.contactNumber),
      password: validatePassword(form.password),
    };

    setTouched(nextTouched);
    setErrors(nextErrors);

    return Object.values(nextErrors).every((value) => !value);
  };

  const handleRegister = async () => {
    setSubmitError('');

    if (!validateAllFields()) {
      return;
    }

    navigation.navigate('RegisterAgreement', {
      registerDraft: {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber,
        password: form.password,
      },
    });
  };

  return (
    <View style={styles.modalRoot}>
      <StatusBar style="light" />

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

            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>
              Join Wheelzy to book rentals, save favourites, and manage your premium vehicle experience.
            </Text>

            {submitError ? (
              <View style={styles.messageBoxError}>
                <Text style={styles.messageTextError}>{submitError}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Full name</Text>
                <TextInput
                  value={form.fullName}
                  onChangeText={(value) => setFieldValue('fullName', value)}
                  onBlur={() => handleBlur('fullName')}
                  placeholder="John Doe"
                  placeholderTextColor="rgba(21,39,66,0.45)"
                  autoCapitalize="words"
                  style={[styles.input, touched.fullName && errors.fullName ? styles.inputError : null]}
                />
                {touched.fullName && errors.fullName ? (
                  <Text style={styles.inlineError}>{errors.fullName}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput
                  value={form.email}
                  onChangeText={(value) => setFieldValue('email', value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(21,39,66,0.45)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, touched.email && errors.email ? styles.inputError : null]}
                />
                {touched.email && errors.email ? (
                  <Text style={styles.inlineError}>{errors.email}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phone number</Text>
                <TextInput
                  value={form.contactNumber}
                  onChangeText={handlePhoneChange}
                  onBlur={() => handleBlur('contactNumber')}
                  placeholder="0771234567"
                  placeholderTextColor="rgba(21,39,66,0.45)"
                  keyboardType="number-pad"
                  maxLength={10}
                  style={[styles.input, touched.contactNumber && errors.contactNumber ? styles.inputError : null]}
                />
                {touched.contactNumber && errors.contactNumber ? (
                  <Text style={styles.inlineError}>{errors.contactNumber}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={[styles.passwordField, touched.password && errors.password ? styles.inputError : null]}>
                  <TextInput
                    value={form.password}
                    onChangeText={(value) => setFieldValue('password', value)}
                    onBlur={() => handleBlur('password')}
                    placeholder="Create a strong password"
                    placeholderTextColor="rgba(21,39,66,0.45)"
                    secureTextEntry={!showPw}
                    style={styles.passwordInput}
                  />
                  <Pressable onPress={() => setShowPw((current) => !current)} hitSlop={8}>
                    <Text style={styles.passwordToggle}>{showPw ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>

                {form.password ? (
                  <View style={styles.strengthWrap}>
                    <View style={styles.strengthBar}>
                      {[1, 2, 3].map((level) => (
                        <View
                          key={level}
                          style={[
                            styles.strengthSegment,
                            {
                              backgroundColor:
                                level <= strength.progress ? strength.color : '#eceff4',
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.rulesGrid}>
                  <PasswordRule compact label="8+ chars" met={passwordRules.minLength} active={Boolean(form.password)} />
                  <PasswordRule compact label="Aa" met={passwordRules.uppercase && passwordRules.lowercase} active={Boolean(form.password)} />
                  <PasswordRule compact label="1 number" met={passwordRules.number} active={Boolean(form.password)} />
                  <PasswordRule compact label="1 symbol" met={passwordRules.symbol} active={Boolean(form.password)} />
                </View>

                {touched.password && errors.password ? (
                  <Text style={styles.inlineError}>{errors.password}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.helperText}>
                  Review the community agreement on the next step before creating your Wheelzy account.
                </Text>
              </View>
            </View>

            <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
              <Pressable
                style={styles.ctaButton}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleRegister}
              >
                <Text style={styles.ctaText}>Continue</Text>
              </Pressable>
            </Animated.View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable
                onPress={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                    return;
                  }

                  navigation.navigate('Login');
                }}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>Sign in here</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

function PasswordRule({ label, met, active, compact = false }) {
  return (
    <View style={[styles.ruleChip, compact ? styles.ruleChipCompact : null]}>
      <View
        style={[
          styles.ruleDot,
          active ? (met ? styles.ruleDotMet : styles.ruleDotPending) : styles.ruleDotIdle,
        ]}
      />
      <Text
        style={[
          styles.ruleText,
          compact ? styles.ruleTextCompact : null,
          active ? (met ? styles.ruleTextMet : styles.ruleTextPending) : null,
        ]}
      >
        {label}
      </Text>
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
    paddingBottom: 12,
  },
  logo: {
    width: 84,
    height: 84,
    alignSelf: 'center',
    marginBottom: 18,
  },
  heading: {
    fontSize: 32,
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
    paddingHorizontal: 10,
  },
  messageBoxError: {
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: Colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageTextError: {
    color: Colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  form: {
    marginTop: 22,
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
    height: 56,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d6dbe4',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  inlineError: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.danger,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  passwordField: {
    height: 56,
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
  strengthWrap: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  strengthBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  strengthSegment: {
    flex: 1,
    height: 5,
    borderRadius: Radius.full,
  },
  strengthLabel: {
    width: 58,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
  },
  rulesGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleChip: {
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eceff4',
    backgroundColor: '#fafbfc',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ruleChipCompact: {
    flexGrow: 1,
  },
  ruleDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    marginRight: 8,
  },
  ruleDotIdle: {
    backgroundColor: '#d9dde5',
  },
  ruleDotPending: {
    backgroundColor: '#f59e0b',
  },
  ruleDotMet: {
    backgroundColor: '#16a34a',
  },
  ruleText: {
    fontSize: 12,
    lineHeight: 15,
    color: Colors.muted,
    fontWeight: '600',
  },
  ruleTextCompact: {
    flexShrink: 1,
  },
  ruleTextPending: {
    color: '#8a5a06',
  },
  ruleTextMet: {
    color: '#166534',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  ctaWrap: {
    marginTop: 24,
  },
  ctaButton: {
    height: 58,
    borderRadius: 20,
    backgroundColor: '#ffe500',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.1,
  },
  footerRow: {
    marginTop: 24,
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
