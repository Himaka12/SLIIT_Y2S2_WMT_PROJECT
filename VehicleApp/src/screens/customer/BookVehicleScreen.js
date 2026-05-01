import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  UIManager,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, bookingAPI } from '../../api';
import AvailabilityStatusBox, {
  getSlotAvailabilityMeta,
  getVehicleAvailabilityMeta,
} from '../../components/AvailabilityStatusBox';
import CalendarDateField from '../../components/CalendarDateField';
import { getPremiumRentPriceMeta } from '../../components/VehicleDetailsShared';
import { InputField, PrimaryButton, SecondaryButton, Card } from '../../components/UI';
import SuccessToast from '../../components/SuccessToast';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useAppAlert } from '../../context/AppAlertContext';

function resolveAssetUri(path) {
  if (!path || typeof path !== 'string') {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/')) {
    return `${BASE_URL}${path}`;
  }

  return `${BASE_URL}/${path}`;
}

function isValidBookingWindow(startDate, startTime, endDate, endTime) {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return end >= start;
}

function getTodayDateString() {
  const today = new Date();
  const offsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - offsetMs).toISOString().split('T')[0];
}

const BUSINESS_BANK_OPTIONS = [
  {
    id: 'commercial-bank',
    name: 'Commercial Bank',
    shortLabel: 'CB',
    accent: '#1769b4',
    cardTint: '#eef6ff',
    borderColor: '#b8daf7',
    logoBackground: '#1769b4',
    logoTextColor: '#ffffff',
    accountHolderName: 'Wheelzy Business Payments',
    branchName: 'Malabe Branch',
    accountNumber: '1023456789',
    branchCode: '845',
  },
  {
    id: 'sampath-bank',
    name: 'Sampath Bank',
    shortLabel: 'SB',
    accent: '#f97316',
    cardTint: '#fff6ee',
    borderColor: '#ffd1ad',
    logoBackground: '#ffffff',
    logoTextColor: '#f97316',
    accountHolderName: 'Wheelzy Business Payments',
    branchName: 'Battaramulla Branch',
    accountNumber: '123456789012',
    branchCode: '221',
  },
  {
    id: 'peoples-bank',
    name: "People's Bank",
    shortLabel: 'PB',
    accent: '#c81e1e',
    cardTint: '#fff8df',
    borderColor: '#f8d774',
    logoBackground: '#facc15',
    logoTextColor: '#c81e1e',
    accountHolderName: 'Wheelzy Business Payments',
    branchName: 'Nugegoda Branch',
    accountNumber: '123456789012345',
    branchCode: '017',
  },
];

function PaymentDetailRow({ label, value, tone = '#111111', isLast = false }) {
  return (
    <View style={[styles.paymentDetailRow, isLast && styles.paymentDetailRowLast]}>
      <Text style={styles.paymentDetailLabel}>{label}</Text>
      <Text style={[styles.paymentDetailValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function BankLogoBadge({ bank }) {
  return (
    <View
      style={[
        styles.bankLogoBadge,
        {
          backgroundColor: bank.logoBackground,
          borderColor: bank.accent,
        },
      ]}
    >
      <Text style={[styles.bankLogoBadgeText, { color: bank.logoTextColor }]}>{bank.shortLabel}</Text>
    </View>
  );
}

function BankSelectorCard({ bank, active, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.bankSelectorCard,
        {
          backgroundColor: active ? bank.cardTint : '#ffffff',
          borderColor: active ? bank.accent : '#e5e7eb',
        },
        active && styles.bankSelectorCardActive,
      ]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      <View style={styles.bankSelectorCardLeft}>
        <BankLogoBadge bank={bank} />
        <View style={styles.bankSelectorCopy}>
          <Text style={styles.bankSelectorTitle}>{bank.name}</Text>
          <Text style={styles.bankSelectorSubtitle}>Business payments</Text>
        </View>
      </View>
      <View
        style={[
          styles.bankSelectorChevronWrap,
          {
            backgroundColor: active ? bank.accent : '#f8fafc',
          },
        ]}
      >
        <MaterialCommunityIcons
          name={active ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={active ? '#ffffff' : '#64748b'}
        />
      </View>
    </TouchableOpacity>
  );
}

function BankAccountDetailsCard({ bank }) {
  return (
    <View
      style={[
        styles.bankAccountDetailsCard,
        {
          borderColor: bank.borderColor,
          backgroundColor: bank.cardTint,
          shadowColor: bank.accent,
        },
      ]}
    >
      <View style={styles.bankAccountDetailsHeader}>
        <View style={styles.bankAccountDetailsHeaderLeft}>
          <BankLogoBadge bank={bank} />
          <View style={styles.bankAccountDetailsCopy}>
            <Text style={styles.bankAccountDetailsTitle}>{bank.name}</Text>
            <Text style={styles.bankAccountDetailsSubtitle}>Sample business account details</Text>
          </View>
        </View>
        <View style={[styles.bankAccountActivePill, { backgroundColor: bank.accent }]}>
          <Text style={styles.bankAccountActivePillText}>Selected</Text>
        </View>
      </View>

      <View style={styles.bankAccountGrid}>
        <PaymentDetailRow label="Account Holder Name" value={bank.accountHolderName} tone={bank.accent} />
        <PaymentDetailRow label="Bank Name" value={bank.name} tone="#111111" />
        <PaymentDetailRow label="Branch Name" value={bank.branchName} tone="#111111" />
        <PaymentDetailRow label="Account Number" value={bank.accountNumber} tone={bank.accent} />
        <PaymentDetailRow label="Branch Code" value={bank.branchCode} tone="#111111" isLast />
      </View>

    </View>
  );
}

export default function BookVehicleScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { vehicle } = params;
  const { user } = useAuth();
  const { showAlert } = useAppAlert();

  const today = getTodayDateString();

  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState('18:00');
  const [requestedUnits, setRequestedUnits] = useState('1');
  const [slip, setSlip] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [availabilityInfo, setAvailabilityInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Booking sent successfully');
  const [toastBackgroundColor, setToastBackgroundColor] = useState('#16a34a');
  const bookingTimeoutRef = useRef(null);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => () => {
    if (bookingTimeoutRef.current) {
      clearTimeout(bookingTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setAvailabilityInfo(null);
    setDateError('');
  }, [startDate, startTime, endDate, endTime, requestedUnits]);

  const parsedRequestedUnits = Math.max(1, Number.parseInt(requestedUnits || '1', 10) || 1);
  const selectedBank = useMemo(
    () => BUSINESS_BANK_OPTIONS.find((item) => item.id === selectedBankId) || null,
    [selectedBankId],
  );

  const showToast = (message, backgroundColor = '#16a34a') => {
    setToastBackgroundColor(backgroundColor);
    setToastMessage(message);
    setShowSuccessToast(true);

    if (bookingTimeoutRef.current) {
      clearTimeout(bookingTimeoutRef.current);
    }

    bookingTimeoutRef.current = setTimeout(() => {
      setShowSuccessToast(false);
    }, 1800);
  };

  const toggleBankSelection = (bankId) => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        springDamping: 0.84,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    setSelectedBankId((current) => (current === bankId ? null : bankId));
  };

  const validateBookingWindow = () => {
    const normalizedToday = getTodayDateString();

    if (startDate < normalizedToday) {
      const message = 'Start date cannot be before today.';
      setDateError(message);
      showAlert('Invalid Selection', message);
      return false;
    }

    if (!isValidBookingWindow(startDate, startTime, endDate, endTime)) {
      const message = 'End date and time must be after the start date and time.';
      setDateError(message);
      showAlert('Invalid Selection', message);
      return false;
    }

    if (parsedRequestedUnits > Math.max(0, Number(vehicle?.quantity || 0))) {
      const message = 'Cannot exceed more than available quantity';
      showToast(message, Colors.danger);
      return false;
    }

    setDateError('');
    return true;
  };

  const checkAvailability = async () => {
    if (!validateBookingWindow()) {
      return;
    }

    setChecking(true);
    try {
      const { data } = await bookingAPI.checkAvailability({
        vehicleId: vehicle._id,
        startDate,
        endDate,
        startTime,
        endTime,
        requestedUnits: parsedRequestedUnits,
      });
      setAvailabilityInfo(data);
    } catch (err) {
      showAlert(
        'Error',
        err?.response?.data?.error || 'Failed to check availability.',
        undefined,
        { tone: 'danger' },
      );
      setAvailabilityInfo(null);
    }
    setChecking(false);
  };

  const pickSlip = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setSlip({
        uri: asset.uri,
        name: asset.fileName || 'slip.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleBook = async () => {
    if (!slip) {
      showAlert('Required', 'Please upload your payment slip.');
      return;
    }

    if (!validateBookingWindow()) {
      return;
    }

    if (!vehicleBookable) {
      showAlert('Unavailable', Number(vehicle?.quantity || 0) <= 0 ? 'This rental vehicle is out of stock.' : 'This rental vehicle is currently unavailable.', undefined, { tone: 'danger' });
      return;
    }

    if (!slotAvailability?.available) {
      showAlert('Unavailable', 'Please verify availability first.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('vehicleId', vehicle._id);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('startTime', startTime);
      formData.append('endTime', endTime);
      formData.append('requestedUnits', String(parsedRequestedUnits));
      formData.append('paymentSlip', { uri: slip.uri, name: slip.name, type: slip.type });

      await bookingAPI.create(formData);
      setToastBackgroundColor('#16a34a');
      setToastMessage('Booking sent successfully');
      setShowSuccessToast(true);
      bookingTimeoutRef.current = setTimeout(() => {
        navigation.goBack();
      }, 1100);
    } catch (err) {
      showAlert(
        'Booking Failed',
        err?.response?.data?.message || 'Please try again.',
        undefined,
        { tone: 'danger' },
      );
    }
    setLoading(false);
  };

  const days = Math.max(
    0,
    Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1,
  );
  const premiumRentMeta = useMemo(() => getPremiumRentPriceMeta(user, vehicle), [user, vehicle]);
  const effectiveDailyRate = premiumRentMeta.eligible ? premiumRentMeta.discountedPrice : Number(vehicle?.price || 0);
  const total = days * effectiveDailyRate * parsedRequestedUnits;
  const vehicleImage = resolveAssetUri(
    vehicle?.image1 || vehicle?.image2 || vehicle?.image3 || vehicle?.image4 || vehicle?.image5,
  );
  const vehicleSubtitle = [vehicle?.brand, vehicle?.category, vehicle?.manufactureYear]
    .filter(Boolean)
    .join(' • ');
  const vehicleAvailability = useMemo(
    () => getVehicleAvailabilityMeta(vehicle?.quantity),
    [vehicle?.quantity],
  );
  const vehicleBookable = useMemo(() => {
    const quantity = Math.max(0, Number(vehicle?.quantity || 0));
    const normalizedStatus = String(vehicle?.status || '').trim().toLowerCase();

    if (quantity <= 0) {
      return false;
    }

    if (!normalizedStatus) {
      return true;
    }

    return normalizedStatus === 'available';
  }, [vehicle?.quantity, vehicle?.status]);
  const slotAvailability = useMemo(
    () => (availabilityInfo ? getSlotAvailabilityMeta(availabilityInfo) : null),
    [availabilityInfo],
  );
  const slotRemainingCount = Math.max(
    0,
    Number(
      availabilityInfo?.remainingQuantity
      ?? availabilityInfo?.remainingUnits
      ?? vehicle?.quantity
      ?? 0,
    ) || 0,
  );
  const hideBookingFlowAfterAvailabilityCheck = Boolean(availabilityInfo) && !availabilityInfo?.available;
  const bookingBlocked = !slotAvailability?.available || !slip || Boolean(dateError);

  return (
    <View style={styles.root}>
      <SuccessToast visible={showSuccessToast} message={toastMessage} backgroundColor={toastBackgroundColor} />
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Text style={styles.pageTitle}>Book Vehicle</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroMediaWrap}>
              {vehicleImage ? (
                <Image source={{ uri: vehicleImage }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroImageFallback}>
                  <Text style={styles.heroImageFallbackText}>Wheelzy</Text>
                </View>
              )}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Selected Vehicle</Text>
              <Text style={styles.vehicleName}>{vehicle.brand} {vehicle.model}</Text>
              <Text style={styles.vehicleSubtitle}>{vehicleSubtitle || 'Premium rental vehicle'}</Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaPill}>
                  <Text style={styles.heroMetaPillText}>For Rent</Text>
                </View>
                <View style={styles.heroPriceStack}>
                  <Text style={styles.vehiclePrice}>Rs. {Number(effectiveDailyRate).toLocaleString()} /day</Text>
                  {premiumRentMeta.eligible ? (
                    <Text style={styles.vehiclePriceOld}>Rs. {Number(premiumRentMeta.originalPrice).toLocaleString()} /day</Text>
                  ) : null}
                </View>
              </View>

              <AvailabilityStatusBox
                title={vehicleAvailability.title}
                subtitle={vehicleAvailability.subtitle}
                tone={vehicleAvailability.tone}
                style={styles.heroAvailabilityBox}
              />
            </View>
          </View>

          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Rental Period</Text>
            <View style={styles.dateRow}>
              <View style={styles.flexField}>
                <CalendarDateField
                  label="Start Date"
                  value={startDate}
                  onChange={(nextDate) => {
                    setStartDate(nextDate);
                    if (endDate < nextDate) {
                      setEndDate(nextDate);
                    }
                  }}
                  minDate={getTodayDateString()}
                  error={dateError && startDate < getTodayDateString() ? dateError : ''}
                />
              </View>
              <View style={styles.flexField}>
                <InputField
                  label="Start Time"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                />
              </View>
            </View>
            <View style={styles.dateRow}>
              <View style={styles.flexField}>
                <CalendarDateField
                  label="End Date"
                  value={endDate}
                  onChange={(nextDate) => {
                    setEndDate(nextDate);
                  }}
                  minDate={startDate}
                  error={dateError && endDate < startDate ? dateError : ''}
                />
              </View>
              <View style={styles.flexField}>
                <InputField
                  label="End Time"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="18:00"
                />
              </View>
            </View>
            <View style={styles.quantityInputWrap}>
              <InputField
                label="Quantity"
                value={requestedUnits}
                onChangeText={(value) => {
                  const sanitized = String(value || '').replace(/[^0-9]/g, '').slice(0, 2);
                  setRequestedUnits(sanitized);
                }}
                placeholder="Enter quantity"
                keyboardType="number-pad"
              />
            </View>

            <SecondaryButton
              title={checking ? 'Checking...' : 'Check Availability'}
              onPress={checkAvailability}
              style={styles.secondaryCta}
            />

            {slotAvailability ? (
              <AvailabilityStatusBox
                title={slotAvailability.title}
                subtitle={slotAvailability.subtitle}
                detailRows={[
                  {
                    label: 'Requested',
                    value: String(parsedRequestedUnits),
                    secondaryValue: String(availabilityInfo?.projectedRemainingQuantity ?? 0),
                    secondaryLabel: 'Remaining',
                  },
                ]}
                detail={
                  availabilityInfo && availabilityInfo.available === false && slotRemainingCount > 0
                    ? `Only ${slotRemainingCount} unit${slotRemainingCount === 1 ? '' : 's'} can be booked for this time period. Reduce your requested quantity to continue.`
                    : undefined
                }
                compactDetailRows
                tone={slotAvailability.tone}
                style={styles.slotAvailabilityBox}
              />
            ) : null}

            {dateError ? (
              <Text style={styles.dateErrorText}>{dateError}</Text>
            ) : null}
          </Card>

          {!hideBookingFlowAfterAvailabilityCheck ? (
            <>
              <Card style={styles.formCard}>
                <Text style={styles.sectionTitle}>Business Bank Account</Text>
                <Text style={styles.bankSelectorHint}>
                  Select one bank below to view its sample business payment details.
                </Text>

                <View style={styles.bankSelectorList}>
                  {BUSINESS_BANK_OPTIONS.map((bank) => (
                    <BankSelectorCard
                      key={bank.id}
                      bank={bank}
                      active={selectedBankId === bank.id}
                      onPress={() => toggleBankSelection(bank.id)}
                    />
                  ))}
                </View>

                {selectedBank ? <BankAccountDetailsCard bank={selectedBank} /> : null}

                <View style={styles.paymentInstructionCard}>
                  <View style={styles.paymentInstructionBadge}>
                    <MaterialCommunityIcons name="bank-transfer-out" size={16} color="#8a6b00" />
                    <Text style={styles.paymentInstructionBadgeText}>Payment Steps</Text>
                  </View>
                  <Text style={styles.paymentInstructionText}>
                    1. Transfer the correct booking amount to the business account.
                  </Text>
                  <Text style={styles.paymentInstructionText}>
                    2. Save a clear screenshot or slip after the payment.
                  </Text>
                  <Text style={styles.paymentInstructionText}>
                    3. Upload that slip below to complete your booking request.
                  </Text>
                </View>

                <View style={styles.paymentAmountCard}>
                  <Text style={styles.paymentAmountLabel}>Amount to Pay</Text>
                  <Text style={styles.paymentAmountValue}>Rs. {Number(total).toLocaleString()}</Text>
                </View>
              </Card>

              <Card style={styles.formCard}>
                <Text style={styles.sectionTitle}>Payment Slip</Text>
                <Text style={styles.slipHint}>Upload your payment proof to complete the booking request.</Text>

                <TouchableOpacity style={styles.uploadBtn} onPress={pickSlip}>
                  <Text style={styles.uploadIcon}>{slip ? 'OK' : 'IMG'}</Text>
                  <Text style={styles.uploadText}>{slip ? slip.name : 'Tap to upload payment slip'}</Text>
                </TouchableOpacity>

                {slip?.uri ? (
                  <Image
                    source={{ uri: slip.uri }}
                    style={styles.slipPreviewImage}
                    resizeMode="cover"
                  />
                ) : null}
              </Card>

              {days > 0 ? (
                <Card style={styles.summaryCard}>
                  <Text style={styles.sectionTitle}>Price Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Daily Rate</Text>
                    <View style={styles.summaryValueWrap}>
                      <Text style={styles.summaryValue}>Rs. {Number(effectiveDailyRate).toLocaleString()}</Text>
                      {premiumRentMeta.eligible ? (
                        <Text style={styles.summaryValueOld}>Rs. {Number(premiumRentMeta.originalPrice).toLocaleString()}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Days</Text>
                    <Text style={styles.summaryValue}>{days}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Units</Text>
                    <Text style={styles.summaryValue}>{parsedRequestedUnits}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>Rs. {Number(total).toLocaleString()}</Text>
                  </View>
                </Card>
              ) : null}

              <View style={styles.ctaBlock}>
                <PrimaryButton
                  title="Confirm Booking"
                  onPress={handleBook}
                  loading={loading}
                  disabled={bookingBlocked}
                  style={styles.primaryCta}
                  textStyle={styles.primaryCtaText}
                />
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f3ee' },
  container: { paddingHorizontal: 20, paddingTop: 22, gap: 18, paddingBottom: 48 },
  topBar: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 30,
    backgroundColor: '#ffffff',
    padding: 14,
    ...Shadow.md,
  },
  heroMediaWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#e7edf4',
    marginBottom: 14,
  },
  heroImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#e5e7eb',
  },
  heroImageFallback: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  heroImageFallbackText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748b',
  },
  heroCopy: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.promo,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  vehicleName: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#111111',
    marginTop: 8,
    letterSpacing: -0.8,
  },
  vehicleSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.muted,
    marginTop: 8,
  },
  heroMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  heroMetaPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.rentSoft,
  },
  heroMetaPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.rent,
    letterSpacing: 0.4,
  },
  heroPriceStack: {
    flexShrink: 1,
    gap: 2,
  },
  vehiclePrice: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '900',
  },
  vehiclePriceOld: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  quantityTag: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe2ea',
  },
  quantityTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroAvailabilityBox: {
    marginTop: 14,
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: '#ffffff',
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flexField: {
    flex: 1,
  },
  quantityInputWrap: {
    marginTop: 4,
  },
  secondaryCta: {
    marginTop: 4,
  },
  slotAvailabilityBox: {
    marginTop: Spacing.md,
  },
  dateErrorText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '700',
  },
  slipHint: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  bankSelectorHint: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 20,
  },
  bankSelectorList: {
    marginTop: 14,
    gap: 12,
  },
  bankSelectorCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    ...Shadow.sm,
  },
  bankSelectorCardActive: {
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  bankSelectorCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  bankSelectorCopy: {
    flex: 1,
    minWidth: 0,
  },
  bankSelectorTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
  bankSelectorSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  bankSelectorChevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  bankLogoBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Shadow.sm,
  },
  bankLogoBadgeText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  bankAccountDetailsCard: {
    marginTop: 14,
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    ...Shadow.md,
  },
  bankAccountDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  bankAccountDetailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  bankAccountDetailsCopy: {
    flex: 1,
    minWidth: 0,
  },
  bankAccountDetailsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  bankAccountDetailsSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  bankAccountActivePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  bankAccountActivePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  bankAccountGrid: {
    marginTop: 16,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  paymentDetailRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    gap: 6,
  },
  paymentDetailRowLast: {
    borderBottomWidth: 0,
  },
  paymentDetailLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  paymentDetailValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  paymentInstructionCard: {
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fffbea',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  paymentInstructionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#fff3c4',
    marginBottom: 10,
  },
  paymentInstructionBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8a6b00',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  paymentInstructionText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4b5563',
    fontWeight: '700',
    marginTop: 2,
  },
  paymentAmountCard: {
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentAmountLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  paymentAmountValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  uploadBtn: {
    borderWidth: 2,
    borderColor: Colors.stroke,
    borderStyle: 'dashed',
    borderRadius: 22,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#f9fbff',
  },
  uploadIcon: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  uploadText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  slipPreviewImage: {
    width: '100%',
    height: 220,
    borderRadius: 22,
    marginTop: 14,
    backgroundColor: '#f8fafc',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    ...Shadow.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.muted,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  summaryValueWrap: {
    alignItems: 'flex-end',
  },
  summaryValueOld: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.blue,
  },
  ctaBlock: {
    gap: 10,
    paddingTop: 4,
  },
  primaryCta: {
    borderRadius: Radius.full,
    minHeight: 56,
    backgroundColor: '#facc15',
  },
  primaryCtaText: {
    color: '#111111',
  },
});


