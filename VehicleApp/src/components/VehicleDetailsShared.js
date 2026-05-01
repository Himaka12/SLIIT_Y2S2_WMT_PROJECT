import React from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../api';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';
import {
  formatPromotionDiscountValue,
  getPromotionComputedStatus,
  getPromotionDateRangeLabel,
  getPromotionDiscountMeta,
  getVehiclePromotion as selectVehiclePromotion,
  promotionMatchesVehicle as matchPromotionToVehicle,
} from '../utils/promotionUtils';

export function resolveAssetUri(path) {
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

export function getVehicleImages(vehicle) {
  return [
    vehicle?.image1,
    vehicle?.image2,
    vehicle?.image3,
    vehicle?.image4,
    vehicle?.image5,
  ]
    .filter(Boolean)
    .map(resolveAssetUri)
    .filter(Boolean);
}

export function promotionMatchesVehicle(promo, vehicle) {
  return matchPromotionToVehicle(promo, vehicle, { placement: 'vehicleDetails' });
}

export function getVehiclePromotion(vehicle, promotions = []) {
  return selectVehiclePromotion(vehicle, promotions, { placement: 'vehicleDetails' });
}

export function formatPrice(value, listingType) {
  const amount = Number(value || 0).toLocaleString();
  return listingType === 'Rent' ? `Rs. ${amount} /day` : `Rs. ${amount}`;
}

export function getDiscountedPrice(vehicle, promotion) {
  return getPromotionDiscountMeta(vehicle, promotion).finalPrice;
}

export const PREMIUM_RENT_DISCOUNT_PERCENTAGE = 10;

export function isPremiumRentOfferEligible(user, vehicle) {
  return Boolean(user?.isPremium) && String(vehicle?.listingType || '').toLowerCase() === 'rent';
}

export function getPremiumRentDiscountedPrice(price) {
  return Math.round(Number(price || 0) * (1 - (PREMIUM_RENT_DISCOUNT_PERCENTAGE / 100)));
}

export function getPremiumRentPriceMeta(user, vehicle) {
  const originalPrice = Number(vehicle?.price || 0);
  const eligible = isPremiumRentOfferEligible(user, vehicle);
  const discountedPrice = eligible ? getPremiumRentDiscountedPrice(originalPrice) : originalPrice;

  return {
    eligible,
    originalPrice,
    discountedPrice,
    savings: Math.max(originalPrice - discountedPrice, 0),
    discountPercentage: PREMIUM_RENT_DISCOUNT_PERCENTAGE,
  };
}

export function PremiumRentBadge({ style, compact = false }) {
  return (
    <View style={[styles.premiumOfferBadgeWrap, compact && styles.premiumOfferBadgeWrapCompact, style]}>
      <MaterialCommunityIcons
        name="crown"
        size={compact ? 12 : 14}
        color="#111111"
      />
      <Text style={[styles.premiumOfferBadgeLabel, compact && styles.premiumOfferBadgeLabelCompact]}>
        10% OFF
      </Text>
    </View>
  );
}

export function PremiumRentCardAccent({
  style,
  compact = false,
  ribbonStyle,
  pillStyle,
}) {
  return (
    <View pointerEvents="none" style={[styles.premiumCardAccentWrap, style]}>
      <View style={[styles.premiumCardRibbon, compact && styles.premiumCardRibbonCompact, ribbonStyle]}>
        <Text style={[styles.premiumCardRibbonText, compact && styles.premiumCardRibbonTextCompact]}>
          10% OFF
        </Text>
      </View>

      <View style={[styles.premiumCardPill, compact && styles.premiumCardPillCompact, pillStyle]}>
        <MaterialCommunityIcons
          name="crown"
          size={compact ? 14 : 16}
          color="#ffffff"
        />
        <Text style={[styles.premiumCardPillText, compact && styles.premiumCardPillTextCompact]}>
          10% OFF
        </Text>
      </View>
    </View>
  );
}

export function PremiumRentOfferCard({ user, vehicle }) {
  const premiumMeta = getPremiumRentPriceMeta(user, vehicle);

  if (!premiumMeta.eligible) {
    return null;
  }

  return (
    <View style={styles.premiumOfferCard}>
      <View style={styles.premiumOfferTopRow}>
        <View style={styles.premiumOfferCopyWrap}>
          <Text style={styles.premiumOfferTitle}>Wheelzy Premium Rent Offer</Text>
          <Text style={styles.premiumOfferDescription}>
            Your premium membership unlocks an exclusive 10% discount on this rental.
          </Text>
        </View>
        <PremiumRentBadge />
      </View>

      <View style={styles.premiumOfferPriceRow}>
        <Text style={styles.premiumOfferPrice}>
          {formatPrice(premiumMeta.discountedPrice, vehicle?.listingType)}
        </Text>
        <Text style={styles.premiumOfferOldPrice}>
          {formatPrice(premiumMeta.originalPrice, vehicle?.listingType)}
        </Text>
      </View>
    </View>
  );
}

export function VehicleHeroGallery({
  vehicle,
  activeImage,
  onChangeImage,
  onBack,
  onToggleWishlist,
  isWishlisted,
  showWishlist = true,
  fallbackLabel = 'Wheelzy',
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const galleryRef = React.useRef(null);
  const previewGalleryRef = React.useRef(null);
  const currentIndexRef = React.useRef(activeImage || 0);
  const heroHeight = Math.min(430, width * 1.08);
  const images = React.useMemo(() => getVehicleImages(vehicle), [vehicle]);
  const heroImages = React.useMemo(
    () => (images.length ? images : [null]),
    [images],
  );
  const measurableImageKey = React.useMemo(
    () => heroImages.filter(Boolean).join('|'),
    [heroImages],
  );
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [previewIndex, setPreviewIndex] = React.useState(activeImage || 0);
  const [previewFrame, setPreviewFrame] = React.useState(() => ({
    width: Math.min(width - 40, 320),
    height: Math.min((width - 40) * 0.62, 240),
  }));

  const openPreview = React.useCallback((index) => {
    if (!heroImages[index]) {
      return;
    }

    setPreviewIndex(index);
    setPreviewVisible(true);
  }, [heroImages]);

  const closePreview = React.useCallback(() => {
    setPreviewVisible(false);
  }, []);

  React.useEffect(() => {
    const nextIndex = Math.max(0, Math.min(activeImage || 0, heroImages.length - 1));

    if (galleryRef.current && heroImages.length > 1 && nextIndex !== currentIndexRef.current) {
      galleryRef.current.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }
    currentIndexRef.current = nextIndex;
  }, [activeImage, heroImages.length, width]);

  React.useEffect(() => {
    if (!previewVisible) {
      return;
    }

    requestAnimationFrame(() => {
      previewGalleryRef.current?.scrollToIndex?.({
        index: previewIndex,
        animated: false,
      });
    });
  }, [previewIndex, previewVisible]);

  React.useEffect(() => {
    if (heroImages.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      const nextIndex = (currentIndexRef.current + 1) % heroImages.length;
      currentIndexRef.current = nextIndex;
      galleryRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      onChangeImage(nextIndex);
    }, 3500);

    return () => clearInterval(timer);
  }, [heroImages.length, onChangeImage, width]);

  React.useEffect(() => {
    let cancelled = false;
    const measurableImages = heroImages.filter(Boolean);
    const setPreviewFrameIfChanged = (nextFrame) => {
      setPreviewFrame((current) => (
        current.width === nextFrame.width && current.height === nextFrame.height
          ? current
          : nextFrame
      ));
    };

    if (!measurableImages.length) {
      setPreviewFrameIfChanged({
        width: Math.min(width - 40, 320),
        height: Math.min((width - 40) * 0.62, 240),
      });
      return undefined;
    }

    const maxPreviewWidth = width - 40;
    const maxPreviewHeight = Math.max(160, height - (insets.top + 180));

    Promise.all(
      measurableImages.map((uri) => new Promise((resolve) => {
        Image.getSize(
          uri,
          (imageWidth, imageHeight) => resolve({ width: imageWidth, height: imageHeight }),
          () => resolve(null),
        );
      })),
    ).then((sizes) => {
      if (cancelled) {
        return;
      }

      const validSizes = sizes.filter(Boolean);
      if (!validSizes.length) {
        setPreviewFrameIfChanged({
          width: Math.min(width - 40, 320),
          height: Math.min((width - 40) * 0.62, 240),
        });
        return;
      }

      const smallestImage = validSizes.reduce((smallest, current) => {
        if (!smallest) {
          return current;
        }

        return (current.width * current.height) < (smallest.width * smallest.height)
          ? current
          : smallest;
      }, null);

      const smallestWidth = smallestImage?.width || validSizes[0].width;
      const smallestHeight = smallestImage?.height || validSizes[0].height;
      const scale = Math.min(
        maxPreviewWidth / Math.max(smallestWidth, 1),
        maxPreviewHeight / Math.max(smallestHeight, 1),
        1,
      );

      setPreviewFrameIfChanged({
        width: Math.round(smallestWidth * scale),
        height: Math.round(smallestHeight * scale),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [height, insets.top, measurableImageKey, width]);

  return (
    <View style={[styles.heroWrap, { height: heroHeight }]}>
      <FlatList
        ref={galleryRef}
        data={heroImages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        scrollEnabled={heroImages.length > 1}
        nestedScrollEnabled
        keyExtractor={(item, index) => `${item || 'fallback'}-${index}`}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => {
            galleryRef.current?.scrollToOffset({
              offset: width * index,
              animated: true,
            });
          });
        }}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          currentIndexRef.current = nextIndex;
          onChangeImage(nextIndex);
        }}
        renderItem={({ item, index }) => (
          item ? (
            <TouchableOpacity activeOpacity={0.96} onPress={() => openPreview(index)}>
              <Image
                source={{ uri: item }}
                style={[styles.heroImage, { width, height: heroHeight }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <View style={[styles.heroFallback, { width, height: heroHeight }]}>
              <MaterialCommunityIcons name="car-sports" size={52} color="#ffffff" />
              <Text style={styles.heroFallbackText}>{fallbackLabel}</Text>
            </View>
          )
        )}
      />

      <View pointerEvents="none" style={styles.heroShade} />

      <View style={[styles.heroActionRow, { top: insets.top + 12 }]}>
        <TouchableOpacity style={styles.heroActionButton} onPress={onBack} activeOpacity={0.88}>
          <BlurView intensity={38} tint="light" style={styles.heroActionBlur}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
          </BlurView>
        </TouchableOpacity>

        {showWishlist ? (
          <TouchableOpacity style={styles.heroActionButton} onPress={onToggleWishlist} activeOpacity={0.88}>
            <BlurView intensity={38} tint="light" style={styles.heroActionBlur}>
              <MaterialCommunityIcons
                name={isWishlisted ? 'heart' : 'heart-outline'}
                size={22}
                color={isWishlisted ? '#dc2626' : '#111111'}
              />
            </BlurView>
          </TouchableOpacity>
        ) : (
          <View style={styles.heroActionPlaceholder} />
        )}
      </View>

      {heroImages.length > 1 ? (
        <View pointerEvents="none" style={styles.imageCountPill}>
          <Text style={styles.imageCountText}>{Math.min(activeImage + 1, heroImages.length)} / {heroImages.length}</Text>
        </View>
      ) : null}

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewBackdrop}>
          <BlurView intensity={32} tint="light" style={styles.previewBlurLayer} />
          <Pressable style={styles.previewDimLayer} onPress={closePreview} />
          <View style={[styles.previewCard, { width: previewFrame.width }]}>
            <FlatList
              ref={previewGalleryRef}
              data={heroImages}
              style={{ width: previewFrame.width }}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              disableIntervalMomentum
              bounces={false}
              keyExtractor={(item, index) => `${item || 'preview-fallback'}-${index}`}
              getItemLayout={(_, index) => ({
                length: previewFrame.width,
                offset: previewFrame.width * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(previewFrame.width, 1));
                setPreviewIndex(nextIndex);
              }}
              renderItem={({ item }) => (
                <View style={[styles.previewSlide, { width: previewFrame.width, height: previewFrame.height }]}>
                  {item ? (
                    <View style={[styles.previewImageFrame, { width: previewFrame.width, height: previewFrame.height }]}>
                      <Image
                        source={{ uri: item }}
                        style={[styles.previewImage, { width: previewFrame.width, height: previewFrame.height }]}
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    <View style={[styles.previewFallback, { width: previewFrame.width, height: previewFrame.height }]}>
                      <MaterialCommunityIcons name="car-sports" size={42} color="#94a3b8" />
                      <Text style={styles.previewFallbackText}>{fallbackLabel}</Text>
                    </View>
                  )}
                </View>
              )}
            />

            {heroImages.length > 1 ? (
              <View style={styles.previewIndicatorRow}>
                {heroImages.map((_, index) => (
                  <View
                    key={`vehicle-preview-indicator-${index}`}
                    style={[
                      styles.previewIndicatorBar,
                      index === previewIndex && styles.previewIndicatorBarActive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function VehicleDetailsSheet({ children }) {
  return <View style={styles.sheet}>{children}</View>;
}

export function VehicleDetailsStats({ items }) {
  return (
    <View style={styles.statsRow}>
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} style={[styles.statCard, index === items.length - 1 && styles.statCardLast]}>
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
          {item.caption ? <Text style={styles.statCaption}>{item.caption}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function VehicleHostInfo({ title, subtitle, caption, accent = 'car-estate' }) {
  return (
    <View style={styles.hostCard}>
      <View style={styles.hostAvatar}>
        <MaterialCommunityIcons name={accent} size={24} color="#111111" />
      </View>

      <View style={styles.hostCopy}>
        <Text style={styles.hostTitle}>{title}</Text>
        {subtitle ? <Text style={styles.hostSubtitle}>{subtitle}</Text> : null}
        {caption ? <Text style={styles.hostCaption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

export function VehicleFeatureGrid({ items }) {
  return (
    <View style={styles.featureGrid}>
      {items.map((item) => (
        <View key={`${item.label}-${item.value}`} style={styles.featureItem}>
          <Text style={styles.featureLabel}>{item.label}</Text>
          <Text style={styles.featureValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function VehiclePromotionCard({ promotion, vehicle }) {
  const discountMeta = getPromotionDiscountMeta(vehicle, promotion);

  if (!discountMeta.hasDiscount) {
    return null;
  }

  const promotionStatus = getPromotionComputedStatus(promotion);
  const dateRangeLabel = getPromotionDateRangeLabel(promotion);

  return (
    <View style={styles.promoCard}>
      <View style={styles.promoTopRow}>
        <View style={styles.promoTitleWrap}>
          <Text style={styles.promoEyebrow}>
            {promotion?.promotionType || 'Promotion'} {promotionStatus === 'Active' ? 'Offer' : promotionStatus}
          </Text>
          <Text style={styles.promoTitle}>{promotion?.title || 'Limited-time offer'}</Text>
        </View>
        <View style={styles.promoBadge}>
          <Text style={styles.promoBadgeText}>{discountMeta.badgeLabel}</Text>
        </View>
      </View>

      {promotion?.description ? (
        <Text style={styles.promoDescription}>{promotion.description}</Text>
      ) : null}

      <View style={styles.promoMetaRow}>
        <View style={styles.promoMetaPill}>
          <Text style={styles.promoMetaPillText}>{formatPromotionDiscountValue(promotion)}</Text>
        </View>
        {dateRangeLabel ? (
          <Text style={styles.promoDates}>{dateRangeLabel}</Text>
        ) : null}
      </View>

      <View style={styles.promoPriceRow}>
        <Text style={styles.promoPrice}>{formatPrice(discountMeta.finalPrice, vehicle?.listingType)}</Text>
        <Text style={styles.promoPriceOld}>{formatPrice(vehicle?.price, vehicle?.listingType)}</Text>
      </View>
    </View>
  );
}

export function VehicleBottomCTA({
  priceLabel,
  priceSubLabel,
  ctaText,
  onPress,
  hidden = false,
}) {
  const insets = useSafeAreaInsets();

  if (hidden) {
    return null;
  }

  return (
    <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom, 2) + 1 }]}>
      <View style={styles.bottomPriceWrap}>
        <Text style={styles.bottomPriceText}>{priceLabel}</Text>
        {priceSubLabel ? <Text style={styles.bottomPriceSub}>{priceSubLabel}</Text> : null}
      </View>

      <TouchableOpacity style={styles.bottomCta} onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.bottomCtaText}>{ctaText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  heroImage: {
    backgroundColor: '#e5e7eb',
  },
  heroFallback: {
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroFallbackText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.12)',
  },
  heroActionRow: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroActionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  heroActionBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroActionPlaceholder: {
    width: 46,
    height: 46,
  },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  previewBlurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  previewDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.24)',
  },
  previewCard: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  previewSlide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  previewImage: {
    backgroundColor: 'transparent',
  },
  previewFallback: {
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewFallbackText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  previewIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  previewIndicatorBar: {
    width: 26,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: '#dbe3ef',
  },
  previewIndicatorBarActive: {
    backgroundColor: '#111111',
  },
  imageCountPill: {
    position: 'absolute',
    right: 18,
    bottom: 46,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(17,17,17,0.55)',
  },
  imageCountText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sheet: {
    marginTop: -28,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 22,
    paddingHorizontal: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  statCardLast: {
    marginRight: 0,
  },
  statValue: {
    fontSize: 23,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  statCaption: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    ...Shadow.sm,
  },
  hostAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  hostCopy: {
    flex: 1,
  },
  hostTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  hostSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.muted,
  },
  hostCaption: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.muted,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    width: '47%',
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  featureValue: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#111111',
  },
  promoCard: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  promoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  promoTitleWrap: {
    flex: 1,
  },
  promoEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  promoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  promoBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#15803d',
  },
  promoDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#166534',
  },
  promoMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  promoMetaPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  promoMetaPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  promoDates: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  promoPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  promoPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
  },
  promoPriceOld: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  premiumOfferBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#facc15',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  premiumOfferBadgeWrapCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 3,
  },
  premiumOfferBadgeLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.3,
  },
  premiumOfferBadgeLabelCompact: {
    fontSize: 10,
  },
  premiumCardAccentWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  premiumCardRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 94,
    height: 74,
    backgroundColor: '#16a34a',
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  premiumCardRibbonCompact: {
    width: 84,
    height: 64,
    borderBottomLeftRadius: 32,
  },
  premiumCardRibbonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    transform: [{ rotate: '38deg' }],
  },
  premiumCardRibbonTextCompact: {
    fontSize: 12,
  },
  premiumCardPill: {
    position: 'absolute',
    right: 14,
    top: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: '#22c55e',
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  premiumCardPillCompact: {
    right: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  premiumCardPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  premiumCardPillTextCompact: {
    fontSize: 13,
  },
  premiumOfferCard: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  premiumOfferTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  premiumOfferCopyWrap: {
    flex: 1,
  },
  premiumOfferTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  premiumOfferDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#166534',
  },
  premiumOfferPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  premiumOfferPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
  },
  premiumOfferOldPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  bottomBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#111111',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Shadow.lg,
  },
  bottomPriceWrap: {
    flex: 1,
    paddingRight: 14,
  },
  bottomPriceText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  bottomPriceSub: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '600',
  },
  bottomCta: {
    minWidth: 144,
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#facc15',
  },
  bottomCtaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
});
