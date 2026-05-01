import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { inquiryAPI, promotionAPI, vehicleAPI, wishlistAPI } from '../../api';
import { getCompactVehicleAvailabilityMeta, getVehicleAvailabilityMeta } from '../../components/AvailabilityStatusBox';
import SendInquirySheet from '../../components/SendInquirySheet';
import SuccessToast from '../../components/SuccessToast';
import { useAuth } from '../../context/AuthContext';
import { useAppAlert } from '../../context/AppAlertContext';
import {
  VehicleBottomCTA,
  VehicleDetailsSheet,
  VehicleDetailsStats,
  VehicleFeatureGrid,
  VehicleHeroGallery,
  VehicleHostInfo,
  VehiclePromotionCard,
  formatPrice,
  getDiscountedPrice,
  getVehiclePromotion,
  getVehicleImages,
} from '../../components/VehicleDetailsShared';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { LoadingSpinner } from '../../components/UI';
import { getPromotionDiscountMeta } from '../../utils/promotionUtils';

function openLoginScreen(navigation) {
  if (navigation.getState?.()?.routeNames?.includes('Login')) {
    navigation.navigate('Login');
    return;
  }

  const parent = navigation.getParent?.();
  if (parent?.getState?.()?.routeNames?.includes('Login')) {
    parent.navigate('Login');
    return;
  }

  const grandParent = parent?.getParent?.();
  if (grandParent?.getState?.()?.routeNames?.includes('Login')) {
    grandParent.navigate('Login');
  }
}

function isVehicleBuyable(vehicle) {
  const quantity = Math.max(0, Number(vehicle?.quantity || 0));
  const normalizedStatus = String(vehicle?.status || '').trim().toLowerCase();

  if (quantity <= 0) {
    return false;
  }

  if (!normalizedStatus) {
    return true;
  }

  return normalizedStatus === 'available';
}

export default function SaleVehicleDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const vehicleId = route.params?.vehicleId;
  const initialVehicle = route.params?.initialVehicle || null;

  const [vehicle, setVehicle] = useState(initialVehicle);
  const [promotion, setPromotion] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(!initialVehicle);
  const [inquiryModalVisible, setInquiryModalVisible] = useState(false);
  const [hasSentInquiry, setHasSentInquiry] = useState(false);
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [showBottomCta, setShowBottomCta] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastBackgroundColor, setToastBackgroundColor] = useState('#16a34a');
  const lastScrollY = useRef(0);
  const ctaTranslateY = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(1)).current;

  const showWishlist = !user || user.role === 'CUSTOMER';
  const showCustomerCTA = !user || user.role === 'CUSTOMER';

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [vehicleRes, promotionsRes, wishlistRes, inquiryCheckRes] = await Promise.all([
          vehicleAPI.getById(vehicleId),
          promotionAPI.getActive().catch(() => ({ data: [] })),
          user ? wishlistAPI.getIds().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          user ? inquiryAPI.check(vehicleId).catch(() => ({ data: false })) : Promise.resolve({ data: false }),
        ]);

        if (!mounted) {
          return;
        }

        const nextVehicle = vehicleRes.data || null;
        setVehicle(nextVehicle);
        setPromotion(getVehiclePromotion(nextVehicle, promotionsRes.data || []));
        setIsWishlisted((wishlistRes.data || []).map(String).includes(String(vehicleId)));
        setHasSentInquiry(Boolean(inquiryCheckRes?.data));
      } catch (_) {
        if (mounted) {
          setVehicle((current) => current || null);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [vehicleId, user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ctaTranslateY, {
        toValue: showBottomCta ? 0 : 120,
        duration: showBottomCta ? 180 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(ctaOpacity, {
        toValue: showBottomCta ? 1 : 0,
        duration: showBottomCta ? 160 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [ctaOpacity, ctaTranslateY, showBottomCta]);

  const images = useMemo(() => getVehicleImages(vehicle), [vehicle]);
  const promotionDiscount = useMemo(() => getPromotionDiscountMeta(vehicle, promotion), [promotion, vehicle]);
  const displayPrice = promotionDiscount.hasDiscount
    ? formatPrice(getDiscountedPrice(vehicle, promotion), vehicle?.listingType)
    : formatPrice(vehicle?.price, vehicle?.listingType);

  const subtitle = [vehicle?.brand, vehicle?.category, vehicle?.manufactureYear].filter(Boolean).join(' - ');
  const summaryLine = [
    vehicle?.seatCount ? `${vehicle.seatCount} seats` : null,
    vehicle?.fuelType,
    vehicle?.engineCapacity ? `${vehicle.engineCapacity} Cc` : null,
    vehicle?.vehicleCondition,
  ].filter(Boolean).join(' - ');

  const highlightItems = [
    { value: String(vehicle?.manufactureYear || '-'), label: 'Year', caption: vehicle?.category || 'Vehicle' },
    { value: `${Number(vehicle?.mileage || 0).toLocaleString()} km`, label: 'Mileage', caption: vehicle?.vehicleCondition || 'Condition' },
    { value: vehicle?.engineCapacity ? `${vehicle.engineCapacity} Cc` : '-', label: 'Engine', caption: vehicle?.fuelType || 'Fuel' },
  ];

  const featureItems = [
    { label: 'Listing Type', value: vehicle?.listingType || 'Sale' },
    { label: 'Fuel Type', value: vehicle?.fuelType || 'Not set' },
    { label: 'Seats', value: vehicle?.seatCount ? String(vehicle.seatCount) : 'Not set' },
    { label: 'Year', value: vehicle?.manufactureYear ? String(vehicle.manufactureYear) : 'Not set' },
    { label: 'Condition', value: vehicle?.vehicleCondition || 'Not set' },
    { label: 'Transmission', value: vehicle?.transmission || 'Not set' },
  ];
  const availabilityMeta = useMemo(() => getVehicleAvailabilityMeta(vehicle?.quantity), [vehicle?.quantity]);
  const vehicleBuyable = useMemo(() => isVehicleBuyable(vehicle), [vehicle]);
  const compactAvailabilityMeta = useMemo(() => getCompactVehicleAvailabilityMeta(vehicle?.quantity), [vehicle?.quantity]);

  const handleScroll = (event) => {
    const nextY = event.nativeEvent.contentOffset.y;
    const previousY = lastScrollY.current;

    if (nextY <= 16) {
      if (!showBottomCta) {
        setShowBottomCta(true);
      }
    } else if (nextY > previousY + 12) {
      if (showBottomCta) {
        setShowBottomCta(false);
      }
    } else if (nextY < previousY - 12) {
      if (!showBottomCta) {
        setShowBottomCta(true);
      }
    }

    lastScrollY.current = nextY;
  };

  const handleWishlist = async () => {
    if (!showWishlist) {
      return;
    }

    if (!user) {
      openLoginScreen(navigation);
      return;
    }

    const previousWishlisted = isWishlisted;
    const nextWishlisted = !previousWishlisted;
    setIsWishlisted(nextWishlisted);
    setToastBackgroundColor('#16a34a');
    setToastMessage(nextWishlisted ? 'Added to favourites' : 'Removed from favourites');
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);

    try {
      await wishlistAPI.toggle(vehicleId);
    } catch (_) {
      setIsWishlisted(previousWishlisted);
      showAlert('Error', 'Unable to update wishlist right now.', undefined, { tone: 'danger' });
    }
  };

  const handleSendInquiry = () => {
    if (!user) {
      openLoginScreen(navigation);
      return;
    }

    if (hasSentInquiry) {
      setToastBackgroundColor(Colors.danger);
      setToastMessage('Inquiry already sent');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1800);
      return;
    }

    if (!vehicleBuyable) {
      setToastBackgroundColor(Colors.danger);
      setToastMessage(Number(vehicle?.quantity || 0) <= 0 ? 'Out of stock' : 'Currently unavailable');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1800);
      return;
    }

    setInquiryModalVisible(true);
  };

  const submitInquiry = async (inquiryPayload) => {
    setSubmittingInquiry(true);
    try {
      await inquiryAPI.add({
        vehicleId,
        vehicleTitle: [vehicle?.brand, vehicle?.model].filter(Boolean).join(' '),
        vehiclePrice: vehicle?.price,
        customerName: user?.fullName || user?.name,
        email: user?.email,
        phone: inquiryPayload.phone,
        contactMethod: inquiryPayload.contactMethod,
        inquiryType: inquiryPayload.inquiryType,
        customMessage: inquiryPayload.customMessage,
        inquiryDate: new Date().toISOString().split('T')[0],
      });

      setInquiryModalVisible(false);
      setHasSentInquiry(true);
      setToastBackgroundColor('#16a34a');
      setToastMessage('Inquiry sent successfully');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1800);
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to send inquiry.', undefined, { tone: 'danger' });
    }
    setSubmittingInquiry(false);
  };

  if (loading && !vehicle) {
    return <LoadingSpinner message="Opening vehicle..." />;
  }

  if (!vehicle) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Vehicle not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <VehicleHeroGallery
          vehicle={vehicle}
          activeImage={activeImage}
          onChangeImage={setActiveImage}
          onBack={() => navigation.goBack()}
          onToggleWishlist={handleWishlist}
          isWishlisted={isWishlisted}
          showWishlist={showWishlist}
        />

        <VehicleDetailsSheet>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{vehicle.brand} {vehicle.model}</Text>
            <View
              style={[
                styles.stockBadge,
                compactAvailabilityMeta.tone === 'success'
                  ? styles.stockBadgeSuccess
                  : compactAvailabilityMeta.tone === 'warning'
                    ? styles.stockBadgeWarning
                    : styles.stockBadgeDanger,
              ]}
            >
              <Text
                style={[
                  styles.stockBadgeText,
                  compactAvailabilityMeta.tone === 'success'
                    ? styles.stockBadgeTextSuccess
                    : compactAvailabilityMeta.tone === 'warning'
                      ? styles.stockBadgeTextWarning
                      : styles.stockBadgeTextDanger,
                ]}
              >
                {compactAvailabilityMeta.shortLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>{subtitle || 'Direct sale listing'}</Text>
          <Text style={styles.summary}>{summaryLine || 'Premium vehicle ready for direct purchase.'}</Text>

          <VehicleDetailsStats items={highlightItems} />

          {promotionDiscount.hasDiscount ? (
            <View style={styles.sectionBlock}>
              <VehiclePromotionCard promotion={promotion} vehicle={vehicle} />
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Vehicle highlights</Text>
            <VehicleFeatureGrid items={featureItems} />
          </View>

          {vehicle.description ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>About this vehicle</Text>
              <View style={styles.copyCard}>
                <Text style={styles.copyText}>{vehicle.description}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.sectionBlock}>
            <VehicleHostInfo
              title="Listed by Wheelzy Sales"
              subtitle={`${vehicle.status || 'Available'} - ${vehicle.listedDate || 'Recently added'}`}
              caption="Managed by Wheelzy for direct-sale requests and follow-up."
              accent="storefront-outline"
            />
          </View>
        </VehicleDetailsSheet>
      </ScrollView>

      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: ctaOpacity,
            transform: [{ translateY: ctaTranslateY }],
          },
        ]}
      >
        <VehicleBottomCTA
          hidden={!showCustomerCTA}
          priceLabel={displayPrice}
          priceSubLabel={promotionDiscount.hasDiscount ? `Original ${formatPrice(vehicle.price, vehicle.listingType)}` : 'One-time purchase'}
          ctaText={hasSentInquiry ? 'Already Sent' : 'Send Inquiry'}
          onPress={handleSendInquiry}
        />
      </Animated.View>

      <SendInquirySheet
        visible={inquiryModalVisible}
        vehicle={vehicle}
        displayPrice={displayPrice}
        initialPhone={user?.phone || user?.contactNumber || ''}
        submitting={submittingInquiry}
        onClose={() => setInquiryModalVisible(false)}
        onSubmit={submitInquiry}
      />
      <SuccessToast visible={toastVisible} message={toastMessage} backgroundColor={toastBackgroundColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 112,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1.4,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.muted,
  },
  summary: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 25,
    color: Colors.muted,
  },
  stockBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  stockBadgeSuccess: {
    backgroundColor: Colors.successSoft,
    borderColor: Colors.rentMid,
  },
  stockBadgeWarning: {
    backgroundColor: Colors.promoSoft,
    borderColor: '#fcd34d',
  },
  stockBadgeDanger: {
    backgroundColor: Colors.dangerSoft,
    borderColor: '#fecaca',
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  stockBadgeTextSuccess: {
    color: Colors.success,
  },
  stockBadgeTextWarning: {
    color: '#b45309',
  },
  stockBadgeTextDanger: {
    color: Colors.danger,
  },
  sectionBlock: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  copyCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  copyText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.muted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
});












