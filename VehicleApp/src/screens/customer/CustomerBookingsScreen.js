import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, bookingAPI } from '../../api';
import BottomPreviewSheet from '../../components/BottomPreviewSheet';
import { EmptyState } from '../../components/UI';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';

let bookingsCache = [];

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
    case 'Approved':
      return { label: 'Approved', tone: styles.statusApproved, textTone: styles.statusApprovedText };
    case 'Cancelled':
      return { label: 'Cancelled', tone: styles.statusCancelled, textTone: styles.statusCancelledText };
    case 'Rejected':
      return { label: 'Rejected', tone: styles.statusRejected, textTone: styles.statusRejectedText };
    default:
      return { label: 'Pending', tone: styles.statusPending, textTone: styles.statusPendingText };
  }
}

function formatDateTime(dateValue, timeValue) {
  return [dateValue, timeValue].filter(Boolean).join(' ');
}

function getRefundActionMeta(item) {
  const refundStatus = item?.refund?.status || item?.refundMeta?.status || 'Refund Not Available';
  const refundSlipUrl = resolveAssetUri(item?.refund?.refundProofUrl || item?.refund?.refundSlipUrl || item?.refundMeta?.refundSlipUrl);

  if (refundStatus === 'Refund Available') {
    return {
      label: 'Request Refund',
      disabled: false,
      tone: 'primary',
      refundSlipUrl,
    };
  }

  if (refundStatus === 'Refund Requested') {
    return {
      label: 'Refund Requested',
      disabled: true,
      tone: 'info',
      refundSlipUrl,
    };
  }

  if (refundStatus === 'Refund Processing') {
    return {
      label: 'Refund Processing',
      disabled: true,
      tone: 'info',
      refundSlipUrl,
    };
  }

  if (refundStatus === 'Refunded') {
    return {
      label: refundSlipUrl ? 'View Refund Slip' : 'Refunded',
      disabled: !refundSlipUrl,
      tone: 'success',
      refundSlipUrl,
    };
  }

  if (refundStatus === 'Refund Rejected') {
    return {
      label: 'Refund Rejected',
      disabled: true,
      tone: 'danger',
      refundSlipUrl,
    };
  }

  if (item?.refundMeta?.reason === 'window_expired') {
    return {
      label: 'Refund Expired',
      disabled: true,
      tone: 'muted',
      refundSlipUrl,
    };
  }

  return null;
}

export default function CustomerBookingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { showAlert } = useAppAlert();
  const lastScrollOffset = useRef(0);
  const hasLoadedOnceRef = useRef(bookingsCache.length > 0);
  const slipPreviewTimeoutRef = useRef(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => bookingsCache.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState(() => bookingsCache);
  const [previewSlip, setPreviewSlip] = useState(null);
  const [previewBooking, setPreviewBooking] = useState(null);
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );

  const load = useCallback(async () => {
    try {
      const bookingsRes = await bookingAPI.myBookings();
      const nextItems = bookingsRes.data || [];
      bookingsCache = nextItems;
      setItems(nextItems);
    } catch (_) {
      if (!bookingsCache.length) {
        setItems([]);
      }
    }

    hasLoadedOnceRef.current = true;
    setHasLoadedOnce(true);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    emitCustomerTabBarVisibility(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnceRef.current) {
        load();
      }
    }, [load]),
  );

  useEffect(() => () => {
    if (slipPreviewTimeoutRef.current) {
      clearTimeout(slipPreviewTimeoutRef.current);
    }
  }, []);

  const openBookingPreview = useCallback((booking) => {
    setPreviewBooking(booking);
  }, []);

  const closeBookingPreview = useCallback(() => {
    setPreviewBooking(null);
  }, []);

  const openSlipPreview = useCallback((uri, title, closeSheetFirst = false) => {
    if (!uri) {
      return;
    }

    if (slipPreviewTimeoutRef.current) {
      clearTimeout(slipPreviewTimeoutRef.current);
      slipPreviewTimeoutRef.current = null;
    }

    const nextPreview = { uri, title };

    if (!closeSheetFirst) {
      setPreviewSlip(nextPreview);
      return;
    }

    setPreviewBooking(null);
    slipPreviewTimeoutRef.current = setTimeout(() => {
      setPreviewSlip(nextPreview);
      slipPreviewTimeoutRef.current = null;
    }, 260);
  }, []);

  const handleCancelBooking = useCallback((booking) => {
    showAlert(
      'Cancel Booking',
      'Do you want to cancel this booking request?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingAPI.cancel(booking._id);
              if (previewBooking?._id === booking._id) {
                setPreviewBooking(null);
              }
              load();
            } catch (error) {
              showAlert('Error', error?.response?.data?.message || 'Failed to cancel booking.', undefined, { tone: 'danger' });
            }
          },
        },
      ],
      { tone: 'danger' },
    );
  }, [load, previewBooking?._id, showAlert]);

  const handleRefundAction = useCallback((booking, refundAction) => {
    if (!refundAction) {
      return;
    }

    if (refundAction.label === 'View Refund Slip' && refundAction.refundSlipUrl) {
      openSlipPreview(
        refundAction.refundSlipUrl,
        `${booking?.vehicle?.brand || ''} ${booking?.vehicle?.model || ''}`.trim() || 'Refund Slip',
      );
      return;
    }

    navigation.navigate('ClaimRefund', { booking });
  }, [navigation, openSlipPreview]);

  const previewVehicle = previewBooking?.vehicle;
  const previewVehicleImageUri = getVehicleImageUri(previewVehicle);
  const previewStatusMeta = getStatusMeta(previewBooking?.status);
  const previewRefundAction = previewBooking ? getRefundActionMeta(previewBooking) : null;
  const paymentSlipUrl = resolveAssetUri(previewBooking?.paymentSlipUrl);

  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={items.filter((item) => item.vehicle)}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const vehicle = item.vehicle;
          const imageUri = getVehicleImageUri(vehicle);
          const statusMeta = getStatusMeta(item.status);
          const refundAction = getRefundActionMeta(item);
          const secondaryInfo = [
            formatDateTime(item?.startDate, item?.startTime),
            item?.status,
            `Rs. ${Number(vehicle?.price || 0).toLocaleString()}/day`,
          ].filter(Boolean).join(' • ');
          const description = `Ends on ${formatDateTime(item?.endDate, item?.endTime) || 'Not set'}${item?.requestedUnits ? ` • Quantity ${item.requestedUnits}` : ''}`;

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
                <TouchableOpacity activeOpacity={0.9} style={styles.cardPressArea} onPress={() => openBookingPreview(item)}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {vehicle?.brand} {vehicle?.model}
                    </Text>
                    <View style={[styles.statusPill, statusMeta.tone]}>
                      <Text style={[styles.statusText, statusMeta.textTone]}>{statusMeta.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardSecondary} numberOfLines={1}>
                    {secondaryInfo || 'Rental booking'}
                  </Text>

                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {description}
                  </Text>
                </TouchableOpacity>

                {item.status === 'Pending' || refundAction ? (
                  <View style={styles.actionRow}>
                    {item.status === 'Pending' ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => handleCancelBooking(item)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    ) : null}

                    {refundAction ? (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.refundButton,
                          refundAction.tone === 'info' && styles.refundButtonInfo,
                          refundAction.tone === 'success' && styles.refundButtonSuccess,
                          refundAction.tone === 'danger' && styles.refundButtonDanger,
                          refundAction.tone === 'muted' && styles.refundButtonMuted,
                          refundAction.disabled && styles.actionButtonDisabled,
                        ]}
                        activeOpacity={refundAction.disabled ? 1 : 0.88}
                        disabled={refundAction.disabled}
                        onPress={() => handleRefundAction(item, refundAction)}
                      >
                        <Text
                          style={[
                            styles.refundButtonText,
                            refundAction.tone === 'info' && styles.refundButtonTextInfo,
                            refundAction.tone === 'success' && styles.refundButtonTextSuccess,
                            refundAction.tone === 'danger' && styles.refundButtonTextDanger,
                            refundAction.tone === 'muted' && styles.refundButtonTextMuted,
                          ]}
                        >
                          {refundAction.label}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
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

              <Text style={styles.pageTitle}>My Bookings</Text>

              <View style={styles.backButtonPlaceholder} />
            </View>
          </View>
        )}
        ListEmptyComponent={hasLoadedOnce ? (
          <EmptyState
            icon="calendar-check-outline"
            title="No bookings yet"
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
        visible={Boolean(previewBooking)}
        onClose={closeBookingPreview}
        title="Booking Preview"
        subtitle="Vehicle details, dates, booking status, and payment information"
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
              {[previewVehicle?.category, previewVehicle?.manufactureYear, previewVehicle?.listingType].filter(Boolean).join(' • ') || 'Rental vehicle'}
            </Text>
            <View style={styles.previewTagRow}>
              <View style={styles.previewTag}>
                <Text style={styles.previewTagText}>Rs. {Number(previewVehicle?.price || 0).toLocaleString()} /day</Text>
              </View>
              <View style={styles.previewTag}>
                <Text style={styles.previewTagText}>Qty {Math.max(1, Number(previewBooking?.requestedUnits || 1))}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Booking Dates</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Start</Text>
            <Text style={styles.infoValue}>{formatDateTime(previewBooking?.startDate, previewBooking?.startTime) || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>End</Text>
            <Text style={styles.infoValue}>{formatDateTime(previewBooking?.endDate, previewBooking?.endTime) || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Requested Units</Text>
            <Text style={styles.infoValue}>{Math.max(1, Number(previewBooking?.requestedUnits || 1))}</Text>
          </View>
        </View>

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Payment Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Daily Rate</Text>
            <Text style={styles.infoValue}>Rs. {Number(previewVehicle?.price || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Slip</Text>
            <Text style={styles.infoValue}>{paymentSlipUrl ? 'Uploaded' : 'Not available'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reviewed At</Text>
            <Text style={styles.infoValue}>
              {previewBooking?.paymentReviewedAt ? new Date(previewBooking.paymentReviewedAt).toLocaleString() : 'Pending review'}
            </Text>
          </View>
          {paymentSlipUrl ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.sheetNeutralButton]}
              onPress={() => openSlipPreview(
                paymentSlipUrl,
                `${previewVehicle?.brand || ''} ${previewVehicle?.model || ''}`.trim() || 'Payment Slip',
                true,
              )}
              activeOpacity={0.88}
            >
              <Text style={styles.sheetNeutralButtonText}>View Payment Slip</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {previewBooking?.refundMeta?.status ? (
          <View style={styles.previewSectionCard}>
            <Text style={styles.previewSectionTitle}>Refund Status</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Status</Text>
              <Text style={styles.infoValue}>{previewBooking.refundMeta.status}</Text>
            </View>
            {previewBooking?.refundMeta?.refundEligibleUntil ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Eligible Until</Text>
                <Text style={styles.infoValue}>{new Date(previewBooking.refundMeta.refundEligibleUntil).toLocaleString()}</Text>
              </View>
            ) : null}
            {previewRefundAction ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.refundButton,
                  previewRefundAction.tone === 'info' && styles.refundButtonInfo,
                  previewRefundAction.tone === 'success' && styles.refundButtonSuccess,
                  previewRefundAction.tone === 'danger' && styles.refundButtonDanger,
                  previewRefundAction.tone === 'muted' && styles.refundButtonMuted,
                  previewRefundAction.disabled && styles.actionButtonDisabled,
                  styles.sheetActionButton,
                ]}
                activeOpacity={previewRefundAction.disabled ? 1 : 0.88}
                disabled={previewRefundAction.disabled}
                onPress={() => handleRefundAction(previewBooking, previewRefundAction)}
              >
                <Text
                  style={[
                    styles.refundButtonText,
                    previewRefundAction.tone === 'info' && styles.refundButtonTextInfo,
                    previewRefundAction.tone === 'success' && styles.refundButtonTextSuccess,
                    previewRefundAction.tone === 'danger' && styles.refundButtonTextDanger,
                    previewRefundAction.tone === 'muted' && styles.refundButtonTextMuted,
                  ]}
                >
                  {previewRefundAction.label}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </BottomPreviewSheet>

      <Modal
        visible={Boolean(previewSlip)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewSlip(null)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView intensity={32} tint="light" style={styles.modalBlurLayer} />
          <Pressable style={styles.modalDimLayer} onPress={() => setPreviewSlip(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{previewSlip?.title || 'Refund Slip'}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setPreviewSlip(null)}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>
            {previewSlip?.uri ? (
              <Image source={{ uri: previewSlip.uri }} style={styles.modalImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </Modal>
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
  statusCancelled: {
    backgroundColor: '#eff6ff',
  },
  statusCancelledText: {
    color: '#2563eb',
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
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonDisabled: {
    opacity: 0.88,
  },
  cancelButton: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  refundButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  refundButtonInfo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  refundButtonSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  refundButtonDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  refundButtonMuted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  refundButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.2,
  },
  refundButtonTextInfo: {
    color: '#2563eb',
  },
  refundButtonTextSuccess: {
    color: '#15803d',
  },
  refundButtonTextDanger: {
    color: '#dc2626',
  },
  refundButtonTextMuted: {
    color: '#64748b',
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
  sheetNeutralButton: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sheetNeutralButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  sheetActionButton: {
    marginTop: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalBlurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.24)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 18,
    ...Shadow.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  modalImage: {
    width: '100%',
    height: 420,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
});
