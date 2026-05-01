import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  ImageBackground,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, promotionAPI, vehicleAPI } from '../../api';
import BottomPreviewSheet from '../../components/BottomPreviewSheet';
import { EmptyState } from '../../components/UI';
import { Radius, Shadow } from '../../constants/theme';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';
import {
  formatPromotionDiscountValue,
  getPromotionComputedStatus,
  getPromotionScope,
  getPromotionScopeLabel,
  getPromotionScopeTypeLabel,
  promotionMatchesVehicle,
} from '../../utils/promotionUtils';

let promotionsCache = [];
let promotionVehiclesCache = [];

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

function formatOfferDate(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();
}

function formatOfferDateRange(promotion) {
  const start = promotion?.startDate ? formatOfferDate(promotion.startDate) : '';
  const end = promotion?.endDate ? formatOfferDate(promotion.endDate) : '';

  if (!start) {
    return end || 'LIMITED TIME';
  }

  if (!end) {
    return start;
  }

  return `${start} - ${end}`;
}

function getPromotionBrandDisplay(promotion) {
  const scope = getPromotionScope(promotion);
  if (scope.brands?.length) {
    return scope.brands[0].toUpperCase();
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

function PromotionListCard({ promotion, onPress }) {
  const imageUri = resolveAssetUri(promotion?.imageUrl);
  const discountLabel = formatPromotionDiscountValue(promotion) || 'Limited offer';
  const dateLabel = formatOfferDateRange(promotion);
  const brandLabel = getPromotionBrandDisplay(promotion);
  const collectionLabel = getPromotionCollectionLabel(promotion);
  const seasonalLabel = String(promotion?.promotionType || 'Seasonal').toUpperCase();
  const subheadline = promotion?.title || `${brandLabel} Premium Offer`;
  const scopeLabel = getPromotionScopeTypeLabel(promotion);

  const content = (
    <>
      <View style={styles.promotionBannerOverlay} />
      <View style={styles.promotionBannerLeftShade} />
      <View style={styles.promotionBannerBeamPrimary} />
      <View style={styles.promotionBannerBeamSecondary} />

      <View style={styles.promotionBannerContent}>
        <View style={styles.promotionBannerRibbonWrap}>
          <View style={styles.promotionBannerRibbon}>
            <MaterialCommunityIcons name="tag-outline" size={16} color="#111111" />
            <Text style={styles.promotionBannerRibbonText}>{seasonalLabel}</Text>
          </View>
          <View style={styles.promotionBannerRibbonCut} />
        </View>

        <View style={styles.promotionBannerHeadlineBlock}>
          <Text style={styles.promotionBannerHeadlineLight}>DRIVE MORE.</Text>
          <Text style={styles.promotionBannerHeadlineAccent}>PAY LESS.</Text>
          <Text style={styles.promotionBannerSubheadline} numberOfLines={1}>{subheadline}</Text>
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
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#f4c430" />
            <View style={styles.promotionBannerInfoCopy}>
              <Text style={styles.promotionBannerInfoLabel}>Offer Valid</Text>
              <Text style={styles.promotionBannerInfoValue} numberOfLines={1}>{dateLabel}</Text>
            </View>
          </View>
          <View style={styles.promotionBannerInfoDivider} />
          <View style={styles.promotionBannerInfoItem}>
            <MaterialCommunityIcons name="car-info" size={18} color="#f4c430" />
            <View style={styles.promotionBannerInfoCopy}>
              <Text style={styles.promotionBannerInfoLabel}>Scope</Text>
              <Text style={styles.promotionBannerInfoValue} numberOfLines={1}>{scopeLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <TouchableOpacity activeOpacity={0.96} onPress={onPress}>
      {imageUri ? (
        <ImageBackground
          source={{ uri: imageUri }}
          style={styles.promotionBannerCard}
          imageStyle={styles.promotionBannerImage}
        >
          {content}
        </ImageBackground>
      ) : (
        <View style={[styles.promotionBannerCard, styles.promotionBannerFallbackCard]}>
          <View style={styles.promotionBannerLeftShadeFallback} />
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function CustomerPromotionsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const lastScrollOffset = useRef(0);
  const hasLoadedOnceRef = useRef(promotionsCache.length > 0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => promotionsCache.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [promotions, setPromotions] = useState(() => promotionsCache);
  const [vehicles, setVehicles] = useState(() => promotionVehiclesCache);
  const [previewPromotion, setPreviewPromotion] = useState(null);
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );

  const load = useCallback(async () => {
    try {
      const [promotionsRes, vehiclesRes] = await Promise.all([
        promotionAPI.showcase(),
        vehicleAPI.getAll().catch(() => ({ data: [] })),
      ]);

      const nextPromotions = promotionsRes.data || [];
      const nextVehicles = vehiclesRes.data || [];
      promotionsCache = nextPromotions;
      promotionVehiclesCache = nextVehicles;
      setPromotions(nextPromotions);
      setVehicles(nextVehicles);
    } catch (_) {
      if (!promotionsCache.length) {
        setPromotions([]);
      }
      if (!promotionVehiclesCache.length) {
        setVehicles([]);
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

  const matchedVehicles = useMemo(
    () => previewPromotion
      ? vehicles.filter((vehicle) => promotionMatchesVehicle(previewPromotion, vehicle, { placement: 'inventoryBanner' }))
      : [],
    [previewPromotion, vehicles],
  );
  const previewDiscount = formatPromotionDiscountValue(previewPromotion) || 'Limited offer';
  const previewStatus = getPromotionComputedStatus(previewPromotion);
  const previewScope = previewPromotion
    ? getPromotionScopeLabel(previewPromotion, matchedVehicles)
    : 'All vehicles';
  const previewImageUri = resolveAssetUri(previewPromotion?.imageUrl);

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

  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={promotions}
        keyExtractor={(item, index) => String(item?._id || index)}
        renderItem={({ item }) => (
          <PromotionListCard promotion={item} onPress={() => setPreviewPromotion(item)} />
        )}
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

              <Text style={styles.pageTitle}>Promotions / Offers</Text>

              <View style={styles.backButtonPlaceholder} />
            </View>
          </View>
        )}
        ListEmptyComponent={hasLoadedOnce ? (
          <EmptyState
            icon="tag-outline"
            title="No promotions available"
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
        visible={Boolean(previewPromotion)}
        onClose={() => setPreviewPromotion(null)}
        title={previewPromotion?.title || 'Promotion Details'}
      >
        <View style={styles.previewHero}>
          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={styles.previewHeroImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewHeroFallback}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={34} color="#f4c430" />
            </View>
          )}
          <View style={styles.previewHeroShade} />
          <View style={styles.previewBadgeRow}>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{previewPromotion?.promotionType || 'Promotion'}</Text>
            </View>
            <View style={[styles.previewBadge, styles.previewBadgeDark]}>
              <Text style={styles.previewBadgeDarkText}>{previewStatus}</Text>
            </View>
          </View>
        </View>

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Offer</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Discount</Text>
            <Text style={styles.infoValue}>{previewDiscount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Valid Dates</Text>
            <Text style={styles.infoValue}>{formatOfferDateRange(previewPromotion)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Scope</Text>
            <Text style={styles.infoValue}>{previewScope}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Eligible Vehicles</Text>
            <Text style={styles.infoValue}>{matchedVehicles.length}</Text>
          </View>
        </View>

        {previewPromotion?.description ? (
          <View style={styles.previewSectionCard}>
            <Text style={styles.previewSectionTitle}>Details</Text>
            <Text style={styles.previewBodyText}>{previewPromotion.description}</Text>
          </View>
        ) : null}

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Matching Vehicles</Text>
          <View style={styles.vehicleChipRow}>
            {matchedVehicles.slice(0, 6).map((vehicle) => (
              <View key={String(vehicle?._id)} style={styles.vehicleChip}>
                <Text style={styles.vehicleChipText} numberOfLines={1}>
                  {`${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Vehicle'}
                </Text>
              </View>
            ))}
            {!matchedVehicles.length ? (
              <Text style={styles.previewBodyText}>No matching vehicles</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.matchingVehiclesButton}
            activeOpacity={0.9}
            onPress={() => {
              const promotion = previewPromotion;
              setPreviewPromotion(null);
              setTimeout(() => openPromotionVehicles(promotion), 180);
            }}
          >
            <Text style={styles.matchingVehiclesButtonText}>Matching Vehicles</Text>
          </TouchableOpacity>
        </View>
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
  promotionBannerCard: {
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
    width: '60%',
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
  },
  promotionBannerFallbackCard: {
    backgroundColor: '#050505',
  },
  promotionBannerLeftShadeFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#080808',
  },
  promotionBannerBeamPrimary: {
    position: 'absolute',
    top: 34,
    left: '34%',
    width: 92,
    height: 1.5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(244, 196, 48, 0.78)',
    transform: [{ rotate: '-24deg' }],
  },
  promotionBannerBeamSecondary: {
    position: 'absolute',
    top: 62,
    left: '31%',
    width: 74,
    height: 1,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(244, 196, 48, 0.5)',
    transform: [{ rotate: '-18deg' }],
  },
  promotionBannerContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
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
  promotionBannerRibbonText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  promotionBannerHeadlineBlock: {
    width: '58%',
    maxWidth: '58%',
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
  promotionBannerSubheadline: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  promotionBannerCalloutRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '66%',
    minHeight: 58,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f4c430',
    backgroundColor: 'rgba(0,0,0,0.78)',
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
    fontSize: 19,
    lineHeight: 21,
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
  previewHero: {
    height: 178,
    marginTop: 18,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  previewHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  previewHeroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  previewHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  previewBadgeRow: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#f4c430',
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewBadgeDark: {
    backgroundColor: 'rgba(17,17,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  previewBadgeDarkText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewSectionCard: {
    marginTop: 14,
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.sm,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  previewBodyText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: '#475569',
  },
  vehicleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleChip: {
    maxWidth: '48%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
  },
  vehicleChipText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  matchingVehiclesButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4c430',
  },
  matchingVehiclesButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
});
