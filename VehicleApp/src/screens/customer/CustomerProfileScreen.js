import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, bookingAPI, customerAPI, inquiryAPI, promotionAPI, reviewAPI, wishlistAPI } from '../../api';
import LogoutConfirmationSheet from '../../components/LogoutConfirmationSheet';
import PremiumCrownBadge from '../../components/PremiumCrownBadge';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';

const DEFAULT_BADGE_COUNTS = {
  bookings: 0,
  wishlist: 0,
  reviews: 0,
  inquiries: 0,
  promotions: 0,
};

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

function ProfileHeader({ user, profileImageUri }) {
  const displayName = user?.fullName || 'Wheelzy Driver';

  return (
    <View style={styles.headerWrap}>
      {profileImageUri ? (
        <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>
            {displayName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.userNameRow}>
        <Text style={styles.userName}>{displayName}</Text>
        {user?.isPremium ? <PremiumCrownBadge style={styles.userNameCrown} size={30} iconSize={17} /> : null}
      </View>
      {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
    </View>
  );
}

function SectionContainer({ title, children }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ProfileOptionItem({ icon, title, onPress, count, isDestructive = false, hideBorder = false }) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, hideBorder && styles.optionRowLast]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.optionIconWrap, isDestructive && styles.optionIconWrapDanger]}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={isDestructive ? '#dc2626' : '#111111'}
        />
      </View>

      <Text style={[styles.optionTitle, isDestructive && styles.optionTitleDanger]}>
        {title}
      </Text>

      <View style={styles.optionRight}>
        {typeof count === 'number' && count > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={isDestructive ? '#dc2626' : '#9ca3af'}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function CustomerProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout } = useAuth();
  const lastScrollOffset = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(() => user || null);
  const [stats, setStats] = useState({
    bookings: 0,
    wishlist: 0,
    reviews: 0,
    inquiries: 0,
    promotions: 0,
  });
  const [promotions, setPromotions] = useState([]);
  const [dismissedBadgeCounts, setDismissedBadgeCounts] = useState(DEFAULT_BADGE_COUNTS);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );

  const load = async () => {
    try {
      const [profileRes, bookingsRes, wishlistRes, reviewsRes, inquiriesRes, promotionsRes] = await Promise.all([
        customerAPI.getProfile(),
        bookingAPI.myBookings(),
        wishlistAPI.getList(),
        reviewAPI.myReviews(),
        inquiryAPI.myInquiries(),
        promotionAPI.showcase().catch(() => ({ data: [] })),
      ]);

      setProfile(profileRes.data || null);
      setPromotions(promotionsRes.data || []);
      setStats({
        bookings: bookingsRes.data?.length || 0,
        wishlist: wishlistRes.data?.length || 0,
        reviews: reviewsRes.data?.length || 0,
        inquiries: inquiriesRes.data?.length || 0,
        promotions: promotionsRes.data?.length || 0,
      });
    } catch (_) {
      // Keep the profile screen resilient.
    }

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

  useEffect(() => {
    let isMounted = true;

    const loadSeenBadgeCounts = async () => {
      const storageKey = `customerProfileSeenCounts:${user?._id || user?.email || 'guest'}`;

      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!isMounted) {
          return;
        }

        if (!raw) {
          setDismissedBadgeCounts(DEFAULT_BADGE_COUNTS);
          return;
        }

        const parsed = JSON.parse(raw);
        setDismissedBadgeCounts({
          ...DEFAULT_BADGE_COUNTS,
          ...(parsed || {}),
        });
      } catch (_) {
        if (isMounted) {
          setDismissedBadgeCounts(DEFAULT_BADGE_COUNTS);
        }
      }
    };

    loadSeenBadgeCounts();

    return () => {
      isMounted = false;
    };
  }, [user?._id, user?.email]);

  const getVisibleBadgeCount = (key) => {
    const liveCount = stats[key] || 0;
    const dismissedCount = dismissedBadgeCounts[key] || 0;
    return Math.max(liveCount - dismissedCount, 0);
  };

  const openLogoutSheet = useCallback(() => {
    if (logoutSheetVisible) {
      return;
    }

    setLogoutSheetVisible(true);
  }, [logoutSheetVisible]);

  const handleOptionPress = (key, action) => {
    if (key && (stats[key] || 0) > 0) {
      const nextCounts = {
        ...dismissedBadgeCounts,
        [key]: stats[key],
      };

      setDismissedBadgeCounts(nextCounts);
      AsyncStorage.setItem(
        `customerProfileSeenCounts:${user?._id || user?.email || 'guest'}`,
        JSON.stringify(nextCounts),
      ).catch(() => {
        // Keep the UI responsive even if persistence fails.
      });
    }

    action?.();
  };

  const openWishlist = () => {
    if (navigation.getState()?.routeNames?.includes('CustomerWishlistMain')) {
      navigation.navigate('CustomerWishlistMain', {
        tabTransitionAt: Date.now(),
      });
      return;
    }

    navigation.getParent()?.navigate('WishlistTab', {
      screen: 'CustomerWishlistMain',
      params: { tabTransitionAt: Date.now() },
    });
  };

  const openInquiries = () => {
    if (navigation.getState()?.routeNames?.includes('CustomerInquiriesMain')) {
      navigation.navigate('CustomerInquiriesMain', {
        tabTransitionAt: Date.now(),
      });
      return;
    }

    navigation.getParent()?.navigate('Dashboard', {
      screen: 'CustomerInquiriesMain',
      params: { tabTransitionAt: Date.now() },
    });
  };

  const openBookings = () => {
    if (navigation.getState()?.routeNames?.includes('CustomerBookingsMain')) {
      navigation.navigate('CustomerBookingsMain', {
        tabTransitionAt: Date.now(),
      });
      return;
    }

    navigation.getParent()?.navigate('Dashboard', {
      screen: 'CustomerBookingsMain',
      params: { tabTransitionAt: Date.now() },
    });
  };

  const openReviews = () => {
    if (navigation.getState()?.routeNames?.includes('CustomerReviewsMain')) {
      navigation.navigate('CustomerReviewsMain', {
        tabTransitionAt: Date.now(),
      });
      return;
    }

    navigation.getParent()?.navigate('Dashboard', {
      screen: 'CustomerReviewsMain',
      params: { tabTransitionAt: Date.now() },
    });
  };

  const displayUser = {
    ...user,
    fullName: profile?.fullName || user?.fullName,
    email: profile?.email || user?.email,
  };
  const profileImageUri = getProfileImageUri({ ...(user || {}), ...(profile || {}) });
  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
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
        {navigation.canGoBack() ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.82}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
          </TouchableOpacity>
        ) : null}

        <ProfileHeader user={displayUser} profileImageUri={profileImageUri} />

        <SectionContainer title="Account">
          <ProfileOptionItem
            icon="card-account-details-outline"
            title="Profile Info"
            onPress={() => navigation.navigate('ProfileInfoMain', { initialProfile: profile })}
          />
          <ProfileOptionItem
            icon="account-edit-outline"
            title="Edit Details"
            onPress={() => navigation.navigate('EditDetailsMain', { initialProfile: profile })}
          />
          <ProfileOptionItem
            icon="account-circle-outline"
            title="Manage Profile"
            onPress={() => navigation.navigate('ManageProfileMain', { initialProfile: profile })}
          />
          <ProfileOptionItem
            icon="crown-outline"
            title="Upgrade to Premium"
            onPress={() => navigation.navigate('PremiumUpgradeMain')}
            hideBorder
          />
        </SectionContainer>

        <SectionContainer title="Vehicle Activity">
          <ProfileOptionItem
            icon="calendar-check-outline"
            title="My Bookings"
            count={getVisibleBadgeCount('bookings')}
            onPress={() => handleOptionPress('bookings', openBookings)}
          />
          <ProfileOptionItem
            icon="cash-multiple"
            title="My Inquiries"
            count={getVisibleBadgeCount('inquiries')}
            onPress={() => handleOptionPress('inquiries', openInquiries)}
          />
          <ProfileOptionItem
            icon="heart-outline"
            title="Wishlist"
            count={getVisibleBadgeCount('wishlist')}
            onPress={() => handleOptionPress('wishlist', openWishlist)}
          />
          <ProfileOptionItem
            icon="star-outline"
            title="Reviews & Feedback"
            count={getVisibleBadgeCount('reviews')}
            onPress={() => handleOptionPress('reviews', openReviews)}
            hideBorder
          />
        </SectionContainer>

        <SectionContainer title="Promotions / Offers">
          <ProfileOptionItem
            icon="tag-outline"
            title="Promotions / Offers"
            count={getVisibleBadgeCount('promotions')}
            onPress={() => handleOptionPress('promotions', () => navigation.navigate('CustomerPromotionsMain', { tabTransitionAt: Date.now() }))}
            hideBorder
          />
        </SectionContainer>

        <SectionContainer title="App Features">
          <ProfileOptionItem
            icon="information-outline"
            title="About App"
            onPress={() => navigation.navigate('AboutAppMain')}
            hideBorder
          />
        </SectionContainer>

        <SectionContainer title="Support">
          <ProfileOptionItem
            icon="lifebuoy"
            title="Help / Support"
            onPress={() => navigation.navigate('HelpSupportMain')}
            hideBorder
          />
        </SectionContainer>

        <SectionContainer title="Logout">
          <ProfileOptionItem
            icon="logout-variant"
            title="Logout"
            onPress={openLogoutSheet}
            isDestructive
            hideBorder
          />
        </SectionContainer>
      </ScrollView>

      <LogoutConfirmationSheet
        visible={logoutSheetVisible}
        onClose={() => setLogoutSheetVisible(false)}
        onConfirm={logout}
      />
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
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 130,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadow.sm,
  },
  headerWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 18,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e5e7eb',
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    ...Shadow.sm,
  },
  avatarFallbackText: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.white,
  },
  userNameRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  userName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  userNameCrown: {
    marginTop: 1,
  },
  userEmail: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
  },
  sectionWrap: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    ...Shadow.sm,
  },
  optionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  optionIconWrapDanger: {
    backgroundColor: '#fef2f2',
  },
  optionTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  optionTitleDanger: {
    color: '#dc2626',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8cc',
  },
  countText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8a6b00',
  },
  promotionList: {
    paddingVertical: 16,
    gap: 14,
  },
  promotionSectionAction: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  promotionSectionActionText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
  promotionEmptyCard: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  promotionEmptyText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
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
  promotionPreviewHero: {
    height: 178,
    marginTop: 18,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  promotionPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  promotionPreviewFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  promotionPreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  promotionPreviewBadgeRow: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promotionPreviewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#f4c430',
  },
  promotionPreviewBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  promotionPreviewBadgeDark: {
    backgroundColor: 'rgba(17,17,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  promotionPreviewBadgeDarkText: {
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
  promotionVehicleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promotionVehicleChip: {
    maxWidth: '48%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
  },
  promotionVehicleChipText: {
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
