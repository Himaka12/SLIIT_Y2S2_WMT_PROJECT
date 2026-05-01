import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, refundAPI } from '../../api';
import SuccessToast from '../../components/SuccessToast';
import { InputField, PrimaryButton, StatusBadge } from '../../components/UI';
import { Colors, Radius, Shadow } from '../../constants/theme';
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

function getVehicleImageUri(vehicle) {
  const imagePath = vehicle?.image1 || vehicle?.image2 || vehicle?.image3 || vehicle?.image4 || vehicle?.image5 || vehicle?.image || vehicle?.thumbnail;
  return resolveAssetUri(imagePath);
}

function buildErrors({ bankName, branchName, accountNumber, accountHolderName }) {
  const nextErrors = {};

  if (!accountHolderName.trim()) {
    nextErrors.accountHolderName = 'Account holder name is required.';
  }

  if (!bankName.trim()) {
    nextErrors.bankName = 'Bank name is required.';
  }

  if (!branchName.trim()) {
    nextErrors.branchName = 'Branch is required.';
  }

  if (!/^\d{6,20}$/.test(accountNumber.trim())) {
    nextErrors.accountNumber = 'Account number must be 6 to 20 digits.';
  }

  return nextErrors;
}

export default function ClaimRefundScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { showAlert } = useAppAlert();
  const booking = params?.booking;
  const refundMeta = booking?.refundMeta || null;
  const vehicleImageUri = getVehicleImageUri(booking?.vehicle);

  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const dismissTimeoutRef = useRef(null);
  const navTimeoutRef = useRef(null);

  const bookingSummary = useMemo(
    () => ({
      title: `${booking?.vehicle?.brand || ''} ${booking?.vehicle?.model || ''}`.trim() || 'Selected Vehicle',
      period: [booking?.startDate, booking?.startTime, booking?.endDate, booking?.endTime].filter(Boolean).join(' • '),
      decisionLabel: booking?.status || refundMeta?.bookingStatus || 'Booking',
    }),
    [booking, refundMeta?.bookingStatus],
  );

  const dismiss = () => {
    navigation.goBack();
  };

  useEffect(() => () => {
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
    }
  }, []);

  const handleSubmit = async () => {
    const nextErrors = buildErrors({
      bankName,
      branchName,
      accountNumber,
      accountHolderName,
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      await refundAPI.claim(booking._id, {
        bankName: bankName.trim(),
        branchName: branchName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim(),
      });

      setShowToast(true);

      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
      }

      dismissTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
      }, 1800);

      navTimeoutRef.current = setTimeout(() => {
        navigation.goBack();
      }, 1900);
    } catch (error) {
      const backendErrors = error?.response?.data?.errors || {};
      if (Object.keys(backendErrors).length > 0) {
        setErrors(backendErrors);
      }

      showAlert(
        'Refund Unavailable',
        error?.response?.data?.message || 'Unable to submit the refund request right now.',
        undefined,
        { tone: 'danger' },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SuccessToast visible={showToast} message="Refund request sent successfully" />
      <BlurView intensity={32} tint="light" style={styles.blurLayer} />
      <Pressable style={styles.dimLayer} onPress={dismiss} />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.sheet}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Request Refund</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={dismiss} activeOpacity={0.88}>
              <MaterialCommunityIcons name="close" size={22} color="#111111" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewVehicleCard}>
              {vehicleImageUri ? (
                <Image source={{ uri: vehicleImageUri }} style={styles.previewVehicleImage} resizeMode="cover" />
              ) : (
                <View style={styles.previewVehicleFallback}>
                  <MaterialCommunityIcons name="car-sports" size={32} color="#94a3b8" />
                </View>
              )}

              <View style={styles.previewVehicleCopy}>
                <View style={styles.previewVehicleTopRow}>
                  <Text style={styles.previewVehicleTitle}>{bookingSummary.title}</Text>
                  <StatusBadge status={refundMeta?.status || 'Refund Available'} />
                </View>
                <Text style={styles.previewVehicleSubtitle}>
                  {[booking?.vehicle?.category, booking?.vehicle?.manufactureYear, booking?.vehicle?.listingType].filter(Boolean).join(' • ') || 'Rental vehicle'}
                </Text>
                <View style={styles.previewTagRow}>
                  <View style={styles.previewTag}>
                    <Text style={styles.previewTagText}>Rs. {Number(booking?.vehicle?.price || 0).toLocaleString()} /day</Text>
                  </View>
                  <View style={styles.previewTag}>
                    <Text style={styles.previewTagText}>{bookingSummary.decisionLabel}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Booking Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Booking Period</Text>
                <Text style={styles.infoValue}>{bookingSummary.period || 'Rental booking details'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Status</Text>
                <Text style={styles.infoValue}>{bookingSummary.decisionLabel}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Bank Account</Text>
              <InputField
                label="Account Holder Name"
                style={styles.fieldWrapCompact}
                inputStyle={styles.roundedInput}
                value={accountHolderName}
                onChangeText={(value) => {
                  setAccountHolderName(value);
                  if (errors.accountHolderName) {
                    setErrors((current) => ({ ...current, accountHolderName: undefined }));
                  }
                }}
                placeholder="Enter account holder name"
                error={errors.accountHolderName}
                autoCapitalize="words"
              />
              <InputField
                label="Bank Name"
                style={styles.fieldWrapCompact}
                inputStyle={styles.roundedInput}
                value={bankName}
                onChangeText={(value) => {
                  setBankName(value);
                  if (errors.bankName) {
                    setErrors((current) => ({ ...current, bankName: undefined }));
                  }
                }}
                placeholder="Enter bank name"
                error={errors.bankName}
              />
              <InputField
                label="Branch"
                style={styles.fieldWrapCompact}
                inputStyle={styles.roundedInput}
                value={branchName}
                onChangeText={(value) => {
                  setBranchName(value);
                  if (errors.branchName) {
                    setErrors((current) => ({ ...current, branchName: undefined }));
                  }
                }}
                placeholder="Enter branch"
                error={errors.branchName}
              />
              <InputField
                label="Account Number"
                style={styles.fieldWrapCompact}
                inputStyle={styles.roundedInput}
                value={accountNumber}
                onChangeText={(value) => {
                  const sanitized = value.replace(/[^0-9]/g, '').slice(0, 20);
                  setAccountNumber(sanitized);
                  if (errors.accountNumber) {
                    setErrors((current) => ({ ...current, accountNumber: undefined }));
                  }
                }}
                placeholder="Enter account number"
                error={errors.accountNumber}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.noticeCard}>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#b45309" />
              <Text style={styles.noticeText}>
                Refund requests are accepted only within 24 hours after admin approval or rejection.
              </Text>
            </View>

            <PrimaryButton
              title="Submit Refund Request"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
              textStyle={styles.submitButtonText}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.30)',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 22,
    maxHeight: '86%',
    ...Shadow.lg,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: '#d6dde8',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
  },
  headerCopy: {
    flex: 1,
    paddingTop: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  previewVehicleCard: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  previewVehicleImage: {
    width: 106,
    height: 128,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  previewVehicleFallback: {
    width: 106,
    height: 128,
    borderRadius: 20,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVehicleCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewVehicleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewVehicleTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  previewVehicleSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.muted,
  },
  previewTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  previewTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  sectionCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    fontWeight: '800',
    color: '#111111',
  },
  fieldWrapCompact: {
    marginBottom: 14,
  },
  roundedInput: {
    height: 52,
    borderRadius: 24,
    paddingHorizontal: 18,
    backgroundColor: '#f8fafc',
    borderColor: '#dbe4ef',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 16,
    marginBottom: 18,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#92400e',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#ffd400',
    minHeight: 54,
    borderRadius: 27,
  },
  submitButtonText: {
    color: '#111111',
    fontWeight: '900',
  },
});
