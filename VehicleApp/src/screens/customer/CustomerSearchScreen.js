import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BASE_URL,
  customerAPI,
  promotionAPI,
  vehicleAPI,
  wishlistAPI,
} from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getPremiumRentPriceMeta, PremiumRentBadge } from '../../components/VehicleDetailsShared';
import SuccessToast from '../../components/SuccessToast';
import PremiumCrownBadge from '../../components/PremiumCrownBadge';
import PremiumLoginOfferPopup from '../../components/PremiumLoginOfferPopup';
import PromotionQuickViewSheet from '../../components/PromotionQuickViewSheet';
import { LoadingSpinner } from '../../components/UI';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';
import {
  formatPromotionDiscountValue,
  getPromotionDiscountMeta,
  getPromotionScope,
  getPromotionScopeTypeLabel,
  getVehiclePromotion,
  promotionMatchesVehicle,
} from '../../utils/promotionUtils';

const GIFT_MARKER = '\uD83C\uDF81';
const LOGIN_PREMIUM_OFFER_KEY = 'wheelzy_login_premium_offer';

function resolveAssetUri(path) {
  if (!path) {
    return null;
  }

  if (typeof path !== 'string') {
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

function getProfileImageUri(profile) {
  const candidates = [
    profile?.profileImage,
    profile?.avatar,
    profile?.image,
    profile?.photo,
    profile?.imageUrl,
    profile?.avatarUrl,
  ];

  const match = candidates.find(Boolean);
  return resolveAssetUri(match);
}

function formatVehiclePrice(vehicle, user) {
  const premiumRentMeta = getPremiumRentPriceMeta(user, vehicle);
  const amount = Number(premiumRentMeta.eligible ? premiumRentMeta.discountedPrice : vehicle?.price || 0).toLocaleString();
  return vehicle?.listingType === 'Rent' ? `Rs. ${amount} /day` : `Rs. ${amount}`;
}

function formatVehicleSubtitle(vehicle) {
  const listingLabel = vehicle?.listingType === 'Rent' ? 'Premium rental' : 'Direct sale';
  const detailBits = [listingLabel, vehicle?.manufactureYear, vehicle?.fuelType].filter(Boolean);
  return detailBits.join(' · ');
}

function formatNotificationTime(value) {
  const timestamp = new Date(value || Date.now()).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Just now';
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getNotificationToneStyle(tone) {
  if (tone === 'critical') {
    return {
      accent: '#dc2626',
      icon: 'alert-circle',
      badgeBackground: '#fee2e2',
      badgeText: '#b91c1c',
      surface: '#fff5f5',
    };
  }

  if (tone === 'warning') {
    return {
      accent: '#d97706',
      icon: 'clock-outline',
      badgeBackground: '#fef3c7',
      badgeText: '#b45309',
      surface: '#fffaf0',
    };
  }

  if (tone === 'premium') {
    return {
      accent: '#ca8a04',
      icon: 'crown',
      badgeBackground: '#fef08a',
      badgeText: '#854d0e',
      surface: '#fffbea',
    };
  }

  if (tone === 'success') {
    return {
      accent: '#16a34a',
      icon: 'check-decagram',
      badgeBackground: '#dcfce7',
      badgeText: '#166534',
      surface: '#f0fdf4',
    };
  }

  return {
    accent: '#111111',
    icon: 'bell-outline',
    badgeBackground: '#f3f4f6',
    badgeText: '#374151',
    surface: '#f8fafc',
  };
}

function IconActionButton({ icon, onPress, badgeCount = 0 }) {
  return (
    <TouchableOpacity style={styles.headerActionButton} onPress={onPress} activeOpacity={0.9}>
      <MaterialCommunityIcons name={icon} size={20} color="#111111" />
      {badgeCount > 0 ? (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function HeaderGreeting({
  profileImageUri,
  customerName,
  isPremium,
  onOpenProfile,
  onOpenNotifications,
  notificationCount,
  onOpenWishlist,
}) {
  return (
    <View style={styles.headerRow}>
      <TouchableOpacity style={styles.headerIdentity} onPress={onOpenProfile} activeOpacity={0.85}>
        {profileImageUri ? (
          <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>
              {(customerName || 'W').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.headerTextWrap}>
          <View style={styles.headerGreetingRow}>
            <Text style={styles.headerGreeting}>Hi, {customerName} !</Text>
            {isPremium ? <PremiumCrownBadge style={styles.headerCrownBadge} /> : null}
          </View>
          <Text style={styles.headerSubtitle}>Welcome back</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <IconActionButton
          icon="bell-outline"
          onPress={onOpenNotifications}
          badgeCount={notificationCount}
        />
        <IconActionButton
          icon="heart-outline"
          onPress={onOpenWishlist}
        />
      </View>
    </View>
  );
}

function formatBannerDate(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).toUpperCase();
  }

  return parsed
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .replace(/ /g, ' ')
    .toUpperCase();
}

function formatBannerDateRange(promotion) {
  const start = promotion?.startDate ? formatBannerDate(promotion.startDate) : '';
  const end = promotion?.endDate ? formatBannerDate(promotion.endDate) : '';

  if (!start) {
    return end || 'LIMITED TIME';
  }

  if (!end) {
    return start;
  }

  const startParts = start.split(' ');
  const endParts = end.split(' ');
  if (startParts.length === 3 && endParts.length === 3 && startParts[2] === endParts[2]) {
    return `${startParts[0]} ${startParts[1]} - ${endParts[0]} ${endParts[1]} ${endParts[2]}`;
  }

  return `${start} - ${end}`;
}

function getPromotionBrandDisplay(promotion) {
  const scope = getPromotionScope(promotion);
  if (scope.brands?.length) {
    return scope.brands[0].toUpperCase();
  }

  if (promotion?.targetBrand) {
    return String(promotion.targetBrand).toUpperCase();
  }

  if (scope.models?.length) {
    return scope.models[0].toUpperCase();
  }

  if (scope.categories?.length) {
    return scope.categories[0].toUpperCase();
  }

  return 'WHEELZY';
}

function getPromotionCollectionLabel(promotion) {
  const scope = getPromotionScope(promotion);
  if (scope.kind === 'brand') {
    return 'COLLECTION';
  }

  if (scope.kind === 'category') {
    return 'SERIES';
  }

  if (scope.kind === 'model') {
    return 'LINEUP';
  }

  return 'SELECTION';
}

function PromotionBannerCard({ promotion, cardWidth, onPress }) {
  const bannerRef = useRef(null);
  const bannerImageUri = resolveAssetUri(promotion?.imageUrl);
  const discountLabel = formatPromotionDiscountValue(promotion) || 'Limited offer';
  const dateLabel = formatBannerDateRange(promotion);
  const brandLabel = getPromotionBrandDisplay(promotion);
  const collectionLabel = getPromotionCollectionLabel(promotion);
  const seasonalLabel = String(promotion?.promotionType || 'Seasonal').toUpperCase();
  const subheadline = promotion?.title || `${brandLabel} Premium Offer`;
  const supportingCopy = promotion?.description || `Unlock ${discountLabel.toUpperCase()} across the ${brandLabel} ${collectionLabel.toLowerCase()}.`;
  const scopeLabel = getPromotionScopeTypeLabel(promotion);
  const scopeValue = scopeLabel ? scopeLabel.toUpperCase() : 'SALE';

  const handlePress = () => {
    if (!onPress) {
      return;
    }

    bannerRef.current?.measureInWindow?.((x, y, width, height) => {
      onPress({
        x,
        y,
        width,
        height,
      });
    });
  };

  if (bannerImageUri) {
    return (
      <View ref={bannerRef} collapsable={false}>
        <TouchableOpacity activeOpacity={0.97} onPress={handlePress}>
          <ImageBackground
            source={{ uri: bannerImageUri }}
            style={[styles.promotionBannerCard, cardWidth ? { width: cardWidth } : null]}
            imageStyle={styles.promotionBannerImage}
          >
            <View style={styles.promotionBannerOverlay} />
            <View style={styles.promotionBannerLeftShade} />
            <View style={styles.promotionBannerBeamPrimary} />
            <View style={styles.promotionBannerBeamSecondary} />

            <View style={styles.promotionBannerContent}>
              <View style={styles.promotionBannerRibbonWrap}>
                <View style={styles.promotionBannerRibbon}>
                  <MaterialCommunityIcons name="tag-outline" size={18} color="#111111" />
                  <Text style={styles.promotionBannerRibbonText}>{seasonalLabel}</Text>
                </View>
                <View style={styles.promotionBannerRibbonCut} />
              </View>

              <View style={styles.promotionBannerHeadlineBlock}>
                <Text style={styles.promotionBannerHeadlineLight}>DRIVE MORE.</Text>
                <Text style={styles.promotionBannerHeadlineAccent}>PAY LESS.</Text>
                <Text style={styles.promotionBannerSubheadline} numberOfLines={1}>{subheadline}</Text>
                <Text style={styles.promotionBannerSupportingCopy} numberOfLines={2}>{supportingCopy}</Text>
              </View>

              <View style={styles.promotionBannerCalloutRow}>
                <View style={styles.promotionBannerDiscountBox}>
                  <Text style={styles.promotionBannerDiscountLabel}>ENJOY</Text>
                  <Text style={styles.promotionBannerDiscountValue}>{discountLabel.toUpperCase()}</Text>
                </View>
                <View style={styles.promotionBannerCollectionBox}>
                  <Text style={styles.promotionBannerCollectionLead}>ON</Text>
                  <Text style={styles.promotionBannerCollectionBrand}>{brandLabel}</Text>
                  <Text style={styles.promotionBannerCollectionTail}>{collectionLabel}</Text>
                </View>
              </View>

              <View style={styles.promotionBannerInfoStrip}>
                <View style={styles.promotionBannerInfoItem}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#f4c430" />
                  <View style={styles.promotionBannerInfoCopy}>
                    <Text style={styles.promotionBannerInfoLabel}>Offer Valid</Text>
                    <Text style={styles.promotionBannerInfoValue} numberOfLines={1}>{dateLabel}</Text>
                  </View>
                </View>
                <View style={styles.promotionBannerInfoDivider} />
                <View style={styles.promotionBannerInfoItem}>
                  <MaterialCommunityIcons name="car-info" size={20} color="#f4c430" />
                  <View style={styles.promotionBannerInfoCopy}>
                    <Text style={styles.promotionBannerInfoLabel}>Brand</Text>
                    <Text style={styles.promotionBannerInfoValue} numberOfLines={1}>{brandLabel}</Text>
                  </View>
                </View>
                <View style={styles.promotionBannerScopeBadge}>
                  <Text style={styles.promotionBannerScopeBadgeText}>{scopeValue}</Text>
                </View>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View ref={bannerRef} collapsable={false}>
      <TouchableOpacity activeOpacity={0.97} onPress={handlePress}>
        <View style={[styles.promotionBannerCard, styles.promotionBannerFallbackCard, cardWidth ? { width: cardWidth } : null]}>
          <View style={styles.promotionBannerLeftShadeFallback} />
          <View style={styles.promotionBannerBeamPrimary} />
          <View style={styles.promotionBannerBeamSecondary} />
          <View style={styles.promotionBannerContent}>
            <View style={styles.promotionBannerRibbonWrap}>
              <View style={[styles.promotionBannerRibbon, styles.promotionBannerRibbonLight]}>
                <MaterialCommunityIcons name="tag-outline" size={18} color="#111111" />
                <Text style={styles.promotionBannerRibbonText}>{seasonalLabel}</Text>
              </View>
              <View style={[styles.promotionBannerRibbonCut, styles.promotionBannerRibbonCutLight]} />
            </View>

            <View style={styles.promotionBannerHeadlineBlock}>
              <Text style={[styles.promotionBannerHeadlineLight, styles.promotionBannerHeadlineFallback]}>DRIVE MORE.</Text>
              <Text style={styles.promotionBannerHeadlineAccent}>PAY LESS.</Text>
              <Text style={[styles.promotionBannerSubheadline, styles.promotionBannerSubheadlineFallback]} numberOfLines={1}>{subheadline}</Text>
              <Text style={[styles.promotionBannerSupportingCopy, styles.promotionBannerSupportingCopyFallback]} numberOfLines={2}>{supportingCopy}</Text>
            </View>

            <View style={styles.promotionBannerCalloutRow}>
              <View style={styles.promotionBannerDiscountBox}>
                <Text style={styles.promotionBannerDiscountLabel}>ENJOY</Text>
                <Text style={styles.promotionBannerDiscountValue}>{discountLabel.toUpperCase()}</Text>
              </View>
              <View style={styles.promotionBannerCollectionBox}>
                <Text style={styles.promotionBannerCollectionLead}>ON</Text>
                <Text style={styles.promotionBannerCollectionBrand}>{brandLabel}</Text>
                <Text style={styles.promotionBannerCollectionTail}>{collectionLabel}</Text>
              </View>
            </View>

            <View style={styles.promotionBannerInfoStrip}>
              <View style={styles.promotionBannerInfoItem}>
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#f4c430" />
                <View style={styles.promotionBannerInfoCopy}>
                  <Text style={styles.promotionBannerInfoLabel}>Offer Valid</Text>
                  <Text style={styles.promotionBannerInfoValue} numberOfLines={1}>{dateLabel}</Text>
                </View>
              </View>
              <View style={styles.promotionBannerInfoDivider} />
              <View style={styles.promotionBannerInfoItem}>
                <MaterialCommunityIcons name="car-info" size={20} color="#f4c430" />
                <View style={styles.promotionBannerInfoCopy}>
                  <Text style={styles.promotionBannerInfoLabel}>Brand</Text>
                  <Text style={styles.promotionBannerInfoValue} numberOfLines={1}>{brandLabel}</Text>
                </View>
              </View>
              <View style={styles.promotionBannerScopeBadge}>
                <Text style={styles.promotionBannerScopeBadgeText}>{scopeValue}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({ title, onPress }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.sectionLink}>See all</Text>
      </TouchableOpacity>
    </View>
  );
}

function OfferWrap({ compact = false }) {
  return (
    <View pointerEvents="none" style={[styles.offerGiftWrap, compact && styles.offerGiftWrapCompact]}>
      <Text style={[styles.offerGiftIcon, compact && styles.offerGiftIconCompact]}>{GIFT_MARKER}</Text>
    </View>
  );
}

function FeaturedVehicleCard({ vehicle, user, promotion, onPress, cardWidth }) {
  const imageUri = resolveAssetUri(vehicle?.image1);
  const premiumRentMeta = getPremiumRentPriceMeta(user, vehicle);
  const promotionDiscount = getPromotionDiscountMeta(vehicle, promotion);
  const hasPromotion = Boolean(promotion && promotionDiscount.hasDiscount);
  const displayPrice = promotionDiscount.hasDiscount ? promotionDiscount.finalPrice : vehicle?.price;
  return (
    <TouchableOpacity
      style={[styles.featuredCard, hasPromotion && styles.featuredCardPromoted, cardWidth ? { width: cardWidth } : null]}
      onPress={onPress}
      activeOpacity={0.94}
    >
      {imageUri ? (
        <ImageBackground source={{ uri: imageUri }} style={styles.featuredImage} imageStyle={styles.featuredImageStyle}>
          {hasPromotion ? <OfferWrap /> : null}
          <View style={styles.featuredOverlay}>
            <View style={styles.featuredTopRow}>
              <View
                style={[
                  styles.featuredTag,
                  vehicle?.listingType === 'Rent' ? styles.tagRent : styles.tagSale,
                  hasPromotion && styles.promotedTag,
                ]}
              >
                <Text
                  style={[
                    styles.featuredTagText,
                    vehicle?.listingType === 'Rent' ? styles.tagRentText : styles.tagSaleText,
                    hasPromotion && styles.promotedMetaText,
                  ]}
                >
                  {vehicle?.listingType === 'Rent' ? 'Rental' : 'For Sale'}
                </Text>
              </View>
              {premiumRentMeta.eligible ? (
                <PremiumRentBadge compact style={styles.featuredPremiumBadge} />
              ) : null}
            </View>
            <View style={styles.featuredContent}>
              <Text style={[styles.featuredTitle, hasPromotion && styles.featuredTitlePromoted]} numberOfLines={2}>
                {vehicle?.brand} {vehicle?.model}
              </Text>
              <Text style={[styles.featuredSubtitle, hasPromotion && styles.promotedMetaText]} numberOfLines={2}>
                {formatVehicleSubtitle(vehicle)}
              </Text>
              <View style={styles.featuredFooter}>
                <View>
                  {promotionDiscount.hasDiscount ? (
                    <Text style={[styles.featuredPriceOld, hasPromotion && styles.promotedMetaText]}>
                      Rs. {Number(vehicle?.price || 0).toLocaleString()}
                    </Text>
                  ) : null}
                  <Text style={[styles.featuredPrice, hasPromotion && styles.featuredPricePromoted]}>
                    {vehicle?.listingType === 'Rent'
                      ? `Rs. ${Number(displayPrice || 0).toLocaleString()} /day`
                      : `Rs. ${Number(displayPrice || 0).toLocaleString()}`}
                  </Text>
                  {premiumRentMeta.eligible ? (
                    <Text style={[styles.featuredPriceOld, hasPromotion && styles.promotedMetaText]}>
                      Rs. {Number(premiumRentMeta.originalPrice).toLocaleString()} /day
                    </Text>
                  ) : null}
                </View>
                <View style={styles.featuredAction}>
                  <MaterialCommunityIcons name="arrow-top-right" size={18} color="#111111" />
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.featuredImage, styles.featuredFallback]}>
          <Text style={styles.featuredFallbackText}>WHEELZY</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function VehicleMiniCard({ vehicle, user, promotion, onPress }) {
  const imageUri = resolveAssetUri(vehicle?.image1);
  const premiumRentMeta = getPremiumRentPriceMeta(user, vehicle);
  const promotionDiscount = getPromotionDiscountMeta(vehicle, promotion);
  const hasPromotion = Boolean(promotion && promotionDiscount.hasDiscount);
  const displayPrice = promotionDiscount.hasDiscount ? promotionDiscount.finalPrice : vehicle?.price;
  return (
    <TouchableOpacity style={[styles.miniCard, hasPromotion && styles.miniCardPromoted]} onPress={onPress} activeOpacity={0.92}>
      {imageUri ? (
        <ImageBackground source={{ uri: imageUri }} style={styles.miniImage} imageStyle={styles.miniImageStyle}>
          {hasPromotion ? <OfferWrap compact /> : null}
          <View style={styles.miniOverlay}>
            <View style={styles.miniTopRow}>
              <View
                style={[
                  styles.miniTag,
                  vehicle?.listingType === 'Rent' ? styles.tagRent : styles.tagSale,
                  hasPromotion && styles.promotedTag,
                ]}
              >
                <Text
                  style={[
                    styles.miniTagText,
                    vehicle?.listingType === 'Rent' ? styles.tagRentText : styles.tagSaleText,
                    hasPromotion && styles.promotedMetaText,
                  ]}
                >
                  {vehicle?.listingType === 'Rent' ? 'Rental' : 'For Sale'}
                </Text>
              </View>
              {premiumRentMeta.eligible ? (
                <PremiumRentBadge compact style={styles.miniPremiumBadge} />
              ) : null}
            </View>
            <View style={styles.miniContent}>
              <Text style={[styles.miniTitle, hasPromotion && styles.miniTitlePromoted]} numberOfLines={1}>
                {vehicle?.brand} {vehicle?.model}
              </Text>
              {promotionDiscount.hasDiscount ? (
                <Text style={[styles.miniPriceOld, hasPromotion && styles.promotedMetaText]} numberOfLines={1}>
                  Rs. {Number(vehicle?.price || 0).toLocaleString()}
                </Text>
              ) : null}
              <Text style={[styles.miniPrice, hasPromotion && styles.miniPricePromoted]} numberOfLines={1}>
                {vehicle?.listingType === 'Rent'
                  ? `Rs. ${Number(displayPrice || 0).toLocaleString()} /day`
                  : `Rs. ${Number(displayPrice || 0).toLocaleString()}`}
              </Text>
              {premiumRentMeta.eligible ? (
                <Text style={[styles.miniPriceOld, hasPromotion && styles.promotedMetaText]} numberOfLines={1}>
                  Rs. {Number(premiumRentMeta.originalPrice).toLocaleString()} /day
                </Text>
              ) : null}
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.miniImage, styles.storyPlaceholder]}>
          <Text style={styles.storyPlaceholderText}>CAR</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function SliderScrubber({ count, activeIndex, onIndexChange }) {
  const [trackWidth, setTrackWidth] = useState(0);

  const handleTouch = useCallback((locationX) => {
    if (!trackWidth || count <= 0) {
      return;
    }

    const segmentWidth = trackWidth / count;
    const nextIndex = Math.max(0, Math.min(count - 1, Math.floor(locationX / segmentWidth)));
    onIndexChange(nextIndex);
  }, [count, onIndexChange, trackWidth]);

  if (count <= 0) {
    return null;
  }

  const segmentWidth = trackWidth > 0 ? trackWidth / count : 0;
  const thumbWidth = segmentWidth > 0 ? Math.max(segmentWidth - 4, 18) : 18;
  const thumbOffset = segmentWidth > 0 ? (activeIndex * segmentWidth) + 2 : 2;

  return (
    <View style={styles.sectionIndicatorWrap}>
      <View
        style={styles.sectionIndicatorTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => handleTouch(event.nativeEvent.locationX)}
        onResponderMove={(event) => handleTouch(event.nativeEvent.locationX)}
      >
        <Animated.View
          style={[
            styles.sectionIndicatorThumb,
            {
              width: thumbWidth,
              transform: [{ translateX: thumbOffset }],
            },
          ]}
        />
      </View>
    </View>
  );
}

function WishlistSheetItem({ item, onPress, onRemove }) {
  const vehicle = item?.vehicle;

  if (!vehicle) {
    return null;
  }

  const imageUri = resolveAssetUri(vehicle?.image1);
  const premiumRentMeta = getPremiumRentPriceMeta(item?.user, vehicle);
  const title = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim();
  const subtitle = [vehicle.manufactureYear, vehicle.listingType, vehicle.fuelType].filter(Boolean).join(' · ');
  const price = Number(vehicle?.price || 0).toLocaleString();

  return (
    <TouchableOpacity style={styles.wishlistSheetItem} onPress={onPress} activeOpacity={0.92}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.wishlistSheetImage} resizeMode="cover" />
      ) : (
        <View style={styles.wishlistSheetImageFallback}>
          <MaterialCommunityIcons name="car-outline" size={22} color="#64748b" />
        </View>
      )}

      <View style={styles.wishlistSheetCopy}>
        <Text style={styles.wishlistSheetTitle} numberOfLines={1}>{title || 'Saved vehicle'}</Text>
        <Text style={styles.wishlistSheetSubtitle} numberOfLines={1}>{subtitle || 'Vehicle details'}</Text>
        <View>
          <Text style={styles.wishlistSheetPrice}>
            Rs. {Number(premiumRentMeta.eligible ? premiumRentMeta.discountedPrice : vehicle?.price || 0).toLocaleString()}
            {vehicle?.listingType === 'Rent' ? ' /day' : ''}
          </Text>
          {premiumRentMeta.eligible ? (
            <Text style={styles.wishlistSheetOldPrice}>Rs. {price} /day</Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.wishlistSheetRemove}
        onPress={onRemove}
        activeOpacity={0.9}
      >
        <MaterialCommunityIcons name="heart" size={18} color="#dc2626" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function CustomerNotificationCard({ item, onPress }) {
  const imageUri = resolveAssetUri(item?.image);
  const tone = getNotificationToneStyle(item?.tone);

  return (
    <TouchableOpacity style={styles.notificationCard} onPress={onPress} activeOpacity={0.92}>
      <View style={[styles.notificationAccentBar, { backgroundColor: tone.accent }]} />
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.notificationImage} resizeMode="cover" />
      ) : (
        <View
          style={[
            styles.notificationImage,
            styles.notificationImageFallback,
            { backgroundColor: tone.surface },
          ]}
        >
          <MaterialCommunityIcons name={tone.icon} size={20} color={tone.accent} />
        </View>
      )}

      <View style={styles.notificationCopy}>
        <View style={styles.notificationMetaRow}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item?.title}
          </Text>
          <Text style={styles.notificationTime}>{formatNotificationTime(item?.createdAt)}</Text>
        </View>

        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item?.message}
        </Text>

        <View style={styles.notificationFooterRow}>
          <View style={[styles.notificationTypeBadge, { backgroundColor: tone.badgeBackground }]}>
            <Text style={[styles.notificationTypeBadgeText, { color: tone.badgeText }]}>
              {item?.tone === 'premium' ? 'Premium' : item?.tone === 'critical' ? 'Critical' : 'Update'}
            </Text>
          </View>

          <View style={styles.notificationGoWrap}>
            <Text style={styles.notificationGoText}>Open</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color="#475569" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CustomerSearchScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const hasLoadedOnceRef = useRef(false);
  const heroBannerListRef = useRef(null);
  const heroBannerIndexRef = useRef(0);
  const featuredListRef = useRef(null);
  const featuredIndexRef = useRef(0);
  const popularScrollRef = useRef(null);
  const suggestedScrollRef = useRef(null);
  const wishlistToastTimeoutRef = useRef(null);
  const premiumToastTimeoutRef = useRef(null);
  const premiumCelebrationProgress = useRef(new Animated.Value(0)).current;
  const wishlistSheetOpacity = useRef(new Animated.Value(0)).current;
  const wishlistSheetTranslateY = useRef(new Animated.Value(420)).current;
  const [vehicles, setVehicles] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [activePromotions, setActivePromotions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promotionQuickViewVisible, setPromotionQuickViewVisible] = useState(false);
  const [selectedPromotionQuickView, setSelectedPromotionQuickView] = useState(null);
  const [selectedPromotionBannerOrigin, setSelectedPromotionBannerOrigin] = useState(null);
  const [activeHeroBannerIndex, setActiveHeroBannerIndex] = useState(0);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [activePopularIndex, setActivePopularIndex] = useState(0);
  const [activeSuggestedIndex, setActiveSuggestedIndex] = useState(0);
  const [wishlistSheetMounted, setWishlistSheetMounted] = useState(false);
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);
  const [wishlistToastMessage, setWishlistToastMessage] = useState('');
  const [showWishlistToast, setShowWishlistToast] = useState(false);
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(false);
  const [showLoginPremiumOffer, setShowLoginPremiumOffer] = useState(false);
  const [loginPremiumOfferIsPremium, setLoginPremiumOfferIsPremium] = useState(false);
  const lastScrollOffset = useRef(0);
  const [appliedFilters, setAppliedFilters] = useState({
    query: '',
    vehicleType: 'All',
    budget: 'Any',
    listingType: 'All',
  });
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );
  const localWishlistItems = useMemo(
    () => wishlistIds
      .map((vehicleId) => vehicles.find((vehicle) => String(vehicle?._id) === String(vehicleId)))
      .filter(Boolean)
      .map((vehicle) => ({ _id: `local-${vehicle._id}`, vehicle })),
    [vehicles, wishlistIds],
  );

  const load = async () => {
    try {
      const [vehicleRes, promotionRes, activePromotionRes, profileRes, wishlistRes, notificationsRes] = await Promise.all([
        vehicleAPI.getAll(),
        promotionAPI.showcase(),
        promotionAPI.getActive().catch(() => ({ data: [] })),
        customerAPI.getProfile(),
        wishlistAPI.getIds(),
        customerAPI.getNotifications(),
      ]);

      setVehicles(vehicleRes.data || []);
      setPromotions(promotionRes.data || []);
      setActivePromotions(activePromotionRes.data || []);
      setProfile(profileRes.data || null);
      setWishlistIds((wishlistRes.data || []).map(String));
      setWishlistCount((wishlistRes.data || []).length);
      setNotifications(notificationsRes.data || []);
    } catch (_) {
      // Keep the customer landing screen resilient.
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load().finally(() => {
      hasLoadedOnceRef.current = true;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnceRef.current) {
        load();
      }
    }, []),
  );

  useEffect(() => {
    emitCustomerTabBarVisibility(true);
  }, []);

  useEffect(() => () => {
    if (wishlistToastTimeoutRef.current) {
      clearTimeout(wishlistToastTimeoutRef.current);
    }
    if (premiumToastTimeoutRef.current) {
      clearTimeout(premiumToastTimeoutRef.current);
    }
  }, []);

  const hideLoginPremiumOffer = useCallback(() => {
    setShowLoginPremiumOffer(false);
  }, []);

  useEffect(() => {
    if (!showLoginPremiumOffer) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setShowLoginPremiumOffer(false);
    }, 3600);

    return () => clearTimeout(timeoutId);
  }, [showLoginPremiumOffer]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const presentLoginPremiumOffer = async () => {
        try {
          const raw = await AsyncStorage.getItem(LOGIN_PREMIUM_OFFER_KEY);
          if (!raw) {
            return;
          }

          await AsyncStorage.removeItem(LOGIN_PREMIUM_OFFER_KEY);
          const payload = JSON.parse(raw);

          if (!active) {
            return;
          }

          setLoginPremiumOfferIsPremium(Boolean(payload?.isPremium));
          setShowLoginPremiumOffer(true);
        } catch (_) {
          await AsyncStorage.removeItem(LOGIN_PREMIUM_OFFER_KEY).catch(() => {});
        }
      };

      presentLoginPremiumOffer();

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!route.params?.premiumActivatedAt) {
      return;
    }

    if (premiumToastTimeoutRef.current) {
      clearTimeout(premiumToastTimeoutRef.current);
    }

    premiumCelebrationProgress.stopAnimation();
    premiumCelebrationProgress.setValue(0);
    setShowPremiumWelcome(true);

    Animated.timing(premiumCelebrationProgress, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    premiumToastTimeoutRef.current = setTimeout(() => {
      setShowPremiumWelcome(false);
      premiumCelebrationProgress.setValue(0);
    }, 2200);

    navigation.setParams({ premiumActivatedAt: undefined });
  }, [navigation, premiumCelebrationProgress, route.params?.premiumActivatedAt]);

  const filteredVehicles = useMemo(() => {
    let result = vehicles;
    const query = (appliedFilters.query || '').toLowerCase().trim();

    if (query) {
      result = result.filter((vehicle) =>
        `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(query) ||
        (vehicle.category || '').toLowerCase().includes(query) ||
        (vehicle.description || '').toLowerCase().includes(query)
      );
    }

    if (appliedFilters.vehicleType && appliedFilters.vehicleType !== 'All') {
      result = result.filter(
        (vehicle) => (vehicle.category || '').toLowerCase() === appliedFilters.vehicleType.toLowerCase()
      );
    }

    if (appliedFilters.listingType && appliedFilters.listingType !== 'All') {
      result = result.filter((vehicle) => vehicle.listingType === appliedFilters.listingType);
    }

    if (appliedFilters.budget === 'Under 5M') {
      result = result.filter((vehicle) => Number(vehicle.price) <= 5000000);
    } else if (appliedFilters.budget === '5M - 10M') {
      result = result.filter((vehicle) => Number(vehicle.price) >= 5000000 && Number(vehicle.price) <= 10000000);
    } else if (appliedFilters.budget === '10M+') {
      result = result.filter((vehicle) => Number(vehicle.price) >= 10000000);
    }

    return result;
  }, [appliedFilters, vehicles]);

  const featuredVehicles = useMemo(
    () => [...vehicles]
      .filter(
        (vehicle) =>
          String(vehicle?.listingType || '').toLowerCase() === 'sale'
          && String(vehicle?.status || '').toLowerCase() === 'available'
      )
      .sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0))
      .slice(0, 5),
    [vehicles],
  );
  const featuredPromotionMap = useMemo(
    () => Object.fromEntries(
      featuredVehicles.map((vehicle) => [
        String(vehicle._id),
        getVehiclePromotion(vehicle, activePromotions, { placement: 'vehicleCard' }),
      ]),
    ),
    [activePromotions, featuredVehicles],
  );
  const popularVehicles = useMemo(
    () => [...filteredVehicles]
      .sort((a, b) => {
        const popularityGap = Number(b?.popularityCount || 0) - Number(a?.popularityCount || 0);

        if (popularityGap !== 0) {
          return popularityGap;
        }

        return Number(b?.price || 0) - Number(a?.price || 0);
      })
      .slice(0, 5),
    [filteredVehicles],
  );
  const popularPromotionMap = useMemo(
    () => Object.fromEntries(
      popularVehicles.map((vehicle) => [
        String(vehicle._id),
        getVehiclePromotion(vehicle, activePromotions, { placement: 'vehicleCard' }),
      ]),
    ),
    [activePromotions, popularVehicles],
  );
  const suggestedVehicles = [...filteredVehicles]
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, 6);
  const suggestedPromotionMap = useMemo(
    () => Object.fromEntries(
      suggestedVehicles.map((vehicle) => [
        String(vehicle._id),
        getVehiclePromotion(vehicle, activePromotions, { placement: 'vehicleCard' }),
      ]),
    ),
    [activePromotions, suggestedVehicles],
  );
  const featuredCardWidth = Math.max(windowWidth - 40, 280);
  const heroBannerWidth = Math.max(windowWidth - 40, 280);
  const miniCardSpan = 182 + 14;
  const customerName = (profile?.fullName || user?.fullName || 'Driver').split(' ')[0];
  const profileImageUri = getProfileImageUri(profile);
  const notificationCount = notifications.length;
  const activeResultCount = filteredVehicles.length;
  const promoCount = promotions.length;
  const heroBannerSlides = useMemo(
    () => promotions.map((promotion) => ({
      key: `promotion-${promotion._id}`,
      type: 'promotion',
      promotion,
    })),
    [promotions],
  );
  const selectedPromotionMatchedVehicles = useMemo(
    () => selectedPromotionQuickView
      ? vehicles.filter((vehicle) => promotionMatchesVehicle(selectedPromotionQuickView, vehicle, { placement: 'inventoryBanner' }))
      : [],
    [selectedPromotionQuickView, vehicles],
  );

  const closePromotionQuickView = useCallback(() => {
    setPromotionQuickViewVisible(false);
  }, []);

  const openPromotionQuickView = useCallback((promotion, origin) => {
    setSelectedPromotionQuickView(promotion);
    setSelectedPromotionBannerOrigin(origin || null);
    setPromotionQuickViewVisible(true);
  }, []);

  const openInventory = () => {
    navigation.navigate('InventoryMain', {
      tabTransitionAt: Date.now(),
    });
  };

  const openPromotionVehicles = useCallback((promotion) => {
    const scope = getPromotionScope(promotion);
    navigation.navigate('InventoryMain', {
      tabTransitionAt: Date.now(),
      searchFilters: {
        appliedAt: Date.now(),
        query: scope.kind === 'brand'
          ? (scope.brands[0] || '')
          : scope.kind === 'model'
            ? (scope.models[0] || '')
            : '',
        vehicleType: scope.kind === 'category' ? (scope.categories[0] || 'All') : 'All',
        budget: 'Any',
        listingType: promotion?.targetListingType || 'All',
      },
    });
  }, [navigation]);

  const handleApplyPromotionToVehicles = useCallback(() => {
    if (!selectedPromotionQuickView) {
      return;
    }

    closePromotionQuickView();
    setTimeout(() => {
      openPromotionVehicles(selectedPromotionQuickView);
    }, 180);
  }, [closePromotionQuickView, openPromotionVehicles, selectedPromotionQuickView]);

  const openVehicle = (vehicleOrId) => {
    const vehicleId = typeof vehicleOrId === 'object' ? vehicleOrId?._id : vehicleOrId;
    const vehicle = typeof vehicleOrId === 'object' ? vehicleOrId : undefined;
    const targetRoute = vehicle?.listingType === 'Rent' ? 'RentVehicleDetails' : 'SaleVehicleDetails';
    navigation.navigate(targetRoute, { vehicleId, initialVehicle: vehicle });
  };

  const handleViewMatchingVehicles = useCallback(() => {
    if (!selectedPromotionQuickView) {
      return;
    }

    closePromotionQuickView();
    setTimeout(() => {
      if (selectedPromotionMatchedVehicles.length === 1) {
        openVehicle(selectedPromotionMatchedVehicles[0]);
        return;
      }

      openPromotionVehicles(selectedPromotionQuickView);
    }, 180);
  }, [closePromotionQuickView, openPromotionVehicles, selectedPromotionMatchedVehicles, selectedPromotionQuickView]);

  const openWishlist = () => {
    wishlistSheetOpacity.stopAnimation();
    wishlistSheetTranslateY.stopAnimation();
    wishlistSheetOpacity.setValue(0);
    wishlistSheetTranslateY.setValue(420);
    setWishlistSheetMounted(true);

    Animated.parallel([
      Animated.timing(wishlistSheetOpacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.spring(wishlistSheetTranslateY, {
        toValue: 0,
        damping: 24,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeWishlistSheet = () => {
    if (!wishlistSheetMounted) {
      return;
    }

    wishlistSheetOpacity.stopAnimation();
    wishlistSheetTranslateY.stopAnimation();

    Animated.parallel([
      Animated.timing(wishlistSheetOpacity, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(wishlistSheetTranslateY, {
        toValue: 420,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setWishlistSheetMounted(false);
      }
    });
  };

  const openNotificationSheet = () => {
    setNotificationSheetVisible(true);
  };

  const closeNotificationSheet = () => {
    setNotificationSheetVisible(false);
  };

  const handleNotificationPress = async (item) => {
    if (!item?.id) {
      return;
    }

    setNotifications((current) => current.filter((entry) => entry.id !== item.id));
    setNotificationSheetVisible(false);

    try {
      await customerAPI.markNotificationViewed(item.type, item.entityId);
    } catch (_) {
      load();
    }

    if (item?.targetScreen) {
      navigation.navigate(item.targetScreen);
    }
  };

  const handleToggleWishlist = async (vehicleId) => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    const vehicleKey = String(vehicleId);
    const wasWishlisted = wishlistIds.includes(vehicleKey);

    setWishlistIds((previous) => (
      previous.includes(vehicleKey)
        ? previous.filter((id) => id !== vehicleKey)
        : [...previous, vehicleKey]
    ));
    setWishlistCount((previous) => Math.max(0, previous + (wasWishlisted ? -1 : 1)));
    setWishlistToastMessage(wasWishlisted ? 'Removed from wishlist' : 'Successfully added to wishlist');
    setShowWishlistToast(true);
    if (wishlistToastTimeoutRef.current) {
      clearTimeout(wishlistToastTimeoutRef.current);
    }
    wishlistToastTimeoutRef.current = setTimeout(() => {
      setShowWishlistToast(false);
    }, 1800);

    try {
      await wishlistAPI.toggle(vehicleId);
    } catch (_) {
      setWishlistIds((previous) => (
        wasWishlisted
          ? [...previous, vehicleKey]
          : previous.filter((id) => id !== vehicleKey)
      ));
      setWishlistCount((previous) => Math.max(0, previous + (wasWishlisted ? 1 : -1)));
    }
  };

  const openProfile = () => {
    navigation.navigate('CustomerProfileMain', {
      tabTransitionAt: Date.now(),
    });
  };

  const handleLoginPremiumOfferPress = useCallback(() => {
    hideLoginPremiumOffer();

    if (!loginPremiumOfferIsPremium) {
      navigation.navigate('PremiumUpgradeMain');
    }
  }, [hideLoginPremiumOffer, loginPremiumOfferIsPremium, navigation]);

  const scrollMiniSectionToIndex = useCallback((ref, nextIndex) => {
    const boundedIndex = Math.max(0, nextIndex);
    ref.current?.scrollTo?.({
      x: boundedIndex * miniCardSpan,
      animated: true,
    });
  }, [miniCardSpan]);

  useEffect(() => {
    heroBannerIndexRef.current = 0;
    setActiveHeroBannerIndex(0);
    heroBannerListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [heroBannerSlides.length]);

  useEffect(() => {
    if (heroBannerSlides.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      const nextIndex = (heroBannerIndexRef.current + 1) % heroBannerSlides.length;
      heroBannerIndexRef.current = nextIndex;
      setActiveHeroBannerIndex(nextIndex);
      heroBannerListRef.current?.scrollToIndex?.({
        index: nextIndex,
        animated: true,
      });
    }, 3400);

    return () => clearInterval(timer);
  }, [heroBannerSlides.length]);

  useEffect(() => {
    featuredIndexRef.current = 0;
    setActiveFeaturedIndex(0);
    featuredListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [featuredVehicles.length]);

  useEffect(() => {
    setActivePopularIndex(0);
  }, [popularVehicles.length]);

  useEffect(() => {
    setActiveSuggestedIndex(0);
  }, [suggestedVehicles.length]);

  useEffect(() => {
    if (featuredVehicles.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      const nextIndex = (featuredIndexRef.current + 1) % featuredVehicles.length;
      featuredIndexRef.current = nextIndex;
      setActiveFeaturedIndex(nextIndex);
      featuredListRef.current?.scrollToIndex?.({
        index: nextIndex,
        animated: true,
      });
    }, 3200);

    return () => clearInterval(timer);
  }, [featuredVehicles.length]);

  const shouldShowBlockingLoader =
    loading
    && !route.params?.tabTransitionAt
    && !route.params?.premiumActivatedAt;

  if (shouldShowBlockingLoader) {
    return <LoadingSpinner message="Loading your search space..." />;
  }

  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
      <PremiumLoginOfferPopup
        visible={showLoginPremiumOffer}
        isPremium={loginPremiumOfferIsPremium}
        onPress={handleLoginPremiumOfferPress}
        onDismiss={hideLoginPremiumOffer}
      />
      <SuccessToast
        visible={showPremiumWelcome || showWishlistToast}
        message={showPremiumWelcome ? 'Welcome to Premium' : wishlistToastMessage}
      />
      <PromotionQuickViewSheet
        visible={promotionQuickViewVisible}
        promotion={selectedPromotionQuickView}
        matchedVehicles={selectedPromotionMatchedVehicles}
        bannerOrigin={selectedPromotionBannerOrigin}
        onRequestClose={closePromotionQuickView}
        onApplyToVehicles={handleApplyPromotionToVehicles}
        onViewMatchingVehicles={handleViewMatchingVehicles}
      />
      {showPremiumWelcome ? (
        <View pointerEvents="none" style={styles.celebrationLayer}>
          {[
            { emoji: '🎉', left: -58, output: -46, rotateStart: '-10deg', rotateEnd: '-2deg' },
            { emoji: '✨', left: 0, output: -58, rotateStart: '0deg', rotateEnd: '8deg' },
            { emoji: '🎈', left: 56, output: -42, rotateStart: '8deg', rotateEnd: '0deg' },
          ].map((item, index) => (
            <Animated.Text
              key={`${item.emoji}-${index}`}
              style={[
                styles.celebrationEmoji,
                {
                  marginLeft: item.left,
                  opacity: premiumCelebrationProgress.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: premiumCelebrationProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, item.output],
                      }),
                    },
                    {
                      scale: premiumCelebrationProgress.interpolate({
                        inputRange: [0, 0.18, 1],
                        outputRange: [0.7, 1.05, 0.96],
                      }),
                    },
                    {
                      rotate: premiumCelebrationProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [item.rotateStart, item.rotateEnd],
                      }),
                    },
                  ],
                },
              ]}
            >
              {item.emoji}
            </Animated.Text>
          ))}
        </View>
      ) : null}
      <Modal
        visible={notificationSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={closeNotificationSheet}
      >
        <View style={styles.notificationOverlay}>
          <BlurView intensity={22} tint="dark" style={styles.notificationOverlayBlur} />
          <Pressable style={styles.notificationOverlayBackdrop} onPress={closeNotificationSheet} />
          <View style={styles.notificationPopup}>
            <View style={styles.notificationPopupHeader}>
              <Text style={styles.notificationPopupTitle}>Notifications</Text>
              <View style={styles.notificationPopupCount}>
                <Text style={styles.notificationPopupCountText}>{notificationCount}</Text>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.notificationList}
              keyboardShouldPersistTaps="handled"
            >
              {notifications.length ? (
                notifications.map((item) => (
                  <CustomerNotificationCard
                    key={item.id}
                    item={item}
                    onPress={() => handleNotificationPress(item)}
                  />
                ))
              ) : (
                <View style={styles.notificationEmptyState}>
                  <MaterialCommunityIcons name="bell-check-outline" size={26} color="#9ca3af" />
                  <Text style={styles.notificationEmptyTitle}>No new notifications</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={wishlistSheetMounted}
        transparent
        animationType="none"
        onRequestClose={closeWishlistSheet}
      >
        <View style={styles.sheetModalRoot}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: wishlistSheetOpacity }]}>
            <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFillObject} />
            <Pressable style={StyleSheet.absoluteFillObject} onPressIn={closeWishlistSheet} />
          </Animated.View>

          <View pointerEvents="box-none" style={styles.sheetHost}>
            <Animated.View pointerEvents="none" style={[styles.sheetBackdrop, { opacity: wishlistSheetOpacity }]} />
            <Animated.View
              style={[
                styles.wishlistSheet,
                {
                  opacity: wishlistSheetOpacity,
                  transform: [{ translateY: wishlistSheetTranslateY }],
                },
              ]}
            >
              <View style={styles.wishlistSheetHandleTouch}>
                <View style={styles.wishlistSheetHandle} />
              </View>

              <Pressable onPress={closeWishlistSheet} style={styles.wishlistSheetClose} hitSlop={14}>
                <Text style={styles.wishlistSheetCloseText}>{'\u00D7'}</Text>
              </Pressable>

              <View style={styles.wishlistSheetHeader}>
                <Text style={styles.wishlistSheetHeading}>Wishlist</Text>
              </View>

              <FlatList
                data={localWishlistItems}
                keyExtractor={(item, index) => String(item?._id || item?.vehicle?._id || index)}
                renderItem={({ item }) => (
                  <WishlistSheetItem
                    item={{ ...item, user }}
                    onPress={() => {
                      closeWishlistSheet();
                      openVehicle(item.vehicle);
                    }}
                    onRemove={() => handleToggleWishlist(item.vehicle._id)}
                  />
                )}
                contentContainerStyle={styles.wishlistSheetList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={(
                  <View style={styles.wishlistSheetEmpty}>
                    <MaterialCommunityIcons name="heart-off-outline" size={28} color="#94a3b8" />
                    <Text style={styles.wishlistSheetEmptyTitle}>Wishlist is empty</Text>
                  </View>
                )}
              />
            </Animated.View>
          </View>
        </View>
      </Modal>
      <ScrollView
        style={styles.root}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
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
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        )}
      >
        <View style={styles.heroShell}>
          <HeaderGreeting
            profileImageUri={profileImageUri}
            customerName={customerName}
            isPremium={Boolean(user?.isPremium)}
            onOpenProfile={openProfile}
            onOpenNotifications={openNotificationSheet}
            notificationCount={notificationCount}
            onOpenWishlist={openWishlist}
          />

          {heroBannerSlides.length ? (
            <>
              <FlatList
                ref={heroBannerListRef}
                data={heroBannerSlides}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToAlignment="start"
                contentContainerStyle={styles.heroBannerList}
                renderItem={({ item }) => (
                  <PromotionBannerCard
                    promotion={item.promotion}
                    cardWidth={heroBannerWidth}
                    onPress={(origin) => openPromotionQuickView(item.promotion, origin)}
                  />
                )}
                getItemLayout={(_, index) => ({
                  length: heroBannerWidth,
                  offset: heroBannerWidth * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(
                    event.nativeEvent.contentOffset.x / heroBannerWidth,
                  );
                  heroBannerIndexRef.current = nextIndex;
                  setActiveHeroBannerIndex(nextIndex);
                }}
              />

              {heroBannerSlides.length > 1 ? (
                <View style={styles.heroBannerIndicatorRow}>
                  {heroBannerSlides.map((item, index) => {
                    const active = index === activeHeroBannerIndex;
                    return (
                      <View
                        key={`hero-banner-indicator-${item.key}`}
                        style={[
                          styles.heroBannerIndicatorBar,
                          active && styles.heroBannerIndicatorBarActive,
                        ]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}

          {featuredVehicles.length ? (
            <FlatList
              ref={featuredListRef}
              data={featuredVehicles}
              keyExtractor={(item) => `featured-${item._id}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToAlignment="start"
              contentContainerStyle={styles.featuredHorizontalList}
              renderItem={({ item }) => (
                <FeaturedVehicleCard
                  vehicle={item}
                  user={user}
                  promotion={featuredPromotionMap[String(item._id)]}
                  onPress={() => openVehicle(item)}
                  cardWidth={featuredCardWidth}
                />
              )}
              getItemLayout={(_, index) => ({
                length: featuredCardWidth,
                offset: featuredCardWidth * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(
                  event.nativeEvent.contentOffset.x / featuredCardWidth,
                );
                featuredIndexRef.current = nextIndex;
                setActiveFeaturedIndex(nextIndex);
              }}
            />
          ) : null}

          {featuredVehicles.length > 0 ? (
            <View style={styles.featuredIndicatorRow}>
              {featuredVehicles.map((vehicle, index) => {
                const active = index === activeFeaturedIndex;
                return (
                  <View
                    key={`featured-indicator-${vehicle._id}`}
                    style={[
                      styles.featuredIndicatorBar,
                      active && styles.featuredIndicatorBarActive,
                    ]}
                  />
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Popular Now" onPress={openInventory} />
          <ScrollView
            ref={popularScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / miniCardSpan,
              );
              setActivePopularIndex(nextIndex);
            }}
          >
            {popularVehicles.map((vehicle) => (
              <VehicleMiniCard
                key={vehicle._id}
                vehicle={vehicle}
                user={user}
                promotion={popularPromotionMap[String(vehicle._id)]}
                onPress={() => openVehicle(vehicle)}
              />
            ))}
          </ScrollView>
          {popularVehicles.length > 0 ? (
            <SliderScrubber
              count={popularVehicles.length}
              activeIndex={activePopularIndex}
              onIndexChange={(nextIndex) => {
                setActivePopularIndex(nextIndex);
                scrollMiniSectionToIndex(popularScrollRef, nextIndex);
              }}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Suggest for you" onPress={openInventory} />
          <ScrollView
            ref={suggestedScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / miniCardSpan,
              );
              setActiveSuggestedIndex(nextIndex);
            }}
          >
            {suggestedVehicles.map((vehicle) => (
              <VehicleMiniCard
                key={`${vehicle._id}-suggested`}
                vehicle={vehicle}
                user={user}
                promotion={suggestedPromotionMap[String(vehicle._id)]}
                onPress={() => openVehicle(vehicle)}
              />
            ))}
          </ScrollView>
          {suggestedVehicles.length > 0 ? (
            <SliderScrubber
              count={suggestedVehicles.length}
              activeIndex={activeSuggestedIndex}
              onIndexChange={(nextIndex) => {
                setActiveSuggestedIndex(nextIndex);
                scrollMiniSectionToIndex(suggestedScrollRef, nextIndex);
              }}
            />
          ) : null}
        </View>

        <TouchableOpacity style={styles.viewAllButton} onPress={openInventory} activeOpacity={0.9}>
          <Text style={styles.viewAllButtonText}>View all vehicles</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#111111" />
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#f6f3ee',
  },
  sheetModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
  },
  sheetHost: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  wishlistSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    minHeight: '60%',
    maxHeight: '82%',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    ...Shadow.lg,
  },
  wishlistSheetHandleTouch: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  wishlistSheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: '#d9dde5',
  },
  wishlistSheetClose: {
    position: 'absolute',
    top: 54,
    right: 34,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
    elevation: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    ...Shadow.sm,
  },
  wishlistSheetCloseText: {
    fontSize: 30,
    lineHeight: 30,
    color: Colors.text,
    fontWeight: '300',
  },
  wishlistSheetHeader: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  wishlistSheetEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  wishlistSheetHeading: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
  },
  wishlistSheetCaption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.muted,
  },
  wishlistSheetList: {
    paddingTop: 6,
    paddingBottom: 12,
    gap: 12,
  },
  wishlistSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    ...Shadow.sm,
  },
  wishlistSheetImage: {
    width: 74,
    height: 74,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    marginRight: 14,
  },
  wishlistSheetImageFallback: {
    width: 74,
    height: 74,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  wishlistSheetCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  wishlistSheetTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  wishlistSheetSubtitle: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
  wishlistSheetPrice: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  wishlistSheetOldPrice: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  wishlistSheetRemove: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
  },
  wishlistSheetEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
    gap: 10,
  },
  wishlistSheetEmptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
  },
  wishlistSheetEmptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  notificationOverlay: {
    flex: 1,
    alignItems: 'center',
  },
  notificationOverlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.56)',
  },
  notificationPopup: {
    width: '86%',
    maxWidth: 360,
    minHeight: 220,
    maxHeight: 430,
    marginTop: 155,
    padding: 14,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
    ...Shadow.md,
  },
  notificationPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notificationPopupTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  notificationPopupCount: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  notificationPopupCountText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  notificationList: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    ...Shadow.sm,
  },
  notificationAccentBar: {
    width: 5,
    alignSelf: 'stretch',
    borderRadius: Radius.full,
    marginRight: 12,
  },
  notificationImage: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
  },
  notificationImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  notificationMessage: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    fontWeight: '600',
  },
  notificationFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  notificationTypeBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  notificationGoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  notificationGoText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  notificationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 170,
    gap: 10,
  },
  notificationEmptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },
  notificationEmptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  content: {
    paddingTop: 58,
    paddingBottom: 132,
  },
  heroShell: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ddd6cb',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    ...Shadow.sm,
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
  },
  headerTextWrap: {
    marginLeft: 12,
  },
  headerGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerGreeting: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  headerCrownBadge: {
    marginTop: 2,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#efe7dc',
    ...Shadow.sm,
  },
  headerBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.white,
  },
  premiumOfferCard: {
    marginTop: 14,
    borderRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f4c430',
    borderWidth: 1,
    borderColor: '#d4a017',
    ...Shadow.sm,
  },
  heroBannerList: {
    paddingRight: 0,
  },
  heroBannerIndicatorRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroBannerIndicatorBar: {
    width: 24,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(17,17,17,0.18)',
  },
  heroBannerIndicatorBarActive: {
    backgroundColor: '#111111',
  },
  premiumOfferBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  premiumOfferBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  premiumOfferTitle: {
    marginTop: 14,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  premiumOfferCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#4b5563',
  },
  promotionBannerCard: {
    marginTop: 14,
    minHeight: 188,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#3f3002',
    ...Shadow.sm,
  },
  promotionBannerImage: {
    borderRadius: 30,
  },
  promotionBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  promotionBannerLeftShade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '58%',
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  promotionBannerFallbackCard: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#3f3002',
  },
  promotionBannerLeftShadeFallback: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#080808',
  },
  promotionBannerBeamPrimary: {
    position: 'absolute',
    top: 34,
    left: '32%',
    width: 92,
    height: 1.5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(244, 196, 48, 0.78)',
    transform: [{ rotate: '-24deg' }],
    shadowColor: '#f4c430',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  promotionBannerBeamSecondary: {
    position: 'absolute',
    top: 62,
    left: '29%',
    width: 74,
    height: 1,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(244, 196, 48, 0.5)',
    transform: [{ rotate: '-18deg' }],
  },
  promotionBannerContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  promotionBannerRibbonWrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  promotionBannerRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f4c430',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  promotionBannerRibbonLight: {
    backgroundColor: '#f4c430',
  },
  promotionBannerRibbonCut: {
    width: 0,
    height: 0,
    borderTopWidth: 15,
    borderBottomWidth: 15,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#f4c430',
  },
  promotionBannerRibbonCutLight: {
    borderLeftColor: '#f4c430',
  },
  promotionBannerRibbonText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  promotionBannerHeadlineBlock: {
    width: '56%',
    maxWidth: '56%',
    marginTop: 6,
  },
  promotionBannerHeadlineLight: {
    fontSize: 25,
    lineHeight: 25,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1.1,
  },
  promotionBannerHeadlineAccent: {
    marginTop: 1,
    fontSize: 29,
    lineHeight: 29,
    fontWeight: '900',
    color: '#f4c430',
    letterSpacing: -1.2,
  },
  promotionBannerHeadlineFallback: {
    color: '#ffffff',
  },
  promotionBannerSubheadline: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  promotionBannerSubheadlineFallback: {
    color: '#ffffff',
  },
  promotionBannerSupportingCopy: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  promotionBannerSupportingCopyFallback: {
    color: 'rgba(255,255,255,0.72)',
  },
  promotionBannerCalloutRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '62%',
    minHeight: 58,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f4c430',
    backgroundColor: 'rgba(0,0,0,0.78)',
    shadowColor: '#f4c430',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  promotionBannerDiscountBox: {
    width: '52%',
    backgroundColor: '#f4c430',
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  promotionBannerDiscountLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  promotionBannerDiscountValue: {
    marginTop: 2,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1,
  },
  promotionBannerCollectionBox: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.74)',
  },
  promotionBannerCollectionLead: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  promotionBannerCollectionBrand: {
    marginTop: 1,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
    color: '#f4c430',
    letterSpacing: -0.8,
  },
  promotionBannerCollectionTail: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  promotionBannerInfoStrip: {
    marginTop: 10,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 10, 10, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 48, 0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  promotionBannerInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  promotionBannerInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  promotionBannerInfoLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f4c430',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  promotionBannerInfoValue: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  promotionBannerInfoDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(244, 196, 48, 0.24)',
  },
  promotionBannerScopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: '#f4c430',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promotionBannerScopeBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  celebrationLayer: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    zIndex: 28,
    width: 200,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationEmoji: {
    position: 'absolute',
    fontSize: 24,
  },
  featuredCard: {
    marginTop: 18,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadow.md,
  },
  featuredCardPromoted: {
    shadowColor: '#b88922',
    shadowOpacity: 0.14,
  },
  featuredHorizontalList: {
    paddingRight: 0,
  },
  featuredIndicatorRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  featuredIndicatorBar: {
    width: 24,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(17,17,17,0.18)',
  },
  featuredIndicatorBarActive: {
    backgroundColor: '#111111',
  },
  featuredImage: {
    height: 340,
    justifyContent: 'space-between',
  },
  offerGiftWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 3,
  },
  offerGiftWrapCompact: {
    top: 6,
    right: 6,
  },
  offerGiftIcon: {
    fontSize: 40,
    textShadowColor: 'rgba(15, 23, 42, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  offerGiftIconCompact: {
    fontSize: 34,
  },
  promotedMetaText: {
    color: '#f5d37a',
  },
  featuredImageStyle: {
    borderRadius: 30,
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: 'rgba(17,17,17,0.18)',
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  featuredPremiumBadge: {
    marginLeft: 12,
  },
  featuredTag: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagRent: {
    backgroundColor: 'rgba(22,163,74,0.32)',
  },
  tagSale: {
    backgroundColor: 'rgba(37,99,235,0.3)',
  },
  promotedTag: {
    backgroundColor: 'rgba(76, 54, 8, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(245, 211, 122, 0.52)',
  },
  featuredTagText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tagRentText: {
    color: '#dcfce7',
  },
  tagSaleText: {
    color: '#dbeafe',
  },
  featuredContent: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 16,
  },
  featuredTitle: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.7,
  },
  featuredTitlePromoted: {
    color: '#ffd978',
  },
  featuredSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.84)',
    fontWeight: '600',
  },
  featuredFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  featuredPricePromoted: {
    color: '#ffd978',
  },
  featuredPriceOld: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'line-through',
  },
  featuredAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredFallback: {
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredFallbackText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1.1,
  },
  section: {
    paddingTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.muted,
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  sectionIndicatorWrap: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sectionIndicatorTrack: {
    width: 108,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(17,17,17,0.12)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sectionIndicatorThumb: {
    position: 'absolute',
    left: 0,
    top: 2,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
  },
  miniCard: {
    width: 182,
    borderRadius: 26,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  miniCardPromoted: {
    borderWidth: 1,
    borderColor: '#ead7a3',
    shadowColor: '#b88922',
    shadowOpacity: 0.12,
  },
  miniImage: {
    width: '100%',
    height: 244,
    backgroundColor: '#dfd6ca',
  },
  miniImageStyle: {
    borderRadius: 26,
  },
  miniOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(17,17,17,0.12)',
  },
  miniTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  miniTag: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  miniTitlePromoted: {
    color: '#ffd978',
  },
  miniPrice: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: Colors.white,
  },
  miniPricePromoted: {
    color: '#ffd978',
  },
  miniContent: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  miniPremiumBadge: {
    marginLeft: 10,
  },
  miniPriceOld: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'line-through',
  },
  storyPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyPlaceholderText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6b5f52',
    letterSpacing: 1,
  },
  viewAllButton: {
    alignSelf: 'center',
    marginTop: 18,
    minWidth: 220,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Shadow.sm,
  },
  viewAllButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
});
