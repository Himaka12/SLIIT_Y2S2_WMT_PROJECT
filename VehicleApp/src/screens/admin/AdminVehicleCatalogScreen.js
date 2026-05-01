import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  adminAPI,
  BASE_URL,
  promotionAPI,
  reviewAPI,
  vehicleAPI,
} from '../../api';
import { Badge, EmptyState, LoadingSpinner } from '../../components/UI';
import SuccessToast from '../../components/SuccessToast';
import { Radius, Shadow } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';
import { getPromotionDiscountMeta, getVehiclePromotion as selectVehiclePromotion } from '../../utils/promotionUtils';
import { emitAdminTabBarAction } from '../../utils/adminTabBarActionEvents';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';
import { VehicleEditorForm } from './AddEditVehicleScreen';

const WHEELZY_LOGO = require('../../../assets/logos/wheelzy-logo.jpeg');

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

function formatPrice(value, listingType) {
  const base = `Rs. ${Number(value || 0).toLocaleString()}`;
  return listingType === 'Rent' ? `${base}` : base;
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
    };
  }

  if (tone === 'warning') {
    return {
      accent: '#d97706',
      icon: 'star-four-points',
      badgeBackground: '#fef3c7',
      badgeText: '#b45309',
    };
  }

  if (tone === 'premium') {
    return {
      accent: '#ca8a04',
      icon: 'crown',
      badgeBackground: '#fef08a',
      badgeText: '#854d0e',
    };
  }

  if (tone === 'info') {
    return {
      accent: '#2563eb',
      icon: 'calendar-check',
      badgeBackground: '#dbeafe',
      badgeText: '#1d4ed8',
    };
  }

  return {
    accent: '#111111',
    icon: 'bell-outline',
    badgeBackground: '#f3f4f6',
    badgeText: '#374151',
  };
}

function buildShortDetails(vehicle) {
  const description = String(vehicle?.description || '').trim();
  if (description) {
    return description;
  }

  return [
    vehicle?.manufactureYear,
    vehicle?.vehicleCondition,
    vehicle?.transmission,
    vehicle?.fuelType,
  ].filter(Boolean).join(' • ');
}

function getVehicleReviewStats(vehicle, reviews) {
  const vehicleId = String(vehicle?._id || '');
  const activeReviews = reviews.filter((item) => {
    const targetId = String(item?.vehicleId?._id || item?.vehicleId || item?.vehicle?._id || item?.vehicle || '');
    return targetId === vehicleId && item?.reviewStatus !== 'Removed';
  });

  if (!activeReviews.length) {
    return { average: 0, count: 0 };
  }

  const total = activeReviews.reduce((sum, item) => sum + Number(item?.rating || 0), 0);

  return {
    average: total / activeReviews.length,
    count: activeReviews.length,
  };
}

function getVehiclePromotion(vehicle, promotions) {
  return selectVehiclePromotion(vehicle, promotions, { placement: 'vehicleCard' });
}

function StarRating({ average }) {
  const filledStars = Math.round(average);

  return (
    <View style={styles.ratingRow}>
      <View style={styles.starStrip}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= filledStars ? 'star' : 'star-outline'}
            size={13}
            color="#ffd54a"
          />
        ))}
      </View>
      <Text style={styles.ratingValue}>{average.toFixed(1)}</Text>
    </View>
  );
}

function AdminNotificationCard({ item, onPress }) {
  const imageUri = resolveAssetUri(item?.image);
  const tone = getNotificationToneStyle(item?.tone);

  return (
    <TouchableOpacity style={styles.notificationCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.notificationAccentBar, { backgroundColor: tone.accent }]} />
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.notificationImage} resizeMode="cover" />
      ) : (
        <View style={[styles.notificationImage, styles.notificationImageFallback]}>
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
          <View style={styles.notificationNameBadge}>
            <Text style={styles.notificationNameBadgeText} numberOfLines={1}>
              {item?.actorName || 'Wheelzy User'}
            </Text>
          </View>
          <View style={styles.notificationIndicators}>
            {item?.tone === 'critical' ? (
              <View style={[styles.notificationTypeBadge, { backgroundColor: tone.badgeBackground }]}>
                <Text style={[styles.notificationTypeBadgeText, { color: tone.badgeText }]}>Critical</Text>
              </View>
            ) : null}
            {item?.premium ? (
              <View style={styles.notificationPremiumBadge}>
                <MaterialCommunityIcons name="crown" size={12} color="#854d0e" />
                <Text style={styles.notificationPremiumBadgeText}>Premium</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function QuickViewDetailTile({ label, value }) {
  return (
    <View style={styles.quickViewDetailTile}>
      <Text style={styles.quickViewDetailLabel}>{label}</Text>
      <Text style={styles.quickViewDetailValue} numberOfLines={2}>
        {value || 'Not provided'}
      </Text>
    </View>
  );
}

function AdminVehicleCard({ cardWidth, vehicle, reviewStats, promotion, onQuickView, onEdit, onDelete }) {
  const imageUri = resolveAssetUri(vehicle?.image1);
  const promotionDiscount = getPromotionDiscountMeta(vehicle, promotion);
  const hasPromotion = promotionDiscount.hasDiscount;
  const currentPriceValue = hasPromotion ? promotionDiscount.finalPrice : Number(vehicle?.price || 0);
  const normalPriceLabel = formatPrice(vehicle?.price, vehicle?.listingType);
  const currentPriceLabel = formatPrice(currentPriceValue, vehicle?.listingType);

  return (
    <View style={[styles.vehicleCard, { width: cardWidth }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.vehicleImage} resizeMode="cover" />
      ) : (
        <View style={[styles.vehicleImage, styles.vehicleImageFallback]}>
          <MaterialCommunityIcons name="car-sports" size={42} color="#9ca3af" />
          <Text style={styles.vehicleImageFallbackText}>Wheelzy</Text>
        </View>
      )}

      <View style={styles.cardTopBadges}>
        <View style={[styles.statusPill, vehicle?.listingType === 'Rent' ? styles.rentPill : styles.salePill]}>
          <Text style={[styles.statusPillText, vehicle?.listingType === 'Rent' ? styles.rentPillText : styles.salePillText]}>
            {vehicle?.listingType === 'Rent' ? 'For Rent' : 'For Sale'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cardDeleteButton}
          onPress={onDelete}
          activeOpacity={0.9}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#dc2626" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBottomContent}>
        <Text style={styles.vehicleTitle} numberOfLines={1}>
          {vehicle?.brand} {vehicle?.model}
        </Text>
        <View style={styles.supportOverlayWrap}>
          <View style={styles.supportOverlayContent}>
            <StarRating average={reviewStats.average} />

            <View style={styles.priceRow}>
              <Text style={styles.vehiclePrice}>{currentPriceLabel}</Text>
              {hasPromotion ? (
                <>
                  <Text style={styles.oldPrice}>{normalPriceLabel}</Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{promotionDiscount.badgeLabel}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.vehicleActionRow}>
              <TouchableOpacity style={styles.quickViewButton} onPress={onQuickView} activeOpacity={0.9}>
                <Text style={styles.quickViewButtonText}>Quick View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editButton} onPress={onEdit} activeOpacity={0.9}>
                <Text style={styles.editButtonText}>Edit Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function AdminVehicleCatalogScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { showAlert } = useAppAlert();
  const lastScrollOffset = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleModalMode, setVehicleModalMode] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationPopupVisible, setNotificationPopupVisible] = useState(false);
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [showVehicleToast, setShowVehicleToast] = useState(false);
  const [vehicleToastMessage, setVehicleToastMessage] = useState('');
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );
  const filterOpacity = useRef(new Animated.Value(0)).current;
  const filterScale = useRef(new Animated.Value(0.94)).current;
  const filterTranslateY = useRef(new Animated.Value(-8)).current;
  const notificationToastTimeoutRef = useRef(null);
  const vehicleToastTimeoutRef = useRef(null);

  const horizontalPadding = 20;
  const cardWidth = Math.max(280, screenWidth - (horizontalPadding * 2));
  const selectedVehicleDeleteImage = useMemo(
    () => resolveAssetUri(deleteVehicleTarget?.image1),
    [deleteVehicleTarget?.image1],
  );

  const load = useCallback(async () => {
    try {
      const [vehiclesRes, reviewsRes, promotionsRes, notificationsRes] = await Promise.all([
        vehicleAPI.getAll(),
        reviewAPI.getAll(),
        promotionAPI.getActive(),
        adminAPI.getNotifications(),
      ]);

      setVehicles(vehiclesRes.data || []);
      setReviews(reviewsRes.data || []);
      setPromotions(promotionsRes.data || []);
      setNotifications(notificationsRes.data || []);
    } catch (_) {
      // Keep screen resilient.
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load().finally(() => {
      hasLoadedOnceRef.current = true;
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnceRef.current) {
        load();
      }
    }, [load]),
  );

  useEffect(() => {
    emitCustomerTabBarVisibility(true);
  }, []);

  const vehicleCards = useMemo(
    () => [...vehicles]
      .reverse()
      .map((vehicle) => ({
        vehicle,
        reviewStats: getVehicleReviewStats(vehicle, reviews),
        promotion: getVehiclePromotion(vehicle, promotions),
      })),
    [promotions, reviews, vehicles],
  );
  const filteredVehicleCards = useMemo(() => {
    if (activeFilter === 'RENT') {
      return vehicleCards.filter((item) => item.vehicle?.listingType === 'Rent');
    }

    if (activeFilter === 'SALE') {
      return vehicleCards.filter((item) => item.vehicle?.listingType === 'Sale');
    }

    return vehicleCards;
  }, [activeFilter, vehicleCards]);
  const notificationCount = notifications.length;
  const criticalNotificationCount = useMemo(
    () => notifications.filter((item) => item?.tone === 'critical').length,
    [notifications],
  );

  const handleDeleteVehicle = useCallback((vehicle) => {
    setDeleteVehicleTarget(vehicle);
    setDeleteDialogVisible(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleteSubmitting) {
      return;
    }

    setDeleteDialogVisible(false);
    setDeleteVehicleTarget(null);
  }, [deleteSubmitting]);

  const confirmDeleteVehicle = useCallback(async () => {
    if (!deleteVehicleTarget?._id || deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);

    try {
      const vehicleLabel = [deleteVehicleTarget?.brand, deleteVehicleTarget?.model].filter(Boolean).join(' ').trim() || 'Vehicle';
      await vehicleAPI.delete(deleteVehicleTarget._id);
      setDeleteSubmitting(false);
      closeDeleteDialog();
      await load();
      setVehicleToastMessage(`${vehicleLabel} deleted successfully`);
      setShowVehicleToast(true);
      if (vehicleToastTimeoutRef.current) {
        clearTimeout(vehicleToastTimeoutRef.current);
      }
      vehicleToastTimeoutRef.current = setTimeout(() => {
        setShowVehicleToast(false);
        vehicleToastTimeoutRef.current = null;
      }, 1800);
    } catch (_) {
      setDeleteSubmitting(false);
      showAlert('Error', 'Unable to delete this vehicle right now.', undefined, { tone: 'danger' });
    }
  }, [closeDeleteDialog, deleteSubmitting, deleteVehicleTarget, load, showAlert]);

  const closeVehicleModal = useCallback((onClosed) => {
    setVehicleModalVisible(false);
    setVehicleModalMode(null);
    setSelectedVehicle(null);
    if (typeof onClosed === 'function') {
      onClosed();
    }
  }, []);

  const openVehicleModal = useCallback((mode, vehicle = null) => {
    setSelectedVehicle(vehicle);
    setVehicleModalMode(mode);
    setVehicleModalVisible(true);
  }, []);

  const openAddVehicleModal = useCallback(() => {
    openVehicleModal('add');
  }, [openVehicleModal]);

  const openEditVehicleModal = useCallback((vehicle) => {
    openVehicleModal('edit', vehicle);
  }, [openVehicleModal]);

  const openQuickView = useCallback((vehicle) => {
    if (!vehicle?._id) {
      return;
    }

    navigation.navigate('VehicleDetail', { vehicleId: vehicle._id, vehicle });
  }, [navigation]);
  const openFilterMenu = useCallback(() => {
    setFilterMenuVisible(true);
    Animated.parallel([
      Animated.timing(filterOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(filterScale, {
        toValue: 1,
        tension: 135,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(filterTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [filterOpacity, filterScale, filterTranslateY]);
  const closeFilterMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(filterOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(filterScale, {
        toValue: 0.94,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(filterTranslateY, {
        toValue: -8,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setFilterMenuVisible(false);
      }
    });
  }, [filterOpacity, filterScale, filterTranslateY]);
  const toggleFilterMenu = useCallback(() => {
    if (filterMenuVisible) {
      closeFilterMenu();
      return;
    }
    openFilterMenu();
  }, [closeFilterMenu, filterMenuVisible, openFilterMenu]);
  const selectFilter = useCallback((nextFilter) => {
    setActiveFilter(nextFilter);
    closeFilterMenu();
  }, [closeFilterMenu]);

  useEffect(() => {
    if (route.params?.openAddVehicleModalAt) {
      openVehicleModal('add');
    }
  }, [openVehicleModal, route.params?.openAddVehicleModalAt]);

  useEffect(() => {
    if (!route.params?.openEditVehicleModalAt || !route.params?.editVehicleId) {
      return;
    }

    const targetVehicle = vehicles.find((vehicle) => String(vehicle._id) === String(route.params.editVehicleId));

    if (targetVehicle) {
      openVehicleModal('edit', targetVehicle);
    }
  }, [openVehicleModal, route.params?.editVehicleId, route.params?.openEditVehicleModalAt, vehicles]);

  useFocusEffect(
    useCallback(() => {
      emitAdminTabBarAction({
        key: 'catalog-vehicle-add',
        icon: 'car-sports',
        showPlusBadge: true,
        onPress: openAddVehicleModal,
      });

      return () => emitAdminTabBarAction(null);
    }, [openAddVehicleModal]),
  );

  useEffect(() => {
    if (notificationToastTimeoutRef.current) {
      clearTimeout(notificationToastTimeoutRef.current);
      notificationToastTimeoutRef.current = null;
    }

    if (notificationCount > 0) {
      setShowNotificationToast(true);
      notificationToastTimeoutRef.current = setTimeout(() => {
        setShowNotificationToast(false);
        notificationToastTimeoutRef.current = null;
      }, 2600);
    } else {
      setShowNotificationToast(false);
    }

    return () => {
      if (notificationToastTimeoutRef.current) {
        clearTimeout(notificationToastTimeoutRef.current);
        notificationToastTimeoutRef.current = null;
      }
    };
  }, [notificationCount]);

  useEffect(() => () => {
    if (vehicleToastTimeoutRef.current) {
      clearTimeout(vehicleToastTimeoutRef.current);
      vehicleToastTimeoutRef.current = null;
    }
  }, []);

  const closeNotificationPopup = useCallback(() => {
    setNotificationPopupVisible(false);
  }, []);

  const openNotificationPopup = useCallback(() => {
    setNotificationPopupVisible(true);
  }, []);

  const handleNotificationPress = useCallback(async (item) => {
    if (!item?.entityId || !item?.type) {
      return;
    }

    setNotifications((current) => current.filter((entry) => entry.id !== item.id));
    setNotificationPopupVisible(false);

    try {
      await adminAPI.markNotificationViewed(item.type, item.entityId);
    } catch (_) {
      load();
    }

    if (item?.targetTab) {
      navigation.getParent()?.navigate('AdminDash', {
        screen: 'AdminDashMain',
        params: {
          initialTab: item.targetTab,
          openedFromCatalogAt: Date.now(),
          notificationTargetId: item.entityId,
          notificationType: item.type,
        },
      });
    }
  }, [load, navigation]);

  const handleVehicleSaved = useCallback(async (notice) => {
    closeVehicleModal();
    await load();
    if (notice?.message) {
      setVehicleToastMessage(notice.message);
      setShowVehicleToast(true);
      if (vehicleToastTimeoutRef.current) {
        clearTimeout(vehicleToastTimeoutRef.current);
      }
      vehicleToastTimeoutRef.current = setTimeout(() => {
        setShowVehicleToast(false);
        vehicleToastTimeoutRef.current = null;
      }, 1800);
    }
  }, [closeVehicleModal, load]);

  if (loading) {
    return <LoadingSpinner message="Loading admin vehicles..." />;
  }

  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
      <SuccessToast
        visible={showNotificationToast}
        message={notificationCount === 1 ? '1 new admin notification is waiting' : `${notificationCount} new admin notifications are waiting`}
        backgroundColor={criticalNotificationCount > 0 ? '#dc2626' : '#111111'}
        textColor="#ffffff"
      />
      <SuccessToast visible={showVehicleToast} message={vehicleToastMessage} />
      {filterMenuVisible ? (
        <Pressable style={styles.filterDismissLayer} onPress={closeFilterMenu} />
      ) : null}
      <ScrollView
        pointerEvents="box-none"
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 10, 30) },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onStartShouldSetResponderCapture={(event) => filterMenuVisible && event.target === event.currentTarget}
        onResponderRelease={() => {
          if (filterMenuVisible) {
            closeFilterMenu();
          }
        }}
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
        <View style={styles.topTitleRow}>
          <View style={styles.topTitleLeft}>
            <Image source={WHEELZY_LOGO} style={styles.topLogo} resizeMode="cover" />
            <Text style={styles.topTitle}>Admin Vehicles</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={openNotificationPopup} activeOpacity={0.88}>
            <MaterialCommunityIcons
              name={criticalNotificationCount > 0 ? 'bell-alert-outline' : 'bell-outline'}
              size={20}
              color={criticalNotificationCount > 0 ? '#dc2626' : '#111111'}
            />
            {notificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>Manage vehicles</Text>
            </View>
            <TouchableOpacity style={styles.filterButton} onPress={toggleFilterMenu} activeOpacity={0.88}>
              <MaterialCommunityIcons name="tune-variant" size={16} color="#111111" />
              <Text style={styles.filterButtonText}>
                {activeFilter === 'ALL' ? 'All' : activeFilter === 'RENT' ? 'Rental' : 'Sale'}
              </Text>
            </TouchableOpacity>
          </View>
          {filterMenuVisible ? (
            <Animated.View
              style={[
                styles.filterMenu,
                {
                  opacity: filterOpacity,
                  transform: [{ translateY: filterTranslateY }, { scale: filterScale }],
                },
              ]}
            >
              {[
                { key: 'ALL', label: 'All Vehicles' },
                { key: 'RENT', label: 'Rental Vehicles' },
                { key: 'SALE', label: 'Sale Vehicles' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.filterMenuItem, activeFilter === option.key && styles.filterMenuItemActive]}
                  onPress={() => selectFilter(option.key)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.filterMenuItemText, activeFilter === option.key && styles.filterMenuItemTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          ) : null}
        </View>

        {filteredVehicleCards.length === 0 ? (
          <EmptyState
            icon="🚗"
            title="No matching vehicles"
            subtitle="Try another filter or add a new listing."
          />
        ) : (
          <View style={styles.vehicleGrid}>
            {filteredVehicleCards.map(({ vehicle, reviewStats, promotion }) => (
              <AdminVehicleCard
                key={vehicle._id}
                cardWidth={cardWidth}
                vehicle={vehicle}
                reviewStats={reviewStats}
                promotion={promotion}
                onQuickView={() => openQuickView(vehicle)}
                onEdit={() => openEditVehicleModal(vehicle)}
                onDelete={() => handleDeleteVehicle(vehicle)}
              />
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={vehicleModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => closeVehicleModal()}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>{vehicleModalMode === 'edit' ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
              </View>
              <TouchableOpacity style={styles.vehicleEditorSheetCloseButton} onPress={() => closeVehicleModal()} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={22} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.vehicleEditorSheetFormBody}>
              <VehicleEditorForm
                existing={vehicleModalMode === 'edit' ? selectedVehicle : null}
                onClose={() => closeVehicleModal()}
                onSaved={handleVehicleSaved}
                showHeader={false}
                showIntro={false}
                topPadding={0}
                embedded
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={notificationPopupVisible} transparent animationType="fade" onRequestClose={closeNotificationPopup}>
        <View style={styles.notificationOverlay}>
          <BlurView intensity={22} tint="dark" style={styles.notificationOverlayBlur} />
          <Pressable style={styles.notificationOverlayBackdrop} onPress={closeNotificationPopup} />
          <View
            style={[
              styles.notificationPopup,
              {
                marginTop: Math.max(insets.top + 68, 94),
              },
            ]}
          >
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
                  <AdminNotificationCard
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
        visible={deleteDialogVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeDeleteDialog}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.deleteSheetMediaCard}>
                {selectedVehicleDeleteImage ? (
                  <Image source={{ uri: selectedVehicleDeleteImage }} style={styles.deleteSheetMediaImage} resizeMode="cover" />
                ) : (
                  <View style={styles.deleteSheetMediaFallback}>
                    <MaterialCommunityIcons name="car-sports" size={34} color="#94a3b8" />
                  </View>
                )}
                <View style={styles.deleteSheetMediaShade} />
                <View style={styles.deleteSheetMediaContent}>
                  <Text style={styles.deleteSheetMediaTitle}>
                    {[deleteVehicleTarget?.brand, deleteVehicleTarget?.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  Related bookings, refunds, reviews, and inquiries will stay saved.
                </Text>
              </View>

              {deleteVehicleTarget?.listingType || deleteVehicleTarget?.status ? (
                <View style={styles.quickViewBadgeRow}>
                  {deleteVehicleTarget?.listingType ? (
                    <Badge label={deleteVehicleTarget.listingType} color="#1d4ed8" bg="#dbeafe" />
                  ) : null}
                  {deleteVehicleTarget?.status ? (
                    <Badge label={deleteVehicleTarget.status} color="#111111" bg="#f3f4f6" />
                  ) : null}
                  {deleteVehicleTarget?.category ? (
                    <Badge label={deleteVehicleTarget.category} color="#92400e" bg="#fff7ed" />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.quickViewInfoSection}>
                <View style={styles.quickViewDetailGrid}>
                  <QuickViewDetailTile label="Price" value={formatPrice(deleteVehicleTarget?.price, deleteVehicleTarget?.listingType)} />
                  <QuickViewDetailTile label="Year" value={deleteVehicleTarget?.manufactureYear} />
                  <QuickViewDetailTile label="Condition" value={deleteVehicleTarget?.vehicleCondition} />
                  <QuickViewDetailTile label="Color" value={deleteVehicleTarget?.color} />
                </View>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity style={styles.deleteSheetPrimaryButton} onPress={confirmDeleteVehicle} activeOpacity={0.9} disabled={deleteSubmitting}>
                {deleteSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Delete Vehicle</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    position: 'relative',
  },
  root: {
    flex: 1,
    backgroundColor: '#f4f1eb',
    zIndex: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  topTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  topTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  topLogo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  topTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.12)',
    ...Shadow.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 7,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  notificationOverlay: {
    flex: 1,
    alignItems: 'flex-end',
  },
  notificationOverlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.56)',
  },
  notificationPopup: {
    width: '88%',
    maxWidth: 360,
    maxHeight: 430,
    marginRight: 20,
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
    letterSpacing: -0.4,
  },
  notificationPopupCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationPopupCountText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  notificationList: {
    gap: 12,
    paddingBottom: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.04)',
    overflow: 'hidden',
  },
  notificationAccentBar: {
    width: 4,
  },
  notificationImage: {
    width: 62,
    height: 62,
    borderRadius: 18,
    marginLeft: 12,
    marginVertical: 12,
    backgroundColor: '#e5e7eb',
  },
  notificationImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 1,
  },
  notificationMessage: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
  },
  notificationFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationNameBadge: {
    flex: 1,
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
    justifyContent: 'center',
  },
  notificationNameBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
  },
  notificationIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationTypeBadge: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTypeBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  notificationPremiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  notificationPremiumBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#854d0e',
  },
  notificationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    paddingHorizontal: 18,
    gap: 8,
  },
  notificationEmptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  notificationEmptyText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#6b7280',
    textAlign: 'center',
  },
  sectionHeaderWrap: {
    position: 'relative',
    zIndex: 12,
    elevation: 12,
  },
  filterDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleBlock: {
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  filterButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Shadow.sm,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  filterMenu: {
    position: 'absolute',
    top: 68,
    right: 0,
    width: 170,
    padding: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
    zIndex: 24,
    elevation: 16,
    ...Shadow.md,
  },
  filterMenuItem: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  filterMenuItemActive: {
    backgroundColor: '#f3f4f6',
  },
  filterMenuItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  filterMenuItemTextActive: {
    color: '#111111',
  },
  vehicleGrid: {
    gap: 18,
  },
  vehicleCard: {
    alignSelf: 'center',
    height: 386,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    ...Shadow.md,
  },
  vehicleImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    backgroundColor: '#d9dde4',
  },
  vehicleImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vehicleImageFallbackText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#374151',
    letterSpacing: -0.5,
  },
  cardTopBadges: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDeleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  rentPill: {
    backgroundColor: 'rgba(240, 253, 244, 0.96)',
  },
  salePill: {
    backgroundColor: 'rgba(239, 246, 255, 0.96)',
  },
  rentPillText: {
    color: '#15803d',
  },
  salePillText: {
    color: '#1d4ed8',
  },
  cardBottomContent: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 6,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 10,
  },
  vehicleTitle: {
    marginLeft: 8,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  supportOverlayWrap: {
    marginTop: 8,
  },
  supportOverlayContent: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  ratingRow: {
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starStrip: {
    flexDirection: 'row',
    gap: 3,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
  },
  priceRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehiclePrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  oldPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
  },
  vehicleActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickViewButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
  },
  editButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
  },
  modalBackdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    width: '100%',
  },
  modalCloseRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingRight: 2,
  },
  modalBlurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  modalFloatingCloseButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.sm,
  },
  modalCard: {
    height: '92%',
    backgroundColor: '#f8fafc',
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.md,
  },
  modalFormBody: {
    flex: 1,
    minHeight: 0,
  },
  modalTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.7,
  },
  modalSubtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
  },
  vehicleEditorSheetScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  vehicleEditorSheet: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  vehicleEditorSheetTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  vehicleEditorSheetTitleWrap: {
    flex: 1,
  },
  vehicleEditorSheetTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.9,
  },
  vehicleEditorSheetSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#6b7280',
  },
  vehicleEditorSheetCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleEditorSheetFormBody: {
    flex: 1,
    minHeight: 0,
    marginTop: 18,
  },
  quickViewBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  quickViewInfoSection: { marginTop: 18 },
  quickViewDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickViewDetailTile: {
    width: '48%',
    minHeight: 86,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eef2f7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  quickViewDetailLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quickViewDetailValue: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    color: '#111111',
  },
  deleteSheetMediaCard: {
    marginTop: 6,
    height: 220,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  deleteSheetMediaImage: {
    width: '100%',
    height: '100%',
  },
  deleteSheetMediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  deleteSheetMediaShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  deleteSheetMediaContent: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  deleteSheetMediaTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  deleteSheetInfoCard: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deleteSheetInfoText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '700',
  },
  deleteSheetFooter: {
    marginTop: 18,
    paddingTop: 6,
    paddingBottom: 8,
  },
  deleteSheetPrimaryButton: {
    minHeight: 54,
    borderRadius: 24,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    ...Shadow.sm,
  },
  deleteSheetPrimaryText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
  bottomSpacer: {
    height: 18,
  },
});
