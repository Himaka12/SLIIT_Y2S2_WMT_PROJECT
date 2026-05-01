import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BASE_URL, refundAPI } from '../../api';
import { PrimaryButton, SecondaryButton, Card, StatusBadge } from '../../components/UI';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';

const REFUNDED_STATUS = 'Refunded';
const DELETED_USER_DISPLAY_NAME = 'Deleted User';

const isMaskedDeletedEmail = (value) => /^deleted-user-[^@]+@deleted\.local$/i.test(String(value || '').trim());
const isDeletedUserRecord = (userLike) => Boolean(
  userLike
  && typeof userLike === 'object'
  && (
    userLike.isDeleted
    || String(userLike.fullName || '').trim() === DELETED_USER_DISPLAY_NAME
    || isMaskedDeletedEmail(userLike.email)
  )
);
const getRefundCustomer = (refund) => refund?.user || refund?.booking?.user || null;
const getRefundCustomerName = (refund) => {
  const customer = getRefundCustomer(refund);
  if (!customer || isDeletedUserRecord(customer)) {
    return DELETED_USER_DISPLAY_NAME;
  }

  return customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || 'Customer Refund';
};

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

export default function ProcessRefundScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { refund: initialRefund } = params;
  const { showAlert } = useAppAlert();

  const [refund, setRefund] = useState(initialRefund);
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const existingSlipUri = useMemo(
    () => resolveAssetUri(refund?.refundProofUrl || refund?.refundSlipUrl),
    [refund?.refundProofUrl, refund?.refundSlipUrl],
  );

  const pickProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.84,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setProofFile({
        uri: asset.uri,
        name: asset.fileName || 'refund-slip.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleProcess = async () => {
    if (!proofFile && !existingSlipUri) {
      showAlert('Refund Slip Required', 'Upload the refund slip image before marking this request as refunded.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('status', REFUNDED_STATUS);

      if (proofFile) {
        formData.append('refundProof', {
          uri: proofFile.uri,
          name: proofFile.name,
          type: proofFile.type,
        });
      }

      const response = await refundAPI.process(refund._id, formData);
      setRefund(response.data);
      setProofFile(null);

      navigation.navigate('AdminDashMain', {
        initialTab: 'Refunds',
        refundToastAt: Date.now(),
        refundToastMessage: 'Refund completed successfully',
        refundUpdatedId: response.data?._id,
      });
    } catch (err) {
      showAlert(
        'Error',
        err?.response?.data?.message || 'Failed to update the refund request.',
        undefined,
        { tone: 'danger' },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.88}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Process Refund</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{getRefundCustomerName(refund)}</Text>
            <Text style={styles.heroSubtitle}>
              {[refund?.booking?.vehicle?.brand, refund?.booking?.vehicle?.model].filter(Boolean).join(' ')}
            </Text>
          </View>
          <StatusBadge status={refund?.status || 'Refund Requested'} />
        </View>

        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMetaLabel}>Amount</Text>
          <Text style={styles.heroMetaValue}>Rs. {Number(refund?.amount || refund?.booking?.vehicle?.price || 0).toLocaleString()}</Text>
        </View>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMetaLabel}>Submitted</Text>
          <Text style={styles.heroMetaValue}>
            {refund?.requestedAt ? new Date(refund.requestedAt).toLocaleString() : '-'}
          </Text>
        </View>
      </Card>

      <Card style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Bank Details</Text>
        {[
          ['Account Holder', refund?.accountHolderName],
          ['Bank Name', refund?.bankName],
          ['Branch', refund?.branchName],
          ['Account Number', refund?.accountNumber],
          ['Booking Status', refund?.booking?.status],
        ].map(([label, value], index, array) => (
          <View key={label} style={[styles.detailRow, index === array.length - 1 && styles.detailRowLast]}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || '-'}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.detailsCard}>
        <Text style={styles.uploadLabel}>Refund Slip</Text>
        <TouchableOpacity
          style={[styles.uploadZone, proofFile && styles.uploadZoneFilled]}
          onPress={pickProof}
          activeOpacity={0.88}
        >
          <MaterialCommunityIcons
            name={proofFile || existingSlipUri ? 'image-check-outline' : 'image-plus-outline'}
            size={24}
            color="#111111"
          />
          <Text style={styles.uploadText}>
            {proofFile ? proofFile.name : existingSlipUri ? 'Replace existing refund slip' : 'Upload refund slip image'}
          </Text>
        </TouchableOpacity>

        {proofFile?.uri || existingSlipUri ? (
          <Image
            source={{ uri: proofFile?.uri || existingSlipUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : null}
      </Card>

      <PrimaryButton
        title="Save Refund Slip"
        onPress={handleProcess}
        loading={loading}
        style={styles.primaryButton}
        textStyle={styles.primaryButtonText}
      />
      <SecondaryButton title="Cancel" onPress={() => navigation.goBack()} style={styles.cancelButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f6f3ee',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Shadow.sm,
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.muted,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  heroMetaLabel: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '700',
  },
  heroMetaValue: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '800',
  },
  detailsCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 18,
    marginTop: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '700',
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    color: '#111111',
    fontWeight: '800',
  },
  uploadLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10,
  },
  uploadZone: {
    minHeight: 104,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: 10,
  },
  uploadZoneFilled: {
    borderStyle: 'solid',
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  uploadText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 22,
    marginTop: 14,
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#ffd400',
    borderRadius: Radius.full,
    ...Shadow.sm,
  },
  primaryButtonText: {
    color: '#111111',
    fontWeight: '900',
  },
  cancelButton: {
    marginTop: 12,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
  },
});
