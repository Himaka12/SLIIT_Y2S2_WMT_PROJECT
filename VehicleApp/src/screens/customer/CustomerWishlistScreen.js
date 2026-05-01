import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { BASE_URL, wishlistAPI } from '../../api';
import BottomPreviewSheet from '../../components/BottomPreviewSheet';
import { EmptyState } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { getPremiumRentPriceMeta } from '../../components/VehicleDetailsShared';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';

let wishlistCache = [];

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
  return resolveAssetUri(
    vehicle?.image1 || vehicle?.image2 || vehicle?.image3 || vehicle?.image4 || vehicle?.image5 || vehicle?.image || vehicle?.thumbnail,
  );
}

export default function CustomerWishlistScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const lastScrollOffset = useRef(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => wishlistCache.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState(() => wishlistCache);
  const [previewItem, setPreviewItem] = useState(null);
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );

  const load = useCallback(async () => {
    try {
      const wishlistRes = await wishlistAPI.getList();
      const nextItems = wishlistRes.data || [];
      wishlistCache = nextItems;
      setItems(nextItems);
    } catch (_) {
      if (!wishlistCache.length) {
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

  const handleToggleWishlist = useCallback(async (vehicleId) => {
    try {
      await wishlistAPI.toggle(vehicleId);
      setItems((current) => {
        const nextItems = current.filter((item) => String(item.vehicle?._id) !== String(vehicleId));
        wishlistCache = nextItems;
        return nextItems;
      });

      setPreviewItem((current) => (
        String(current?.vehicle?._id) === String(vehicleId) ? null : current
      ));
    } catch (_) {
      // Keep screen stable if wishlist toggle fails.
    }
  }, []);

  const previewVehicle = previewItem?.vehicle;
  const previewImageUri = getVehicleImageUri(previewVehicle);
  const previewPremiumMeta = getPremiumRentPriceMeta(user, previewVehicle);

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
          const premiumRentMeta = getPremiumRentPriceMeta(user, vehicle);
          const savedDateLabel = item?.addedDate ? new Date(item.addedDate).toLocaleDateString() : 'Saved';
          const secondaryInfo = [
            vehicle?.listingType,
            vehicle?.manufactureYear,
            `Saved ${savedDateLabel}`,
          ].filter(Boolean).join(' • ');
          const description = [
            vehicle?.category,
            vehicle?.fuelType,
            vehicle?.vehicleCondition,
          ].filter(Boolean).slice(0, 3).join(' • ') || 'Saved vehicle';

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
                <TouchableOpacity activeOpacity={0.9} style={styles.cardPressArea} onPress={() => setPreviewItem(item)}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {vehicle?.brand} {vehicle?.model}
                  </Text>

                  <Text style={styles.cardSecondary} numberOfLines={1}>
                    {secondaryInfo}
                  </Text>

                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {description}
                  </Text>

                  <View style={styles.priceRow}>
                    <Text style={styles.cardPrice}>
                      Rs. {Number(premiumRentMeta.displayPrice || vehicle?.price || 0).toLocaleString()}
                      {vehicle?.listingType === 'Rent' ? ' /day' : ''}
                    </Text>
                    {premiumRentMeta.eligible ? (
                      <Text style={styles.cardPriceOld}>
                        Rs. {Number(premiumRentMeta.originalPrice || 0).toLocaleString()} /day
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.removeButton}
                    activeOpacity={0.88}
                    onPress={() => handleToggleWishlist(vehicle?._id)}
                  >
                    <MaterialCommunityIcons name="heart" size={16} color="#dc2626" />
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
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

              <Text style={styles.pageTitle}>Wishlist</Text>

              <View style={styles.backButtonPlaceholder} />
            </View>
          </View>
        )}
        ListEmptyComponent={hasLoadedOnce ? (
          <EmptyState
            icon="heart-outline"
            title="Your wishlist is empty"
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
        visible={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        title="Wishlist Preview"
        subtitle="Full vehicle details, pricing, and availability"
      >
        <View style={styles.previewVehicleCard}>
          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={styles.previewVehicleImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewVehicleFallback}>
              <MaterialCommunityIcons name="car-sports" size={32} color="#94a3b8" />
            </View>
          )}

          <View style={styles.previewVehicleCopy}>
            <Text style={styles.previewVehicleTitle}>
              {previewVehicle?.brand} {previewVehicle?.model}
            </Text>
            <Text style={styles.previewVehicleSubtitle}>
              {[previewVehicle?.category, previewVehicle?.manufactureYear, previewVehicle?.listingType].filter(Boolean).join(' • ') || 'Vehicle'}
            </Text>
            <View style={styles.previewTagRow}>
              <View style={styles.previewTag}>
                <Text style={styles.previewTagText}>{previewVehicle?.status || 'Available'}</Text>
              </View>
              {previewVehicle?.fuelType ? (
                <View style={styles.previewTag}>
                  <Text style={styles.previewTagText}>{previewVehicle.fuelType}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Price & Availability</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Price</Text>
            <Text style={styles.infoValue}>
              Rs. {Number(previewPremiumMeta.displayPrice || previewVehicle?.price || 0).toLocaleString()}
              {previewVehicle?.listingType === 'Rent' ? ' /day' : ''}
            </Text>
          </View>
          {previewPremiumMeta.eligible ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Original Price</Text>
              <Text style={styles.infoValue}>Rs. {Number(previewPremiumMeta.originalPrice || 0).toLocaleString()} /day</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Availability</Text>
            <Text style={styles.infoValue}>{previewVehicle?.status || 'Available'}</Text>
          </View>
          {previewItem?.addedDate ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Saved On</Text>
              <Text style={styles.infoValue}>{new Date(previewItem.addedDate).toLocaleDateString()}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.previewSectionCard}>
          <Text style={styles.previewSectionTitle}>Vehicle Details</Text>
          <Text style={styles.longMessage}>
            {[previewVehicle?.category, previewVehicle?.fuelType, previewVehicle?.transmission, previewVehicle?.vehicleCondition, previewVehicle?.manufactureYear].filter(Boolean).join(' • ') || 'No additional vehicle details available.'}
          </Text>
          <TouchableOpacity
            style={[styles.removeButton, styles.sheetRemoveButton]}
            activeOpacity={0.88}
            onPress={() => handleToggleWishlist(previewVehicle?._id)}
          >
            <MaterialCommunityIcons name="heart" size={16} color="#dc2626" />
            <Text style={styles.removeButtonText}>Remove from Wishlist</Text>
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
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
  priceRow: {
    marginTop: 10,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  cardPriceOld: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 12,
  },
  removeButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
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
  previewVehicleTitle: {
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
    textTransform: 'capitalize',
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
  sheetRemoveButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
});
