import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BASE_URL, customerAPI, promotionAPI, reviewAPI, vehicleAPI, wishlistAPI } from '../../api';
import InventoryVehicleCard from '../../components/InventoryVehicleCard';
import PremiumCrownBadge from '../../components/PremiumCrownBadge';
import SuccessToast from '../../components/SuccessToast';
import { getPremiumRentPriceMeta } from '../../components/VehicleDetailsShared';
import { EmptyState } from '../../components/UI';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getVehiclePromotion } from '../../utils/promotionUtils';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';

const LISTING_TYPES = ['All', 'Rent', 'Sale'];
const FUEL_TYPES = ['All', 'Petrol', 'Electric', 'Hybrid'];
const CONDITIONS = ['All', 'New', 'Used'];
const inventoryViewCache = {
  vehicles: [],
  reviews: [],
  promotions: [],
  wishlistIds: [],
  profile: null,
  hydrated: false,
};
const prefetchedInventoryImageUris = new Set();

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

function FilterPill({ label, selected, onSelect }) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillActive]}
      onPress={() => onSelect(label)}
      activeOpacity={0.9}
    >
      <Text style={[styles.pillText, selected && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterSection({ title, options, selectedValue, onSelect }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.filterGroupOptions}>
        {options.map((item) => (
          <FilterPill
            key={`${title}-${item}`}
            label={item}
            selected={selectedValue === item}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

function SectionRow({
  title,
  vehicles,
  user,
  reviewSummaryMap,
  promotionMap,
  wishlistIds,
  onToggleWishlist,
  onQuickView,
  cardWidth,
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <FlatList
        data={vehicles}
        horizontal
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item, index }) => (
          <View style={[styles.horizontalCardWrap, index === vehicles.length - 1 && styles.horizontalCardWrapLast]}>
            <InventoryVehicleCard
              vehicle={item}
              user={user}
              ratingSummary={reviewSummaryMap[String(item._id)]}
              promotion={promotionMap[String(item._id)]}
              isWishlisted={wishlistIds.includes(String(item._id))}
              onToggleWishlist={onToggleWishlist}
              onQuickView={onQuickView}
              cardWidth={cardWidth}
            />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
    </View>
  );
}

function WishlistSheetItem({ item, onPress, onRemove }) {
  const vehicle = item?.vehicle;

  if (!vehicle) {
    return null;
  }

  const premiumRentMeta = getPremiumRentPriceMeta(item?.user, vehicle);
  const title = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim();
  const subtitle = [vehicle.manufactureYear, vehicle.listingType, vehicle.fuelType].filter(Boolean).join(' - ');
  const price = Number(vehicle?.price || 0).toLocaleString();
  const imageUri = resolveAssetUri(vehicle?.image1);

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
        <View style={styles.wishlistSheetPriceRow}>
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

function HeaderActionButton({ icon, onPress, badgeCount = 0 }) {
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
            {item?.title || 'Notification'}
          </Text>
          <Text style={styles.notificationTime}>{formatNotificationTime(item?.createdAt)}</Text>
        </View>

        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item?.message || ''}
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

export default function InventoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const lastScrollOffset = React.useRef(0);
  const searchInputRef = React.useRef(null);
  const searchFocusProgress = React.useRef(new Animated.Value(0)).current;
  const wishlistSheetOpacity = React.useRef(new Animated.Value(0)).current;
  const wishlistSheetTranslateY = React.useRef(new Animated.Value(420)).current;
  const pendingWishlistRef = React.useRef(new Set());
  const wishlistToastTimeoutRef = React.useRef(null);

  const [vehicles, setVehicles] = useState(() => inventoryViewCache.vehicles);
  const [reviews, setReviews] = useState(() => inventoryViewCache.reviews);
  const [promotions, setPromotions] = useState(() => inventoryViewCache.promotions);
  const [profile, setProfile] = useState(() => inventoryViewCache.profile);
  const [notifications, setNotifications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => inventoryViewCache.wishlistIds);
  const [loading, setLoading] = useState(() => !inventoryViewCache.hydrated);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [listingType, setListingType] = useState('All');
  const [fuelType, setFuelType] = useState('All');
  const [condition, setCondition] = useState('All');
  const [category, setCategory] = useState('All');
  const [maxPrice, setMaxPrice] = useState(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [wishlistToastMessage, setWishlistToastMessage] = useState('');
  const [showWishlistToast, setShowWishlistToast] = useState(false);
  const [wishlistSheetMounted, setWishlistSheetMounted] = useState(false);
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );
  const profileImageUri = getProfileImageUri({ ...(user || {}), ...(profile || {}) });
  const profileInitial = (profile?.fullName || user?.fullName || user?.name || 'W')
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const notificationCount = notifications.length;

  const localWishlistItems = useMemo(
    () => wishlistIds
      .map((vehicleId) => vehicles.find((vehicle) => String(vehicle?._id) === String(vehicleId)))
      .filter(Boolean)
      .map((vehicle) => ({ _id: `local-${vehicle._id}`, vehicle })),
    [vehicles, wishlistIds],
  );
  const hasActiveFilters = listingType !== 'All'
    || fuelType !== 'All'
    || condition !== 'All'
    || category !== 'All'
    || maxPrice !== null
    || Boolean(locationQuery.trim());
  const searchAnimatedStyle = {
    borderColor: searchFocusProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(148,163,184,0.16)', 'rgba(250,204,21,0.72)'],
    }),
    shadowOpacity: searchFocusProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.12, 0.22],
    }),
    transform: [
      {
        scale: searchFocusProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.015],
        }),
      },
      {
        translateY: searchFocusProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
    ],
  };

  const load = async () => {
    try {
      const [vehiclesRes, wishlistRes, reviewsRes, promotionsRes, profileRes, notificationsRes] = await Promise.all([
        vehicleAPI.getAll(),
        user ? wishlistAPI.getIds() : Promise.resolve({ data: [] }),
        reviewAPI.getAll().catch(() => ({ data: [] })),
        promotionAPI.getActive().catch(() => ({ data: [] })),
        user ? customerAPI.getProfile().catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        user ? customerAPI.getNotifications().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      setVehicles(vehiclesRes.data || []);
      setWishlistIds((wishlistRes.data || []).map(String));
      setReviews(reviewsRes.data || []);
      setPromotions(promotionsRes.data || []);
      setProfile(profileRes.data || null);
      setNotifications(notificationsRes.data || []);
      inventoryViewCache.vehicles = vehiclesRes.data || [];
      inventoryViewCache.wishlistIds = (wishlistRes.data || []).map(String);
      inventoryViewCache.reviews = reviewsRes.data || [];
      inventoryViewCache.promotions = promotionsRes.data || [];
      inventoryViewCache.profile = profileRes.data || null;
      inventoryViewCache.hydrated = true;
    } catch (_) {
      // Keep the screen resilient.
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    const nextUris = vehicles
      .map((vehicle) => resolveAssetUri(vehicle?.image1))
      .filter(Boolean)
      .filter((uri) => !prefetchedInventoryImageUris.has(uri));

    if (!nextUris.length) {
      return;
    }

    nextUris.forEach((uri) => {
      prefetchedInventoryImageUris.add(uri);
      Image.prefetch(uri).catch(() => {
        prefetchedInventoryImageUris.delete(uri);
      });
    });
  }, [vehicles]);

  useEffect(() => () => {
    if (wishlistToastTimeoutRef.current) {
      clearTimeout(wishlistToastTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setWishlistItems(localWishlistItems);
  }, [localWishlistItems]);

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

  useEffect(() => {
    const filters = route.params?.searchFilters;

    if (!filters?.appliedAt) {
      return;
    }

    setSearch(filters.query || '');
    setLocationQuery(filters.city || '');
    setListingType(filters.listingType || 'All');
    setFuelType('All');
    setCondition('All');
    setCategory(filters.vehicleType && filters.vehicleType !== 'All' ? filters.vehicleType : 'All');

    if (filters.budget === 'Under 5M') {
      setMaxPrice(5000000);
    } else if (filters.budget === '5M - 10M') {
      setMaxPrice(10000000);
    } else if (filters.budget === '10M+') {
      setMaxPrice(1000000000);
    } else {
      setMaxPrice(null);
    }
  }, [route.params?.searchFilters]);

  useEffect(() => {
    if (!route.params?.focusSearchAt) {
      return;
    }

    const timer = setTimeout(() => {
      searchInputRef.current?.focus?.();
    }, 180);

    return () => clearTimeout(timer);
  }, [route.params?.focusSearchAt]);

  useEffect(() => {
    Animated.timing(searchFocusProgress, {
      toValue: searchFocused ? 1 : 0,
      duration: searchFocused ? 180 : 150,
      useNativeDriver: false,
    }).start();
  }, [searchFocusProgress, searchFocused]);

  useEffect(() => {
    let result = vehicles;

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((vehicle) =>
        `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(query)
        || (vehicle.category || '').toLowerCase().includes(query)
        || (vehicle.description || '').toLowerCase().includes(query)
      );
    }

    if (locationQuery.trim()) {
      const query = locationQuery.toLowerCase();
      result = result.filter((vehicle) =>
        (vehicle.city || '').toLowerCase().includes(query)
        || (vehicle.location || '').toLowerCase().includes(query)
        || (vehicle.description || '').toLowerCase().includes(query)
      );
    }

    if (listingType !== 'All') {
      result = result.filter((vehicle) => vehicle.listingType === listingType);
    }

    if (fuelType !== 'All') {
      result = result.filter((vehicle) => vehicle.fuelType === fuelType);
    }

    if (condition !== 'All') {
      result = result.filter((vehicle) => vehicle.vehicleCondition === condition);
    }

    if (category !== 'All') {
      result = result.filter((vehicle) => (vehicle.category || '').toLowerCase() === category.toLowerCase());
    }

    if (maxPrice) {
      if (route.params?.searchFilters?.budget === '5M - 10M') {
        result = result.filter((vehicle) => Number(vehicle.price) >= 5000000 && Number(vehicle.price) <= 10000000);
      } else if (route.params?.searchFilters?.budget === '10M+') {
        result = result.filter((vehicle) => Number(vehicle.price) >= 10000000);
      } else {
        result = result.filter((vehicle) => Number(vehicle.price) <= maxPrice);
      }
    }

    setFiltered(result);
  }, [vehicles, search, listingType, fuelType, condition, category, maxPrice, locationQuery, route.params?.searchFilters?.budget]);

  const reviewSummaryMap = useMemo(() => {
    const summaryMap = {};

    reviews.forEach((review) => {
      if (review?.reviewStatus === 'Removed') {
        return;
      }

      const vehicleId = String(
        review?.vehicleId?._id
          || review?.vehicleId
          || review?.vehicle?._id
          || review?.vehicle
          || '',
      );

      if (!vehicleId) {
        return;
      }

      if (!summaryMap[vehicleId]) {
        summaryMap[vehicleId] = { total: 0, count: 0 };
      }

      summaryMap[vehicleId].total += Number(review?.rating || 0);
      summaryMap[vehicleId].count += 1;
    });

    return Object.fromEntries(
      Object.entries(summaryMap).map(([vehicleId, summary]) => ([
        vehicleId,
        {
          average: summary.count ? summary.total / summary.count : 0,
          count: summary.count,
        },
      ])),
    );
  }, [reviews]);

  const promotionMap = useMemo(() => {
    const map = {};

    vehicles.forEach((vehicle) => {
      map[String(vehicle._id)] = getVehiclePromotion(vehicle, promotions, { placement: 'vehicleCard' });
    });

    return map;
  }, [promotions, vehicles]);

  const openLogin = () => {
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
  };

  const handleToggleWishlist = async (vehicleId) => {
    if (!user) {
      openLogin();
      return;
    }

    const vehicleKey = String(vehicleId);

    if (pendingWishlistRef.current.has(vehicleKey)) {
      return;
    }

    pendingWishlistRef.current.add(vehicleKey);
    const wasWishlisted = wishlistIds.includes(vehicleKey);

    setWishlistIds((previous) => (
      previous.includes(vehicleKey)
        ? previous.filter((id) => id !== vehicleKey)
        : [...previous, vehicleKey]
    ));
    setWishlistItems((previous) => {
      const existingIndex = previous.findIndex((item) => String(item?.vehicle?._id) === vehicleKey);

      if (wasWishlisted) {
        return previous.filter((item) => String(item?.vehicle?._id) !== vehicleKey);
      }

      if (existingIndex >= 0) {
        return previous;
      }

      const matchedVehicle = vehicles.find((vehicle) => String(vehicle?._id) === vehicleKey);
      if (!matchedVehicle) {
        return previous;
      }

      return [{ _id: `local-${vehicleKey}`, vehicle: matchedVehicle }, ...previous];
    });

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
      setWishlistIds((previous) => {
        const isCurrentlyWishlisted = previous.includes(vehicleKey);

        if (wasWishlisted && !isCurrentlyWishlisted) {
          return [...previous, vehicleKey];
        }

        if (!wasWishlisted && isCurrentlyWishlisted) {
          return previous.filter((id) => id !== vehicleKey);
        }

        return previous;
      });
      setWishlistItems((previous) => {
        const existsNow = previous.some((item) => String(item?.vehicle?._id) === vehicleKey);
        const matchedVehicle = vehicles.find((vehicle) => String(vehicle?._id) === vehicleKey);

        if (wasWishlisted && !existsNow && matchedVehicle) {
          return [{ _id: `rollback-${vehicleKey}`, vehicle: matchedVehicle }, ...previous];
        }

        if (!wasWishlisted && existsNow) {
          return previous.filter((item) => String(item?.vehicle?._id) !== vehicleKey);
        }

        return previous;
      });
    } finally {
      pendingWishlistRef.current.delete(vehicleKey);
    }
  };

  const handleQuickView = (vehicle) => {
    const targetRoute = vehicle?.listingType === 'Rent' ? 'RentVehicleDetails' : 'SaleVehicleDetails';
    navigation.navigate(targetRoute, { vehicleId: vehicle._id, initialVehicle: vehicle });
  };

  const openProfile = () => {
    navigation.navigate('CustomerProfileMain');
  };

  const openWishlist = () => {
    if (!user) {
      openLogin();
      return;
    }

    wishlistSheetOpacity.stopAnimation();
    wishlistSheetTranslateY.stopAnimation();
    wishlistSheetOpacity.setValue(0);
    wishlistSheetTranslateY.setValue(420);
    setWishlistItems(localWishlistItems);
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

  const openNotificationSheet = () => {
    setNotificationSheetVisible(true);
  };

  const closeNotificationSheet = () => {
    setNotificationSheetVisible(false);
  };

  const handleNotificationPress = async (item) => {
    const notificationId = item?.id || item?._id;

    if (!notificationId) {
      return;
    }

    setNotifications((current) => current.filter((entry) => (entry.id || entry._id) !== notificationId));
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

  const resetInventoryFilters = () => {
    setListingType('All');
    setFuelType('All');
    setCondition('All');
    setCategory('All');
    setMaxPrice(null);
    setLocationQuery('');
  };

  const handleFilterButtonPress = () => {
    if (hasActiveFilters) {
      resetInventoryFilters();
      setFilterMenuVisible(false);
      return;
    }

    setFilterMenuVisible((current) => !current);
  };

  return (
    <Animated.View style={[styles.root, pageTransitionStyle]}>
      <SuccessToast visible={showWishlistToast} message={wishlistToastMessage} />
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
                notifications.map((item, index) => (
                  <CustomerNotificationCard
                    key={String(item?.id || item?._id || index)}
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
                data={wishlistItems.filter((item) => item?.vehicle)}
                keyExtractor={(item, index) => String(item?._id || item?.vehicle?._id || index)}
                renderItem={({ item }) => (
                  <WishlistSheetItem
                    item={{ ...item, user }}
                    onPress={() => {
                      closeWishlistSheet();
                      handleQuickView(item.vehicle);
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
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item._id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <View style={styles.gridCardWrap}>
            <InventoryVehicleCard
              vehicle={item}
              user={user}
              ratingSummary={reviewSummaryMap[String(item._id)]}
              promotion={promotionMap[String(item._id)]}
              isWishlisted={wishlistIds.includes(String(item._id))}
              onToggleWishlist={handleToggleWishlist}
              onQuickView={handleQuickView}
            />
          </View>
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.topBar}>
              <View style={styles.headerProfileGroup}>
                <TouchableOpacity
                  style={styles.profileShortcut}
                  onPress={openProfile}
                  activeOpacity={0.88}
                >
                  {profileImageUri ? (
                    <Image source={{ uri: profileImageUri }} style={styles.profileShortcutImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.profileShortcutFallback}>
                      <Text style={styles.profileShortcutFallbackText}>{profileInitial}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {user?.isPremium ? (
                  <TouchableOpacity
                    onPress={openProfile}
                    activeOpacity={0.88}
                    style={styles.headerProfileCrownTouch}
                  >
                    <PremiumCrownBadge
                      size={44}
                      iconSize={22}
                      style={styles.headerProfileCrown}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.pageTitle}>Vehicle Inventory</Text>
              <HeaderActionButton
                icon="bell-outline"
                onPress={openNotificationSheet}
                badgeCount={notificationCount}
              />
            </View>

            <View style={styles.searchRow}>
              <Animated.View style={[styles.searchWrap, searchAnimatedStyle]}>
                <MaterialCommunityIcons name="magnify" size={22} color={Colors.text} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search brand, model, or vehicle details"
                  placeholderTextColor={Colors.muted}
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="close" size={20} color={Colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </Animated.View>

              <View style={styles.searchActions}>
                <TouchableOpacity
                  style={[styles.filterButton, (filterMenuVisible || hasActiveFilters) && styles.filterButtonActive]}
                  onPress={handleFilterButtonPress}
                  activeOpacity={0.9}
                >
                  <MaterialCommunityIcons
                    name={filterMenuVisible || hasActiveFilters ? 'tune-variant' : 'filter-variant'}
                    size={20}
                    color={filterMenuVisible || hasActiveFilters ? '#ffffff' : '#111111'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.wishlistButton}
                  onPress={openWishlist}
                  activeOpacity={0.9}
                >
                  <MaterialCommunityIcons name="cart-outline" size={20} color="#111111" />
                </TouchableOpacity>
              </View>
            </View>

            {filterMenuVisible ? (
              <View style={styles.filterPanel}>
                <FilterSection
                  title="Listing Type"
                  options={LISTING_TYPES}
                  selectedValue={listingType}
                  onSelect={setListingType}
                />
                <FilterSection
                  title="Fuel Type"
                  options={FUEL_TYPES}
                  selectedValue={fuelType}
                  onSelect={setFuelType}
                />
                <FilterSection
                  title="Condition"
                  options={CONDITIONS}
                  selectedValue={condition}
                  onSelect={setCondition}
                />
              </View>
            ) : null}

          </View>
        )}
        ListEmptyComponent={loading ? null : (
          <EmptyState
            icon="car-outline"
            title="No vehicles found"
          />
        )}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        )}
        showsVerticalScrollIndicator={false}
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
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f5f0',
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
  notificationOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  notificationOverlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  notificationPopup: {
    maxHeight: '72%',
    borderRadius: 32,
    padding: 18,
    backgroundColor: '#ffffff',
    ...Shadow.lg,
  },
  notificationPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  notificationPopupTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  notificationPopupCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  notificationPopupCountText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  notificationList: {
    gap: 12,
    paddingBottom: 4,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  notificationAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  notificationImage: {
    width: 54,
    height: 54,
    borderRadius: 18,
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
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  notificationMessage: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#64748b',
  },
  notificationFooterRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  notificationTypeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  notificationGoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationGoText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
  },
  notificationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    gap: 10,
  },
  notificationEmptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
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
  wishlistSheetLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
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
  wishlistSheetPriceRow: {
    marginTop: 8,
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
  list: {
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  headerBlock: {
    marginBottom: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 18,
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
  headerProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 14,
  },
  headerProfileCrown: {
    marginTop: 0,
  },
  headerProfileCrownTouch: {
    borderRadius: 22,
  },
  profileShortcut: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...Shadow.sm,
  },
  profileShortcutImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
  },
  profileShortcutFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileShortcutFallbackText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 16,
    height: 58,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    ...Shadow.md,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  wishlistButton: {
    width: 52,
    height: 58,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  filterButton: {
    width: 52,
    height: 58,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  filterButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterPanel: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    ...Shadow.md,
    zIndex: 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    marginRight: 7,
    marginBottom: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
  },
  pillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
  },
  pillTextActive: {
    color: '#ffffff',
  },
  filterGroup: {
    marginBottom: 9,
  },
  filterGroupTitle: {
    marginBottom: 7,
    fontSize: 11,
    fontWeight: '800',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  filterGroupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridCardWrap: {
    width: '48%',
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.muted,
  },
  horizontalList: {
    paddingLeft: 18,
    paddingRight: 8,
  },
  horizontalCardWrap: {
    marginRight: 14,
  },
  horizontalCardWrapLast: {
    marginRight: 18,
  },
});

