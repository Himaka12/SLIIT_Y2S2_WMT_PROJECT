import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customerAPI } from '../../api';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const WHEELZY_LOGO = require('../../../assets/logos/wheelzy-logo.jpeg');
const PREMIUM_AMOUNT = 10000;
const PREMIUM_CURRENCY = 'LKR';
const PAYMENT_METHOD = 'card';
const SUPPORTED_CARD_BRANDS = [
  { key: 'visa', label: 'VISA' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'unionpay', label: 'UnionPay' },
];

function formatAmount(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCardNumber(value) {
  return digitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatExpiry(value) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isExpiryValid(expiry) {
  if (!/^\d{2}\/\d{2}$/.test(String(expiry || '').trim())) {
    return false;
  }

  const [monthRaw, yearRaw] = String(expiry).split('/');
  const month = Number(monthRaw);
  const year = Number(`20${yearRaw}`);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
}

function StepBadge({ step, active, complete }) {
  return (
    <View style={[styles.stepBadge, active && styles.stepBadgeActive, complete && styles.stepBadgeComplete]}>
      <Text style={[styles.stepBadgeText, (active || complete) && styles.stepBadgeTextActive]}>
        Step {step}
      </Text>
    </View>
  );
}

function BrandHeader({ amount, title, subtitle, showActiveStatus }) {
  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandRow}>
        <Image source={WHEELZY_LOGO} style={styles.logo} resizeMode="cover" />

        <View style={styles.brandCopy}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandName}>Wheelzy</Text>
            {showActiveStatus ? (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Premium Active</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.brandSubtitle}>{subtitle}</Text>
          <Text style={styles.brandAmount}>{formatAmount(amount)}</Text>
        </View>
      </View>

      <Text style={styles.brandHeading}>{title}</Text>
    </View>
  );
}

function SectionShell({
  step,
  active,
  complete,
  locked,
  title,
  subtitle,
  children,
  onLayout,
}) {
  return (
    <View onLayout={onLayout} style={[styles.sectionShell, locked && styles.sectionShellLocked]}>
      <View style={styles.sectionHeader}>
        <StepBadge step={step} active={active} complete={complete} />
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {complete ? (
          <MaterialCommunityIcons name="check-circle" size={22} color={Colors.success} />
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        {children}
        {locked ? (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons name="lock-outline" size={18} color="#475569" />
            <Text style={styles.lockText}>Complete the previous step to unlock this section.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PaymentMethodCard({
  selectedMethod,
  selectedCardBrand,
  onSelectMethod,
  onSelectCardBrand,
  onContinue,
  isContinuing,
  amount,
  showActiveStatus,
}) {
  return (
    <View>
      <BrandHeader
        amount={amount}
        title="Premium profile upgrade"
        subtitle="Wheelzy secure demo payment portal"
        showActiveStatus={showActiveStatus}
      />

      <View style={styles.cardBody}>
        <Text style={styles.cardLabel}>Select a payment method</Text>

        <Pressable
          onPress={() => onSelectMethod(PAYMENT_METHOD)}
          style={({ pressed }) => [
            styles.methodOption,
            selectedMethod === PAYMENT_METHOD && styles.methodOptionSelected,
            pressed && styles.methodOptionPressed,
          ]}
        >
          <View style={styles.methodIconWrap}>
            <MaterialCommunityIcons
              name="credit-card-outline"
              size={22}
              color={selectedMethod === PAYMENT_METHOD ? Colors.blue : '#334155'}
            />
          </View>

          <View style={styles.methodCopy}>
            <Text style={styles.methodTitle}>Credit / Debit Card</Text>
            <Text style={styles.methodSubtitle}>Demo checkout only. No real payment will be charged.</Text>
          </View>

          <MaterialCommunityIcons
            name={selectedMethod === PAYMENT_METHOD ? 'radiobox-marked' : 'radiobox-blank'}
            size={22}
            color={selectedMethod === PAYMENT_METHOD ? Colors.blue : '#94a3b8'}
          />
        </Pressable>

        <View style={styles.cardBrandRow}>
          {SUPPORTED_CARD_BRANDS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onSelectCardBrand(item.key)}
              style={({ pressed }) => [
                styles.brandChip,
                selectedCardBrand === item.key && styles.brandChipSelected,
                pressed && styles.brandChipPressed,
              ]}
            >
              <Text style={[styles.brandChipText, selectedCardBrand === item.key && styles.brandChipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onContinue}
          disabled={!selectedMethod || !selectedCardBrand || isContinuing}
          style={({ pressed }) => [
            styles.primaryButton,
            (!selectedMethod || !selectedCardBrand || isContinuing) && styles.buttonDisabled,
            pressed && selectedMethod && selectedCardBrand && !isContinuing && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CardDetailsCard({
  amount,
  form,
  errors,
  touched,
  canPay,
  submitting,
  onChange,
  onBlur,
  onBack,
  onSubmit,
  formMessage,
}) {
  return (
    <View>
      <BrandHeader
        amount={amount}
        title="Enter your card details"
        subtitle="Wheelzy premium upgrade payment"
      />

      <View style={styles.cardBody}>
        <Text style={styles.cardLabel}>Credit / Debit Card</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name on Card</Text>
          <TextInput
            value={form.nameOnCard}
            onChangeText={(value) => onChange('nameOnCard', value)}
            onBlur={() => onBlur('nameOnCard')}
            placeholder="Enter the cardholder name"
            placeholderTextColor="#94a3b8"
            style={[styles.input, touched.nameOnCard && errors.nameOnCard ? styles.inputError : null]}
          />
          {touched.nameOnCard && errors.nameOnCard ? <Text style={styles.errorText}>{errors.nameOnCard}</Text> : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Card Number</Text>
          <TextInput
            value={formatCardNumber(form.cardNumber)}
            onChangeText={(value) => onChange('cardNumber', digitsOnly(value).slice(0, 16))}
            onBlur={() => onBlur('cardNumber')}
            placeholder="0000 0000 0000 0000"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            maxLength={19}
            style={[styles.input, touched.cardNumber && errors.cardNumber ? styles.inputError : null]}
          />
          {touched.cardNumber && errors.cardNumber ? <Text style={styles.errorText}>{errors.cardNumber}</Text> : null}
        </View>

        <View style={styles.twoColumnRow}>
          <View style={[styles.inputGroup, styles.flexOne]}>
            <Text style={styles.inputLabel}>CVV</Text>
            <TextInput
              value={form.cvv}
              onChangeText={(value) => onChange('cvv', digitsOnly(value).slice(0, 4))}
              onBlur={() => onBlur('cvv')}
              placeholder="123"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.input, touched.cvv && errors.cvv ? styles.inputError : null]}
            />
            {touched.cvv && errors.cvv ? <Text style={styles.errorText}>{errors.cvv}</Text> : null}
          </View>

          <View style={[styles.inputGroup, styles.flexOne]}>
            <Text style={styles.inputLabel}>Expiry MM/YY</Text>
            <TextInput
              value={formatExpiry(form.expiry)}
              onChangeText={(value) => onChange('expiry', formatExpiry(value))}
              onBlur={() => onBlur('expiry')}
              placeholder="MM/YY"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={5}
              style={[styles.input, touched.expiry && errors.expiry ? styles.inputError : null]}
            />
            {touched.expiry && errors.expiry ? <Text style={styles.errorText}>{errors.expiry}</Text> : null}
          </View>
        </View>

        {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}

        <View style={styles.actionRow}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !canPay}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.payButton,
            (submitting || !canPay) && styles.buttonDisabled,
            pressed && canPay && !submitting && styles.primaryButtonPressed,
          ]}
        >
            {submitting ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <Text style={styles.primaryButtonText}>Pay {formatAmount(amount)}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PaymentSuccessCard({ amount, purchaseId, onBackToHome }) {
  return (
    <View>
      <BrandHeader
        amount={amount}
        title="Payment approved"
        subtitle="Wheelzy premium upgrade completed"
      />

      <View style={styles.cardBody}>
        <Text style={styles.thankYouText}>Thank you!</Text>

        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <MaterialCommunityIcons name="check" size={44} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Premium upgrade approved</Text>
          <Text style={styles.successSubtitle}>Your Wheelzy account has been upgraded successfully.</Text>
        </View>

        <View style={styles.receiptCard}>
          <Text style={styles.receiptLabel}>Payment ID</Text>
          <Text style={styles.receiptValue}>{purchaseId}</Text>
          <Text style={styles.receiptMeta}>{formatAmount(amount)} - Demo card payment approved</Text>
        </View>

        <Pressable onPress={onBackToHome} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActiveSubscriptionCard({ amount }) {
  return (
    <View>
      <BrandHeader
        amount={amount}
        title="Premium subscription active"
        subtitle="Your Wheelzy Premium membership is already enabled"
        showActiveStatus
      />

      <View style={styles.cardBody}>
        <View style={styles.subscriptionActiveCard}>
          <View style={styles.subscriptionActiveBadge}>
            <MaterialCommunityIcons name="check-decagram" size={18} color={Colors.success} />
            <Text style={styles.subscriptionActiveBadgeText}>Subscription Active</Text>
          </View>

          <Text style={styles.subscriptionActiveTitle}>You are already enjoying Wheelzy Premium</Text>
          <Text style={styles.subscriptionActiveCopy}>
            Your premium access is active, including the exclusive 10% off on eligible rent vehicles for 1 year.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function PremiumUpgradeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const horizontalStepsRef = useRef(null);
  const { width } = useWindowDimensions();
  const { user, refreshUser, updateStoredUser } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [selectedCardBrand, setSelectedCardBrand] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [formMessage, setFormMessage] = useState('');
  const [cardForm, setCardForm] = useState({
    nameOnCard: '',
    cardNumber: '',
    cvv: '',
    expiry: '',
  });
  const [touched, setTouched] = useState({
    nameOnCard: false,
    cardNumber: false,
    cvv: false,
    expiry: false,
  });

  const stepCardWidth = Math.max(width - 40, 280);
  const stepCardGap = 14;
  const isPremiumUser = Boolean(user?.isPremium);
  const showActiveSubscriptionState = isPremiumUser && !paymentResult;
  const scrollToStep = (step) => {
    if (!horizontalStepsRef.current || step < 1) {
      return;
    }

    const stepIndex = step - 1;
    requestAnimationFrame(() => {
      horizontalStepsRef.current?.scrollTo({
        x: stepIndex * (stepCardWidth + stepCardGap),
        y: 0,
        animated: true,
      });
    });
  };

  useEffect(() => {
    scrollToStep(currentStep);
  }, [currentStep, stepCardGap, stepCardWidth]);

  const resetCardForm = () => {
    setCardForm({
      nameOnCard: '',
      cardNumber: '',
      cvv: '',
      expiry: '',
    });
    setTouched({
      nameOnCard: false,
      cardNumber: false,
      cvv: false,
      expiry: false,
    });
    setFormMessage('');
  };

  const errors = useMemo(() => {
    const nextErrors = {};

    if (!String(cardForm.nameOnCard || '').trim()) {
      nextErrors.nameOnCard = 'Name on card is required.';
    }

    if (digitsOnly(cardForm.cardNumber).length !== 16) {
      nextErrors.cardNumber = 'Card number must contain exactly 16 digits.';
    }

    if (!/^\d{3,4}$/.test(cardForm.cvv)) {
      nextErrors.cvv = 'CVV must contain 3 or 4 digits.';
    }

    if (!isExpiryValid(cardForm.expiry)) {
      nextErrors.expiry = 'Expiry must be current or a future month in MM/YY format.';
    }

    return nextErrors;
  }, [cardForm]);

  const isStepTwoValid = Object.keys(errors).length === 0;

  const handleContinueToStepTwo = () => {
    if (!paymentMethod) {
      return;
    }

    setCurrentStep(2);
  };

  const handleBackToStepOne = () => {
    resetCardForm();
    setCurrentStep(1);
  };

  const handleFieldChange = (field, value) => {
    setCardForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleFieldBlur = (field) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const handleSubmitPayment = async () => {
    const nextTouched = {
      nameOnCard: true,
      cardNumber: true,
      cvv: true,
      expiry: true,
    };

    setTouched(nextTouched);
    setFormMessage('');

    if (!isStepTwoValid || currentStep < 2 || paymentMethod !== PAYMENT_METHOD) {
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await customerAPI.premiumUpgrade({
        paymentMethod: PAYMENT_METHOD,
        cardBrand: selectedCardBrand,
        nameOnCard: cardForm.nameOnCard.trim(),
        cardNumber: cardForm.cardNumber,
        cvv: cardForm.cvv,
        expiry: cardForm.expiry,
        premiumPlan: 'wheelzy_premium_demo',
        upgradeType: 'premium_profile',
      });

      await updateStoredUser({
        isPremium: Boolean(data?.isPremium),
      });
      await refreshUser();
      setPaymentResult(data);
      setCurrentStep(3);
    } catch (error) {
      setFormMessage(error?.response?.data?.message || 'Unable to approve this demo payment right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToHome = () => {
    const premiumActivatedAt = Date.now();
    const parent = navigation.getParent();

    if (parent?.getState?.()?.routeNames?.includes('InventoryTab')) {
      parent.navigate('InventoryTab', {
        screen: 'CustomerSearchMain',
        params: { premiumActivatedAt },
      });
      return;
    }

    navigation.navigate('CustomerSearchMain', { premiumActivatedAt });
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top + 12, 44),
              paddingBottom: Math.max(insets.bottom + 40, 44),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Upgrade to Premium</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            ref={horizontalStepsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={stepCardWidth + stepCardGap}
            snapToAlignment="start"
            contentContainerStyle={styles.horizontalStepsContent}
            style={styles.horizontalSteps}
          >
            <View
              style={[
                styles.stepPage,
                {
                  width: stepCardWidth,
                  marginRight: showActiveSubscriptionState ? 0 : stepCardGap,
                },
              ]}
            >
              {showActiveSubscriptionState ? (
                <View style={styles.activeSubscriptionWrap}>
                  <ActiveSubscriptionCard amount={PREMIUM_AMOUNT} />
                </View>
              ) : (
                <SectionShell
                  step={1}
                  active={currentStep === 1}
                  complete={currentStep > 1}
                  locked={false}
                  title="Payment method"
                >
                  <PaymentMethodCard
                    amount={PREMIUM_AMOUNT}
                    selectedMethod={paymentMethod}
                    selectedCardBrand={selectedCardBrand}
                    onSelectMethod={setPaymentMethod}
                    onSelectCardBrand={setSelectedCardBrand}
                    onContinue={handleContinueToStepTwo}
                    isContinuing={false}
                    showActiveStatus={false}
                  />
                </SectionShell>
              )}
            </View>

            {!showActiveSubscriptionState && currentStep >= 2 ? (
              <View style={[styles.stepPage, { width: stepCardWidth, marginRight: currentStep >= 3 ? stepCardGap : 0 }]}>
                <SectionShell
                  step={2}
                  active={currentStep === 2}
                  complete={currentStep > 2}
                  locked={false}
                  title="Card details"
                >
                  <CardDetailsCard
                    amount={PREMIUM_AMOUNT}
                    form={cardForm}
                    errors={errors}
                    touched={touched}
                    canPay={isStepTwoValid}
                    submitting={submitting}
                    onChange={handleFieldChange}
                    onBlur={handleFieldBlur}
                    onBack={handleBackToStepOne}
                    onSubmit={handleSubmitPayment}
                    formMessage={formMessage}
                  />
                </SectionShell>
              </View>
            ) : null}

            {!showActiveSubscriptionState && currentStep >= 3 ? (
              <View style={[styles.stepPage, { width: stepCardWidth }]}>
                <SectionShell
                  step={3}
                  active
                  complete
                  locked={false}
                  title="Payment approved"
                >
                  <PaymentSuccessCard
                    amount={paymentResult?.amount || PREMIUM_AMOUNT}
                    purchaseId={paymentResult?.purchaseId || 'Pending'}
                    onBackToHome={handleBackToHome}
                  />
                </SectionShell>
              </View>
            ) : null}
          </ScrollView>

          <Text style={styles.footerNote}>
            Demo gateway only. No real payment processing or bank verification is used in this project flow.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  sectionShell: {
    marginTop: 10,
    marginBottom: 8,
  },
  activeSubscriptionWrap: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    ...Shadow.md,
  },
  sectionShellLocked: {
    opacity: 0.92,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748b',
  },
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#dbe4f4',
  },
  stepBadgeActive: {
    backgroundColor: '#dbeafe',
  },
  stepBadgeComplete: {
    backgroundColor: '#dcfce7',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepBadgeTextActive: {
    color: '#1d4ed8',
  },
  sectionCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    ...Shadow.md,
  },
  brandHeader: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: '#2348d6',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  brandCopy: {
    flex: 1,
    marginLeft: 14,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  brandSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255,255,255,0.84)',
  },
  brandAmount: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
  },
  brandHeading: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.84)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  cardBody: {
    padding: 18,
    backgroundColor: '#ffffff',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  methodOption: {
    marginTop: 14,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodOptionSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#f8fbff',
  },
  methodOptionPressed: {
    transform: [{ scale: 0.99 }],
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  methodCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  methodSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
  },
  cardBrandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  brandChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brandChipSelected: {
    backgroundColor: '#eef6ff',
    borderColor: '#93c5fd',
  },
  brandChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  brandChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  brandChipTextSelected: {
    color: '#1d4ed8',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#ffcb05',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d9e1ec',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  inputGroup: {
    marginTop: 14,
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d9e1ec',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
  },
  inputError: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff7f7',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  twoColumnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flexOne: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  payButton: {
    flex: 1,
  },
  formMessage: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: '#dc2626',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(241,245,249,0.92)',
  },
  lockText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    color: '#475569',
  },
  thankYouText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  successSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#64748b',
    textAlign: 'center',
  },
  receiptCard: {
    marginBottom: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  receiptValue: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
  receiptMeta: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  subscriptionActiveCard: {
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    ...Shadow.sm,
  },
  subscriptionActiveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#dcfce7',
  },
  subscriptionActiveBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subscriptionActiveTitle: {
    marginTop: 16,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#14532d',
    letterSpacing: -0.5,
  },
  subscriptionActiveCopy: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#3f3f46',
  },
  footerNote: {
    marginTop: 10,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
  },
  horizontalSteps: {
    marginTop: 4,
  },
  horizontalStepsContent: {
    paddingRight: 2,
  },
  stepPage: {
    alignSelf: 'flex-start',
  },
});
