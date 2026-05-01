import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { BASE_URL, adminAPI, authAPI, bookingAPI, inquiryAPI, promotionAPI, refundAPI, reviewAPI, vehicleAPI } from '../../api';
import { ReviewBusinessReply } from '../../components/ReviewShared';
import { Badge, Card, EmptyState, LoadingSpinner, StatusBadge } from '../../components/UI';
import PremiumCrownBadge from '../../components/PremiumCrownBadge';
import SuccessToast from '../../components/SuccessToast';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';
import { useAuth } from '../../context/AuthContext';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { emitAdminTabBarAction } from '../../utils/adminTabBarActionEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';
import {
  VehiclePromotionCard,
  getDiscountedPrice,
  getVehiclePromotion as getQuickViewPromotion,
} from '../../components/VehicleDetailsShared';
import { VehicleEditorForm } from './AddEditVehicleScreen';

const TABS = ['Overview', 'Vehicles', 'Users', 'Promotions', 'Bookings', 'Inquiries', 'Refunds', 'Reviews'];
const uri = (value) => !value || typeof value !== 'string' ? null : value.startsWith('http') ? value : `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
const imageUri = (user) => uri([user?.profileImage, user?.avatar, user?.image, user?.photo, user?.imageUrl, user?.avatarUrl].find(Boolean));
const initials = (name) => (String(name || 'Admin').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A');
const price = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;
const dateRange = (from, to) => [from, to].filter(Boolean).join(' -> ');
const DELETED_USER_DISPLAY_NAME = 'Deleted User';
const HIDDEN_EMAIL_LABEL = 'Email hidden';
const HIDDEN_PHONE_LABEL = 'Phone hidden';
const isMaskedDeletedEmail = (value) => /^deleted-user-[^@]+@deleted\.local$/i.test(String(value || '').trim());
const isDeletedUserRecord = (userLike) => Boolean(
  userLike
  && typeof userLike === 'object'
  && (
    userLike.isDeleted
    || String(userLike.fullName || '').trim() === DELETED_USER_DISPLAY_NAME
    || isMaskedDeletedEmail(userLike.email)
  )
);
const isMissingOrDeletedCustomer = (userLike) => (
  !userLike
  || (typeof userLike === 'object' && isDeletedUserRecord(userLike))
);
const getUserDisplayName = (userLike, fallback = 'Customer') => {
  if (isMissingOrDeletedCustomer(userLike)) {
    return DELETED_USER_DISPLAY_NAME;
  }

  if (typeof userLike !== 'object') {
    return fallback;
  }

  const composed = [userLike.firstName, userLike.lastName].filter(Boolean).join(' ').trim();
  return composed || userLike.fullName || userLike.email || fallback;
};
const getUserDisplayEmail = (userLike, fallback = HIDDEN_EMAIL_LABEL) => {
  if (!userLike || typeof userLike !== 'object' || isDeletedUserRecord(userLike) || isMaskedDeletedEmail(userLike.email)) {
    return fallback;
  }

  return userLike.email || fallback;
};
const getUserDisplayPhone = (userLike, fallback = HIDDEN_PHONE_LABEL) => {
  if (!userLike || typeof userLike !== 'object' || isDeletedUserRecord(userLike)) {
    return fallback;
  }

  return userLike.phone || userLike.contactNumber || fallback;
};
const getInquiryDisplayName = (inquiry) => (
  isMaskedDeletedEmail(inquiry?.email) || String(inquiry?.customerName || '').trim() === DELETED_USER_DISPLAY_NAME
    ? DELETED_USER_DISPLAY_NAME
    : inquiry?.customerName || 'Customer'
);
const getInquiryDisplayEmail = (inquiry) => (
  isMaskedDeletedEmail(inquiry?.email) ? HIDDEN_EMAIL_LABEL : inquiry?.email || HIDDEN_EMAIL_LABEL
);
const getInquiryDisplayPhone = (inquiry) => (
  String(inquiry?.phone || '').trim().toLowerCase() === 'deleted' ? HIDDEN_PHONE_LABEL : inquiry?.phone || HIDDEN_PHONE_LABEL
);
const getReviewCustomerName = (review) => getUserDisplayName(review?.userId, review?.customerName || 'Customer');
const getRefundCustomer = (refund) => refund?.user || refund?.booking?.user || null;
const getRefundCustomerName = (refund) => getUserDisplayName(getRefundCustomer(refund), 'Customer');
const formatNotificationTime = (value) => {
  const timestamp = new Date(value || Date.now()).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};
const getNotificationToneStyle = (tone) => {
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
      icon: 'tag-outline',
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
};
const getPromotionDiscountLabel = (promotion) => (
  promotion?.discountPercentage
    ? `${promotion.discountPercentage}% off`
    : promotion?.discountAmount
      ? `${price(promotion.discountAmount)} off`
      : 'Offer'
);
const getPromotionScopeText = (promotion) => {
  const scope = promotion?.targetScope?.kind || (promotion?.appliesToAllVehicles ? 'all' : '');
  if (scope === 'brand') return promotion?.targetScope?.brands?.join(', ') || promotion?.targetBrand || 'Brand';
  if (scope === 'model') return promotion?.targetScope?.models?.join(', ') || promotion?.targetModel || 'Model';
  if (scope === 'category') return promotion?.targetScope?.categories?.join(', ') || promotion?.targetCategory || 'Category';
  if (scope === 'vehicle') return `${promotion?.targetScope?.vehicleIds?.length || promotion?.targetVehicleIds?.length || 1} vehicle(s)`;
  return 'All sale vehicles';
};
const passwordRulesFor = (password) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /[0-9]/.test(password),
  symbol: /[^A-Za-z0-9]/.test(password),
});
const DASHBOARD_FILTER_OPTIONS = {
  Vehicles: [
    { key: 'ALL', label: 'All' },
    { key: 'SALE', label: 'Sale' },
    { key: 'RENT', label: 'Rent' },
  ],
  Users: [
    { key: 'ALL', label: 'All' },
    { key: 'BASIC', label: 'Basic' },
    { key: 'PREMIUM', label: 'Premium' },
    { key: 'MANAGERS', label: 'Managers' },
  ],
  Bookings: [
    { key: 'ALL', label: 'All' },
    { key: 'BASIC', label: 'Basic' },
    { key: 'PREMIUM', label: 'Premium' },
  ],
  Inquiries: [
    { key: 'ALL', label: 'All' },
    { key: 'BASIC', label: 'Basic' },
    { key: 'PREMIUM', label: 'Premium' },
  ],
  Refunds: [
    { key: 'ALL', label: 'All' },
    { key: 'BASIC', label: 'Basic' },
    { key: 'PREMIUM', label: 'Premium' },
  ],
  Reviews: [
    { key: 'ALL', label: 'All' },
    { key: 'POSITIVE', label: 'Positive' },
    { key: 'NEGATIVE', label: 'Negative' },
    { key: 'CRITICAL', label: 'Critical' },
  ],
};
const HARD_DELETE_TABS = [
  { key: 'USERS', label: 'Customers', icon: 'account' },
  { key: 'VEHICLES', label: 'Vehicles', icon: 'car-sports' },
  { key: 'BOOKINGS', label: 'Bookings', icon: 'calendar-check' },
  { key: 'INQUIRIES', label: 'Inquiries', icon: 'message-text-outline' },
  { key: 'REFUNDS', label: 'Refunds', icon: 'cash-refund' },
  { key: 'REVIEWS', label: 'Reviews', icon: 'star-outline' },
  { key: 'PROMOTIONS', label: 'Promotions', icon: 'tag-outline' },
];
const validateManagerEmail = (value) => {
  const email = String(value || '').trim();
  if (!email) return 'Email address is required.';
  if (!email.includes('@')) return 'Email must include "@".';
  return '';
};
const validateManagerPhone = (value) => {
  const phone = String(value || '').trim();
  if (!phone) return 'Phone number is required.';
  if (!/^\d{10}$/.test(phone)) return 'Phone number must be exactly 10 digits.';
  return '';
};
const validateManagerPassword = (value) => {
  if (!value) return 'Password is required.';
  if (!Object.values(passwordRulesFor(value)).every(Boolean)) {
    return 'Use 8+ chars with uppercase, lowercase, number, and symbol.';
  }
  return '';
};
const splitUserName = (account) => {
  if (isDeletedUserRecord(account)) {
    return { firstName: 'Deleted', lastName: 'User' };
  }

  const firstName = String(account?.firstName || '').trim();
  const lastName = String(account?.lastName || '').trim();

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const parts = String(account?.fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};
const formatUserAddress = (address) => [
  address?.houseNo,
  address?.lane,
  address?.city,
  address?.district,
  address?.province,
  address?.postalCode,
].filter(Boolean).join(', ');
const getReviewModerationStatus = (review) => {
  if (review?.adminDeleted) {
    return 'Deleted by Admin';
  }

  if (review?.isVisible === false) {
    return 'Hidden';
  }

  return 'Visible';
};
const getReviewPreviewMessage = (review) => String(review?.message || review?.comment || '').trim();

function SectionHeader({ title, subtitle, actionLabel, onActionPress }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {!!actionLabel && <TouchableOpacity style={styles.sectionAction} onPress={onActionPress} activeOpacity={0.88}><Text style={styles.sectionActionText}>{actionLabel}</Text></TouchableOpacity>}
    </View>
  );
}

function DashboardScroll({ children, refreshing, onRefresh, onScroll, scrollRef, filterMenuVisible = false, onEmptyPress }) {
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onStartShouldSetResponderCapture={(event) => Boolean(filterMenuVisible) && event.target === event.currentTarget}
      onResponderRelease={() => {
        if (filterMenuVisible && typeof onEmptyPress === 'function') {
          onEmptyPress();
        }
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
    >
      {children}
    </ScrollView>
  );
}

function MediaThumb({ sourceUri, fallbackText, icon, round = false }) {
  return sourceUri ? (
    <Image source={{ uri: sourceUri }} style={[styles.mediaThumb, round && styles.mediaThumbRound]} resizeMode="cover" />
  ) : (
    <View style={[styles.mediaThumb, styles.mediaThumbFallback, round && styles.mediaThumbRound]}>
      {fallbackText ? (
        <Text style={styles.mediaThumbText}>{String(fallbackText).slice(0, 2).toUpperCase()}</Text>
      ) : (
        <MaterialCommunityIcons name={icon} size={18} color="#9ca3af" />
      )}
    </View>
  );
}

function UserInfoRow({ label, value, hideBorder = false }) {
  return (
    <View style={[styles.userInfoRow, hideBorder && styles.userInfoRowLast]}>
      <Text style={styles.userInfoLabel}>{label}</Text>
      <Text style={styles.userInfoValue}>{value || 'Not provided'}</Text>
    </View>
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

function HardDeleteTypeButton({ icon, label, active = false, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.hardDeleteTypeButton, active && styles.hardDeleteTypeButtonActive]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={active ? '#ffffff' : '#334155'}
      />
      <Text style={[styles.hardDeleteTypeButtonText, active && styles.hardDeleteTypeButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HardDeleteRecordRow({ item, loading = false, onDelete }) {
  return (
    <View style={styles.hardDeleteRecordRow}>
      <View style={styles.hardDeleteRecordTop}>
        <View style={styles.hardDeleteRecordIconWrap}>
          <MaterialCommunityIcons name={item.icon} size={18} color="#b91c1c" />
        </View>
        <View style={styles.hardDeleteRecordCopy}>
          <View style={styles.hardDeleteRecordTitleRow}>
            <Text style={styles.hardDeleteRecordTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.badgeLabel ? (
              <View style={styles.hardDeleteRecordBadge}>
                <Text style={styles.hardDeleteRecordBadgeText}>{item.badgeLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.hardDeleteRecordSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
          {item.helperText ? (
            <Text style={styles.hardDeleteRecordHelper} numberOfLines={2}>
              {item.helperText}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.hardDeleteRecordAction, loading && styles.hardDeleteRecordActionDisabled]}
        onPress={onDelete}
        activeOpacity={0.88}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <MaterialCommunityIcons name="delete-forever" size={16} color="#ffffff" />
            <Text style={styles.hardDeleteRecordActionText}>Hard Delete</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function AdminNotificationCard({ item, onPress }) {
  const tone = getNotificationToneStyle(item?.tone);
  const itemImageUri = uri(item?.image);

  return (
    <TouchableOpacity style={styles.adminNotificationCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.adminNotificationAccent, { backgroundColor: tone.accent }]} />
      {itemImageUri ? (
        <Image source={{ uri: itemImageUri }} style={styles.adminNotificationImage} resizeMode="cover" />
      ) : (
        <View style={[styles.adminNotificationImage, styles.adminNotificationImageFallback]}>
          <MaterialCommunityIcons name={tone.icon} size={18} color={tone.accent} />
        </View>
      )}
      <View style={styles.adminNotificationCopy}>
        <View style={styles.adminNotificationMetaRow}>
          <Text style={styles.adminNotificationTitle} numberOfLines={1}>{item?.title}</Text>
          <Text style={styles.adminNotificationTime}>{formatNotificationTime(item?.createdAt)}</Text>
        </View>
        <Text style={styles.adminNotificationMessage} numberOfLines={2}>{item?.message}</Text>
        <View style={styles.adminNotificationFooter}>
          <View style={styles.adminNotificationActorBadge}>
            <Text style={styles.adminNotificationActorText} numberOfLines={1}>{item?.actorName || 'Wheelzy User'}</Text>
          </View>
          {item?.tone ? (
            <View style={[styles.adminNotificationToneBadge, { backgroundColor: tone.badgeBackground }]}>
              <Text style={[styles.adminNotificationToneText, { color: tone.badgeText }]}>{item.tone}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FilterableSectionHeader({
  title,
  subtitle,
  selectedFilterKey,
  filterLabel,
  onFilterPress,
  filterMenuVisible,
  filterOptions,
  onSelectFilter,
  filterOpacity,
  filterScale,
  filterTranslateY,
}) {
  return (
    <View style={styles.dashboardFilterWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
        <TouchableOpacity style={styles.dashboardFilterButton} onPress={onFilterPress} activeOpacity={0.88}>
          <MaterialCommunityIcons name="tune-variant" size={16} color="#111111" />
          <Text style={styles.dashboardFilterButtonText}>{filterLabel}</Text>
        </TouchableOpacity>
      </View>
      {filterMenuVisible ? (
        <Animated.View
          style={[
            styles.dashboardFilterMenu,
            {
              opacity: filterOpacity,
              transform: [{ translateY: filterTranslateY }, { scale: filterScale }],
            },
          ]}
        >
          {filterOptions.map((option) => {
            const isActive = option.key === selectedFilterKey;

            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.dashboardFilterMenuItem, isActive && styles.dashboardFilterMenuItemActive]}
                onPress={() => onSelectFilter(option.key)}
                activeOpacity={0.88}
              >
                <Text style={[styles.dashboardFilterMenuItemText, isActive && styles.dashboardFilterMenuItemTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { user } = useAuth();
  const lastScrollOffset = useRef(0);
  const overviewScrollRef = useRef(null);
  const overviewScrollOffsetRef = useRef(0);
  const restoreOverviewScrollRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefundToast, setShowRefundToast] = useState(false);
  const [refundToastMessage, setRefundToastMessage] = useState('');
  const [showVehicleToast, setShowVehicleToast] = useState(false);
  const [vehicleToastMessage, setVehicleToastMessage] = useState('');
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [notificationPopupVisible, setNotificationPopupVisible] = useState(false);
  const [promotionDetailVisible, setPromotionDetailVisible] = useState(false);
  const [selectedPromotionDetail, setSelectedPromotionDetail] = useState(null);
  const [managerModalVisible, setManagerModalVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [vehicleQuickViewVisible, setVehicleQuickViewVisible] = useState(false);
  const [vehicleDeleteVisible, setVehicleDeleteVisible] = useState(false);
  const [userQuickViewVisible, setUserQuickViewVisible] = useState(false);
  const [managerRemoveVisible, setManagerRemoveVisible] = useState(false);
  const [userDeleteVisible, setUserDeleteVisible] = useState(false);
  const [bookingSlipVisible, setBookingSlipVisible] = useState(false);
  const [bookingDetailVisible, setBookingDetailVisible] = useState(false);
  const [vehicleModalMode, setVehicleModalMode] = useState('add');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedQuickViewVehicle, setSelectedQuickViewVehicle] = useState(null);
  const [selectedVehicleToDelete, setSelectedVehicleToDelete] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedManagerToRemove, setSelectedManagerToRemove] = useState(null);
  const [selectedUserToDelete, setSelectedUserToDelete] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [selectedBookingToDelete, setSelectedBookingToDelete] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedInquiryDetail, setSelectedInquiryDetail] = useState(null);
  const [selectedInquiryToDelete, setSelectedInquiryToDelete] = useState(null);
  const [selectedRefundDetail, setSelectedRefundDetail] = useState(null);
  const [selectedRefundToDelete, setSelectedRefundToDelete] = useState(null);
  const [reviewDetailVisible, setReviewDetailVisible] = useState(false);
  const [inquiryDetailVisible, setInquiryDetailVisible] = useState(false);
  const [refundDetailVisible, setRefundDetailVisible] = useState(false);
  const [bookingDeleteVisible, setBookingDeleteVisible] = useState(false);
  const [inquiryDeleteVisible, setInquiryDeleteVisible] = useState(false);
  const [refundDeleteVisible, setRefundDeleteVisible] = useState(false);
  const [managerModalMode, setManagerModalMode] = useState('create');
  const [managerSubmitting, setManagerSubmitting] = useState(false);
  const [managerForm, setManagerForm] = useState({ id: null, fullName: '', email: '', contactNumber: '', password: '' });
  const [managerError, setManagerError] = useState('');
  const [managerPasswordVisible, setManagerPasswordVisible] = useState(false);
  const [reviewDeleteModalVisible, setReviewDeleteModalVisible] = useState(false);
  const [reviewReplyModalVisible, setReviewReplyModalVisible] = useState(false);
  const [reviewDeleteReason, setReviewDeleteReason] = useState('');
  const [reviewReplyMessage, setReviewReplyMessage] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [vehicleDeleteLoading, setVehicleDeleteLoading] = useState(false);
  const [managerRemoveLoading, setManagerRemoveLoading] = useState(false);
  const [userDeleteLoading, setUserDeleteLoading] = useState(false);
  const [userDeletePreviewLoading, setUserDeletePreviewLoading] = useState(false);
  const [userDeletePreview, setUserDeletePreview] = useState(null);
  const [bookingDeleteLoading, setBookingDeleteLoading] = useState(false);
  const [inquiryDeleteLoading, setInquiryDeleteLoading] = useState(false);
  const [refundDeleteLoading, setRefundDeleteLoading] = useState(false);
  const [hardDeleteGateVisible, setHardDeleteGateVisible] = useState(false);
  const [hardDeleteUnlocked, setHardDeleteUnlocked] = useState(false);
  const [hardDeletePassword, setHardDeletePassword] = useState('');
  const [hardDeletePasswordError, setHardDeletePasswordError] = useState('');
  const [hardDeletePasswordVisible, setHardDeletePasswordVisible] = useState(false);
  const [hardDeleteUnlockLoading, setHardDeleteUnlockLoading] = useState(false);
  const [hardDeleteTab, setHardDeleteTab] = useState('USERS');
  const [hardDeleteSearch, setHardDeleteSearch] = useState('');
  const [hardDeleteSubmittingId, setHardDeleteSubmittingId] = useState('');
  const [dashboardFilters, setDashboardFilters] = useState({
    Vehicles: 'ALL',
    Users: 'ALL',
    Bookings: 'ALL',
    Inquiries: 'ALL',
    Refunds: 'ALL',
    Reviews: 'ALL',
  });
  const [openFilterTab, setOpenFilterTab] = useState(null);
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const tabTranslateY = useRef(new Animated.Value(0)).current;
  const tabScale = useRef(new Animated.Value(1)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;
  const filterScale = useRef(new Animated.Value(0.94)).current;
  const filterTranslateY = useRef(new Animated.Value(-8)).current;
  const notificationToastTimeoutRef = useRef(null);
  const transitionStyle = useCustomerTabPageTransition(route.params?.tabTransitionAt, route.params?.tabTransitionAnchor);

  const load = useCallback(async () => {
    try {
      const [statsRes, bookingsRes, vehiclesRes, usersRes, reviewsRes, refundsRes, inquiriesRes, promotionsRes, notificationsRes] = await Promise.allSettled([
        adminAPI.getStats(), bookingAPI.getAll(), vehicleAPI.getAll(), authAPI.getUsers(), reviewAPI.adminList(), refundAPI.getAll(), inquiryAPI.getAll(), promotionAPI.getAll(), adminAPI.getNotifications(),
      ]);
      setStats(statsRes.status === 'fulfilled' ? statsRes.value.data || null : null);
      setBookings(bookingsRes.status === 'fulfilled' ? bookingsRes.value.data || [] : []);
      setVehicles(vehiclesRes.status === 'fulfilled' ? vehiclesRes.value.data || [] : []);
      setUsers(usersRes.status === 'fulfilled' ? usersRes.value.data || [] : []);
      setReviews(reviewsRes.status === 'fulfilled' ? reviewsRes.value.data || [] : []);
      setRefunds(refundsRes.status === 'fulfilled' ? refundsRes.value.data || [] : []);
      setInquiries(inquiriesRes.status === 'fulfilled' ? inquiriesRes.value.data || [] : []);
      setPromotions(promotionsRes.status === 'fulfilled' ? promotionsRes.value.data || [] : []);
      setNotifications(notificationsRes.status === 'fulfilled' ? notificationsRes.value.data || [] : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load().finally(() => { hasLoadedOnceRef.current = true; }); }, [load]);
  useFocusEffect(useCallback(() => { if (hasLoadedOnceRef.current) load(); }, [load]));
  useEffect(() => { emitCustomerTabBarVisibility(true); }, []);
  useEffect(() => {
    if (route.params?.resetToOverviewAt) {
      restoreOverviewScrollRef.current = false;
      overviewScrollOffsetRef.current = 0;
      setActiveTab('Overview');
    }
  }, [route.params?.resetToOverviewAt]);
  useEffect(() => {
    if (route.params?.initialTab && TABS.includes(route.params.initialTab)) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);
  useEffect(() => {
    if (!route.params?.refundToastAt) {
      return undefined;
    }

    setRefundToastMessage(route.params?.refundToastMessage || 'Refund completed successfully');
    setShowRefundToast(true);

    const timer = setTimeout(() => {
      setShowRefundToast(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [route.params?.refundToastAt, route.params?.refundToastMessage]);
  useEffect(() => {
    if (!showRefundToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowRefundToast(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [showRefundToast]);
  useEffect(() => {
    if (!showVehicleToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowVehicleToast(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [showVehicleToast]);
  useEffect(() => {
    if (activeTab !== 'Overview' || !restoreOverviewScrollRef.current) {
      return undefined;
    }

    const timer = setTimeout(() => {
      overviewScrollRef.current?.scrollTo?.({
        y: overviewScrollOffsetRef.current,
        animated: false,
      });
      restoreOverviewScrollRef.current = false;
    }, 0);

    return () => clearTimeout(timer);
  }, [activeTab]);
  useEffect(() => {
    tabOpacity.setValue(0);
    tabTranslateY.setValue(20);
    tabScale.setValue(0.985);

    Animated.parallel([
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(tabTranslateY, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.spring(tabScale, {
        toValue: 1,
        tension: 52,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, tabOpacity, tabScale, tabTranslateY]);
  useEffect(() => {
    setOpenFilterTab(null);
    filterOpacity.setValue(0);
    filterScale.setValue(0.94);
    filterTranslateY.setValue(-8);
  }, [activeTab, filterOpacity, filterScale, filterTranslateY]);

  const edgeSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          activeTab !== 'Overview' && event.nativeEvent.pageX <= 28,
        onMoveShouldSetPanResponder: (event, gestureState) =>
          activeTab !== 'Overview'
          && event.nativeEvent.pageX <= 36
          && gestureState.dx > 12
          && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderRelease: (_, gestureState) => {
          if (activeTab !== 'Overview' && gestureState.dx > 70) {
            goToTab('Overview');
          }
        },
      }),
    [activeTab, goToTab],
  );

  const onScroll = (event) => {
    const current = event.nativeEvent.contentOffset.y;
    if (current <= 8) emitCustomerTabBarVisibility(true);
    else if (current > lastScrollOffset.current + 8) emitCustomerTabBarVisibility(false);
    else if (current < lastScrollOffset.current - 8) emitCustomerTabBarVisibility(true);
    lastScrollOffset.current = current;
  };
  const onOverviewScroll = (event) => {
    overviewScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    onScroll(event);
  };
  const goToTab = useCallback((tab, options = {}) => {
    if (tab !== 'Overview' && activeTab === 'Overview') {
      restoreOverviewScrollRef.current = options.preserveOverviewScroll !== false;
    }

    if (tab === 'Overview' && options.restoreOverviewScroll === false) {
      restoreOverviewScrollRef.current = false;
      overviewScrollOffsetRef.current = 0;
    }

    setActiveTab(tab);
  }, [activeTab]);

  const refresh = () => { setRefreshing(true); load(); };
  const closeUserQuickView = useCallback(() => {
    setUserQuickViewVisible(false);
    setSelectedUser(null);
  }, []);
  const openUserQuickView = useCallback((account) => {
    setSelectedUser(account);
    setUserQuickViewVisible(true);
  }, []);
  const closeManagerRemoveModal = useCallback(() => {
    if (managerRemoveLoading) {
      return;
    }

    setManagerRemoveVisible(false);
    setSelectedManagerToRemove(null);
  }, [managerRemoveLoading]);
  const openManagerRemoveModal = useCallback((manager) => {
    if (!manager?._id) {
      return;
    }

    setSelectedManagerToRemove(manager);
    setManagerRemoveVisible(true);
  }, []);
  const closeUserDeleteModal = useCallback(() => {
    if (userDeleteLoading) {
      return;
    }

    setUserDeleteVisible(false);
    setSelectedUserToDelete(null);
    setUserDeletePreview(null);
    setUserDeletePreviewLoading(false);
  }, [userDeleteLoading]);
  const openUserDeleteModal = useCallback((account) => {
    if (!account?._id) {
      return;
    }

    setSelectedUserToDelete(account);
    setUserDeletePreview(null);
    setUserDeleteVisible(true);
    setUserDeletePreviewLoading(true);

    authAPI.getDeleteUserPreview(account._id)
      .then((response) => {
        setUserDeletePreview(response?.data || null);
      })
      .catch((error) => {
        const message = error?.response?.data?.message || 'Unable to check whether this account can be deleted right now.';
        setUserDeletePreview({ allowed: false, message });
      })
      .finally(() => {
        setUserDeletePreviewLoading(false);
      });
  }, []);
  const closeBookingSlip = useCallback(() => {
    setBookingSlipVisible(false);
    setSelectedBooking(null);
  }, []);
  const closeBookingDetail = useCallback(() => {
    setBookingDetailVisible(false);
    setSelectedBookingDetail(null);
  }, []);
  const closeBookingDelete = useCallback(() => {
    setBookingDeleteVisible(false);
    setSelectedBookingToDelete(null);
    setBookingDeleteLoading(false);
  }, []);
  const closeInquiryDetail = useCallback(() => {
    setInquiryDetailVisible(false);
    setSelectedInquiryDetail(null);
  }, []);
  const closeInquiryDelete = useCallback(() => {
    setInquiryDeleteVisible(false);
    setSelectedInquiryToDelete(null);
    setInquiryDeleteLoading(false);
  }, []);
  const closeRefundDetail = useCallback(() => {
    setRefundDetailVisible(false);
    setSelectedRefundDetail(null);
  }, []);
  const closeRefundDelete = useCallback(() => {
    setRefundDeleteVisible(false);
    setSelectedRefundToDelete(null);
    setRefundDeleteLoading(false);
  }, []);
  const openBookingDetail = useCallback((booking) => {
    if (!booking?._id) {
      return;
    }

    setSelectedBookingDetail(booking);
    setBookingDetailVisible(true);
  }, []);
  const openBookingDelete = useCallback((booking) => {
    if (!booking?._id) {
      return;
    }
    setSelectedBookingToDelete(booking);
    setBookingDeleteVisible(true);
  }, []);
  const openInquiryDetail = useCallback((inquiry) => {
    if (!inquiry?._id) {
      return;
    }

    setSelectedInquiryDetail(inquiry);
    setInquiryDetailVisible(true);
  }, []);
  const openInquiryDelete = useCallback((inquiry) => {
    if (!inquiry?._id) {
      return;
    }
    setSelectedInquiryToDelete(inquiry);
    setInquiryDeleteVisible(true);
  }, []);
  const openRefundDetail = useCallback((refund) => {
    if (!refund?._id) {
      return;
    }

    setSelectedRefundDetail(refund);
    setRefundDetailVisible(true);
  }, []);
  const openRefundDelete = useCallback((refund) => {
    if (!refund?._id) {
      return;
    }
    setSelectedRefundToDelete(refund);
    setRefundDeleteVisible(true);
  }, []);
  const openBookingSlip = useCallback(async (booking) => {
    setSelectedBooking(booking);
    setBookingSlipVisible(true);

    if (!booking?._id || booking?.paymentSlipViewedAt || !booking?.paymentSlipUrl) {
      return;
    }

    try {
      const response = await bookingAPI.markSlipViewed(booking._id);
      const updatedBooking = response?.data;
      if (updatedBooking?._id) {
        setSelectedBooking(updatedBooking);
        setBookings((current) => current.map((item) => (
          String(item._id) === String(updatedBooking._id) ? updatedBooking : item
        )));
      }
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to mark the payment slip as viewed.', undefined, { tone: 'danger' });
    }
  }, [showAlert]);
  const profileUri = imageUri(user);
  const pendingBookings = useMemo(() => bookings.filter((item) => item.status === 'Pending'), [bookings]);
  const approvedBookings = useMemo(() => bookings.filter((item) => item.status === 'Approved'), [bookings]);
  const pendingInquiries = useMemo(() => inquiries.filter((item) => item.status === 'Pending'), [inquiries]);
  const pendingRefunds = useMemo(
    () => refunds.filter((item) => ['Refund Requested', 'Refund Processing'].includes(item.status)),
    [refunds],
  );
  const newRefundRequests = useMemo(
    () => refunds.filter((item) => item.status === 'Refund Requested' && !item.adminViewedAt),
    [refunds],
  );
  const flaggedReviews = useMemo(() => reviews.filter((item) => item.requiresAdminAttention && item.adminAttentionStatus === 'Pending'), [reviews]);
  const marketingManagers = useMemo(() => users.filter((item) => item.role === 'MARKETING_MANAGER'), [users]);
  const customerAccounts = useMemo(() => users.filter((item) => item.role === 'CUSTOMER'), [users]);
  const latestVehicles = useMemo(() => [...vehicles].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [vehicles]);
  const latestBookings = useMemo(() => [...bookings].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [bookings]);
  const activeCustomerAccounts = useMemo(() => customerAccounts.filter((item) => !isDeletedUserRecord(item)), [customerAccounts]);
  const latestCustomerRegistrations = useMemo(() => [...activeCustomerAccounts].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5), [activeCustomerAccounts]);
  const hardDeleteCatalog = useMemo(() => ({
    USERS: [...customerAccounts]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((account) => ({
        id: String(account._id),
        type: 'USERS',
        icon: 'account',
        title: getUserDisplayName(account),
        subtitle: getUserDisplayEmail(account, 'No email address'),
        helperText: [
          isDeletedUserRecord(account) ? 'Deleted account' : account.isPremium ? 'Premium account' : 'Basic account',
          getUserDisplayPhone(account, ''),
        ].filter(Boolean).join(' · '),
        badgeLabel: isDeletedUserRecord(account) ? 'Deleted' : 'Customer',
        searchText: [
          getUserDisplayName(account),
          getUserDisplayEmail(account, ''),
          getUserDisplayPhone(account, ''),
          account.fullName,
          account.email,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
    VEHICLES: [...vehicles]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((vehicle) => ({
        id: String(vehicle._id),
        type: 'VEHICLES',
        icon: 'car-sports',
        title: [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehicle',
        subtitle: [vehicle.listingType, vehicle.status, vehicle.manufactureYear].filter(Boolean).join(' · '),
        helperText: [price(vehicle.price), vehicle.vehicleCondition, vehicle.category].filter(Boolean).join(' · '),
        badgeLabel: vehicle.listingType || 'Vehicle',
        searchText: [
          vehicle.brand,
          vehicle.model,
          vehicle.listingType,
          vehicle.status,
          vehicle.category,
          vehicle.manufactureYear,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
    BOOKINGS: [...bookings]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((booking) => ({
        id: String(booking._id),
        type: 'BOOKINGS',
        icon: 'calendar-check',
        title: [booking?.vehicle?.brand, booking?.vehicle?.model].filter(Boolean).join(' ') || 'Booking',
        subtitle: [getUserDisplayName(booking?.user), dateRange(booking?.startDate, booking?.endDate)].filter(Boolean).join(' · '),
        helperText: [booking.status, price(booking.totalAmount || booking.price || 0)].filter(Boolean).join(' · '),
        badgeLabel: booking.status || 'Booking',
        searchText: [
          getUserDisplayName(booking?.user),
          getUserDisplayEmail(booking?.user, ''),
          booking?.vehicle?.brand,
          booking?.vehicle?.model,
          booking?.status,
          booking?.startDate,
          booking?.endDate,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
    INQUIRIES: [...inquiries]
      .sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0))
      .map((inquiry) => ({
        id: String(inquiry._id),
        type: 'INQUIRIES',
        icon: 'message-text-outline',
        title: getInquiryDisplayName(inquiry) || getInquiryDisplayEmail(inquiry) || 'Inquiry',
        subtitle: [[inquiry?.vehicleId?.brand, inquiry?.vehicleId?.model].filter(Boolean).join(' '), inquiry.status].filter(Boolean).join(' · '),
        helperText: inquiry.inquiryType || inquiry.message || inquiry.customMessage || 'Customer inquiry',
        badgeLabel: inquiry.status || 'Inquiry',
        searchText: [
          getInquiryDisplayName(inquiry),
          getInquiryDisplayEmail(inquiry),
          getInquiryDisplayPhone(inquiry),
          inquiry.inquiryType,
          inquiry.message,
          inquiry.customMessage,
          inquiry?.vehicleId?.brand,
          inquiry?.vehicleId?.model,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
    REFUNDS: [...refunds]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((refund) => ({
        id: String(refund._id),
        type: 'REFUNDS',
        icon: 'cash-refund',
        title: [refund?.booking?.vehicle?.brand, refund?.booking?.vehicle?.model].filter(Boolean).join(' ') || 'Refund',
        subtitle: [getRefundCustomerName(refund), refund.status].filter(Boolean).join(' · '),
        helperText: [price(refund.amount || 0), refund.reason].filter(Boolean).join(' · '),
        badgeLabel: refund.status || 'Refund',
        searchText: [
          getRefundCustomerName(refund),
          getUserDisplayEmail(getRefundCustomer(refund), ''),
          refund?.booking?.vehicle?.brand,
          refund?.booking?.vehicle?.model,
          refund.status,
          refund.reason,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
    REVIEWS: [...reviews]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((review) => ({
        id: String(review._id),
        type: 'REVIEWS',
        icon: 'star-outline',
        title: [review?.vehicleId?.brand, review?.vehicleId?.model].filter(Boolean).join(' ') || 'Review',
        subtitle: [getReviewCustomerName(review), review?.rating ? `${review.rating}/5` : 'No rating'].filter(Boolean).join(' · '),
        helperText: getReviewPreviewMessage(review) || 'Customer review',
        badgeLabel: getReviewModerationStatus(review),
        searchText: [
          getReviewCustomerName(review),
          getUserDisplayEmail(review?.userId, ''),
          review?.vehicleId?.brand,
          review?.vehicleId?.model,
          review?.message,
          review?.comment,
          review?.rating,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
    PROMOTIONS: [...promotions]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((promotion) => ({
        id: String(promotion._id),
        type: 'PROMOTIONS',
        icon: 'tag-outline',
        title: promotion.title || 'Promotion',
        subtitle: [getPromotionScopeText(promotion), promotion.status].filter(Boolean).join(' · '),
        helperText: [getPromotionDiscountLabel(promotion), dateRange(promotion.startDate, promotion.endDate)].filter(Boolean).join(' · '),
        badgeLabel: promotion.status || 'Promotion',
        searchText: [
          promotion.title,
          promotion.description,
          promotion.status,
          promotion.targetBrand,
          promotion.targetModel,
          promotion.targetCategory,
        ].filter(Boolean).join(' ').toLowerCase(),
      })),
  }), [bookings, customerAccounts, inquiries, promotions, refunds, reviews, vehicles]);
  const visibleHardDeleteItems = useMemo(() => {
    const items = hardDeleteCatalog[hardDeleteTab] || [];
    const query = String(hardDeleteSearch || '').trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) => item.searchText.includes(query));
  }, [hardDeleteCatalog, hardDeleteSearch, hardDeleteTab]);
  const notificationCount = notifications.length;
  const promotionNotifications = useMemo(
    () => notifications.filter((item) => item?.type === 'promotion'),
    [notifications],
  );
  const featuredPromotions = useMemo(
    () => promotions.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8),
    [promotions],
  );
  const shouldCenterPromotionCards = featuredPromotions.length > 0 && featuredPromotions.length <= 2;
  useEffect(() => {
    if (activeTab !== 'Refunds' || !newRefundRequests.length) {
      return;
    }

    const viewedAt = new Date().toISOString();
    setRefunds((current) => current.map((item) => (
      item.status === 'Refund Requested' && !item.adminViewedAt
        ? { ...item, adminViewedAt: viewedAt }
        : item
    )));

    refundAPI.markViewed().catch(() => {
      load();
    });
  }, [activeTab, load, newRefundRequests.length]);
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
      }, 2200);
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
  const selectedUserNameParts = useMemo(() => splitUserName(selectedUser), [selectedUser]);
  const selectedUserAddress = useMemo(
    () => (isDeletedUserRecord(selectedUser) ? 'Removed after account deletion' : formatUserAddress(selectedUser?.address)),
    [selectedUser],
  );
  const selectedQuickViewImages = useMemo(
    () => [selectedQuickViewVehicle?.image1, selectedQuickViewVehicle?.image2, selectedQuickViewVehicle?.image3, selectedQuickViewVehicle?.image4, selectedQuickViewVehicle?.image5]
      .filter(Boolean)
      .map((item) => uri(item))
      .filter(Boolean),
    [selectedQuickViewVehicle],
  );
  const selectedQuickViewPromotion = useMemo(
    () => getQuickViewPromotion(selectedQuickViewVehicle, promotions),
    [promotions, selectedQuickViewVehicle],
  );
  const selectedQuickViewFinalPrice = useMemo(() => {
    if (!selectedQuickViewVehicle) {
      return 0;
    }

    return selectedQuickViewPromotion
      ? getDiscountedPrice(selectedQuickViewVehicle, selectedQuickViewPromotion)
      : selectedQuickViewVehicle?.price;
  }, [selectedQuickViewPromotion, selectedQuickViewVehicle]);
  const resolveVehicleThumb = useCallback((vehicleLike) => {
    if (!vehicleLike) return null;
    if (typeof vehicleLike === 'object' && vehicleLike.image1) return uri(vehicleLike.image1);
    const vehicleId = typeof vehicleLike === 'object'
      ? vehicleLike._id || vehicleLike.vehicleId || vehicleLike.vehicle
      : vehicleLike;
    const match = vehicles.find((item) => String(item._id) === String(vehicleId));
    return uri(match?.image1);
  }, [vehicles]);
  const selectedVehicleDeleteImage = useMemo(
    () => uri([
      selectedVehicleToDelete?.image1,
      selectedVehicleToDelete?.image2,
      selectedVehicleToDelete?.image3,
      selectedVehicleToDelete?.image4,
      selectedVehicleToDelete?.image5,
    ].find(Boolean)),
    [selectedVehicleToDelete],
  );
  const resolveUserThumb = useCallback((userLike, email) => {
    if (userLike && typeof userLike === 'object') {
      if (isDeletedUserRecord(userLike)) {
        return null;
      }

      const direct = imageUri(userLike);
      if (direct) return direct;
    }

    const userId = userLike && typeof userLike === 'object'
      ? userLike._id || userLike.userId
      : userLike;

    if (userId) {
      const idMatch = users.find((item) => String(item._id) === String(userId));
      const direct = isDeletedUserRecord(idMatch) ? null : imageUri(idMatch);
      if (direct) return direct;
    }

    if (email) {
      const emailMatch = users.find((item) => String(item.email || '').toLowerCase() === String(email).toLowerCase());
      return isDeletedUserRecord(emailMatch) ? null : imageUri(emailMatch);
    }

    return null;
  }, [users]);
  const resolveUserPremium = useCallback((userLike, email) => {
    if (userLike && typeof userLike === 'object' && isDeletedUserRecord(userLike)) {
      return false;
    }

    if (userLike && typeof userLike === 'object' && typeof userLike.isPremium === 'boolean') {
      return Boolean(userLike.isPremium);
    }

    const userId = userLike && typeof userLike === 'object'
      ? userLike._id || userLike.userId
      : userLike;

    if (userId) {
      const idMatch = users.find((item) => String(item._id) === String(userId));
      if (idMatch) {
        if (isDeletedUserRecord(idMatch)) {
          return false;
        }

        return Boolean(idMatch.isPremium);
      }
    }

    if (email) {
      const emailMatch = users.find((item) => String(item.email || '').toLowerCase() === String(email).toLowerCase());
      if (emailMatch) {
        if (isDeletedUserRecord(emailMatch)) {
          return false;
        }

        return Boolean(emailMatch.isPremium);
      }
    }

    return false;
  }, [users]);
  const matchesTierFilter = useCallback((value, filterKey) => {
    if (filterKey === 'ALL') {
      return true;
    }

    if (filterKey === 'PREMIUM') {
      return Boolean(value);
    }

    if (filterKey === 'BASIC') {
      return !value;
    }

    return true;
  }, []);
  const getReviewFilterKey = useCallback((review) => {
    const rating = Number(review?.rating || 0);

    if (review?.requiresAdminAttention || rating <= 1) {
      return 'CRITICAL';
    }

    if (rating >= 4) {
      return 'POSITIVE';
    }

    return 'NEGATIVE';
  }, []);
  const openDashboardFilter = useCallback((tabKey) => {
    setOpenFilterTab(tabKey);
    filterOpacity.setValue(0);
    filterScale.setValue(0.94);
    filterTranslateY.setValue(-8);

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
  const closeDashboardFilter = useCallback(() => {
    if (!openFilterTab) {
      return;
    }

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
        setOpenFilterTab(null);
      }
    });
  }, [filterOpacity, filterScale, filterTranslateY, openFilterTab]);
  const toggleDashboardFilter = useCallback((tabKey) => {
    if (openFilterTab === tabKey) {
      closeDashboardFilter();
      return;
    }

    openDashboardFilter(tabKey);
  }, [closeDashboardFilter, openDashboardFilter, openFilterTab]);
  const selectDashboardFilter = useCallback((tabKey, nextFilter) => {
    setDashboardFilters((current) => ({
      ...current,
      [tabKey]: nextFilter,
    }));
    closeDashboardFilter();
  }, [closeDashboardFilter]);
  const getFilterLabel = useCallback((tabKey) => {
    const option = DASHBOARD_FILTER_OPTIONS[tabKey]?.find((item) => item.key === dashboardFilters[tabKey]);
    return option?.label || 'All';
  }, [dashboardFilters]);
  const filteredVehicles = useMemo(() => {
    if (dashboardFilters.Vehicles === 'SALE') {
      return vehicles.filter((item) => item.listingType === 'Sale');
    }

    if (dashboardFilters.Vehicles === 'RENT') {
      return vehicles.filter((item) => item.listingType === 'Rent');
    }

    return vehicles;
  }, [dashboardFilters.Vehicles, vehicles]);
  const filteredMarketingManagers = useMemo(() => {
    if (dashboardFilters.Users === 'BASIC' || dashboardFilters.Users === 'PREMIUM') {
      return [];
    }

    if (dashboardFilters.Users === 'MANAGERS') {
      return marketingManagers;
    }

    return marketingManagers;
  }, [dashboardFilters.Users, marketingManagers]);
  const filteredCustomerAccounts = useMemo(
    () => {
      if (dashboardFilters.Users === 'MANAGERS') {
        return [];
      }

      return customerAccounts.filter((item) => {
        if (isDeletedUserRecord(item)) {
          return dashboardFilters.Users === 'ALL';
        }

        return matchesTierFilter(item?.isPremium, dashboardFilters.Users);
      });
    },
    [customerAccounts, dashboardFilters.Users, matchesTierFilter],
  );
  const filteredBookings = useMemo(
    () => bookings.filter((item) => (
      isMissingOrDeletedCustomer(item?.user)
        ? dashboardFilters.Bookings === 'ALL'
        : matchesTierFilter(resolveUserPremium(item?.user), dashboardFilters.Bookings)
    )),
    [bookings, dashboardFilters.Bookings, matchesTierFilter, resolveUserPremium],
  );
  const filteredInquiries = useMemo(
    () => inquiries.filter((item) => (
      isMaskedDeletedEmail(item?.email)
        ? dashboardFilters.Inquiries === 'ALL'
        : matchesTierFilter(resolveUserPremium(null, item?.email), dashboardFilters.Inquiries)
    )),
    [dashboardFilters.Inquiries, inquiries, matchesTierFilter, resolveUserPremium],
  );
  const filteredRefunds = useMemo(
    () => refunds.filter((item) => {
      const customer = getRefundCustomer(item);
      return isMissingOrDeletedCustomer(customer)
        ? dashboardFilters.Refunds === 'ALL'
        : matchesTierFilter(resolveUserPremium(customer), dashboardFilters.Refunds);
    }),
    [dashboardFilters.Refunds, matchesTierFilter, refunds, resolveUserPremium],
  );
  const filteredReviews = useMemo(() => {
    const selectedFilter = dashboardFilters.Reviews;
    if (selectedFilter === 'ALL') {
      return reviews;
    }

    return reviews.filter((item) => getReviewFilterKey(item) === selectedFilter);
  }, [dashboardFilters.Reviews, getReviewFilterKey, reviews]);
  const chartSeries = useMemo(() => ([
    { label: 'Vehicles', value: stats?.totalVehicles ?? vehicles.length, color: '#111111' },
    { label: 'Users', value: stats?.totalUsers ?? users.length, color: '#2563eb' },
    { label: 'Bookings', value: bookings.length, color: '#16a34a' },
    { label: 'Reviews', value: reviews.length, color: '#f59e0b' },
    { label: 'Refunds', value: refunds.length, color: '#7c3aed' },
    { label: 'Inquiries', value: inquiries.length, color: '#f59e0b' },
  ]), [bookings.length, inquiries.length, refunds.length, reviews.length, stats?.totalUsers, stats?.totalVehicles, users.length, vehicles.length]);
  const maxChartValue = useMemo(() => Math.max(...chartSeries.map((item) => item.value), 1), [chartSeries]);
  const ringTotal = pendingBookings.length + pendingRefunds.length + flaggedReviews.length + pendingInquiries.length;
  const ringSegments = [
    { label: 'Bookings', value: pendingBookings.length, color: '#111111' },
    { label: 'Refunds', value: pendingRefunds.length, color: '#2563eb' },
    { label: 'Reviews', value: flaggedReviews.length, color: '#f59e0b' },
    { label: 'Inquiries', value: pendingInquiries.length, color: '#16a34a' },
  ];
  const recentActivities = useMemo(() => {
    const bookingItems = latestBookings.map((booking) => ({
      id: `booking-${booking._id}`,
      type: 'Booking',
      createdAt: booking.createdAt,
      title: `${getUserDisplayName(booking.user)} booked ${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim(),
      subtitle: [dateRange(booking.startDate, booking.endDate), booking.status].filter(Boolean).join(' • '),
      vehicleThumb: resolveVehicleThumb(booking.vehicle),
      userThumb: resolveUserThumb(booking.user),
      userFallback: initials(getUserDisplayName(booking.user)),
      status: booking.status,
    }));

    const reviewItems = reviews.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).map((review) => ({
      id: `review-${review._id}`,
      type: 'Review',
      createdAt: review.createdAt,
      title: `${getReviewCustomerName(review)} left a review`,
      subtitle: [`${review.rating || 0} star`, getReviewPreviewMessage(review)].filter(Boolean).join(' • '),
      vehicleThumb: resolveVehicleThumb(review.vehicleId),
      userThumb: resolveUserThumb(review.userId),
      userFallback: initials(getReviewCustomerName(review)),
      status: getReviewModerationStatus(review),
    }));

    const inquiryItems = inquiries.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).map((inquiry) => ({
      id: `inquiry-${inquiry._id}`,
      type: 'Inquiry',
      createdAt: inquiry.createdAt,
      title: `${getInquiryDisplayName(inquiry)} sent an inquiry`,
      subtitle: [getInquiryDisplayEmail(inquiry), getInquiryDisplayPhone(inquiry)].filter(Boolean).join(' • '),
      vehicleThumb: resolveVehicleThumb(inquiry.vehicleId),
      userThumb: resolveUserThumb(null, inquiry.email),
      userFallback: initials(getInquiryDisplayName(inquiry)),
      status: inquiry.status,
    }));

    const refundItems = refunds.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).map((refund) => ({
      id: `refund-${refund._id}`,
      type: 'Refund',
      createdAt: refund.createdAt,
      title: `${getRefundCustomerName(refund)} requested a refund`,
      subtitle: [refund.bankName, refund.status].filter(Boolean).join(' • '),
      vehicleThumb: resolveVehicleThumb(refund.booking?.vehicle),
      userThumb: resolveUserThumb(refund.user),
      userFallback: initials(getRefundCustomerName(refund)),
      status: refund.status,
    }));

    const registrationItems = latestCustomerRegistrations.map((account) => ({
      id: `user-${account._id}`,
      type: 'New User',
      createdAt: account.createdAt,
      title: `${getUserDisplayName(account)} registered`,
      subtitle: getUserDisplayEmail(account, 'Customer account'),
      vehicleThumb: null,
      userThumb: resolveUserThumb(account),
      userFallback: initials(getUserDisplayName(account)),
      status: account.isActive ? 'Active' : 'Disabled',
    }));

    return [...bookingItems, ...reviewItems, ...inquiryItems, ...refundItems, ...registrationItems]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [inquiries, latestBookings, latestCustomerRegistrations, refunds, resolveUserThumb, resolveVehicleThumb, reviews]);

  const openVehicleCatalog = () => navigation.getParent()?.navigate('HomeTab', { screen: 'AdminVehiclesMain', params: { tabTransitionAt: Date.now() } });
  const openNotificationPopup = useCallback(() => {
    setNotificationPopupVisible(true);
  }, []);
  const closeNotificationPopup = useCallback(() => {
    setNotificationPopupVisible(false);
  }, []);
  const openPromotionDetail = useCallback((promotion) => {
    if (!promotion) return;
    setSelectedPromotionDetail(promotion);
    setPromotionDetailVisible(true);
  }, []);
  const closePromotionDetail = useCallback(() => {
    setPromotionDetailVisible(false);
    setSelectedPromotionDetail(null);
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

    if (item.type === 'promotion') {
      const promotion = promotions.find((entry) => String(entry?._id) === String(item.entityId));
      goToTab('Promotions', { preserveOverviewScroll: true });
      if (promotion) {
        openPromotionDetail(promotion);
      }
      return;
    }

    if (item?.targetTab && TABS.includes(item.targetTab)) {
      goToTab(item.targetTab, { preserveOverviewScroll: true });
    }
  }, [goToTab, load, openPromotionDetail, promotions]);
  const closeVehicleQuickView = useCallback(() => {
    setVehicleQuickViewVisible(false);
    setSelectedQuickViewVehicle(null);
  }, []);
  const openVehicleQuickView = useCallback((vehicle) => {
    if (!vehicle?._id) {
      return;
    }
    setSelectedQuickViewVehicle(vehicle);
    setVehicleQuickViewVisible(true);
  }, []);
  const openAddVehicleModal = useCallback(() => {
    setSelectedVehicle(null);
    setVehicleModalMode('add');
    setVehicleModalVisible(true);
  }, []);
  const openEditVehicleModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleModalMode('edit');
    setVehicleModalVisible(true);
  };
  const closeVehicleDeleteModal = useCallback(() => {
    if (vehicleDeleteLoading) {
      return;
    }

    setVehicleDeleteVisible(false);
    setSelectedVehicleToDelete(null);
  }, [vehicleDeleteLoading]);
  const openVehicleDeleteModal = useCallback((vehicle) => {
    if (!vehicle?._id) {
      return;
    }

    setSelectedVehicleToDelete(vehicle);
    setVehicleDeleteVisible(true);
  }, []);
  const closeVehicleModal = () => {
    setVehicleModalVisible(false);
    setSelectedVehicle(null);
  };
  const handleVehicleSaved = async (notice) => {
    closeVehicleModal();
    await load();
    if (notice?.message) {
      setVehicleToastMessage(notice.message);
      setShowVehicleToast(true);
    }
  };
  const openManagerModal = useCallback((mode, manager = null) => {
    setManagerModalMode(mode);
    setManagerError('');
    setManagerForm({
      id: manager?._id || null,
      fullName: manager?.fullName || '',
      email: manager?.email || '',
      contactNumber: manager?.contactNumber || '',
      password: '',
    });
    setManagerPasswordVisible(false);
    setManagerModalVisible(true);
  }, []);
  const closeManagerModal = () => {
    if (managerSubmitting) {
      return;
    }
    setManagerModalVisible(false);
    setManagerError('');
  };
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'Vehicles') {
        emitAdminTabBarAction({
          key: 'vehicles',
          icon: 'car-sports',
          showPlusBadge: true,
          onPress: openAddVehicleModal,
        });
        return () => emitAdminTabBarAction(null);
      }

      if (activeTab === 'Users') {
        emitAdminTabBarAction({
          key: 'users',
          icon: 'account-plus-outline',
          onPress: () => openManagerModal('create'),
        });
        return () => emitAdminTabBarAction(null);
      }

      emitAdminTabBarAction(null);
      return () => emitAdminTabBarAction(null);
    }, [activeTab, openAddVehicleModal, openManagerModal]),
  );
  const submitManagerModal = async () => {
    const fullName = managerForm.fullName.trim();
    const email = managerForm.email.trim().toLowerCase();
    const contactNumber = managerForm.contactNumber.trim();
    const password = managerForm.password.trim();

    if (managerModalMode !== 'password' && !fullName) {
      setManagerError('Marketing manager name is required.');
      return;
    }
    if (managerModalMode !== 'password') {
      const emailError = validateManagerEmail(email);
      if (emailError) {
        setManagerError(emailError);
        return;
      }
    }
    if (managerModalMode !== 'password') {
      const phoneError = validateManagerPhone(contactNumber);
      if (phoneError) {
        setManagerError(phoneError);
        return;
      }
    }
    if (managerModalMode === 'create' || managerModalMode === 'password') {
      const passwordError = validateManagerPassword(password);
      if (passwordError) {
        setManagerError(passwordError);
        return;
      }
    }
    if (managerModalMode === 'edit' && password) {
      const passwordError = validateManagerPassword(password);
      if (passwordError) {
        setManagerError(passwordError);
        return;
      }
    }
    if (managerModalMode !== 'password' && !fullName) {
      setManagerError('Marketing manager name is required.');
      return;
    }

    setManagerSubmitting(true);
    setManagerError('');

    try {
      if (managerModalMode === 'create') {
        await authAPI.addSubAdmin({ fullName, email, contactNumber, password });
      } else if (managerModalMode === 'edit') {
        await authAPI.updateSubAdmin(managerForm.id, {
          fullName,
          email,
          contactNumber,
          ...(password ? { password } : {}),
        });
      } else {
        await authAPI.updateSubAdmin(managerForm.id, { password });
      }

      setManagerModalVisible(false);
      await load();
    } catch (error) {
      setManagerError(error?.response?.data?.message || 'Failed to update marketing manager.');
    } finally {
      setManagerSubmitting(false);
    }
  };
  const removeMarketingManager = (manager) => openManagerRemoveModal(manager);
  const toggleMarketingManagerStatus = async (manager, nextValue) => {
    try {
      await authAPI.updateSubAdmin(manager._id, { isActive: nextValue });
      setUsers((current) => current.map((item) => (
        String(item._id) === String(manager._id)
          ? { ...item, isActive: nextValue }
          : item
      )));
      showAlert(
        'Marketing Manager Updated',
        `${manager.fullName} is now ${nextValue ? 'active' : 'inactive'}.`,
        [],
        { tone: 'success', hideActions: true, autoHideMs: 900 },
      );
      load();
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to update marketing manager status.', undefined, { tone: 'danger' });
    }
  };
  const onBookingStatus = async (id, status) => {
    const booking = bookings.find((item) => String(item?._id) === String(id));
    if (isMissingOrDeletedCustomer(booking?.user)) {
      showAlert(
        'Booking Is View-Only',
        'This booking belongs to a deleted customer account, so approval and rejection actions are disabled.',
        undefined,
        { tone: 'danger' },
      );
      return;
    }

    try {
      await bookingAPI.updateStatus(id, status);
      setRefundToastMessage(status === 'Approved' ? 'Booking approved' : 'Booking rejected');
      setShowRefundToast(true);
      load();
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to update booking.', undefined, { tone: 'danger' });
    }
  };
  const onInquiryStatus = async (id, status) => { try { await inquiryAPI.updateStatus(id, status); load(); } catch (error) { showAlert('Error', error?.response?.data?.message || 'Failed to update inquiry.', undefined, { tone: 'danger' }); } };
  const onDeleteVehicle = async (vehicle) => {
    openVehicleDeleteModal(vehicle);
  };
  const submitVehicleDelete = useCallback(async () => {
    if (!selectedVehicleToDelete?._id || vehicleDeleteLoading) {
      return;
    }

    setVehicleDeleteLoading(true);
    try {
      const vehicleLabel = [selectedVehicleToDelete?.brand, selectedVehicleToDelete?.model].filter(Boolean).join(' ').trim() || 'Vehicle';
      await vehicleAPI.delete(selectedVehicleToDelete._id);
      closeVehicleDeleteModal();
      await load();
      setVehicleToastMessage(`${vehicleLabel} deleted successfully`);
      setShowVehicleToast(true);
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to delete vehicle.', undefined, { tone: 'danger' });
    } finally {
      setVehicleDeleteLoading(false);
    }
  }, [closeVehicleDeleteModal, load, selectedVehicleToDelete, showAlert, vehicleDeleteLoading]);
  const onDeleteUser = async (account) => openUserDeleteModal(account);
  const submitManagerRemove = useCallback(async () => {
    if (!selectedManagerToRemove?._id || managerRemoveLoading) {
      return;
    }

    setManagerRemoveLoading(true);
    try {
      await authAPI.deleteSubAdmin(selectedManagerToRemove._id);
      closeManagerRemoveModal();
      await load();
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to remove marketing manager.', undefined, { tone: 'danger' });
    } finally {
      setManagerRemoveLoading(false);
    }
  }, [closeManagerRemoveModal, load, managerRemoveLoading, selectedManagerToRemove, showAlert]);
  const submitUserDelete = useCallback(async () => {
    if (!selectedUserToDelete?._id || userDeleteLoading) {
      return;
    }

    if (userDeletePreview?.allowed === false) {
      showAlert('Delete Blocked', userDeletePreview.message || 'This account cannot be deleted right now.', undefined, { tone: 'danger' });
      return;
    }

    setUserDeleteLoading(true);
    try {
      const response = await authAPI.deleteUser(selectedUserToDelete._id);
      closeUserDeleteModal();
      await load();
      setRefundToastMessage(response?.data?.message || 'User deleted and anonymized successfully');
      setShowRefundToast(true);
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to delete user.', undefined, { tone: 'danger' });
    } finally {
      setUserDeleteLoading(false);
    }
  }, [closeUserDeleteModal, load, selectedUserToDelete, showAlert, userDeleteLoading, userDeletePreview]);
  const openHardDeleteGate = useCallback(() => {
    setHardDeletePassword('');
    setHardDeletePasswordError('');
    setHardDeletePasswordVisible(false);
    setHardDeleteGateVisible(true);
  }, []);
  const closeHardDeleteGate = useCallback(() => {
    if (hardDeleteUnlockLoading) {
      return;
    }

    setHardDeleteGateVisible(false);
    setHardDeletePassword('');
    setHardDeletePasswordError('');
    setHardDeletePasswordVisible(false);
  }, [hardDeleteUnlockLoading]);
  const lockHardDeleteVault = useCallback(() => {
    setHardDeleteUnlocked(false);
    setHardDeleteTab('USERS');
    setHardDeleteSearch('');
    setHardDeleteSubmittingId('');
    setHardDeletePassword('');
    setHardDeletePasswordError('');
    setHardDeletePasswordVisible(false);
  }, []);
  const submitHardDeleteUnlock = useCallback(async () => {
    const password = String(hardDeletePassword || '');

    if (!password.trim()) {
      setHardDeletePasswordError('Admin password is required.');
      return;
    }

    setHardDeleteUnlockLoading(true);
    setHardDeletePasswordError('');

    try {
      await authAPI.verifyAdminPassword({ password });
      setHardDeleteUnlocked(true);
      setHardDeleteTab('USERS');
      setHardDeleteSearch('');
      setHardDeleteGateVisible(false);
      setHardDeletePassword('');
      setHardDeletePasswordVisible(false);
    } catch (error) {
      setHardDeletePasswordError(error?.response?.data?.message || 'Unable to verify your admin password.');
    } finally {
      setHardDeleteUnlockLoading(false);
    }
  }, [hardDeletePassword]);
  const runHardDeleteRequest = useCallback((item) => {
    switch (item.type) {
      case 'USERS':
        return authAPI.hardDeleteUser(item.id);
      case 'VEHICLES':
        return vehicleAPI.hardDelete(item.id);
      case 'BOOKINGS':
        return bookingAPI.hardDelete(item.id);
      case 'INQUIRIES':
        return inquiryAPI.hardDelete(item.id);
      case 'REFUNDS':
        return refundAPI.hardDelete(item.id);
      case 'REVIEWS':
        return reviewAPI.adminPurge(item.id);
      case 'PROMOTIONS':
        return promotionAPI.delete(item.id);
      default:
        return Promise.reject(new Error('Unsupported hard delete record type.'));
    }
  }, []);
  const getHardDeleteConfirmCopy = useCallback((item) => {
    switch (item.type) {
      case 'USERS':
        return `Permanently delete ${item.title} and remove linked bookings, refunds, reviews, inquiries, wishlists, and payments from the database?`;
      case 'VEHICLES':
        return `Permanently delete ${item.title} and remove linked bookings, refunds, reviews, inquiries, wishlists, and direct promotion links from the database?`;
      case 'BOOKINGS':
        return `Permanently delete ${item.title} and remove any refund records linked to this booking?`;
      case 'INQUIRIES':
        return `Permanently delete ${item.title} from the database?`;
      case 'REFUNDS':
        return `Permanently delete the refund record for ${item.title}?`;
      case 'REVIEWS':
        return `Permanently delete the review linked to ${item.title}?`;
      case 'PROMOTIONS':
        return `Permanently delete the promotion "${item.title}" from the database?`;
      default:
        return 'Permanently delete this record from the database?';
    }
  }, []);
  const triggerHardDelete = useCallback((item) => {
    showAlert(
      'Hard Delete Record',
      getHardDeleteConfirmCopy(item),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hard Delete',
          style: 'destructive',
          onPress: async () => {
            setHardDeleteSubmittingId(`${item.type}:${item.id}`);

            try {
              await runHardDeleteRequest(item);
              setRefundToastMessage(`${item.title} permanently deleted`);
              setShowRefundToast(true);
              await load();
            } catch (error) {
              showAlert('Error', error?.response?.data?.message || 'Failed to permanently delete this record.', undefined, { tone: 'danger' });
            } finally {
              setHardDeleteSubmittingId('');
            }
          },
        },
      ],
      { tone: 'danger' },
    );
  }, [getHardDeleteConfirmCopy, load, runHardDeleteRequest, showAlert]);
  const submitBookingDelete = useCallback(async () => {
    if (!selectedBookingToDelete?._id || bookingDeleteLoading) {
      return;
    }

    setBookingDeleteLoading(true);
    try {
      await bookingAPI.hardDelete(selectedBookingToDelete._id);
      closeBookingDelete();
      setRefundToastMessage('Booking deleted');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setBookingDeleteLoading(false);
      showAlert('Error', error?.response?.data?.message || 'Failed to delete booking.', undefined, { tone: 'danger' });
    }
  }, [bookingDeleteLoading, closeBookingDelete, load, selectedBookingToDelete, showAlert]);
  const submitInquiryDelete = useCallback(async () => {
    if (!selectedInquiryToDelete?._id || inquiryDeleteLoading) {
      return;
    }

    setInquiryDeleteLoading(true);
    try {
      await inquiryAPI.hardDelete(selectedInquiryToDelete._id);
      closeInquiryDelete();
      setRefundToastMessage('Inquiry deleted');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setInquiryDeleteLoading(false);
      showAlert('Error', error?.response?.data?.message || 'Failed to delete inquiry.', undefined, { tone: 'danger' });
    }
  }, [closeInquiryDelete, inquiryDeleteLoading, load, selectedInquiryToDelete, showAlert]);
  const submitRefundDelete = useCallback(async () => {
    if (!selectedRefundToDelete?._id || refundDeleteLoading) {
      return;
    }

    setRefundDeleteLoading(true);
    try {
      await refundAPI.hardDelete(selectedRefundToDelete._id);
      closeRefundDelete();
      setRefundToastMessage('Refund deleted');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setRefundDeleteLoading(false);
      showAlert('Error', error?.response?.data?.message || 'Failed to delete refund.', undefined, { tone: 'danger' });
    }
  }, [closeRefundDelete, load, refundDeleteLoading, selectedRefundToDelete, showAlert]);
  const closeReviewDeleteModal = useCallback(() => {
    setReviewDeleteModalVisible(false);
    setSelectedReview(null);
    setReviewDeleteReason('');
    setReviewActionLoading(false);
  }, []);
  const closeReviewDetail = useCallback(() => {
    setReviewDetailVisible(false);
    setSelectedReview(null);
  }, []);
  const closeReviewReplyModal = useCallback(() => {
    setReviewReplyModalVisible(false);
    setSelectedReview(null);
    setReviewReplyMessage('');
    setReviewActionLoading(false);
  }, []);
  const openReviewDetail = useCallback((review) => {
    setSelectedReview(review);
    setReviewDetailVisible(true);
  }, []);
  const openReviewDeleteModal = useCallback((review) => {
    setSelectedReview(review);
    setReviewDeleteReason('');
    setReviewDeleteModalVisible(true);
  }, []);
  const openReviewReplyModal = useCallback((review) => {
    if (String(review?.businessReply || '').trim()) {
      showAlert('Response Already Sent', 'This review already has an admin response.', undefined, { tone: 'warning' });
      return;
    }

    if (isMissingOrDeletedCustomer(review?.userId)) {
      showAlert(
        'Review Is View-Only',
        'This review belongs to a deleted customer account, so admin responses are disabled.',
        undefined,
        { tone: 'warning' },
      );
      return;
    }

    setSelectedReview(review);
    setReviewReplyMessage('');
    setReviewReplyModalVisible(true);
  }, [showAlert]);
  const onHideReview = useCallback(async (review) => {
    const reviewId = String(review?._id || '');
    const previousReview = selectedReview;
    const previousReviews = reviews;

    setReviews((current) => current.map((item) => (
      String(item?._id || '') === reviewId
        ? { ...item, isVisible: false }
        : item
    )));
    setSelectedReview((current) => (current?._id === review?._id ? { ...current, isVisible: false } : current));

    try {
      await reviewAPI.adminHide(review._id);
      setRefundToastMessage('Review hidden');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setReviews(previousReviews);
      setSelectedReview(previousReview);
      showAlert('Error', error?.response?.data?.message || 'Failed to hide review.', undefined, { tone: 'danger' });
    }
  }, [load, reviews, selectedReview, showAlert]);
  const onShowReview = useCallback(async (review) => {
    const reviewId = String(review?._id || '');
    const previousReview = selectedReview;
    const previousReviews = reviews;

    setReviews((current) => current.map((item) => (
      String(item?._id || '') === reviewId
        ? { ...item, isVisible: true }
        : item
    )));
    setSelectedReview((current) => (current?._id === review?._id ? { ...current, isVisible: true } : current));

    try {
      await reviewAPI.adminShow(review._id);
      setRefundToastMessage('Review is visible again');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setReviews(previousReviews);
      setSelectedReview(previousReview);
      showAlert('Error', error?.response?.data?.message || 'Failed to show review.', undefined, { tone: 'danger' });
    }
  }, [load, reviews, selectedReview, showAlert]);
  const submitReviewDelete = useCallback(async () => {
    const reason = String(reviewDeleteReason || '').trim();

    if (!selectedReview?._id) {
      return;
    }

    if (!reason) {
      showAlert('Delete Reason Required', 'Please provide a reason before deleting this review.', undefined, { tone: 'warning' });
      return;
    }

    setReviewActionLoading(true);

    try {
      await reviewAPI.adminDelete(selectedReview._id, { reason });
      closeReviewDeleteModal();
      setRefundToastMessage('Review deleted');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setReviewActionLoading(false);
      showAlert('Error', error?.response?.data?.message || 'Failed to delete review.', undefined, { tone: 'danger' });
    }
  }, [closeReviewDeleteModal, load, reviewDeleteReason, selectedReview, showAlert]);
  const submitReviewReply = useCallback(async () => {
    const message = String(reviewReplyMessage || '').trim();

    if (!selectedReview?._id) {
      return;
    }

    if (!message) {
      showAlert('Response Required', 'Please write a response before sending it.', undefined, { tone: 'warning' });
      return;
    }

    setReviewActionLoading(true);

    try {
      await reviewAPI.adminRespond(selectedReview._id, { businessReply: message });
      closeReviewReplyModal();
      setRefundToastMessage('Review response sent');
      setShowRefundToast(true);
      load();
    } catch (error) {
      setReviewActionLoading(false);
      showAlert('Error', error?.response?.data?.message || 'Failed to send review response.', undefined, { tone: 'danger' });
    }
  }, [closeReviewReplyModal, load, reviewReplyMessage, selectedReview, showAlert]);
  const header = (
    <View style={styles.headerRow}>
      <View style={styles.headerIdentity}>
        {profileUri ? <Image source={{ uri: profileUri }} style={styles.avatarImage} resizeMode="cover" /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials(user?.fullName)}</Text></View>}
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Hi, {user?.fullName?.split(' ')?.[0] || 'Admin'}</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconButton} onPress={openNotificationPopup} activeOpacity={0.88}>
          <MaterialCommunityIcons name={promotionNotifications.length ? 'bell-badge-outline' : 'bell-outline'} size={22} color="#111111" />
          {notificationCount > 0 ? (
            <View style={styles.headerNotificationBadge}>
              <Text style={styles.headerNotificationBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={refresh} activeOpacity={0.88}>
          <MaterialCommunityIcons name={refreshing ? 'loading' : 'refresh'} size={22} color="#111111" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const overviewStats = [
    ['Customers', stats?.totalUsers ?? users.length, 'account-group-outline', '#eef2ff'],
    ['Vehicles', stats?.totalVehicles ?? vehicles.length, 'car-multiple', '#ecfeff'],
    ['Active Rentals', approvedBookings.length, 'calendar-check-outline', '#ecfdf3'],
    ['Pending Requests', pendingBookings.length, 'clock-alert-outline', '#fffbeb'],
    ['Refunds', pendingRefunds.length, 'cash-refund', '#eff6ff'],
    ['Inquiries', pendingInquiries.length, 'message-processing-outline', '#f3f4f6'],
  ];
  const activePromotionCount = promotions.filter((item) => item?.status === 'Active').length;
  const inactivePromotionCount = promotions.filter((item) => item?.status === 'Inactive').length;
  const expiredPromotionCount = promotions.filter((item) => item?.status === 'Expired').length;

  const modules = [
    ['Vehicle Management', 'Browse inventory cards, edit listings, and add new vehicles.', `${vehicles.length} live`, 'car-sports', () => goToTab('Vehicles')],
    ['Booking Management', 'Review rentals, approvals, and booking activity.', `${pendingBookings.length} pending`, 'calendar-month-outline', () => goToTab('Bookings')],
    ['User Management', 'Monitor customer accounts and access.', `${users.length} users`, 'account-cog-outline', () => goToTab('Users')],
    ['Review Management', 'Moderate feedback and flagged content.', `${flaggedReviews.length} flagged`, 'star-circle-outline', () => goToTab('Reviews')],
    ['Refund Management', 'Handle pending claims and payment follow-up.', `${pendingRefunds.length} open`, 'cash-fast', () => goToTab('Refunds')],
    ['Sales Inquiries', 'Respond to new leads and buying requests.', `${pendingInquiries.length} waiting`, 'phone-in-talk-outline', () => goToTab('Inquiries')],
    ['Promotion Campaigns', 'Read current offers and promotion visibility from one place.', `${activePromotionCount} active`, 'tag-multiple-outline', () => goToTab('Promotions')],
  ];

  const renderListCard = (items, empty, row) => items.length === 0 ? <EmptyState {...empty} /> : items.map(row);

  const screens = {
    Overview: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onOverviewScroll} scrollRef={overviewScrollRef} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        {header}
        <Card style={styles.heroCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartCopy}>
              <Text style={styles.eyebrow}>Live Activity</Text>
              <Text style={styles.chartTitle}>Platform pulse</Text>
            </View>
            <View style={styles.ringCard}>
              <View style={styles.ringTrack}>
                {ringSegments.map((segment) => (
                  <View
                    key={segment.label}
                    style={[
                      styles.ringSlice,
                      {
                        flex: ringTotal > 0 ? segment.value || 0.2 : 1,
                        backgroundColor: segment.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.ringValue}>{ringTotal}</Text>
              <Text style={styles.ringLabel}>Open items</Text>
            </View>
          </View>

          <View style={styles.barChart}>
            {chartSeries.map((item) => (
              <View key={item.label} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max((item.value / maxChartValue) * 100, item.value > 0 ? 18 : 6)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{item.value}</Text>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionHeader title="Summary" subtitle="Live counts across core admin areas" />
        <View style={styles.grid}>
          {overviewStats.map(([label, value, icon, bg]) => (
            <Card key={label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: bg }]}><MaterialCommunityIcons name={icon} size={18} color="#111111" /></View>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </Card>
          ))}
        </View>

        <SectionHeader title="Promotion Snapshot" subtitle="Visibility across the current promotion slate" />
        <View style={styles.quickRow}>
          <Card style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{activePromotionCount}</Text>
            <Text style={styles.quickStatLabel}>Active</Text>
          </Card>
          <Card style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{inactivePromotionCount}</Text>
            <Text style={styles.quickStatLabel}>Inactive</Text>
          </Card>
          <Card style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{expiredPromotionCount}</Text>
            <Text style={styles.quickStatLabel}>Expired</Text>
          </Card>
        </View>

        <SectionHeader title="Recent Vehicles" subtitle="Newest inventory added to the marketplace" actionLabel="Open Fleet" onActionPress={openVehicleCatalog} />
        <Card style={styles.listCard}>
          {renderListCard(latestVehicles, { icon: '🚗', title: 'No vehicles yet' }, (vehicle, index) => (
            <View key={vehicle._id} style={[styles.listRow, index === latestVehicles.length - 1 && styles.lastRow]}>
              <View style={styles.visualRow}>
                {vehicle?.image1 ? <Image source={{ uri: uri(vehicle.image1) }} style={styles.vehicleThumb} resizeMode="cover" /> : <View style={styles.vehicleThumbFallback}><MaterialCommunityIcons name="car-sports" size={20} color="#9ca3af" /></View>}
                <View style={styles.listCopy}><Text style={styles.listTitle}>{vehicle.brand} {vehicle.model}</Text><Text style={styles.listSubtitle}>{[vehicle.listingType, vehicle.manufactureYear, price(vehicle.price), vehicle.status].filter(Boolean).join(' • ')}</Text></View>
              </View>
              <TouchableOpacity onPress={openVehicleCatalog} activeOpacity={0.88}><MaterialCommunityIcons name="chevron-right" size={22} color="#9ca3af" /></TouchableOpacity>
            </View>
          ))}
        </Card>

        <SectionHeader title="Recent Activity" subtitle="Latest bookings, reviews, inquiries, refunds, and registrations" />
        <Card style={styles.listCard}>
          {renderListCard(recentActivities, { icon: '📅', title: 'No activity yet' }, (activity, index) => (
            <View key={activity.id} style={[styles.listRow, index === recentActivities.length - 1 && styles.lastRow]}>
              <View style={styles.visualRow}>
                <View style={styles.mediaStrip}>
                  {activity.vehicleThumb ? <MediaThumb sourceUri={activity.vehicleThumb} icon="car-sports" /> : null}
                  <MediaThumb sourceUri={activity.userThumb} fallbackText={activity.userFallback} round icon="account" />
                </View>
                <View style={styles.listCopy}><Text style={styles.listTitle}>{activity.title}</Text><Text style={styles.listSubtitle}>{[activity.type, activity.subtitle].filter(Boolean).join(' • ')}</Text></View>
              </View>
              <StatusBadge status={activity.status} />
            </View>
          ))}
        </Card>
        <SectionHeader
          title="Hard Delete Vault"
          subtitle={hardDeleteUnlocked
            ? `Unlocked for ${HARD_DELETE_TABS.find((item) => item.key === hardDeleteTab)?.label || 'records'}`
            : 'Hidden permanent-delete tools locked behind your admin password'}
        />
        <Card style={[styles.hardDeleteVaultCard, !hardDeleteUnlocked && styles.hardDeleteVaultCardLocked]}>
          {!hardDeleteUnlocked ? (
            <TouchableOpacity style={styles.hardDeleteLockState} onPress={openHardDeleteGate} activeOpacity={0.9}>
              <View style={styles.hardDeleteLockBadge}>
                <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#b91c1c" />
              </View>
              <View style={styles.hardDeleteLockCopy}>
                <Text style={styles.hardDeleteLockTitle}>Hidden Hard Delete Vault</Text>
                <Text style={styles.hardDeleteLockText}>
                  Unlock with your admin password to permanently erase one record at a time and remove linked data.
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.hardDeleteVaultHeader}>
                <View style={styles.hardDeleteVaultTitleWrap}>
                  <Text style={styles.hardDeleteVaultEyebrow}>Permanent Database Delete</Text>
                  <Text style={styles.hardDeleteVaultTitle}>One by one only</Text>
                  <Text style={styles.hardDeleteVaultText}>
                    Every action here removes the selected record from MongoDB and clears linked data where a cascade exists.
                  </Text>
                </View>
                <TouchableOpacity style={styles.hardDeleteLockButton} onPress={lockHardDeleteVault} activeOpacity={0.88}>
                  <MaterialCommunityIcons name="lock-outline" size={16} color="#0f172a" />
                  <Text style={styles.hardDeleteLockButtonText}>Lock</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.hardDeleteNoticeCard}>
                <Text style={styles.hardDeleteNoticeText}>
                  Search the exact record you want, then hard delete it individually. This vault does not support bulk delete.
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hardDeleteTypeRow}
              >
                {HARD_DELETE_TABS.map((item) => (
                  <HardDeleteTypeButton
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    active={item.key === hardDeleteTab}
                    onPress={() => setHardDeleteTab(item.key)}
                  />
                ))}
              </ScrollView>

              <View style={styles.hardDeleteSearchWrap}>
                <MaterialCommunityIcons name="magnify" size={18} color="#64748b" />
                <TextInput
                  value={hardDeleteSearch}
                  onChangeText={setHardDeleteSearch}
                  placeholder="Search by name, email, title, brand, status..."
                  placeholderTextColor="#94a3b8"
                  style={styles.hardDeleteSearchInput}
                />
              </View>

              <Text style={styles.hardDeleteResultsLabel}>
                {visibleHardDeleteItems.length} matching {HARD_DELETE_TABS.find((item) => item.key === hardDeleteTab)?.label?.toLowerCase() || 'records'}
              </Text>

              <View style={styles.hardDeleteRecordList}>
                {visibleHardDeleteItems.length ? visibleHardDeleteItems.map((item) => (
                  <HardDeleteRecordRow
                    key={`${item.type}-${item.id}`}
                    item={item}
                    loading={hardDeleteSubmittingId === `${item.type}:${item.id}`}
                    onDelete={() => triggerHardDelete(item)}
                  />
                )) : (
                  <EmptyState icon="🔎" title="No matching records found" subtitle="Try a different keyword or switch to another hard-delete category." />
                )}
              </View>
            </>
          )}
        </Card>
      </DashboardScroll>
    ),
    Promotions: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <SectionHeader
          title="Promotions"
        />
        {featuredPromotions.length ? (
          featuredPromotions.map((promotion) => (
            <Card key={promotion._id} style={styles.recordCard}>
              <TouchableOpacity onPress={() => openPromotionDetail(promotion)} activeOpacity={0.88}>
                <View style={styles.recordHeader}>
                  <View style={styles.visualRow}>
                    {promotion?.imageUrl ? (
                      <Image source={{ uri: uri(promotion.imageUrl) }} style={styles.promotionPreviewThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.promotionPreviewThumbFallback}>
                        <MaterialCommunityIcons name="tag-outline" size={22} color="#d97706" />
                      </View>
                    )}
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle} numberOfLines={1}>{promotion?.title || 'Promotion'}</Text>
                      <Text style={styles.listSubtitle} numberOfLines={2}>
                        {promotion?.description || `${promotion?.promotionType || 'Promotion'} campaign`}
                      </Text>
                    </View>
                  </View>
                  <StatusBadge status={promotion?.status || 'Active'} />
                </View>

                <View style={styles.badgeRow}>
                  <Badge
                    label={promotion?.promotionType || 'Promotion'}
                    color="#9a3412"
                    bg="#fff7ed"
                  />
                  <Badge
                    label={getPromotionDiscountLabel(promotion)}
                    color="#8a6b00"
                    bg="#fff8cc"
                  />
                  <Badge
                    label={dateRange(promotion?.startDate, promotion?.endDate)}
                    color="#475569"
                    bg="#f8fafc"
                  />
                </View>
              </TouchableOpacity>
            </Card>
          ))
        ) : (
          <Card style={styles.listCard}>
            <EmptyState icon="📣" title="No promotions yet" />
          </Card>
        )}
      </DashboardScroll>
    ),
    Bookings: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <FilterableSectionHeader
          title="Booking Management"
          subtitle={`${filteredBookings.length} bookings across the platform`}
          selectedFilterKey={dashboardFilters.Bookings}
          filterLabel={getFilterLabel('Bookings')}
          onFilterPress={() => toggleDashboardFilter('Bookings')}
          filterMenuVisible={openFilterTab === 'Bookings'}
          filterOptions={DASHBOARD_FILTER_OPTIONS.Bookings}
          onSelectFilter={(nextFilter) => selectDashboardFilter('Bookings', nextFilter)}
          filterOpacity={filterOpacity}
          filterScale={filterScale}
          filterTranslateY={filterTranslateY}
        />
          {renderListCard(
          filteredBookings,
          { icon: '📅', title: 'No bookings yet' },
          (booking) => (
            <Card key={booking._id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <TouchableOpacity style={styles.visualRow} onPress={() => openBookingDetail(booking)} activeOpacity={0.88}>
                  <View style={styles.mediaStrip}>
                    <MediaThumb sourceUri={resolveVehicleThumb(booking.vehicle)} icon="car-sports" />
                    <MediaThumb sourceUri={resolveUserThumb(booking.user)} fallbackText={initials(getUserDisplayName(booking.user))} round icon="account" />
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>{booking.vehicle?.brand} {booking.vehicle?.model}</Text>
                    <Text style={styles.listSubtitle} numberOfLines={2}>{[getUserDisplayName(booking.user), dateRange(booking.startDate, booking.endDate)].filter(Boolean).join(' • ')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.badgeRow}>
                <StatusBadge status={booking.status} />
                <Badge
                  label={`Quantity ${Math.max(1, Number(booking.requestedUnits || 1))}`}
                  color="#111111"
                  bg="#f3f4f6"
                />
                {booking.paymentSlipViewedAt ? (
                  <Badge label="Slip Viewed" color="#166534" bg="#ecfdf3" />
                ) : (
                  <Badge label="Slip Not Viewed" color="#b45309" bg="#fffbeb" />
                )}
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openBookingDetail(booking)} activeOpacity={0.88}>
                  <Text style={styles.secondaryActionText}>View Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openBookingSlip(booking)} activeOpacity={0.88}>
                  <Text style={styles.secondaryActionText}>View Slip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openBookingDelete(booking)} activeOpacity={0.88}>
                  <Text style={styles.dangerText}>Delete</Text>
                </TouchableOpacity>
              </View>
              {booking.status === 'Pending' && isMissingOrDeletedCustomer(booking.user) ? (
                <View style={styles.badgeRow}>
                  <Badge label="Deleted customer - view only" color="#64748b" bg="#f1f5f9" />
                </View>
              ) : null}
              {booking.status === 'Pending' && !isMissingOrDeletedCustomer(booking.user) ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.bookingDecisionButton, styles.quickAccent, !booking.paymentSlipViewedAt && styles.actionButtonDisabled]}
                    onPress={() => onBookingStatus(booking._id, 'Approved')}
                    activeOpacity={0.88}
                    disabled={!booking.paymentSlipViewedAt}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.quickAccentText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.bookingDecisionButton, styles.dangerButton, !booking.paymentSlipViewedAt && styles.actionButtonDisabled]}
                    onPress={() => onBookingStatus(booking._id, 'Rejected')}
                    activeOpacity={0.88}
                    disabled={!booking.paymentSlipViewedAt}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.dangerText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Card>
          ),
        )}
      </DashboardScroll>
    ),
    Vehicles: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <FilterableSectionHeader
          title="Vehicle Management"
          subtitle={`${filteredVehicles.length} listings ready for review`}
          selectedFilterKey={dashboardFilters.Vehicles}
          filterLabel={getFilterLabel('Vehicles')}
          onFilterPress={() => toggleDashboardFilter('Vehicles')}
          filterMenuVisible={openFilterTab === 'Vehicles'}
          filterOptions={DASHBOARD_FILTER_OPTIONS.Vehicles}
          onSelectFilter={(nextFilter) => selectDashboardFilter('Vehicles', nextFilter)}
          filterOpacity={filterOpacity}
          filterScale={filterScale}
          filterTranslateY={filterTranslateY}
        />
          {renderListCard(
          filteredVehicles,
          { icon: '🚗', title: 'No vehicles yet' },
          (vehicle) => (
            <Card key={vehicle._id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <TouchableOpacity style={styles.vehiclePreviewRow} onPress={() => openVehicleQuickView(vehicle)} activeOpacity={0.88}>
                  {vehicle?.image1 ? (
                    <Image source={{ uri: uri(vehicle.image1) }} style={styles.vehicleThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.vehicleThumbFallback}>
                      <MaterialCommunityIcons name="car-sports" size={20} color="#9ca3af" />
                    </View>
                  )}
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{vehicle.brand} {vehicle.model}</Text>
                    <Text style={styles.listSubtitle}>{[vehicle.listingType, vehicle.manufactureYear].filter(Boolean).join(' • ')}</Text>
                    <Text style={styles.listPriceText}>{price(vehicle.price)}</Text>
                  </View>
                </TouchableOpacity>
                <StatusBadge status={vehicle.status} />
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openVehicleQuickView(vehicle)} activeOpacity={0.88}>
                  <Text style={styles.secondaryActionText}>Quick View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.neutralButton} onPress={() => openEditVehicleModal(vehicle)} activeOpacity={0.88}>
                  <Text style={styles.neutralText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => onDeleteVehicle(vehicle)} activeOpacity={0.88}>
                  <Text style={styles.dangerText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ),
        )}
      </DashboardScroll>
    ),
    Users: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <FilterableSectionHeader
          title="Marketing Manager Access"
          subtitle="Manage access and account controls."
          selectedFilterKey={dashboardFilters.Users}
          filterLabel={getFilterLabel('Users')}
          onFilterPress={() => toggleDashboardFilter('Users')}
          filterMenuVisible={openFilterTab === 'Users'}
          filterOptions={DASHBOARD_FILTER_OPTIONS.Users}
          onSelectFilter={(nextFilter) => selectDashboardFilter('Users', nextFilter)}
          filterOpacity={filterOpacity}
          filterScale={filterScale}
          filterTranslateY={filterTranslateY}
        />
        {(dashboardFilters.Users === 'ALL' || dashboardFilters.Users === 'MANAGERS') ? (
          filteredMarketingManagers.length === 0 ? (
            <Card style={styles.recordCard}>
              <EmptyState icon="📣" title="No marketing manager yet" />
            </Card>
          ) : filteredMarketingManagers.map((manager) => (
            <Card key={manager._id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <TouchableOpacity style={styles.visualRow} onPress={() => openUserQuickView(manager)} activeOpacity={0.88}>
                  <MediaThumb sourceUri={resolveUserThumb(manager)} fallbackText={initials(manager.fullName)} round icon="account" />
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{manager.fullName}</Text>
                    <Text style={styles.listSubtitle}>{[manager.email, manager.contactNumber || 'No contact number'].filter(Boolean).join(' • ')}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.managerStatusSide}>
                  <StatusBadge status={manager.isActive ? 'Active' : 'Disabled'} />
                  <View style={styles.managerToggleRow}>
                    <Text style={styles.managerToggleLabel}>{manager.isActive ? 'Active' : 'Inactive'}</Text>
                    <Switch value={Boolean(manager.isActive)} onValueChange={(value) => toggleMarketingManagerStatus(manager, value)} trackColor={{ false: '#d1d5db', true: '#fde047' }} thumbColor={manager.isActive ? '#111111' : '#f9fafb'} ios_backgroundColor="#d1d5db" />
                  </View>
                </View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openUserQuickView(manager)} activeOpacity={0.88}>
                  <Text style={styles.secondaryActionText}>Quick View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.quickAccent]} onPress={() => openManagerModal('edit', manager)} activeOpacity={0.88}>
                  <Text style={styles.quickAccentText}>Edit Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => removeMarketingManager(manager)} activeOpacity={0.88}>
                  <Text style={styles.dangerText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        ) : null}
        {(dashboardFilters.Users === 'ALL' || dashboardFilters.Users === 'BASIC' || dashboardFilters.Users === 'PREMIUM') ? (
          <>
            <SectionHeader title="Customer Accounts" subtitle={`${filteredCustomerAccounts.length} customer users available`} />
            {renderListCard(
              filteredCustomerAccounts,
              { icon: '👥', title: 'No customer users found' },
              (account) => (
                <Card key={account._id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <TouchableOpacity style={styles.visualRow} onPress={() => openUserQuickView(account)} activeOpacity={0.88}>
                      <MediaThumb sourceUri={resolveUserThumb(account)} fallbackText={initials(getUserDisplayName(account))} round icon="account" />
                      <View style={styles.listCopy}>
                        <View style={styles.userNameRow}>
                          <Text style={styles.listTitle}>{getUserDisplayName(account)}</Text>
                          {account?.isPremium ? <PremiumCrownBadge size={22} iconSize={12} style={styles.userPremiumBadge} /> : null}
                        </View>
                        <Text style={styles.listSubtitle}>{[getUserDisplayEmail(account), account.role].filter(Boolean).join(' • ')}</Text>
                      </View>
                    </TouchableOpacity>
                    <StatusBadge status={isDeletedUserRecord(account) ? 'Deleted' : account.isActive ? 'Active' : 'Disabled'} />
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openUserQuickView(account)} activeOpacity={0.88}>
                      <Text style={styles.secondaryActionText}>Quick View</Text>
                    </TouchableOpacity>
                    {!isDeletedUserRecord(account) ? (
                      <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => onDeleteUser(account)} activeOpacity={0.88}>
                        <Text style={styles.dangerText}>Delete User</Text>
                      </TouchableOpacity>
                    ) : (
                      <Badge label="Anonymized" color="#64748b" bg="#f1f5f9" />
                    )}
                  </View>
                </Card>
              ),
            )}
          </>
        ) : null}
      </DashboardScroll>
    ),
    Reviews: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <FilterableSectionHeader
          title="Review & Feedback"
          subtitle={`${filteredReviews.length} customer reviews collected`}
          selectedFilterKey={dashboardFilters.Reviews}
          filterLabel={getFilterLabel('Reviews')}
          onFilterPress={() => toggleDashboardFilter('Reviews')}
          filterMenuVisible={openFilterTab === 'Reviews'}
          filterOptions={DASHBOARD_FILTER_OPTIONS.Reviews}
          onSelectFilter={(nextFilter) => selectDashboardFilter('Reviews', nextFilter)}
          filterOpacity={filterOpacity}
          filterScale={filterScale}
          filterTranslateY={filterTranslateY}
        />
        {renderListCard(
          filteredReviews,
          { icon: '⭐', title: 'No reviews yet' },
          (review) => (
            <Card key={review._id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <TouchableOpacity style={styles.visualRow} onPress={() => openReviewDetail(review)} activeOpacity={0.88}>
                  <View style={styles.mediaStrip}>
                    <MediaThumb sourceUri={resolveVehicleThumb(review.vehicleId)} icon="car-sports" />
                    <MediaThumb sourceUri={resolveUserThumb(review.userId)} fallbackText={initials(getReviewCustomerName(review))} round icon="account" />
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>
                      {getReviewCustomerName(review)} • {'★'.repeat(review.rating || 0)}
                    </Text>
                    <Text style={styles.listSubtitle} numberOfLines={3}>{getReviewPreviewMessage(review) || 'No review message provided.'}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.reviewStatusBlock}>
                  <StatusBadge status={getReviewModerationStatus(review)} />
                  {!review?.adminDeleted ? (
                    <View style={styles.reviewCardToggleRow}>
                      <Text style={styles.reviewCardToggleLabel}>Hide Review</Text>
                      <Switch
                        value={review?.isVisible === false}
                        onValueChange={(nextValue) => {
                          if (nextValue) {
                            onHideReview(review);
                            return;
                          }

                          onShowReview(review);
                        }}
                        trackColor={{ false: '#dbe4f0', true: '#111111' }}
                        thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                        ios_backgroundColor="#dbe4f0"
                      />
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.badgeRow}>
                <Badge label={`${review?.vehicleId?.brand || 'Vehicle'} ${review?.vehicleId?.model || ''}`.trim()} color="#111111" bg="#f3f4f6" />
                <Badge label={`Rating ${Number(review?.rating || 0).toFixed(1)}`} color="#9a3412" bg="#fff7ed" />
                <Badge
                  label={`Created ${new Date(review.createdAt || Date.now()).toLocaleDateString()}`}
                  color="#475569"
                  bg="#f8fafc"
                />
                {Array.isArray(review?.images) && review.images.length ? (
                  <Badge label={`${review.images.length} image${review.images.length === 1 ? '' : 's'}`} color="#2563eb" bg="#eff6ff" />
                ) : null}
              </View>
              {review.requiresAdminAttention && review.adminAttentionStatus === 'Pending' ? (
                <View style={styles.badgeRow}>
                  <Badge label="Needs Attention" color="#8a6b00" bg="#fff8cc" />
                </View>
              ) : null}
              {review?.adminDeleteReason ? (
                <Text style={styles.inlineReasonText}>Reason: {review.adminDeleteReason}</Text>
              ) : null}
              <ReviewBusinessReply review={review} style={styles.adminReviewReplyCard} />
              {!review?.adminDeleted ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openReviewDetail(review)} activeOpacity={0.88}>
                    <Text style={styles.secondaryActionText}>View Details</Text>
                  </TouchableOpacity>
                  {isMissingOrDeletedCustomer(review?.userId) ? (
                    <Badge label="Deleted customer - response disabled" color="#64748b" bg="#f1f5f9" />
                  ) : !String(review?.businessReply || '').trim() ? (
                    <TouchableOpacity style={[styles.actionButton, styles.quickAccent]} onPress={() => openReviewReplyModal(review)} activeOpacity={0.88}>
                      <Text style={styles.quickAccentText}>Respond</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openReviewDeleteModal(review)} activeOpacity={0.88}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openReviewDetail(review)} activeOpacity={0.88}>
                    <Text style={styles.secondaryActionText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ),
        )}
      </DashboardScroll>
    ),
    Refunds: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <FilterableSectionHeader
          title="Refund Management"
          subtitle={`${filteredRefunds.length} refund claims across the platform`}
          selectedFilterKey={dashboardFilters.Refunds}
          filterLabel={getFilterLabel('Refunds')}
          onFilterPress={() => toggleDashboardFilter('Refunds')}
          filterMenuVisible={openFilterTab === 'Refunds'}
          filterOptions={DASHBOARD_FILTER_OPTIONS.Refunds}
          onSelectFilter={(nextFilter) => selectDashboardFilter('Refunds', nextFilter)}
          filterOpacity={filterOpacity}
          filterScale={filterScale}
          filterTranslateY={filterTranslateY}
        />
        {renderListCard(
          filteredRefunds,
          { icon: '💳', title: 'No refund requests' },
          (refund) => (
            <Card key={refund._id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <TouchableOpacity
                  style={styles.visualRow}
                  onPress={() => openRefundDetail(refund)}
                  activeOpacity={0.88}
                >
                  <View style={styles.mediaStrip}>
                    <MediaThumb sourceUri={resolveVehicleThumb(refund.booking?.vehicle)} icon="car-sports" />
                    <MediaThumb sourceUri={resolveUserThumb(getRefundCustomer(refund))} fallbackText={initials(getRefundCustomerName(refund))} round icon="account" />
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{getRefundCustomerName(refund)}</Text>
                    {refund.bankName ? <Text style={styles.listSubtitle}>Bank: {refund.bankName}</Text> : null}
                    {refund.accountNumber ? <Text style={styles.listSubtitle}>Account: {refund.accountNumber}</Text> : null}
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.badgeRow}>
                <Badge label={`Amount ${price(refund.amount || refund.booking?.vehicle?.price)}`} color="#111111" bg="#f3f4f6" />
                <Badge label={`Booking ${refund.booking?.status || 'Pending'}`} color="#2563eb" bg="#eff6ff" />
                <Badge
                  label={`Submitted ${refund.requestedAt ? new Date(refund.requestedAt).toLocaleDateString() : 'Today'}`}
                  color="#475569"
                  bg="#f8fafc"
                />
                {refund.processedAt ? (
                  <Badge
                    label={`Processed ${new Date(refund.processedAt).toLocaleDateString()}`}
                    color="#15803d"
                    bg="#ecfdf5"
                  />
                ) : null}
                {(refund.refundProofUrl || refund.refundSlipUrl) ? (
                  <Badge label="Slip Uploaded" color="#8a6b00" bg="#fff8cc" />
                ) : null}
              </View>
              {['Refund Requested', 'Refund Processing'].includes(refund.status) ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openRefundDetail(refund)} activeOpacity={0.88}>
                    <Text style={styles.secondaryActionText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.quickAccent]} onPress={() => navigation.navigate('ProcessRefund', { refund })} activeOpacity={0.88}>
                    <Text style={styles.quickAccentText}>{refund.status === 'Refund Processing' ? 'Continue' : 'Process Refund'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openRefundDelete(refund)} activeOpacity={0.88}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openRefundDetail(refund)} activeOpacity={0.88}>
                    <Text style={styles.secondaryActionText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openRefundDelete(refund)} activeOpacity={0.88}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ),
        )}
      </DashboardScroll>
    ),
    Inquiries: (
      <DashboardScroll refreshing={refreshing} onRefresh={refresh} onScroll={onScroll} filterMenuVisible={Boolean(openFilterTab)} onEmptyPress={closeDashboardFilter}>
        <FilterableSectionHeader
          title="Sales Inquiries"
          subtitle={`${filteredInquiries.length} customer leads waiting for follow-up`}
          selectedFilterKey={dashboardFilters.Inquiries}
          filterLabel={getFilterLabel('Inquiries')}
          onFilterPress={() => toggleDashboardFilter('Inquiries')}
          filterMenuVisible={openFilterTab === 'Inquiries'}
          filterOptions={DASHBOARD_FILTER_OPTIONS.Inquiries}
          onSelectFilter={(nextFilter) => selectDashboardFilter('Inquiries', nextFilter)}
          filterOpacity={filterOpacity}
          filterScale={filterScale}
          filterTranslateY={filterTranslateY}
        />
        {renderListCard(
          filteredInquiries,
          { icon: '📨', title: 'No inquiries yet' },
          (inquiry) => (
            <Card key={inquiry._id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <TouchableOpacity
                  style={styles.visualRow}
                  onPress={() => openInquiryDetail(inquiry)}
                  activeOpacity={0.88}
                >
                  <View style={styles.mediaStrip}>
                    <MediaThumb sourceUri={resolveVehicleThumb(inquiry.vehicleId)} icon="car-sports" />
                    <MediaThumb sourceUri={resolveUserThumb(null, inquiry.email)} fallbackText={initials(getInquiryDisplayName(inquiry))} round icon="account" />
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{getInquiryDisplayName(inquiry)}</Text>
                    <Text style={styles.listSubtitle}>{[getInquiryDisplayEmail(inquiry), getInquiryDisplayPhone(inquiry)].filter(Boolean).join(' • ')}</Text>
                    {inquiry.message ? <Text style={styles.note} numberOfLines={2}>{inquiry.message}</Text> : null}
                  </View>
                </TouchableOpacity>
                <StatusBadge status={inquiry.status} />
              </View>
              {inquiry.status === 'Pending' ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openInquiryDetail(inquiry)} activeOpacity={0.88}>
                    <Text style={styles.secondaryActionText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.quickAccent]} onPress={() => onInquiryStatus(inquiry._id, 'Resolved')} activeOpacity={0.88}>
                    <Text style={styles.quickAccentText}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => onInquiryStatus(inquiry._id, 'Rejected')} activeOpacity={0.88}>
                    <Text style={styles.dangerText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openInquiryDelete(inquiry)} activeOpacity={0.88}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openInquiryDetail(inquiry)} activeOpacity={0.88}>
                    <Text style={styles.secondaryActionText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openInquiryDelete(inquiry)} activeOpacity={0.88}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ),
        )}
      </DashboardScroll>
    ),
  };

  if (loading) return <LoadingSpinner message="Loading admin dashboard..." />;

  const managerModalTitle = managerModalMode === 'create'
    ? 'Add Marketing Manager'
    : managerModalMode === 'password'
      ? 'Change Marketing Password'
      : 'Edit Marketing Manager';

  return (
    <Animated.View style={[styles.root, transitionStyle]}>
      <SuccessToast
        visible={showNotificationToast}
        message={notificationCount === 1 ? '1 new admin notification is waiting' : `${notificationCount} new admin notifications are waiting`}
        backgroundColor="#111111"
        textColor="#ffffff"
      />
      <SuccessToast visible={showRefundToast} message={refundToastMessage} />
      <SuccessToast visible={showVehicleToast} message={vehicleToastMessage} />
      {openFilterTab ? (
        <Pressable style={styles.dashboardFilterDismissLayer} onPress={closeDashboardFilter} />
      ) : null}
      <View style={[styles.tabsWrap, { paddingTop: Math.max(insets.top + 6, 18) }]}>
        <View style={styles.topTitleRow}>
          <Text style={styles.topTitle}>Admin Dashboard</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => {
            const active = tab === activeTab;
            return <TouchableOpacity key={tab} style={[styles.tabPill, active && styles.tabPillActive]} onPress={() => goToTab(tab, { restoreOverviewScroll: tab !== 'Overview' ? undefined : true })} activeOpacity={0.88}><Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text></TouchableOpacity>;
          })}
        </ScrollView>
      </View>
      <Animated.View
        {...edgeSwipeResponder.panHandlers}
        pointerEvents="box-none"
        style={[
          styles.contentWrap,
          {
            opacity: tabOpacity,
            transform: [{ translateY: tabTranslateY }, { scale: tabScale }],
          },
        ]}
      >
        {screens[activeTab]}
      </Animated.View>

      <Modal
        visible={vehicleQuickViewVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeVehicleQuickView}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Quick View</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Check the vehicle details here.</Text>
              </View>
            </View>

            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              {selectedQuickViewImages.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickViewGallery}
                >
                  {selectedQuickViewImages.map((imageSource, index) => (
                    <Image
                      key={`${imageSource}-${index}`}
                      source={{ uri: imageSource }}
                      style={styles.quickViewImage}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.quickViewImageFallback}>
                  <MaterialCommunityIcons name="car-sports" size={36} color="#94a3b8" />
                  <Text style={styles.quickViewImageFallbackText}>No vehicle images available</Text>
                </View>
              )}

              <View style={styles.quickViewBadgeRow}>
                <Badge label={selectedQuickViewVehicle?.listingType || 'Vehicle'} color="#1d4ed8" bg="#dbeafe" />
                <Badge label={selectedQuickViewVehicle?.status || 'Unknown'} color="#111111" bg="#f3f4f6" />
                {selectedQuickViewVehicle?.category ? (
                  <Badge label={selectedQuickViewVehicle.category} color="#92400e" bg="#fff7ed" />
                ) : null}
              </View>

              <View style={styles.quickViewInfoSection}>
                <Text style={styles.quickViewSectionTitle}>
                  {[selectedQuickViewVehicle?.brand, selectedQuickViewVehicle?.model].filter(Boolean).join(' ') || 'Vehicle'}
                </Text>
                <View style={styles.quickViewPriceRow}>
                  <Text style={styles.quickViewPrice}>
                    {price(selectedQuickViewFinalPrice)}
                    {selectedQuickViewVehicle?.listingType === 'Rent' ? ' /day' : ''}
                  </Text>
                  {selectedQuickViewPromotion ? (
                    <Text style={styles.quickViewPriceOld}>
                      {price(selectedQuickViewVehicle?.price)}
                      {selectedQuickViewVehicle?.listingType === 'Rent' ? ' /day' : ''}
                    </Text>
                  ) : null}
                </View>
              </View>

              {selectedQuickViewPromotion ? (
                <View style={styles.quickViewInfoSection}>
                  <VehiclePromotionCard
                    promotion={selectedQuickViewPromotion}
                    vehicle={selectedQuickViewVehicle}
                  />
                </View>
              ) : null}

              <View style={styles.quickViewInfoSection}>
                <Text style={styles.quickViewSectionLabel}>Vehicle Details</Text>
                <View style={styles.quickViewDetailGrid}>
                  <QuickViewDetailTile label="Brand" value={selectedQuickViewVehicle?.brand} />
                  <QuickViewDetailTile label="Model" value={selectedQuickViewVehicle?.model} />
                  <QuickViewDetailTile label="Category" value={selectedQuickViewVehicle?.category} />
                  <QuickViewDetailTile label="Manufacture Year" value={selectedQuickViewVehicle?.manufactureYear} />
                  <QuickViewDetailTile label="Condition" value={selectedQuickViewVehicle?.vehicleCondition} />
                  <QuickViewDetailTile label="Color" value={selectedQuickViewVehicle?.color} />
                  <QuickViewDetailTile label="Fuel Type" value={selectedQuickViewVehicle?.fuelType} />
                  <QuickViewDetailTile label="Transmission" value={selectedQuickViewVehicle?.transmission} />
                  <QuickViewDetailTile label="Mileage" value={selectedQuickViewVehicle?.mileage ? `${selectedQuickViewVehicle.mileage} km` : '0 km'} />
                  <QuickViewDetailTile label="Seats" value={selectedQuickViewVehicle?.seatCount} />
                  <QuickViewDetailTile label="Engine Capacity" value={selectedQuickViewVehicle?.engineCapacity ? `${selectedQuickViewVehicle.engineCapacity} cc` : ''} />
                  <QuickViewDetailTile label="Quantity" value={selectedQuickViewVehicle?.quantity} />
                </View>
              </View>

              {String(selectedQuickViewVehicle?.description || '').trim() ? (
                <View style={styles.quickViewInfoSection}>
                  <Text style={styles.quickViewSectionLabel}>Description</Text>
                  <View style={styles.quickViewDescriptionCard}>
                    <Text style={styles.quickViewDescriptionText}>{selectedQuickViewVehicle.description}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={vehicleDeleteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeVehicleDeleteModal}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
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
                    {[selectedVehicleToDelete?.brand, selectedVehicleToDelete?.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  Related bookings, refunds, reviews, and inquiries will stay saved.
                </Text>
              </View>

              {selectedVehicleToDelete?.listingType || selectedVehicleToDelete?.status ? (
                <View style={styles.quickViewBadgeRow}>
                  {selectedVehicleToDelete?.listingType ? (
                    <Badge label={selectedVehicleToDelete.listingType} color="#1d4ed8" bg="#dbeafe" />
                  ) : null}
                  {selectedVehicleToDelete?.status ? (
                    <Badge label={selectedVehicleToDelete.status} color="#111111" bg="#f3f4f6" />
                  ) : null}
                  {selectedVehicleToDelete?.category ? (
                    <Badge label={selectedVehicleToDelete.category} color="#92400e" bg="#fff7ed" />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.quickViewInfoSection}>
                <View style={styles.quickViewDetailGrid}>
                  <QuickViewDetailTile label="Price" value={price(selectedVehicleToDelete?.price)} />
                  <QuickViewDetailTile label="Year" value={selectedVehicleToDelete?.manufactureYear} />
                  <QuickViewDetailTile label="Condition" value={selectedVehicleToDelete?.vehicleCondition} />
                  <QuickViewDetailTile label="Color" value={selectedVehicleToDelete?.color} />
                </View>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity style={styles.deleteSheetPrimaryButton} onPress={submitVehicleDelete} activeOpacity={0.9} disabled={vehicleDeleteLoading}>
                {vehicleDeleteLoading ? (
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

      <Modal
        visible={managerModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeManagerModal}
      >
        <KeyboardAvoidingView
          style={styles.vehicleEditorSheetScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>{managerModalTitle}</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>
                  {managerModalMode === 'create'
                    ? 'Add the marketing manager details here.'
                    : managerModalMode === 'password'
                      ? 'Set the marketing manager password here.'
                      : 'Review and update the manager details here.'}
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.vehicleEditorSheetFormBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {managerModalMode !== 'password' ? (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Full name"
                    placeholderTextColor="#9ca3af"
                    value={managerForm.fullName}
                    onChangeText={(value) => setManagerForm((current) => ({ ...current, fullName: value }))}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Email address"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={managerForm.email}
                    onChangeText={(value) => {
                      setManagerError('');
                      setManagerForm((current) => ({ ...current, email: value }));
                    }}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Contact number"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={managerForm.contactNumber}
                    onChangeText={(value) => {
                      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
                      setManagerError('');
                      setManagerForm((current) => ({ ...current, contactNumber: digitsOnly }));
                    }}
                  />
                </>
              ) : null}

              <View style={styles.modalInputWrap}>
                <TextInput
                  style={styles.modalInputWithToggle}
                  placeholder={managerModalMode === 'edit' ? 'New password (optional)' : 'Password'}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!managerPasswordVisible}
                  value={managerForm.password}
                  onChangeText={(value) => {
                    setManagerError('');
                    setManagerForm((current) => ({ ...current, password: value }));
                  }}
                />
                <TouchableOpacity
                  style={styles.modalInputToggle}
                  onPress={() => setManagerPasswordVisible((current) => !current)}
                  activeOpacity={0.88}
                >
                  <MaterialCommunityIcons
                    name={managerPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>

              {managerError ? <Text style={styles.modalError}>{managerError}</Text> : null}
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeManagerModal} activeOpacity={0.88}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, managerSubmitting && styles.modalButtonDisabled]}
                onPress={submitManagerModal}
                activeOpacity={0.88}
                disabled={managerSubmitting}
              >
                <Text style={styles.modalPrimaryText}>{managerSubmitting ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
                  <AdminNotificationCard key={item.id} item={item} onPress={() => handleNotificationPress(item)} />
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
        visible={promotionDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closePromotionDetail}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>{selectedPromotionDetail?.title || 'Promotion Details'}</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Check the promotions.</Text>
              </View>
            </View>

            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              {selectedPromotionDetail?.imageUrl ? (
                <Image source={{ uri: uri(selectedPromotionDetail.imageUrl) }} style={styles.promotionDetailImage} resizeMode="cover" />
              ) : null}

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Promotion</Text>
                <UserInfoRow label="Type" value={selectedPromotionDetail?.promotionType || 'Promotion'} />
                <UserInfoRow label="Status" value={selectedPromotionDetail?.status || 'Active'} />
                <UserInfoRow label="Discount" value={getPromotionDiscountLabel(selectedPromotionDetail)} />
                <UserInfoRow label="Date Range" value={dateRange(selectedPromotionDetail?.startDate, selectedPromotionDetail?.endDate)} hideBorder />
              </View>

              {selectedPromotionDetail?.description ? (
                <View style={styles.userInfoSection}>
                  <Text style={styles.userInfoSectionTitle}>Description</Text>
                  <Text style={styles.reviewSheetBodyText}>{selectedPromotionDetail.description}</Text>
                </View>
              ) : null}

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Visibility</Text>
                <UserInfoRow label="Scope" value={getPromotionScopeText(selectedPromotionDetail)} />
                <UserInfoRow label="Inventory Banner" value={selectedPromotionDetail?.showOnInventoryBanner ? 'Visible' : 'Hidden'} />
                <UserInfoRow label="Vehicle Cards" value={selectedPromotionDetail?.showOnVehicleCard ? 'Visible' : 'Hidden'} />
                <UserInfoRow label="Vehicle Details" value={selectedPromotionDetail?.showOnVehicleDetails ? 'Visible' : 'Hidden'} />
                <UserInfoRow label="Highlight Label" value={selectedPromotionDetail?.highlightLabel || 'Not set'} hideBorder />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeReviewDetail}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Review Details</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Review the full customer feedback here.</Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeReviewDetail} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <View style={styles.mediaStrip}>
                  <MediaThumb sourceUri={resolveUserThumb(selectedReview?.userId)} fallbackText={initials(getReviewCustomerName(selectedReview))} round icon="account" />
                  <MediaThumb sourceUri={resolveVehicleThumb(selectedReview?.vehicleId)} icon="car-sports" />
                </View>
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getReviewCustomerName(selectedReview)}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>
                    {[selectedReview?.vehicleId?.brand, selectedReview?.vehicleId?.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Text>
                </View>
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Review</Text>
                <UserInfoRow label="Status" value={getReviewModerationStatus(selectedReview)} />
                <UserInfoRow label="Rating" value={Number(selectedReview?.rating || 0).toFixed(1)} />
                <UserInfoRow label="Created At" value={selectedReview?.createdAt ? new Date(selectedReview.createdAt).toLocaleString() : ''} />
                <UserInfoRow label="Message" value={getReviewPreviewMessage(selectedReview) || 'No review message provided.'} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Customer</Text>
                <UserInfoRow label="Name" value={getReviewCustomerName(selectedReview)} />
                <UserInfoRow label="Email" value={getUserDisplayEmail(selectedReview?.userId)} />
                <UserInfoRow label="Phone" value={getUserDisplayPhone(selectedReview?.userId)} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Vehicle</Text>
                <UserInfoRow label="Vehicle" value={[selectedReview?.vehicleId?.brand, selectedReview?.vehicleId?.model].filter(Boolean).join(' ')} />
                <UserInfoRow label="Listing Type" value={selectedReview?.vehicleId?.listingType} />
                <UserInfoRow label="Price" value={price(selectedReview?.vehicleId?.price)} hideBorder />
              </View>

              {selectedReview?.adminDeleteReason ? (
                <View style={styles.userInfoSection}>
                  <Text style={styles.userInfoSectionTitle}>Delete Reason</Text>
                  <Text style={styles.reviewSheetBodyText}>{selectedReview.adminDeleteReason}</Text>
                </View>
              ) : null}

              {String(selectedReview?.businessReply || '').trim() ? (
                <View style={styles.userInfoSection}>
                  <Text style={styles.userInfoSectionTitle}>Admin Response</Text>
                  <Text style={styles.reviewSheetBodyText}>{selectedReview.businessReply}</Text>
                </View>
              ) : null}

              {Array.isArray(selectedReview?.images) && selectedReview.images.length ? (
                <View style={styles.userInfoSection}>
                  <Text style={styles.userInfoSectionTitle}>Images</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewSheetGallery}>
                    {selectedReview.images.map((image, index) => (
                      <Image
                        key={`${image}-${index}`}
                        source={{ uri: uri(image) }}
                        style={styles.reviewSheetImage}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewReplyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeReviewReplyModal}
      >
        <KeyboardAvoidingView
          style={styles.vehicleEditorSheetScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Respond to Review</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Send one admin response that the customer can view.</Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeReviewReplyModal} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.vehicleEditorSheetFormBody}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Review Context</Text>
                <UserInfoRow
                  label="Customer"
                  value={getReviewCustomerName(selectedReview)}
                />
                <UserInfoRow
                  label="Vehicle"
                  value={[selectedReview?.vehicleId?.brand, selectedReview?.vehicleId?.model].filter(Boolean).join(' ')}
                />
                <UserInfoRow
                  label="Review"
                  value={getReviewPreviewMessage(selectedReview) || 'No review message provided.'}
                  hideBorder
                />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Response</Text>
                <TextInput
                  style={[styles.modalInput, styles.reviewReasonInput, styles.reviewSheetTextArea]}
                  placeholder="Write admin response"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={reviewReplyMessage}
                  onChangeText={setReviewReplyMessage}
                />
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity
                style={[styles.deleteSheetPrimaryButton, reviewActionLoading && styles.modalButtonDisabled]}
                onPress={submitReviewReply}
                activeOpacity={0.9}
                disabled={reviewActionLoading}
              >
                <Text style={styles.deleteSheetPrimaryText}>{reviewActionLoading ? 'Sending...' : 'Send Response'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={reviewDeleteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeReviewDeleteModal}
      >
        <KeyboardAvoidingView
          style={styles.vehicleEditorSheetScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Delete Review</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Store a clear moderation reason for this deletion.</Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeReviewDeleteModal} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.vehicleEditorSheetFormBody}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Review Context</Text>
                <UserInfoRow
                  label="Customer"
                  value={getReviewCustomerName(selectedReview)}
                />
                <UserInfoRow
                  label="Vehicle"
                  value={[selectedReview?.vehicleId?.brand, selectedReview?.vehicleId?.model].filter(Boolean).join(' ')}
                />
                <UserInfoRow
                  label="Review"
                  value={getReviewPreviewMessage(selectedReview) || 'No review message provided.'}
                  hideBorder
                />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Delete Reason</Text>
                <TextInput
                  style={[styles.modalInput, styles.reviewReasonInput, styles.reviewSheetTextArea]}
                  placeholder="Write delete reason"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={reviewDeleteReason}
                  onChangeText={setReviewDeleteReason}
                />
              </View>

            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity
                style={[styles.deleteSheetPrimaryButton, styles.dangerButton, reviewActionLoading && styles.modalButtonDisabled]}
                onPress={submitReviewDelete}
                activeOpacity={0.9}
                disabled={reviewActionLoading}
              >
                <Text style={styles.deleteSheetPrimaryText}>{reviewActionLoading ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={userQuickViewVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeUserQuickView}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>User Details</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Review the account details here.</Text>
              </View>
            </View>

            <ScrollView
              style={styles.vehicleEditorSheetFormBody}
              contentContainerStyle={styles.userSheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.userSheetHero}>
                <MediaThumb
                  sourceUri={resolveUserThumb(selectedUser, selectedUser?.email)}
                  fallbackText={initials(getUserDisplayName(selectedUser, 'User'))}
                  round
                  icon="account"
                />
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getUserDisplayName(selectedUser, 'User')}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>
                    {[getUserDisplayEmail(selectedUser), selectedUser?.role].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Personal Details</Text>
                <UserInfoRow label="First Name" value={selectedUserNameParts.firstName} />
                <UserInfoRow label="Last Name" value={selectedUserNameParts.lastName} />
                <UserInfoRow label="Email" value={getUserDisplayEmail(selectedUser)} />
                <UserInfoRow label="Primary Phone" value={getUserDisplayPhone(selectedUser)} />
                <UserInfoRow label="Secondary Phone" value={isDeletedUserRecord(selectedUser) ? HIDDEN_PHONE_LABEL : selectedUser?.secondaryPhone} />
                <UserInfoRow label="Status" value={isDeletedUserRecord(selectedUser) ? 'Deleted' : selectedUser?.isActive ? 'Active' : 'Inactive'} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Address</Text>
                <UserInfoRow label="Address" value={selectedUserAddress} hideBorder />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={managerRemoveVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeManagerRemoveModal}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <MediaThumb
                  sourceUri={resolveUserThumb(selectedManagerToRemove, selectedManagerToRemove?.email)}
                  fallbackText={initials(selectedManagerToRemove?.fullName)}
                  round
                  icon="account"
                />
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{selectedManagerToRemove?.fullName || 'Marketing Manager'}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>Marketing Manager</Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  Promotions created by this marketing manager will stay saved.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity style={styles.deleteSheetPrimaryButton} onPress={submitManagerRemove} activeOpacity={0.9} disabled={managerRemoveLoading}>
                {managerRemoveLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-remove-outline" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Remove Manager</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={userDeleteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeUserDeleteModal}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <MediaThumb
                  sourceUri={resolveUserThumb(selectedUserToDelete, selectedUserToDelete?.email)}
                  fallbackText={initials(getUserDisplayName(selectedUserToDelete))}
                  round
                  icon="account"
                />
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getUserDisplayName(selectedUserToDelete)}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>Customer Account</Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  Personal details will be anonymized. Booking, payment, refund, review, and inquiry history will stay saved for business records.
                </Text>
              </View>
              {userDeletePreviewLoading ? (
                <View style={styles.deleteSheetInfoCard}>
                  <ActivityIndicator size="small" color="#111111" />
                  <Text style={styles.deleteSheetInfoText}>Checking linked bookings and refund state...</Text>
                </View>
              ) : null}
              {!userDeletePreviewLoading && userDeletePreview?.message ? (
                <View style={styles.deleteSheetInfoCard}>
                  <Text style={styles.deleteSheetInfoText}>{userDeletePreview.message}</Text>
                  {userDeletePreview?.pendingAction ? (
                    <Text style={styles.deleteSheetInfoText}>{userDeletePreview.pendingAction}</Text>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity
                style={[styles.deleteSheetPrimaryButton, (userDeleteLoading || userDeletePreviewLoading || userDeletePreview?.allowed === false) && styles.modalButtonDisabled]}
                onPress={submitUserDelete}
                activeOpacity={0.9}
                disabled={userDeleteLoading || userDeletePreviewLoading || userDeletePreview?.allowed === false}
              >
                {userDeleteLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-remove-outline" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Delete User</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={hardDeleteGateVisible} transparent animationType="fade" onRequestClose={closeHardDeleteGate}>
        <View style={styles.modalBackdrop}>
          <BlurView intensity={42} tint="light" style={styles.modalBlurLayer} />
          <Pressable style={styles.modalDimLayer} onPress={closeHardDeleteGate} />
          <View style={[styles.modalCard, styles.hardDeleteGateModal]}>
            <View style={styles.dashboardModalHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.modalTitle}>Unlock Hard Delete Vault</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your current admin password to access the hidden permanent-delete section.
                </Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeHardDeleteGate} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputWrap}>
              <TextInput
                value={hardDeletePassword}
                onChangeText={(value) => {
                  setHardDeletePassword(value);
                  if (hardDeletePasswordError) {
                    setHardDeletePasswordError('');
                  }
                }}
                placeholder="Admin password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!hardDeletePasswordVisible}
                style={styles.modalInputWithToggle}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.modalInputToggle}
                onPress={() => setHardDeletePasswordVisible((current) => !current)}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons
                  name={hardDeletePasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            {hardDeletePasswordError ? <Text style={styles.modalError}>{hardDeletePasswordError}</Text> : null}

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeHardDeleteGate} activeOpacity={0.88}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, hardDeleteUnlockLoading && styles.modalButtonDisabled]}
                onPress={submitHardDeleteUnlock}
                activeOpacity={0.88}
                disabled={hardDeleteUnlockLoading}
              >
                {hardDeleteUnlockLoading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Unlock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={bookingSlipVisible} transparent animationType="fade" onRequestClose={closeBookingSlip}>
        <View style={styles.modalBackdrop}>
          <BlurView intensity={42} tint="light" style={styles.modalBlurLayer} />
          <Pressable style={styles.modalDimLayer} onPress={closeBookingSlip} />
          <View style={styles.bookingSlipCard}>
            <View style={styles.dashboardModalHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.modalTitle}>Payment Slip</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedBooking?.user
                    ? `${getUserDisplayName(selectedBooking.user)} • ${selectedBooking.vehicle?.brand || ''} ${selectedBooking.vehicle?.model || ''}`.trim()
                    : 'Deleted User payment proof'}
                </Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeBookingSlip} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>
            {selectedBooking?.paymentSlipUrl ? (
              <Image source={{ uri: uri(selectedBooking.paymentSlipUrl) }} style={styles.bookingSlipPreview} resizeMode="contain" />
            ) : (
              <View style={styles.bookingSlipFallback}>
                <MaterialCommunityIcons name="image-off-outline" size={28} color="#94a3b8" />
                <Text style={styles.bookingSlipFallbackText}>No payment slip available</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={bookingDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeBookingDetail}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Booking Details</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Review the full booking information here.</Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeBookingDetail} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <MediaThumb
                  sourceUri={resolveUserThumb(selectedBookingDetail?.user)}
                  fallbackText={initials(getUserDisplayName(selectedBookingDetail?.user))}
                  round
                  icon="account"
                />
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getUserDisplayName(selectedBookingDetail?.user)}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>
                    {[selectedBookingDetail?.vehicle?.brand, selectedBookingDetail?.vehicle?.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Text>
                </View>
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Booking Details</Text>
                <UserInfoRow label="Status" value={selectedBookingDetail?.status} />
                <UserInfoRow label="Date Range" value={dateRange(selectedBookingDetail?.startDate, selectedBookingDetail?.endDate)} />
                <UserInfoRow label="Time Range" value={[selectedBookingDetail?.startTime, selectedBookingDetail?.endTime].filter(Boolean).join(' • ')} />
                <UserInfoRow label="Quantity" value={String(Math.max(1, Number(selectedBookingDetail?.requestedUnits || 1)))} />
                <UserInfoRow label="Created At" value={selectedBookingDetail?.createdAt ? new Date(selectedBookingDetail.createdAt).toLocaleString() : ''} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Customer</Text>
                <UserInfoRow label="Email" value={getUserDisplayEmail(selectedBookingDetail?.user)} />
                <UserInfoRow label="Phone" value={getUserDisplayPhone(selectedBookingDetail?.user)} />
                <UserInfoRow label="Membership" value={isMissingOrDeletedCustomer(selectedBookingDetail?.user) ? 'Deleted account' : resolveUserPremium(selectedBookingDetail?.user) ? 'Premium' : 'Basic'} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Vehicle</Text>
                <UserInfoRow label="Vehicle" value={[selectedBookingDetail?.vehicle?.brand, selectedBookingDetail?.vehicle?.model].filter(Boolean).join(' ')} />
                <UserInfoRow label="Listing Type" value={selectedBookingDetail?.vehicle?.listingType} />
                <UserInfoRow label="Price" value={price(selectedBookingDetail?.vehicle?.price)} />
                <UserInfoRow label="Vehicle Status" value={selectedBookingDetail?.vehicle?.status} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Slip</Text>
                {selectedBookingDetail?.paymentSlipUrl ? (
                  <Image source={{ uri: uri(selectedBookingDetail.paymentSlipUrl) }} style={styles.bookingDetailSlipPreview} resizeMode="contain" />
                ) : (
                  <View style={styles.bookingSlipFallback}>
                    <MaterialCommunityIcons name="image-off-outline" size={28} color="#94a3b8" />
                    <Text style={styles.bookingSlipFallbackText}>No payment slip available</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={bookingDeleteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeBookingDelete}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <View style={styles.mediaStrip}>
                  <MediaThumb sourceUri={resolveUserThumb(selectedBookingToDelete?.user)} fallbackText={initials(getUserDisplayName(selectedBookingToDelete?.user))} round icon="account" />
                  <MediaThumb sourceUri={resolveVehicleThumb(selectedBookingToDelete?.vehicle)} icon="car-sports" />
                </View>
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{[selectedBookingToDelete?.vehicle?.brand, selectedBookingToDelete?.vehicle?.model].filter(Boolean).join(' ') || 'Booking'}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>{getUserDisplayName(selectedBookingToDelete?.user)}</Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  This booking will be permanently deleted from the database.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity style={styles.deleteSheetPrimaryButton} onPress={submitBookingDelete} activeOpacity={0.9} disabled={bookingDeleteLoading}>
                {bookingDeleteLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="calendar-remove-outline" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Delete Booking</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={refundDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeRefundDetail}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Refund Details</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Review the full refund information here.</Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeRefundDetail} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <View style={styles.mediaStrip}>
                  <MediaThumb sourceUri={resolveUserThumb(getRefundCustomer(selectedRefundDetail))} fallbackText={initials(getRefundCustomerName(selectedRefundDetail))} round icon="account" />
                  <MediaThumb sourceUri={resolveVehicleThumb(selectedRefundDetail?.booking?.vehicle)} icon="car-sports" />
                </View>
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getRefundCustomerName(selectedRefundDetail)}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>
                    {[selectedRefundDetail?.booking?.vehicle?.brand, selectedRefundDetail?.booking?.vehicle?.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Text>
                </View>
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Refund</Text>
                <UserInfoRow label="Status" value={selectedRefundDetail?.status} />
                <UserInfoRow label="Amount" value={price(selectedRefundDetail?.amount || selectedRefundDetail?.booking?.vehicle?.price)} />
                <UserInfoRow label="Requested At" value={selectedRefundDetail?.requestedAt ? new Date(selectedRefundDetail.requestedAt).toLocaleString() : ''} />
                <UserInfoRow label="Processed At" value={selectedRefundDetail?.processedAt ? new Date(selectedRefundDetail.processedAt).toLocaleString() : 'Not processed'} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Bank Details</Text>
                <UserInfoRow label="Account Holder" value={selectedRefundDetail?.accountHolderName} />
                <UserInfoRow label="Bank" value={selectedRefundDetail?.bankName} />
                <UserInfoRow label="Branch" value={selectedRefundDetail?.branchName} />
                <UserInfoRow label="Account Number" value={selectedRefundDetail?.accountNumber} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Booking</Text>
                <UserInfoRow label="Booking Status" value={selectedRefundDetail?.booking?.status} />
                <UserInfoRow label="Vehicle" value={[selectedRefundDetail?.booking?.vehicle?.brand, selectedRefundDetail?.booking?.vehicle?.model].filter(Boolean).join(' ')} hideBorder />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={refundDeleteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeRefundDelete}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <View style={styles.mediaStrip}>
                  <MediaThumb sourceUri={resolveUserThumb(getRefundCustomer(selectedRefundToDelete))} fallbackText={initials(getRefundCustomerName(selectedRefundToDelete))} round icon="account" />
                  <MediaThumb sourceUri={resolveVehicleThumb(selectedRefundToDelete?.booking?.vehicle)} icon="car-sports" />
                </View>
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getRefundCustomerName(selectedRefundToDelete)}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>{[selectedRefundToDelete?.booking?.vehicle?.brand, selectedRefundToDelete?.booking?.vehicle?.model].filter(Boolean).join(' ') || 'Vehicle'}</Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  This refund record will be permanently deleted from the database.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity style={styles.deleteSheetPrimaryButton} onPress={submitRefundDelete} activeOpacity={0.9} disabled={refundDeleteLoading}>
                {refundDeleteLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="cash-remove" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Delete Refund</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={inquiryDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeInquiryDetail}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>Inquiry Details</Text>
                <Text style={styles.vehicleEditorSheetSubtitle}>Review the full customer inquiry here.</Text>
              </View>
              <TouchableOpacity style={styles.reviewReasonCloseButton} onPress={closeInquiryDetail} activeOpacity={0.88}>
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <View style={styles.mediaStrip}>
                  <MediaThumb sourceUri={resolveUserThumb(null, selectedInquiryDetail?.email)} fallbackText={initials(getInquiryDisplayName(selectedInquiryDetail))} round icon="account" />
                  <MediaThumb sourceUri={resolveVehicleThumb(selectedInquiryDetail?.vehicleId)} icon="car-sports" />
                </View>
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getInquiryDisplayName(selectedInquiryDetail)}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>
                    {[selectedInquiryDetail?.vehicleId?.brand, selectedInquiryDetail?.vehicleId?.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Text>
                </View>
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Inquiry</Text>
                <UserInfoRow label="Status" value={selectedInquiryDetail?.status} />
                <UserInfoRow label="Email" value={getInquiryDisplayEmail(selectedInquiryDetail)} />
                <UserInfoRow label="Phone" value={getInquiryDisplayPhone(selectedInquiryDetail)} />
                <UserInfoRow label="Contact Method" value={selectedInquiryDetail?.contactMethod} />
                <UserInfoRow label="Inquiry Type" value={selectedInquiryDetail?.inquiryType || (selectedInquiryDetail?.customMessage ? 'Custom Message' : '')} />
                <UserInfoRow label="Created At" value={selectedInquiryDetail?.createdAt ? new Date(selectedInquiryDetail.createdAt).toLocaleString() : ''} hideBorder />
              </View>

              <View style={styles.userInfoSection}>
                <Text style={styles.userInfoSectionTitle}>Vehicle</Text>
                <UserInfoRow label="Vehicle" value={selectedInquiryDetail?.vehicleTitle || [selectedInquiryDetail?.vehicleId?.brand, selectedInquiryDetail?.vehicleId?.model].filter(Boolean).join(' ')} />
                <UserInfoRow label="Listing Type" value={selectedInquiryDetail?.vehicleId?.listingType} />
                <UserInfoRow label="Price" value={price(selectedInquiryDetail?.vehiclePrice || selectedInquiryDetail?.vehicleId?.price)} hideBorder />
              </View>

              {selectedInquiryDetail?.message || selectedInquiryDetail?.customMessage ? (
                <View style={styles.userInfoSection}>
                  <Text style={styles.userInfoSectionTitle}>Inquiry Content</Text>
                  <Text style={styles.reviewSheetBodyText}>{selectedInquiryDetail?.customMessage || selectedInquiryDetail?.message}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={inquiryDeleteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeInquiryDelete}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.vehicleEditorSheetFormBody} showsVerticalScrollIndicator={false}>
              <View style={styles.userSheetHero}>
                <View style={styles.mediaStrip}>
                  <MediaThumb sourceUri={resolveUserThumb(null, selectedInquiryToDelete?.email)} fallbackText={initials(getInquiryDisplayName(selectedInquiryToDelete))} round icon="account" />
                  <MediaThumb sourceUri={resolveVehicleThumb(selectedInquiryToDelete?.vehicleId)} icon="car-sports" />
                </View>
                <View style={styles.userSheetHeroCopy}>
                  <Text style={styles.userSheetHeroTitle}>{getInquiryDisplayName(selectedInquiryToDelete) || 'Inquiry'}</Text>
                  <Text style={styles.userSheetHeroSubtitle}>{[selectedInquiryToDelete?.vehicleId?.brand, selectedInquiryToDelete?.vehicleId?.model].filter(Boolean).join(' ') || 'Vehicle'}</Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  This inquiry will be permanently deleted from the database.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity style={styles.deleteSheetPrimaryButton} onPress={submitInquiryDelete} activeOpacity={0.9} disabled={inquiryDeleteLoading}>
                {inquiryDeleteLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="message-remove-outline" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Delete Inquiry</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={vehicleModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closeVehicleModal}
      >
        <View style={styles.vehicleEditorSheetScreen}>
          <View style={[styles.vehicleEditorSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.vehicleEditorSheetTopBar}>
              <View style={styles.vehicleEditorSheetTitleWrap}>
                <Text style={styles.vehicleEditorSheetTitle}>{vehicleModalMode === 'edit' ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
              </View>
            </View>

            <View style={styles.vehicleEditorSheetFormBody}>
              <VehicleEditorForm
                existing={vehicleModalMode === 'edit' ? selectedVehicle : null}
                onClose={closeVehicleModal}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', position: 'relative' },
  dashboardFilterDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  tabsWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eef2f7', zIndex: 8 },
  topTitleRow: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 22 },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#111111', letterSpacing: -0.3 },
  tabs: { maxHeight: 58 },
  tabsContent: { paddingHorizontal: 18, gap: 8, alignItems: 'center', paddingBottom: 10 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: '#f3f4f6' },
  tabPillActive: { backgroundColor: '#111111' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  contentWrap: { flex: 1, zIndex: 8 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  avatarImage: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#f3f4f6' },
  avatarFallback: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  avatarText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerCopy: { flex: 1, marginLeft: 14 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#111111', letterSpacing: -0.7 },
  headerSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 21, color: '#6b7280' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  headerNotificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNotificationBadgeText: { fontSize: 10, fontWeight: '900', color: '#ffffff' },
  heroCard: { borderRadius: 28, backgroundColor: '#f9fafb', padding: 22, borderWidth: 1, borderColor: '#eef2f7', marginBottom: 24 },
  eyebrow: { fontSize: 12, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  chartCopy: { flex: 1 },
  chartTitle: { marginTop: 8, fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#111111', letterSpacing: -0.7 },
  chartSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 21, color: '#6b7280' },
  ringCard: { width: 118, alignItems: 'center', justifyContent: 'center' },
  ringTrack: { width: 104, height: 16, borderRadius: Radius.full, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#e5e7eb', marginBottom: 14 },
  ringSlice: { height: '100%' },
  ringValue: { fontSize: 28, fontWeight: '900', color: '#111111', letterSpacing: -0.6 },
  ringLabel: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#6b7280' },
  barChart: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', rowGap: 18, columnGap: 12, minHeight: 162, marginBottom: 18 },
  barItem: { width: '30%', alignItems: 'center' },
  barTrack: { width: '100%', maxWidth: 54, height: 100, borderRadius: 18, justifyContent: 'flex-end', backgroundColor: '#eef2f7', padding: 6, marginBottom: 10 },
  barFill: { width: '100%', borderRadius: 12, minHeight: 8 },
  barValue: { fontSize: 16, fontWeight: '900', color: '#111111' },
  barLabel: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  dashboardFilterWrap: { position: 'relative', zIndex: 12, elevation: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionCopy: { flex: 1, marginRight: 12 },
  sectionTitle: { fontSize: 24, fontWeight: '900', color: '#111111', letterSpacing: -0.5 },
  sectionSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 20, color: '#6b7280' },
  sectionAction: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: '#f3f4f6' },
  sectionActionText: { fontSize: 12, fontWeight: '800', color: '#111111' },
  dashboardFilterButton: {
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
    marginTop: 2,
    ...Shadow.sm,
  },
  dashboardFilterButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  dashboardFilterMenu: {
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
  dashboardFilterMenuItem: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  dashboardFilterMenuItemActive: {
    backgroundColor: '#f3f4f6',
  },
  dashboardFilterMenuItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  dashboardFilterMenuItemTextActive: {
    color: '#111111',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 },
  statCard: { width: '47%', borderRadius: 24, padding: 18, marginBottom: 0 },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#111111', letterSpacing: -0.8 },
  statLabel: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6 },
  moduleGrid: { gap: 12, marginBottom: 22 },
  moduleCard: { borderRadius: 24, borderWidth: 1, borderColor: '#eef2f7', backgroundColor: '#fff', padding: 18, ...Shadow.sm },
  moduleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', marginBottom: 12 },
  moduleBadge: { marginBottom: 12 },
  moduleTitle: { fontSize: 16, fontWeight: '900', color: '#111111' },
  moduleSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 20, color: '#6b7280' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  promotionRail: {
    paddingBottom: 6,
    paddingHorizontal: 6,
    gap: 14,
    marginBottom: 24,
  },
  promotionPreviewThumb: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#f3f4f6' },
  promotionPreviewThumbFallback: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  quickButton: { minWidth: '47%', flex: 1, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', flexDirection: 'row', alignItems: 'center', gap: 10, ...Shadow.sm },
  quickAccent: { backgroundColor: '#ffd400', borderColor: '#ffd400' },
  quickText: { fontSize: 13, fontWeight: '800', color: '#111111' },
  quickStatCard: { minWidth: '30%', flex: 1, paddingVertical: 18, alignItems: 'center', marginBottom: 0 },
  quickStatValue: { fontSize: 26, fontWeight: '900', color: '#111111', letterSpacing: -0.7 },
  quickStatLabel: { marginTop: 6, fontSize: 12, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6 },
  mediaThumbFallbackOnly: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  quickAccentText: { fontSize: 13, fontWeight: '900', color: '#111111' },
  hardDeleteVaultCard: {
    borderRadius: 26,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  hardDeleteVaultCardLocked: {
    backgroundColor: '#fffafa',
  },
  hardDeleteLockState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  hardDeleteLockBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  hardDeleteLockCopy: {
    flex: 1,
    minWidth: 0,
  },
  hardDeleteLockTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
  },
  hardDeleteLockText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7280',
    fontWeight: '700',
  },
  hardDeleteVaultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  hardDeleteVaultTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  hardDeleteVaultEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hardDeleteVaultTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  hardDeleteVaultText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    fontWeight: '700',
  },
  hardDeleteLockButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: '#fee2e2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hardDeleteLockButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  hardDeleteNoticeCard: {
    marginTop: 16,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  hardDeleteNoticeText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: '#7f1d1d',
  },
  hardDeleteTypeRow: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 4,
  },
  hardDeleteTypeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hardDeleteTypeButtonActive: {
    backgroundColor: '#b91c1c',
    borderColor: '#b91c1c',
  },
  hardDeleteTypeButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#334155',
  },
  hardDeleteTypeButtonTextActive: {
    color: '#ffffff',
  },
  hardDeleteSearchWrap: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hardDeleteSearchInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 14,
    color: '#111111',
  },
  hardDeleteResultsLabel: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '900',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  hardDeleteRecordList: {
    marginTop: 12,
    gap: 12,
  },
  hardDeleteRecordRow: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 12,
  },
  hardDeleteRecordTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  hardDeleteRecordIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  hardDeleteRecordCopy: {
    flex: 1,
    minWidth: 0,
  },
  hardDeleteRecordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  hardDeleteRecordTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
  hardDeleteRecordBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: '#fef2f2',
  },
  hardDeleteRecordBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b91c1c',
    textTransform: 'uppercase',
  },
  hardDeleteRecordSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
    fontWeight: '700',
  },
  hardDeleteRecordHelper: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  hardDeleteRecordAction: {
    minHeight: 42,
    borderRadius: Radius.full,
    backgroundColor: '#b91c1c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  hardDeleteRecordActionDisabled: {
    opacity: 0.75,
  },
  hardDeleteRecordActionText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  listCard: { borderRadius: 26, marginBottom: 16 },
  listRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f7', paddingVertical: 4 },
  lastRow: { borderBottomWidth: 0 },
  visualRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, flexShrink: 1 },
  mediaStrip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mediaThumb: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#f3f4f6' },
  mediaThumbRound: { borderRadius: 23 },
  mediaThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  mediaThumbText: { fontSize: 12, fontWeight: '900', color: '#6b7280' },
  vehiclePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  vehicleThumb: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#f3f4f6' },
  vehicleThumbFallback: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  userPremiumBadge: { marginTop: 1 },
  listTitle: { fontSize: 14, fontWeight: '800', color: '#111111' },
  listSubtitle: { marginTop: 2, fontSize: 12, lineHeight: 18, color: '#6b7280' },
  listPriceText: { marginTop: 4, fontSize: 12, lineHeight: 18, fontWeight: '800', color: '#111111' },
  recordCard: { borderRadius: 24, marginBottom: 14 },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  managerStatusSide: { alignItems: 'flex-end', justifyContent: 'flex-start', gap: 10, paddingTop: 2, marginLeft: 'auto', flexShrink: 0 },
  managerToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  managerToggleLabel: { fontSize: 12, fontWeight: '800', color: '#6b7280' },
  actionRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginTop: 16 },
  actionButton: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 12, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  bookingDecisionButton: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 13 },
  secondaryActionButton: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: '#fff7cc', alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { fontSize: 13, fontWeight: '800', color: '#8a6b00' },
  neutralButton: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  neutralText: { fontSize: 13, fontWeight: '800', color: '#111111' },
  dangerButton: { backgroundColor: '#dc2626' },
  dangerText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  inlineReasonText: { marginTop: 12, fontSize: 13, lineHeight: 20, color: '#b91c1c', fontWeight: '700' },
  adminReviewReplyCard: { marginTop: 12 },
  reviewStatusBlock: { alignItems: 'flex-end', gap: 10 },
  reviewCardToggleRow: { alignItems: 'center', gap: 8 },
  reviewCardToggleLabel: { fontSize: 11, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  note: { marginTop: 10, fontSize: 13, lineHeight: 20, color: '#4b5563' },
  modalBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  modalBlurLayer: { ...StyleSheet.absoluteFillObject },
  modalDimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.20)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#eef2f7', ...Shadow.md },
  hardDeleteGateModal: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  promotionDetailModal: { width: '100%', maxWidth: 520, maxHeight: '78%', alignSelf: 'center' },
  dashboardModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  notificationOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  notificationOverlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.26)',
  },
  notificationPopup: {
    width: '100%',
    maxHeight: '78%',
    borderRadius: 28,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#eef2f7',
    alignSelf: 'center',
    ...Shadow.lg,
  },
  notificationPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  notificationPopupTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
  },
  notificationPopupCount: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  notificationPopupCountText: { fontSize: 13, fontWeight: '900', color: '#ffffff' },
  notificationList: { gap: 12, paddingBottom: 4 },
  adminNotificationCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eef2f7',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  adminNotificationAccent: { width: 4, borderRadius: 999 },
  adminNotificationImage: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#f3f4f6' },
  adminNotificationImageFallback: { alignItems: 'center', justifyContent: 'center' },
  adminNotificationCopy: { flex: 1, minWidth: 0 },
  adminNotificationMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  adminNotificationTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: '#111111' },
  adminNotificationTime: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  adminNotificationMessage: { marginTop: 6, fontSize: 13, lineHeight: 19, color: '#4b5563' },
  adminNotificationFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  adminNotificationActorBadge: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: '#f8fafc' },
  adminNotificationActorText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  adminNotificationToneBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.full },
  adminNotificationToneText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  notificationEmptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  notificationEmptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  promotionDetailImage: { width: '100%', height: 184, borderRadius: 20, backgroundColor: '#fff7ed', marginBottom: 16 },
  modalFloatingCloseButton: { position: 'absolute', top: '15%', right: 28, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#eef2f7', ...Shadow.sm, zIndex: 3 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111111' },
  modalSubtitle: { marginTop: 8, marginBottom: 16, fontSize: 13, lineHeight: 20, color: '#6b7280' },
  modalInput: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', paddingHorizontal: 14, fontSize: 15, color: '#111111', marginBottom: 12 },
  modalInputWrap: { position: 'relative', marginBottom: 12 },
  modalInputWithToggle: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', paddingLeft: 14, paddingRight: 52, fontSize: 15, color: '#111111' },
  modalInputToggle: { position: 'absolute', top: 0, right: 0, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  modalError: { marginTop: 2, marginBottom: 10, fontSize: 12, fontWeight: '700', color: '#dc2626' },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalSecondaryButton: { flex: 1, height: 48, borderRadius: Radius.full, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  modalSecondaryText: { fontSize: 14, fontWeight: '800', color: '#111111' },
  modalPrimaryButton: { flex: 1, height: 48, borderRadius: Radius.full, backgroundColor: '#ffd400', alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { fontSize: 14, fontWeight: '900', color: '#111111' },
  modalButtonDisabled: { opacity: 0.7 },
  reviewReasonModalScroll: { width: '100%' },
  reviewReasonModalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingTop: 18 },
  reviewReasonModalCard: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderWidth: 1, borderColor: '#eef2f7', ...Shadow.md },
  reviewReasonHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  reviewReasonCopy: { flex: 1, paddingRight: 8 },
  reviewReasonCloseButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7' },
  reviewReasonLabel: { marginTop: 12, fontSize: 13, lineHeight: 20, color: '#64748b', fontWeight: '700' },
  reviewReasonInput: { height: 112, marginTop: 14, paddingTop: 16, textAlignVertical: 'top' },
  reviewSheetTextArea: { minHeight: 132, height: 132, marginTop: 8 },
  reviewSheetBodyText: { marginTop: 4, fontSize: 15, lineHeight: 23, fontWeight: '700', color: '#111111' },
  reviewSheetGallery: { gap: 12, paddingTop: 8, paddingBottom: 4 },
  reviewSheetImage: { width: 148, height: 108, borderRadius: 18, backgroundColor: '#f8fafc' },
  reviewToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 4 },
  reviewToggleCopy: { flex: 1, paddingRight: 8 },
  reviewToggleTitle: { fontSize: 15, fontWeight: '900', color: '#111111' },
  reviewToggleSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 20, color: '#6b7280', fontWeight: '700' },
  actionButtonDisabled: { opacity: 0.45 },
  bookingSlipCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#eef2f7', ...Shadow.md },
  bookingSlipPreview: { width: '100%', height: 420, borderRadius: 20, backgroundColor: '#f8fafc' },
  bookingDetailSlipPreview: { width: '100%', height: 260, borderRadius: 18, backgroundColor: '#f8fafc', marginTop: 8 },
  bookingSlipFallback: { height: 220, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bookingSlipFallbackText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  userSheetScrollContent: { paddingBottom: 4 },
  userSheetHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  userSheetHeroCopy: {
    flex: 1,
  },
  userSheetHeroTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  userSheetHeroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
    fontWeight: '700',
  },
  userInfoSection: { borderRadius: 22, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#eef2f7', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14 },
  userInfoSectionTitle: { marginBottom: 6, fontSize: 13, fontWeight: '900', color: '#111111', textTransform: 'uppercase', letterSpacing: 0.6 },
  userInfoRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  userInfoRowLast: { borderBottomWidth: 0 },
  userInfoLabel: { fontSize: 11, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  userInfoValue: { marginTop: 4, fontSize: 15, lineHeight: 22, fontWeight: '700', color: '#111111' },
  vehicleSheet: { width: '100%' },
  vehicleSheetCloseRow: { alignItems: 'flex-end', marginBottom: 14, paddingRight: 2 },
  vehicleSheetCloseButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#eef2f7', ...Shadow.sm },
  vehicleSheetCard: { height: '92%', backgroundColor: '#f8fafc', borderRadius: 30, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 10, borderWidth: 1, borderColor: '#eef2f7', ...Shadow.md },
  vehicleSheetTitle: { fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#111111', letterSpacing: -0.7 },
  vehicleSheetSubtitle: { marginTop: 8, marginBottom: 18, fontSize: 14, lineHeight: 21, color: '#6b7280' },
  vehicleSheetFormBody: { flex: 1, minHeight: 0 },
  vehicleEditorSheetScreen: { flex: 1, backgroundColor: '#ffffff' },
  vehicleEditorSheet: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  vehicleEditorSheetTopBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  vehicleEditorSheetTitleWrap: { flex: 1 },
  vehicleEditorSheetTitle: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: '#111111', letterSpacing: -0.9 },
  vehicleEditorSheetSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 22, color: '#6b7280' },
  vehicleEditorSheetFormBody: { flex: 1, minHeight: 0, marginTop: 18 },
  quickViewGallery: { gap: 12, paddingBottom: 4 },
  quickViewImage: { width: 260, height: 180, borderRadius: 22, backgroundColor: '#f3f4f6' },
  quickViewImageFallback: {
    height: 180,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  quickViewImageFallbackText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  quickViewBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  quickViewInfoSection: { marginTop: 18 },
  quickViewSectionTitle: { fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#111111', letterSpacing: -0.7 },
  quickViewPriceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  quickViewPrice: { fontSize: 18, fontWeight: '900', color: '#111111' },
  quickViewPriceOld: { fontSize: 14, fontWeight: '800', color: '#94a3b8', textDecorationLine: 'line-through' },
  quickViewSectionLabel: { marginBottom: 10, fontSize: 13, fontWeight: '900', color: '#111111', textTransform: 'uppercase', letterSpacing: 0.6 },
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
  quickViewDescriptionCard: {
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eef2f7',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickViewDescriptionText: { fontSize: 14, lineHeight: 22, color: '#4b5563', fontWeight: '600' },
});




