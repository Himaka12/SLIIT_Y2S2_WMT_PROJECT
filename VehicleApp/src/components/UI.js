import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Shadow } from '../constants/theme';

// ─── Primary Button ────────────────────────────────────────────────────────
export const PrimaryButton = ({ title, onPress, loading, disabled, style, icon, textStyle }) => (
  <TouchableOpacity
    style={[styles.primaryBtn, (disabled || loading) && styles.btnDisabled, style]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
  >
    {loading
      ? <ActivityIndicator color="#fff" size="small" />
      : <Text style={[styles.primaryBtnText, textStyle]}>{icon ? `${icon}  ` : ''}{title}</Text>
    }
  </TouchableOpacity>
);

// ─── Secondary Button ──────────────────────────────────────────────────────
export const SecondaryButton = ({ title, onPress, style, icon }) => (
  <TouchableOpacity style={[styles.secondaryBtn, style]} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.secondaryBtnText}>{icon ? `${icon}  ` : ''}{title}</Text>
  </TouchableOpacity>
);

// ─── Danger Button ─────────────────────────────────────────────────────────
export const DangerButton = ({ title, onPress, loading, style }) => (
  <TouchableOpacity
    style={[styles.dangerBtn, style]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.85}
  >
    {loading
      ? <ActivityIndicator color="#fff" size="small" />
      : <Text style={styles.primaryBtnText}>{title}</Text>
    }
  </TouchableOpacity>
);

// ─── Input Field ───────────────────────────────────────────────────────────
export const InputField = ({ label, error, style, inputStyle, ...props }) => (
  <View style={[styles.fieldWrap, style]}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <TextInput
      style={[styles.fieldInput, error && styles.fieldInputError, inputStyle]}
      placeholderTextColor={Colors.muted}
      {...props}
    />
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

// ─── Card ──────────────────────────────────────────────────────────────────
export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

// ─── Section Title ─────────────────────────────────────────────────────────
export const SectionTitle = ({ title, subtitle, style }) => (
  <View style={[styles.sectionTitle, style]}>
    <Text style={styles.sectionTitleText}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSubText}>{subtitle}</Text> : null}
  </View>
);

// ─── Badge ─────────────────────────────────────────────────────────────────
export const Badge = ({ label, color = Colors.blue, bg = Colors.blueSoft, style }) => (
  <View style={[styles.badge, { backgroundColor: bg }, style]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

// ─── Empty State ───────────────────────────────────────────────────────────
export const EmptyState = ({ icon = '🔍', title, subtitle }) => (
  <View style={styles.emptyState}>
    {typeof icon === 'string' && /^[a-z0-9-]+$/i.test(icon) ? (
      <View style={styles.emptyIconWrap}>
        <MaterialCommunityIcons name={icon} size={38} color={Colors.muted} />
      </View>
    ) : (
      <Text style={styles.emptyIcon}>{icon}</Text>
    )}
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
  </View>
);

// ─── Loading Spinner ───────────────────────────────────────────────────────
export const LoadingSpinner = ({ message = 'Loading...' }) => (
  <View style={styles.loadingWrap}>
    <ActivityIndicator size="large" color={Colors.blue} />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

// ─── Status Badge ──────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const map = {
    Pending:    { bg: Colors.promoSoft,   color: Colors.promo   },
    Approved:   { bg: Colors.successSoft, color: Colors.success  },
    Active:     { bg: Colors.successSoft, color: Colors.success  },
    Scheduled:  { bg: Colors.blueSoft,    color: Colors.blue     },
    Inactive:   { bg: '#f1f5f9',          color: Colors.muted    },
    Available:  { bg: Colors.successSoft, color: Colors.success  },
    'Refund Available': { bg: Colors.successSoft, color: Colors.success },
    'Refund Requested': { bg: Colors.blueSoft, color: Colors.blue },
    'Refund Processing': { bg: Colors.blueSoft, color: Colors.blue },
    Refunded:   { bg: Colors.successSoft, color: Colors.success  },
    'Refund Rejected': { bg: Colors.dangerSoft, color: Colors.danger },
    'Refund Not Available': { bg: '#f1f5f9', color: Colors.muted },
    Rejected:   { bg: Colors.dangerSoft,  color: Colors.danger   },
    Cancelled:  { bg: '#f1f5f9',          color: Colors.muted    },
    'Cancelled - Account Deleted': { bg: '#f1f5f9', color: Colors.muted },
    Completed:  { bg: Colors.blueSoft,    color: Colors.blue     },
    Processing: { bg: Colors.blueSoft,    color: Colors.blue     },
    'Coming Soon': { bg: Colors.promoSoft, color: Colors.promo   },
    Resolved:   { bg: Colors.successSoft, color: Colors.success  },
    Expired:    { bg: '#f1f5f9',          color: Colors.muted    },
    Disabled:   { bg: '#f1f5f9',          color: Colors.muted    },
    Removed:    { bg: Colors.dangerSoft,  color: Colors.danger   },
    Visible:    { bg: Colors.successSoft, color: Colors.success  },
    Hidden:     { bg: Colors.promoSoft,   color: Colors.promo    },
    Deleted:    { bg: '#f1f5f9',          color: Colors.muted    },
    'Deleted by Admin': { bg: Colors.dangerSoft, color: Colors.danger },
  };
  const style = map[status] || { bg: '#f1f5f9', color: Colors.muted };
  return <Badge label={status} color={style.color} bg={style.bg} />;
};

// ─── Row Separator ─────────────────────────────────────────────────────────
export const Divider = ({ style }) => <View style={[styles.divider, style]} />;

const styles = StyleSheet.create({
  primaryBtn: {
    height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  secondaryBtn: {
    height: 50, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.stroke,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: Colors.text, fontWeight: '600', fontSize: 15 },

  dangerBtn: {
    height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },

  fieldWrap: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  fieldInput: {
    height: 48, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.stroke,
    backgroundColor: Colors.soft, paddingHorizontal: 14,
    fontSize: 15, color: Colors.text,
  },
  fieldInputError: { borderColor: Colors.danger },
  fieldError: { fontSize: 12, color: Colors.danger, marginTop: 4 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },

  sectionTitle: { marginBottom: Spacing.lg },
  sectionTitleText: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  sectionSubText: { fontSize: 14, color: Colors.muted, marginTop: 4, lineHeight: 20 },

  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  emptyState: { alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.soft,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 20 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  loadingText: { fontSize: 14, color: Colors.muted, marginTop: 8 },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
});
