import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, customerAPI } from '../../api';
import SuccessToast from '../../components/SuccessToast';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

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

function SectionCard({ title, subtitle, children }) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({ label, value, onChangeText, onBlur, placeholder, keyboardType = 'default', error, maxLength }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </View>
  );
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  secondaryPhone: '',
  houseNo: '',
  lane: '',
  city: '',
  district: '',
  province: '',
  postalCode: '',
};

const EMPTY_TOUCHED = {
  firstName: false,
  phone: false,
  secondaryPhone: false,
  postalCode: false,
};

const splitFullName = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};

const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);
const sanitizePostalCode = (value) => String(value || '').replace(/\D/g, '').slice(0, 5);

export default function EditDetailsScreen({ navigation }) {
  const route = useRoute();
  const { refreshUser } = useAuth();
  const initialProfile = route.params?.initialProfile || null;
  const toastTimeoutRef = useRef(null);
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(EMPTY_TOUCHED);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await customerAPI.getProfile();
        const fallbackName = splitFullName(data?.fullName);

        setProfile(data || null);
        setForm({
          firstName: data?.firstName || fallbackName.firstName || '',
          lastName: data?.lastName || fallbackName.lastName || '',
          phone: data?.phone || data?.contactNumber || '',
          secondaryPhone: data?.secondaryPhone || '',
          houseNo: data?.address?.houseNo || '',
          lane: data?.address?.lane || '',
          city: data?.address?.city || '',
          district: data?.address?.district || '',
          province: data?.address?.province || '',
          postalCode: data?.address?.postalCode || '',
        });
      } catch (_) {
        // Keep screen stable.
      }
    };

    if (initialProfile) {
      const fallbackName = splitFullName(initialProfile?.fullName);
      setForm({
        firstName: initialProfile?.firstName || fallbackName.firstName || '',
        lastName: initialProfile?.lastName || fallbackName.lastName || '',
        phone: initialProfile?.phone || initialProfile?.contactNumber || '',
        secondaryPhone: initialProfile?.secondaryPhone || '',
        houseNo: initialProfile?.address?.houseNo || '',
        lane: initialProfile?.address?.lane || '',
        city: initialProfile?.address?.city || '',
        district: initialProfile?.address?.district || '',
        province: initialProfile?.address?.province || '',
        postalCode: initialProfile?.address?.postalCode || '',
      });
    }

    load();

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const profileImageUri = useMemo(() => {
    if (selectedImage?.uri) {
      return selectedImage.uri;
    }

    return resolveAssetUri(profile?.profileImage);
  }, [profile?.profileImage, selectedImage]);

  const errors = useMemo(() => {
    const nextErrors = {};

    if (!String(form.firstName || '').trim()) {
      nextErrors.firstName = 'First name is required.';
    }

    if (!/^\d{10}$/.test(form.phone || '')) {
      nextErrors.phone = 'Primary phone number must have exactly 10 digits.';
    }

    if (form.secondaryPhone && !/^\d{10}$/.test(form.secondaryPhone)) {
      nextErrors.secondaryPhone = 'Secondary phone number must have exactly 10 digits.';
    }

    if (
      form.secondaryPhone &&
      /^\d{10}$/.test(form.secondaryPhone) &&
      form.secondaryPhone === form.phone
    ) {
      nextErrors.secondaryPhone = 'Secondary phone number cannot be the same as the primary phone number.';
    }

    if (form.postalCode && !/^\d{5}$/.test(form.postalCode)) {
      nextErrors.postalCode = 'Postal code must contain exactly 5 numbers.';
    }

    return nextErrors;
  }, [form]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const setFieldValue = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const markTouched = (field) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormMessage('Please allow photo access to upload a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    setSelectedImage({
      uri: asset.uri,
      name: asset.fileName || `profile_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
    setFormMessage('');
  };

  const handleSave = async () => {
    const nextTouched = {
      firstName: true,
      phone: true,
      secondaryPhone: true,
      postalCode: true,
    };
    setTouched(nextTouched);
    setFormMessage('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      const payload = new FormData();
      payload.append('firstName', String(form.firstName || '').trim());
      payload.append('lastName', String(form.lastName || '').trim());
      payload.append('phone', sanitizePhone(form.phone));
      payload.append('secondaryPhone', sanitizePhone(form.secondaryPhone));
      payload.append('houseNo', String(form.houseNo || '').trim());
      payload.append('lane', String(form.lane || '').trim());
      payload.append('city', String(form.city || '').trim());
      payload.append('district', String(form.district || '').trim());
      payload.append('province', String(form.province || '').trim());
      payload.append('postalCode', sanitizePostalCode(form.postalCode));

      if (selectedImage?.uri) {
        payload.append('profileImage', {
          uri: selectedImage.uri,
          name: selectedImage.name,
          type: selectedImage.type,
        });
      }

      const { data } = await customerAPI.updateProfile(payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProfile(data || null);
      setSelectedImage(null);
      await refreshUser();

      setFeedbackMessage('Details updated successfully');
      setShowToast(true);

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
        navigation.goBack();
      }, 1200);
    } catch (error) {
      setFormMessage(error?.response?.data?.message || 'Unable to update your details right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SuccessToast visible={showToast} message={feedbackMessage} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
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
            <Text style={styles.pageTitle}>Edit Details</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.photoSection}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons name="account-outline" size={48} color="#6b7280" />
              </View>
            )}

            <TouchableOpacity style={styles.photoButton} onPress={pickProfileImage} activeOpacity={0.9}>
              <Text style={styles.photoButtonText}>{profileImageUri ? 'Change Photo' : 'Upload Photo'}</Text>
            </TouchableOpacity>
          </View>

          <SectionCard
            title="Full Name"
            subtitle="Use the name you want shown across your account."
          >
            <Field
              label="First Name"
              value={form.firstName}
              onChangeText={(value) => setFieldValue('firstName', value)}
              onBlur={() => markTouched('firstName')}
              placeholder="Enter first name"
              error={touched.firstName ? errors.firstName : ''}
            />
            <Field
              label="Last Name"
              value={form.lastName}
              onChangeText={(value) => setFieldValue('lastName', value)}
              placeholder="Enter last name"
            />
          </SectionCard>

          <SectionCard
            title="Phone Information"
            subtitle="Primary number is required. Secondary number is optional."
          >
            <Field
              label="Primary Phone Number"
              value={form.phone}
              onChangeText={(value) => setFieldValue('phone', sanitizePhone(value))}
              onBlur={() => markTouched('phone')}
              placeholder="07XXXXXXXX"
              keyboardType="number-pad"
              maxLength={10}
              error={touched.phone ? errors.phone : ''}
            />
            <Field
              label="Secondary Phone Number"
              value={form.secondaryPhone}
              onChangeText={(value) => setFieldValue('secondaryPhone', sanitizePhone(value))}
              onBlur={() => markTouched('secondaryPhone')}
              placeholder="Optional"
              keyboardType="number-pad"
              maxLength={10}
              error={touched.secondaryPhone ? errors.secondaryPhone : ''}
            />
          </SectionCard>

          <SectionCard
            title="Address Information"
            subtitle="Fill only what you want to keep on your profile. You can update later anytime."
          >
            <Field
              label="House No / Name"
              value={form.houseNo}
              onChangeText={(value) => setFieldValue('houseNo', value)}
              placeholder="Apartment / house name or number"
            />
            <Field
              label="Lane / Street"
              value={form.lane}
              onChangeText={(value) => setFieldValue('lane', value)}
              placeholder="House number / street"
            />
            <Field
              label="City / Town"
              value={form.city}
              onChangeText={(value) => setFieldValue('city', value)}
              placeholder="Enter city or town"
            />
            <Field
              label="District"
              value={form.district}
              onChangeText={(value) => setFieldValue('district', value)}
              placeholder="Enter district"
            />
            <Field
              label="Province"
              value={form.province}
              onChangeText={(value) => setFieldValue('province', value)}
              placeholder="Enter province"
            />
            <Field
              label="Postal Code"
              value={form.postalCode}
              onChangeText={(value) => setFieldValue('postalCode', sanitizePostalCode(value))}
              onBlur={() => markTouched('postalCode')}
              placeholder="5 digit postal code"
              keyboardType="number-pad"
              maxLength={5}
              error={touched.postalCode ? errors.postalCode : ''}
            />
          </SectionCard>

          {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryAction, !canSubmit && styles.actionDisabled]}
              onPress={handleSave}
              disabled={!canSubmit}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryActionText}>{submitting ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 22,
    paddingTop: 52,
    paddingBottom: 40,
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
  photoSection: {
    marginTop: 18,
    alignItems: 'center',
  },
  avatarImage: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#e5e7eb',
  },
  avatarPlaceholder: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionWrap: {
    marginTop: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#6b7280',
  },
  sectionCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#edf2f7',
    ...Shadow.sm,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  input: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: Colors.danger,
  },
  inlineError: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
  },
  formMessage: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.danger,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    height: 54,
    borderRadius: Radius.xl,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  primaryAction: {
    flex: 1.2,
    height: 54,
    borderRadius: Radius.xl,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionDisabled: {
    opacity: 0.45,
  },
});
