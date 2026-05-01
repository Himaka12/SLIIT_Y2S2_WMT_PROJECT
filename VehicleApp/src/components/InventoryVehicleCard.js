import React, { useMemo } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { BASE_URL } from '../api';
import { getPremiumRentPriceMeta, PremiumRentBadge } from './VehicleDetailsShared';
import { Colors, Radius, Shadow } from '../constants/theme';
import { getPromotionDiscountMeta } from '../utils/promotionUtils';

const GIFT_MARKER = '\uD83C\uDF81';

function resolveAssetUri(path) {
  if (!path || typeof path !== 'string') {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return path.startsWith('/') ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;
}

function formatPrice(value) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function InventoryVehicleCard({
  vehicle,
  user,
  promotion,
  isWishlisted,
  onToggleWishlist,
  onQuickView,
  cardWidth,
}) {
  const imageUri = useMemo(() => resolveAssetUri(vehicle?.image1), [vehicle?.image1]);
  const imageSource = useMemo(
    () => (imageUri ? { uri: imageUri, cache: 'force-cache' } : null),
    [imageUri],
  );
  const isRentVehicle = vehicle?.listingType === 'Rent';
  const premiumRentMeta = getPremiumRentPriceMeta(user, vehicle);
  const showPremiumOffer = premiumRentMeta.eligible;
  const promotionDiscount = getPromotionDiscountMeta(vehicle, promotion);
  const hasPromotion = promotionDiscount.hasDiscount;
  const currentPriceValue = showPremiumOffer
    ? premiumRentMeta.discountedPrice
    : hasPromotion
      ? promotionDiscount.finalPrice
      : Number(vehicle?.price || 0);
  const oldPriceLabel = formatPrice(vehicle?.price);
  const currentPriceLabel = formatPrice(currentPriceValue);

  const cardContent = (
    <View style={styles.overlay}>
      <View style={styles.topRow}>
        <View style={styles.topBadgeStack}>
          <View
            style={[
              styles.listingTypePill,
              isRentVehicle ? styles.tagRent : styles.tagSale,
              hasPromotion && styles.promotedTag,
            ]}
          >
            <Text
              style={[
                styles.listingTypeText,
                isRentVehicle ? styles.tagRentText : styles.tagSaleText,
                hasPromotion && styles.promotedMetaText,
              ]}
            >
              {isRentVehicle ? 'For Rent' : 'For Sale'}
            </Text>
          </View>

          {showPremiumOffer ? <PremiumRentBadge compact style={styles.premiumOfferBadge} /> : null}

          {hasPromotion ? (
            <View pointerEvents="none" style={styles.offerGiftWrap}>
              <Text style={styles.offerGiftIcon}>{GIFT_MARKER}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.wishlistButton}
        onPress={() => onToggleWishlist?.(vehicle?._id)}
        activeOpacity={0.9}
      >
        <BlurView intensity={34} tint="light" style={styles.wishlistBlur}>
          <Text style={[styles.wishlistIcon, !isWishlisted && styles.wishlistIconInactive]}>
            {isWishlisted ? '♥' : '♡'}
          </Text>
        </BlurView>
      </TouchableOpacity>

      <View style={styles.cardCopy}>
        <Text style={[styles.vehicleTitle, hasPromotion && styles.promotedText]} numberOfLines={1}>
          {vehicle?.brand} {vehicle?.model}
        </Text>

        {hasPromotion || showPremiumOffer ? (
          <Text style={[styles.oldPrice, hasPromotion && styles.promotedMetaText]} numberOfLines={1}>
            {oldPriceLabel}{isRentVehicle ? ' /day' : ''}
          </Text>
        ) : null}

        <Text style={[styles.currentPrice, hasPromotion && styles.promotedText]} numberOfLines={1}>
          {currentPriceLabel}{isRentVehicle ? ' /day' : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <TouchableOpacity
      style={[styles.card, cardWidth ? { width: cardWidth } : null, hasPromotion && styles.cardPromoted]}
      onPress={() => onQuickView?.(vehicle)}
      activeOpacity={0.92}
    >
      {imageSource ? (
        <ImageBackground source={imageSource} style={styles.image} imageStyle={styles.imageStyle}>
          {cardContent}
        </ImageBackground>
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Text style={styles.imageFallbackText}>CAR</Text>
          {cardContent}
        </View>
      )}
    </TouchableOpacity>
  );
}

function areEqual(prevProps, nextProps) {
  return (
    prevProps.vehicle === nextProps.vehicle
    && prevProps.user === nextProps.user
    && prevProps.promotion === nextProps.promotion
    && prevProps.isWishlisted === nextProps.isWishlisted
    && prevProps.onToggleWishlist === nextProps.onToggleWishlist
    && prevProps.onQuickView === nextProps.onQuickView
    && prevProps.cardWidth === nextProps.cardWidth
  );
}

export default React.memo(InventoryVehicleCard, areEqual);

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardPromoted: {
    borderWidth: 1,
    borderColor: '#ead7a3',
    shadowColor: '#b88922',
    shadowOpacity: 0.12,
  },
  image: {
    width: '100%',
    height: 244,
    backgroundColor: '#dfd6ca',
  },
  imageStyle: {
    borderRadius: 26,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(17,17,17,0.12)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingRight: 40,
  },
  topBadgeStack: {
    alignItems: 'flex-start',
    gap: 7,
  },
  listingTypePill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagRent: {
    backgroundColor: '#ffffff',
  },
  tagSale: {
    backgroundColor: 'rgba(37, 99, 235, 0.62)',
  },
  promotedTag: {
    backgroundColor: 'rgba(76, 54, 8, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245, 211, 122, 0.42)',
  },
  listingTypeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tagRentText: {
    color: '#111827',
  },
  tagSaleText: {
    color: Colors.white,
  },
  premiumOfferBadge: {
    alignSelf: 'flex-start',
  },
  wishlistButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  wishlistBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  wishlistIcon: {
    marginTop: -1,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: '900',
    color: '#ef4444',
  },
  wishlistIconInactive: {
    color: 'rgba(17,17,17,0.55)',
  },
  offerGiftWrap: {
    marginLeft: 3,
  },
  offerGiftIcon: {
    fontSize: 30,
    textShadowColor: 'rgba(15, 23, 42, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  cardCopy: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  promotedText: {
    color: '#ffd978',
  },
  promotedMetaText: {
    color: '#f6e0a2',
  },
  currentPrice: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: Colors.white,
  },
  oldPrice: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'line-through',
  },
});
