import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, inquiryAPI } from '../../api';
import BottomPreviewSheet from '../../components/BottomPreviewSheet';
import { EmptyState } from '../../components/UI';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';

let inquiryListCache = [];

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

function getStatusMeta(status) {
  switch (status) {
    case 'Resolved':
      return {
        label: 'Resolved',
        tone: styles.statusApproved,
        textTone: styles.statusApprovedText,
      };
    case 'Rejected':
      return {
        label: 'Rejected',
        tone: styles.statusRejected,
        textTone: styles.statusRejectedText,
      };
    default:
      return {
        label: 'Pending',
        tone: styles.statusPending,
        textTone: styles.statusPendingText,
      };
  }
}

function getInquiryResponseText(inquiry) {
  return String(
    inquiry?.response
      || inquiry?.adminResponse
      || inquiry?.reply
      || inquiry?.resolutionMessage
      || '',
  ).trim();
}

export default function CustomerInquiriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const lastScrollOffset = useRef(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => inquiryListCache.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState(() => inquiryListCache);
  const [previewInquiry, setPreviewInquiry] = useState(null);
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );

  const load = useCallback(async () => {
    try {
      const inquiriesRes = await inquiryAPI.myInquiries();
      const nextItems = inquiriesRes.data || [];
      inquiryListCache = nextItems;
      setItems(nextItems);
    } catch (_) {
      if (!inquiryListCache.length) {
        setItems([]);
      }
    }

    setHasLoadedOnce(true);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    emitCustomerTabBarVisibility(true);
    load();
  }, [load]);

  const previewVehicle = previewInquiry?.vehicleId;
  const previewVehicleImageUri = getVehicleImageUri(previewVehicle);
  const previewStatusMeta = getStatusMeta(previewInquiry?.status);
  const previewResponseText = getInquiryResponseText(previewInquiry);

  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={items.filter((item) => item.vehicleId)}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const vehicle = item.vehicleId;
          const imageUri = getVehicleImageUri(vehicle);
          const statusMeta = getStatusMeta(item.status);
          const secondaryInfo = [
            item?.inquiryDate,
            item?.status,
            `Rs. ${Number(vehicle?.price || 0).toLocaleString()}`,
          ].filter(Boolean).join(' • ');

          return (
            <View style={styles.card}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={styles.cardImageFallback}>
                  <MaterialCommunityIcons name="car-sports" size={28} color="#94a3b8" />
                </View>
              )}

              <View style={styles.cardCopy}>
                <TouchableOpacity activeOpacity={0.9} style={styles.cardPressArea} onPress={() => setPreviewInquiry(item)}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {vehicle?.brand} {vehicle?.model}
                    </Text>
                    <View style={[styles.statusPill, statusMeta.tone]}>
                      <Text style={[styles.statusText, statusMeta.textTone]}>{statusMeta.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardSecondary} numberOfLines={1}>
                    {secondaryInfo || 'Sales inquiry'}
                  </Text>

                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {item?.customMessage || item?.message || 'Your sales inquiry has been recorded for this vehicle.'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
              </TouchableOpacity>

              <Text style={styles.pageTitle}>My Inquiries</Text>

              <View style={styles.backButtonPlaceholder} />
            </View>
          </View>
        )}
        ListEmptyComponent={hasLoadedOnce ? (
          <EmptyState
            icon="file-document-outline"
            title="No inquiries yet"
          />
        ) : null}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        )}
        onScroll={(event) => {
          const currentOffset = event.nativeEvent.contentOffset.y;

          if (currentOffset <= 8) {
            emitCustomerTabBarVisibility(true);
          } else if (currentOffset > lastScrollOffset.current + 8) {
            emitCustomerTabBarVisibility(false);
          } else if (currentOffset < lastScrollOffset.current - 8) {
            emitCustomerTabBarVisibility(true);
          }

          lastScrollOffset.current = currentOffset;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <BottomPreviewSheet
        visible={Boolean(previewInquiry)}
        onClose={() => setPreviewInquiry(null)}
        title="Inquiry Preview"
        subtitle="Vehicle details and the full inquiry you sent"
      >
        <View style={styles.previewVehicleCard}>
          {previewVehicleImageUri ? (
            <Image source={{ uri: previewVehicleImageUri }} style={styles.previewVehicleImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewVehicleFallback}>
              <MaterialCommunityIcons name="car-sports" size={32} color="#94a3b8" />
            </View>
          )}

          <View style={styles.previewVehicleCopy}>
            <View style={styles.previewVehicleTopRow}>
              <Text style={styles.previewVehicleTitle}>
                {previewVehicle?.brand} {previewVehicle?.model}
              </Text>
              <View style={[styles.statusPill, previewStatusMeta?.tone]}>
                <Text style={[styles.statusText, previewStatusMeta?.textTone]}>{previewStatusMeta?.label}</Text>
              </View>
            </View>
            <Text style={styles.previewVehicleSubtitle}>
              {[previewVehicle?.category, previewVehicle?.manufactureYear, previewVehicle?.listingType].filter(Boolean).join(' • ') || 'Sale vehicle'}
            </Text>
            <View style={styles.previewTagRow}>
              <View style={styles.previewTag}>
                <Text style={styles.previewTagText}>Rs. {Number(previewVehicle?.price || 0).toLocaleString()}</Text>
              </View>
              {previewInquiry?.inquiryDate ? (
                <View style={styles.previewTag}>
                  <Text style={styles.previewTagText}>{previewInquiry.inquiryDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Inquiry Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{previewStatusMeta?.label || 'Pending'}</Text>
          </View>
          {previewInquiry?.preferredContactTime ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Preferred Contact</Text>
              <Text style={styles.infoValue}>{previewInquiry.preferredContactTime}</Text>
            </View>
          ) : null}
          {previewInquiry?.contactMethod ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contact Method</Text>
              <Text style={styles.infoValue}>{previewInquiry.contactMethod}</Text>
            </View>
          ) : null}
          {previewInquiry?.inquiryType ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Inquiry Type</Text>
              <Text style={styles.infoValue}>{previewInquiry.inquiryType}</Text>
            </View>
          ) : null}
          <Text style={styles.longMessage}>
            {previewInquiry?.customMessage || previewInquiry?.message || 'No inquiry content was added.'}
          </Text>
        </View>

        {previewResponseText ? (
          <View style={styles.previewSectionCard}>
            <Text style={styles.previewSectionTitle}>Response</Text>
            <Text style={styles.longMessage}>{previewResponseText}</Text>
          </View>
        ) : null}
      </BottomPreviewSheet>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 130,
    gap: 14,
  },
  headerBlock: {
    marginBottom: 14,
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
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 12,
    gap: 12,
    minHeight: 140,
    ...Shadow.sm,
  },
  cardImage: {
    width: 92,
    height: 120,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
  },
  cardImageFallback: {
    width: 92,
    height: 120,
    borderRadius: 18,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardPressArea: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  statusPending: {
    backgroundColor: '#fff7ed',
  },
  statusPendingText: {
    color: '#b45309',
  },
  statusApproved: {
    backgroundColor: '#ecfdf5',
  },
  statusApprovedText: {
    color: '#15803d',
  },
  statusRejected: {
    backgroundColor: '#fef2f2',
  },
  statusRejectedText: {
    color: '#dc2626',
  },
  cardSecondary: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
  },
  cardDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text,
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
  previewSectionCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.sm,
  },
  previewSectionTitle: {
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
  longMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text,
  },
});
