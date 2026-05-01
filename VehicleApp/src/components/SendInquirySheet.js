import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';

const CONTACT_METHODS = ['Call', 'WhatsApp', 'Email'];
const INQUIRY_TYPES = [
  'Price Negotiation',
  'Vehicle Availability',
  'Finance / Installment',
  'Vehicle Condition',
  'Inspection Appointment',
  'Other',
];

function DropdownField({ label, value, placeholder, options, onChange, error, disabled = false }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (nextValue) => {
    setOpen(false);
    onChange?.(nextValue);
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdownButton, error && styles.inputError, disabled && styles.disabledInput]}
        activeOpacity={disabled ? 1 : 0.86}
        onPress={() => {
          if (!disabled) {
            Keyboard.dismiss();
            setOpen((current) => !current);
          }
        }}
        disabled={disabled}
      >
        <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color="#111111" />
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdownList}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.dropdownOption, value === option && styles.dropdownOptionActive]}
              activeOpacity={0.86}
              onPress={() => handleSelect(option)}
            >
              <Text style={[styles.dropdownOptionText, value === option && styles.dropdownOptionTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export default function SendInquirySheet({
  visible,
  vehicle,
  displayPrice,
  initialPhone = '',
  submitting = false,
  onClose,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [contactMethod, setContactMethod] = useState('');
  const [inquirySelection, setInquirySelection] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [messageFocused, setMessageFocused] = useState(false);

  const vehicleTitle = useMemo(
    () => [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || 'Selected vehicle',
    [vehicle]
  );
  const sanitizedPhone = String(phone || '').replace(/\D/g, '').slice(0, 10);
  const isStandardInquiryType = inquirySelection && inquirySelection !== 'Other';
  const showCustomMessage = !isStandardInquiryType;

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    setPhone(String(initialPhone || '').replace(/\D/g, '').slice(0, 10));
    setContactMethod('');
    setInquirySelection('');
    setCustomMessage('');
    setErrors({});
    return undefined;
  }, [initialPhone, visible]);

  const handleClose = () => {
    if (submitting) {
      return;
    }

    Keyboard.dismiss();
    onClose?.();
  };

  const messageDragResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!messageFocused) {
            return false;
          }

          return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          setMessageFocused(false);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 62) {
            handleClose();
          }
        }
      }),
    [messageFocused, submitting, onClose]
  );

  const validate = () => {
    const nextErrors = {};
    const typedMessage = String(customMessage || '').trim();

    if (!sanitizedPhone) {
      nextErrors.phone = 'Mobile number is required.';
    } else if (!/^\d{10}$/.test(sanitizedPhone)) {
      nextErrors.phone = 'Mobile number must contain exactly 10 digits.';
    }

    if (!contactMethod) {
      nextErrors.contactMethod = 'Select how you prefer to be contacted.';
    }

    if (!isStandardInquiryType && !typedMessage) {
      nextErrors.inquiryContent = 'Choose an inquiry type or enter a custom message.';
    }

    if (isStandardInquiryType && typedMessage) {
      nextErrors.inquiryContent = 'Use either an inquiry type or a custom message, not both.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    const typedMessage = String(customMessage || '').trim();
    onSubmit?.({
      phone: sanitizedPhone,
      contactMethod,
      inquiryType: isStandardInquiryType ? inquirySelection : undefined,
      customMessage: typedMessage || undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <View style={styles.topBar}>
            <Text style={styles.title}>Send Inquiry</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.88}>
              <MaterialCommunityIcons name="close" size={22} color="#111111" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{vehicleTitle} · {displayPrice}</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contact Details</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder="Enter mobile number"
                  placeholderTextColor={Colors.muted}
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(String(value || '').replace(/\D/g, '').slice(0, 10));
                    setErrors((current) => ({ ...current, phone: '' }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
              </View>

              <DropdownField
                label="Preferred Contact Method"
                value={contactMethod}
                placeholder="Choose contact method"
                options={CONTACT_METHODS}
                onChange={(nextValue) => {
                  setContactMethod(nextValue);
                  setErrors((current) => ({ ...current, contactMethod: '' }));
                }}
                error={errors.contactMethod}
              />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Inquiry Type</Text>
              <DropdownField
                label="Common Inquiry"
                value={inquirySelection}
                placeholder="Choose one inquiry type"
                options={INQUIRY_TYPES}
                onChange={(nextValue) => {
                  setInquirySelection(nextValue);
                  setCustomMessage('');
                  setErrors((current) => ({ ...current, inquiryContent: '' }));
                }}
                error={errors.inquiryContent && !customMessage ? errors.inquiryContent : ''}
              />

              {showCustomMessage ? (
                <View style={styles.fieldWrap} {...messageDragResponder.panHandlers}>
                  <Text style={styles.fieldLabel}>
                    {inquirySelection === 'Other' ? 'Custom Inquiry Message' : 'Or Custom Inquiry Message'}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea, errors.inquiryContent && styles.inputError]}
                    placeholder="Type your inquiry here"
                    placeholderTextColor={Colors.muted}
                    value={customMessage}
                    onChangeText={(value) => {
                      setCustomMessage(value);
                      if (value) {
                        setInquirySelection('');
                      }
                      setErrors((current) => ({ ...current, inquiryContent: '' }));
                    }}
                    multiline
                    numberOfLines={4}
                    scrollEnabled={false}
                    onFocus={() => setMessageFocused(true)}
                    onBlur={() => setMessageFocused(false)}
                    textAlignVertical="top"
                  />
                  {errors.inquiryContent ? <Text style={styles.fieldError}>{errors.inquiryContent}</Text> : null}
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              activeOpacity={0.9}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#111111" />
                  <Text style={styles.submitText}>Send Inquiry</Text>
                </>
              )}
            </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.muted,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
  },
  fieldWrap: {
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  textArea: {
    minHeight: 116,
    lineHeight: 22,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: '#fff7f7',
  },
  disabledInput: {
    opacity: 0.56,
  },
  fieldError: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.danger,
  },
  dropdownButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  placeholderText: {
    color: Colors.muted,
  },
  dropdownList: {
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    ...Shadow.sm,
  },
  dropdownOption: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dropdownOptionActive: {
    backgroundColor: '#facc15',
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  dropdownOptionTextActive: {
    color: '#111111',
  },
  submitButton: {
    marginTop: 18,
    minHeight: 58,
    borderRadius: Radius.full,
    backgroundColor: '#facc15',
    borderWidth: 1,
    borderColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  submitButtonDisabled: {
    opacity: 0.66,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.2,
  },
});
