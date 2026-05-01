import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, inquiryAPI, promotionAPI, vehicleAPI } from '../../api';
import LogoutConfirmationSheet from '../../components/LogoutConfirmationSheet';
import CalendarDateField from '../../components/CalendarDateField';
import SuccessToast from '../../components/SuccessToast';
import {
  Badge,
  Card,
  EmptyState,
  LoadingSpinner,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
} from '../../components/UI';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatPromotionDiscountValue,
  getPromotionComputedStatus,
  getPromotionDateRangeLabel,
  getPromotionScope,
  getPromotionScopeLabel,
  getPromotionScopeTypeLabel,
  getVehiclePromotion,
  promotionMatchesVehicle,
} from '../../utils/promotionUtils';

const PROMOTION_TYPES = ['Seasonal', 'Featured', 'Flash Sale'];
const DISCOUNT_TYPES = [
  { key: 'percentage', label: 'Percentage' },
  { key: 'amount', label: 'Amount' },
];
const SCOPE_OPTIONS = [
  { key: 'all', label: 'All vehicles', icon: 'car-multiple' },
  { key: 'brand', label: 'Brand', icon: 'alpha-b-circle-outline' },
  { key: 'model', label: 'Model', icon: 'shape-outline' },
  { key: 'category', label: 'Category', icon: 'view-grid-outline' },
];
const INQUIRY_ACTIONS = ['Resolved', 'Rejected'];
const SCHEDULED_STATUS = 'Scheduled';

const imageUri = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (value.startsWith('http')) {
    return value;
  }

  return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const initials = (name) => (
  String(name || 'Marketing')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M'
);

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

const formatDate = (value, fallback = 'No date') => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) {
    return 'No activity yet';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const uniqueValues = (values = []) => [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeDigits = (value) => String(value || '').replace(/[^\d]/g, '');

const sanitizePercentageInput = (value) => {
  const text = String(value || '').replace(/[^0-9.]/g, '');
  if (!text) {
    return '';
  }

  const [wholePart = '', ...decimalParts] = text.split('.');
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, '') || (text.startsWith('.') ? '0' : wholePart);
  const decimalPart = decimalParts.join('').slice(0, 2);
  const normalized = decimalParts.length ? `${normalizedWhole}.${decimalPart}` : normalizedWhole;

  if (!normalized || normalized === '.') {
    return '';
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return normalized;
  }

  if (parsed > 100) {
    return '100';
  }

  return normalized;
};

const clampPercentageValue = (value) => {
  return sanitizePercentageInput(value);
};

const formatGroupedNumber = (value) => {
  const digits = sanitizeDigits(value);
  if (!digits) {
    return '';
  }

  return Number(digits).toLocaleString('en-US');
};

const getAutomaticPromotionStatus = (startDate, today = getTodayDateString()) => {
  if (startDate && startDate > today) {
    return SCHEDULED_STATUS;
  }

  return 'Active';
};

const buildInitialForm = (promotion = null) => {
  const scope = getPromotionScope(promotion || {});
  const discountType = promotion?.discountType === 'amount' ? 'amount' : 'percentage';
  const scopeKind = scope.kind === 'vehicle' ? 'all' : scope.kind;
  const startDate = promotion?.startDate || '';

  return {
    title: promotion?.title || '',
    description: promotion?.description || '',
    promotionType: promotion?.promotionType || PROMOTION_TYPES[0],
    targetListingType: promotion?.targetListingType || '',
    discountType,
    discountPercentage: discountType === 'percentage' ? String(promotion?.discountPercentage ?? '') : '',
    discountAmount: discountType === 'amount' ? String(promotion?.discountAmount ?? '') : '',
    scopeKind,
    targetVehicleIds: [],
    targetBrand: scope.brands[0] || '',
    targetModel: scope.models[0] || '',
    targetCategory: scope.categories[0] || '',
    startDate,
    endDate: promotion?.endDate || '',
    status: getAutomaticPromotionStatus(startDate),
    highlightLabel: promotion?.highlightLabel || '',
    showOnInventoryBanner: promotion?.showOnInventoryBanner !== false,
    showOnVehicleCard: promotion?.showOnVehicleCard !== false,
    showOnVehicleDetails: promotion?.showOnVehicleDetails !== false,
    image: promotion?.imageUrl
      ? {
        existing: true,
        uri: imageUri(promotion.imageUrl),
      }
      : null,
  };
};

const validatePromotionForm = (form, options = {}) => {
  const nextErrors = {};
  const minimumStartDate = options.minimumStartDate || getTodayDateString();

  if (!form.title.trim()) {
    nextErrors.title = 'Promotion title is required.';
  }

  if (!form.startDate.trim()) {
    nextErrors.startDate = 'Start date is required.';
  } else if (form.startDate.trim() < minimumStartDate) {
    nextErrors.startDate = 'Start date cannot be earlier than the allowed minimum date.';
  }

  if (!form.endDate.trim()) {
    nextErrors.endDate = 'End date is required.';
  } else if (form.startDate.trim() && form.endDate.trim() < form.startDate.trim()) {
    nextErrors.endDate = 'End date must be later than or equal to the start date.';
  }

  if (form.discountType === 'amount') {
    if (!sanitizeDigits(form.discountAmount).trim()) {
      nextErrors.discountAmount = 'Discount amount is required.';
    } else if (Number(sanitizeDigits(form.discountAmount)) <= 0) {
      nextErrors.discountAmount = 'Discount amount must be greater than 0.';
    }
  } else if (!String(form.discountPercentage || '').trim()) {
    nextErrors.discountPercentage = 'Discount percentage is required.';
  } else if (Number(form.discountPercentage) <= 0) {
    nextErrors.discountPercentage = 'Discount percentage must be greater than 0.';
  } else if (Number(form.discountPercentage) > 100) {
    nextErrors.discountPercentage = 'Discount percentage cannot exceed 100.';
  }

  if (form.scopeKind === 'brand' && !form.targetBrand.trim()) {
    nextErrors.scope = 'Target brand is required.';
  }
  if (form.scopeKind === 'model' && !form.targetModel.trim()) {
    nextErrors.scope = 'Target model is required.';
  }
  if (form.scopeKind === 'category' && !form.targetCategory.trim()) {
    nextErrors.scope = 'Target category is required.';
  }

  return nextErrors;
};

function SectionHeader({ title, subtitle, actionLabel, onActionPress }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {!!actionLabel && (
        <TouchableOpacity style={styles.sectionAction} onPress={onActionPress} activeOpacity={0.88}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SummaryStatCard({ label, value, icon, bg }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color="#111111" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function ModuleCard({ title, meta, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.moduleCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.moduleIcon}>
        <MaterialCommunityIcons name={icon} size={20} color="#111111" />
      </View>
      <Badge label={meta} color="#111111" bg="#f3f4f6" style={styles.moduleBadge} />
      <Text style={styles.moduleTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function DashboardListCard({ children }) {
  return <Card style={styles.listCard}>{children}</Card>;
}

function PromotionFormSection({ icon, title, subtitle, children }) {
  return (
    <View style={styles.composerSection}>
      <View style={styles.composerSectionHeader}>
        <View style={styles.composerSectionIcon}>
          <MaterialCommunityIcons name={icon} size={18} color="#111111" />
        </View>
        <View style={styles.composerSectionCopy}>
          <Text style={styles.composerSectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.composerSectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function PromotionField({
  label,
  error,
  multiline = false,
  style,
  inputStyle,
  suffix,
  ...props
}) {
  return (
    <View style={[styles.composerFieldWrap, style]}>
      {!!label && <Text style={styles.composerFieldLabel}>{label}</Text>}
      <View style={styles.composerFieldShell}>
        <TextInput
          style={[
            styles.composerFieldInput,
            multiline && styles.composerFieldInputMultiline,
            suffix && styles.composerFieldInputWithSuffix,
            error && styles.composerFieldInputError,
            inputStyle,
          ]}
          placeholderTextColor={Colors.muted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
        />
        {!!suffix && <Text style={styles.composerFieldSuffix}>{suffix}</Text>}
      </View>
      {!!error && <Text style={styles.composerFieldError}>{error}</Text>}
    </View>
  );
}

function PromotionSelectField({ label, value, placeholder, error, onPress }) {
  return (
    <View style={styles.composerFieldWrap}>
      {!!label && <Text style={styles.composerFieldLabel}>{label}</Text>}
      <TouchableOpacity
        style={[styles.selectFieldButton, error && styles.composerFieldInputError]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <Text style={[styles.selectFieldValue, !value && styles.selectFieldPlaceholder]}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.muted} />
      </TouchableOpacity>
      {!!error && <Text style={styles.composerFieldError}>{error}</Text>}
    </View>
  );
}

function PromotionSwitchRow({ title, subtitle, value, onValueChange, showDivider = false }) {
  return (
    <>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.switchSubtitle}>{subtitle}</Text>}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: '#facc15', false: '#d1d5db' }}
          thumbColor="#ffffff"
          ios_backgroundColor="#d1d5db"
        />
      </View>
      {showDivider ? <View style={styles.switchDivider} /> : null}
    </>
  );
}

export default function MarketingDashboardScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const autoJumpedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const floatingOpacity = useRef(new Animated.Value(1)).current;
  const floatingTranslateY = useRef(new Animated.Value(0)).current;

  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [promotionModalVisible, setPromotionModalVisible] = useState(false);
  const [optionSelector, setOptionSelector] = useState({
    visible: false,
    field: '',
    title: '',
    subtitle: '',
    options: [],
    value: '',
  });
  const [formMode, setFormMode] = useState('create');
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [selectedPromotionDetail, setSelectedPromotionDetail] = useState(null);
  const [promotionDetailVisible, setPromotionDetailVisible] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState(null);
  const [promotionDeleteVisible, setPromotionDeleteVisible] = useState(false);
  const [promotionDeleteLoading, setPromotionDeleteLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [promotions, setPromotions] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(buildInitialForm());

  const firstName = String(user?.fullName || 'Marketing Manager').trim().split(/\s+/)[0] || 'Marketing';
  const todayDate = getTodayDateString();
  const minimumStartDate = useMemo(() => {
    const existingStartDate = String(editingPromotion?.startDate || '').trim();
    if (formMode === 'edit' && existingStartDate && existingStartDate < todayDate) {
      return existingStartDate;
    }

    return todayDate;
  }, [editingPromotion, formMode, todayDate]);

  const registerSection = (key) => (event) => {
    sectionOffsets.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToSection = useCallback((key) => {
    const offset = sectionOffsets.current[key];
    if (typeof offset !== 'number') {
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(offset - 14, 0),
      animated: true,
    });
  }, []);

  const loadDashboard = useCallback(async ({ pullToRefresh = false } = {}) => {
    if (pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [promotionRes, inquiryRes, vehicleRes] = await Promise.all([
        promotionAPI.getAll(),
        inquiryAPI.getAll(),
        vehicleAPI.getAll(),
      ]);

      setPromotions(Array.isArray(promotionRes.data) ? promotionRes.data : []);
      setInquiries(Array.isArray(inquiryRes.data) ? inquiryRes.data : []);
      setVehicles(Array.isArray(vehicleRes.data) ? vehicleRes.data : []);
    } catch (error) {
      showAlert(
        'Unable to load marketing dashboard',
        error?.response?.data?.message || 'The latest campaign and inquiry data could not be loaded right now.',
        undefined,
        { tone: 'danger' },
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (autoJumpedRef.current || route.name !== 'PromotionManagement' || loading) {
      return;
    }

    const timer = setTimeout(() => {
      scrollToSection('campaigns');
      autoJumpedRef.current = true;
    }, 260);

    return () => clearTimeout(timer);
  }, [loading, route.name, scrollToSection]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(floatingOpacity, {
        toValue: floatingVisible ? 1 : 0,
        duration: floatingVisible ? 160 : 140,
        useNativeDriver: true,
      }),
      Animated.timing(floatingTranslateY, {
        toValue: floatingVisible ? 0 : 84,
        duration: floatingVisible ? 180 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [floatingOpacity, floatingTranslateY, floatingVisible]);

  const refresh = () => loadDashboard({ pullToRefresh: true });

  const handleScroll = useCallback((event) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const delta = currentY - lastScrollYRef.current;

    if (currentY <= 24) {
      if (!floatingVisible) {
        setFloatingVisible(true);
      }
      lastScrollYRef.current = currentY;
      return;
    }

    if (delta > 8 && floatingVisible) {
      setFloatingVisible(false);
    } else if (delta < -8 && !floatingVisible) {
      setFloatingVisible(true);
    }

    lastScrollYRef.current = currentY;
  }, [floatingVisible]);

  const allBrands = useMemo(() => uniqueValues(vehicles.map((vehicle) => vehicle?.brand)), [vehicles]);
  const allModels = useMemo(() => uniqueValues(vehicles.map((vehicle) => vehicle?.model)), [vehicles]);
  const allCategories = useMemo(() => uniqueValues(vehicles.map((vehicle) => vehicle?.category)), [vehicles]);

  const activePromotions = useMemo(
    () => promotions.filter((item) => getPromotionComputedStatus(item) === 'Active'),
    [promotions],
  );
  const inactivePromotions = useMemo(
    () => promotions.filter((item) => getPromotionComputedStatus(item) === 'Inactive'),
    [promotions],
  );
  const expiredPromotions = useMemo(
    () => promotions.filter((item) => getPromotionComputedStatus(item) === 'Expired'),
    [promotions],
  );
  const pendingInquiries = useMemo(
    () => inquiries.filter((item) => String(item?.status || 'Pending') === 'Pending'),
    [inquiries],
  );
  const resolvedInquiries = useMemo(
    () => inquiries.filter((item) => String(item?.status || '') === 'Resolved'),
    [inquiries],
  );

  const promotedVehicles = useMemo(() => (
    vehicles
      .map((vehicle) => ({
        vehicle,
        promotion: getVehiclePromotion(vehicle, activePromotions, { placement: 'vehicleCard' }),
      }))
      .filter((item) => item.promotion)
  ), [activePromotions, vehicles]);

  const featuredVehicleHighlights = useMemo(
    () => promotedVehicles.slice(0, 4),
    [promotedVehicles],
  );

  const featuredCampaigns = useMemo(() => (
    [...activePromotions]
      .sort((left, right) => Number(right?.priority || 0) - Number(left?.priority || 0))
      .slice(0, 4)
  ), [activePromotions]);

  const recentActivities = useMemo(() => {
    const promotionItems = promotions.map((promotion) => ({
      id: `promotion-${promotion._id}`,
      icon: 'tag-heart-outline',
      title: promotion.title,
      subtitle: `${formatPromotionDiscountValue(promotion) || 'Offer'} | ${getPromotionComputedStatus(promotion)}`,
      status: getPromotionComputedStatus(promotion),
      timestamp: promotion.updatedAt || promotion.createdAt,
    }));

    const inquiryItems = inquiries.map((inquiry) => ({
      id: `inquiry-${inquiry._id}`,
      icon: inquiry.status === 'Pending' ? 'message-alert-outline' : 'message-check-outline',
      title: inquiry.customerName || 'Customer inquiry',
      subtitle: `${inquiry.status || 'Pending'} | ${inquiry.vehicleId?.brand || ''} ${inquiry.vehicleId?.model || ''}`.trim(),
      status: inquiry.status || 'Pending',
      timestamp: inquiry.updatedAt || inquiry.createdAt || inquiry.inquiryDate,
    }));

    return [...promotionItems, ...inquiryItems]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 6);
  }, [inquiries, promotions]);

  const overviewStats = [
    ['Active Campaigns', activePromotions.length, 'tag-heart-outline', '#eef2ff'],
    ['Pending Leads', pendingInquiries.length, 'message-processing-outline', '#fff7ed'],
    ['Promoted Vehicles', promotedVehicles.length, 'car-multiple', '#ecfeff'],
    ['Expired Offers', expiredPromotions.length, 'clock-alert-outline', '#fffbeb'],
  ];

  const ringSegments = [
    { label: 'Active', value: activePromotions.length, color: '#111111' },
    { label: 'Inactive', value: inactivePromotions.length, color: '#9ca3af' },
    { label: 'Expired', value: expiredPromotions.length, color: '#f59e0b' },
  ];

  const ringTotal = ringSegments.reduce((sum, item) => sum + item.value, 0);
  const maxChartValue = Math.max(...ringSegments.map((item) => item.value), 1);

  const modules = [
    [
      'Campaign Board',
      'Create offers, edit campaigns, and manage active date ranges in one place.',
      `${promotions.length} total`,
      'tag-multiple-outline',
      () => scrollToSection('campaigns'),
    ],
    [
      'Lead Follow-up',
      'Review pending inquiries and resolve the newest customer leads quickly.',
      `${pendingInquiries.length} waiting`,
      'message-processing-outline',
      () => scrollToSection('leads'),
    ],
    [
      'Promotion Highlights',
      'See which campaigns are currently featured and what inventory they affect.',
      `${featuredCampaigns.length} featured`,
      'bullhorn-outline',
      () => scrollToSection('highlights'),
    ],
    [
      'Vehicle Reach',
      'Check how active promotions connect to live sale and rental listings.',
      `${promotedVehicles.length} matched`,
      'car-sports',
      () => scrollToSection('vehicles'),
    ],
  ];

  const openCreatePromotion = () => {
    setFormMode('create');
    setEditingPromotion(null);
    setForm(buildInitialForm());
    setFormErrors({});
    setPromotionModalVisible(true);
  };

  const showSuccessToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  }, []);

  const openEditPromotion = (promotion) => {
    setFormMode('edit');
    setEditingPromotion(promotion);
    setForm(buildInitialForm(promotion));
    setFormErrors({});
    setPromotionModalVisible(true);
  };

  const openPromotionDetail = useCallback((promotion) => {
    setSelectedPromotionDetail(promotion);
    setPromotionDetailVisible(true);
  }, []);

  const closePromotionDetail = useCallback(() => {
    setPromotionDetailVisible(false);
    setSelectedPromotionDetail(null);
  }, []);

  const closePromotionModal = (force = false) => {
    if (submitting && !force) {
      return;
    }

    setPromotionModalVisible(false);
    setOptionSelector((prev) => ({ ...prev, visible: false }));
    setFormErrors({});
  };

  const updateFormField = (key, value) => {
    setForm((prev) => {
      const nextForm = { ...prev, [key]: value };

      if (key === 'discountType') {
        if (value === 'amount') {
          nextForm.discountPercentage = '';
        } else {
          nextForm.discountAmount = '';
        }
      }

      if (key === 'startDate') {
        nextForm.status = getAutomaticPromotionStatus(value, todayDate);
        if (nextForm.endDate && nextForm.endDate < value) {
          nextForm.endDate = '';
        }
      }

      if (key === 'discountPercentage') {
        nextForm.discountPercentage = clampPercentageValue(value);
      }

      if (key === 'discountAmount') {
        nextForm.discountAmount = sanitizeDigits(value);
      }

      return nextForm;
    });
    setFormErrors((prev) => ({ ...prev, [key]: undefined, scope: undefined }));
  };

  const handleScopeChange = (scopeKind) => {
    setForm((prev) => ({
      ...prev,
      scopeKind,
      targetVehicleIds: [],
      targetBrand: scopeKind === 'brand' ? prev.targetBrand : '',
      targetModel: scopeKind === 'model' ? prev.targetModel : '',
      targetCategory: scopeKind === 'category' ? prev.targetCategory : '',
    }));
    setOptionSelector((prev) => ({ ...prev, visible: false }));
    setFormErrors((prev) => ({ ...prev, scope: undefined }));
  };

  const openOptionSelector = (field) => {
    const selectorMap = {
      targetBrand: {
        title: 'Select Brand',
        subtitle: 'Choose a brand from your existing inventory data.',
        options: allBrands,
        value: form.targetBrand,
      },
      targetModel: {
        title: 'Select Model',
        subtitle: 'Choose a model from your existing inventory data.',
        options: allModels,
        value: form.targetModel,
      },
      targetCategory: {
        title: 'Select Category',
        subtitle: 'Choose a category from your existing inventory data.',
        options: allCategories,
        value: form.targetCategory,
      },
    };

    const nextConfig = selectorMap[field];
    if (!nextConfig) {
      return;
    }

    if (optionSelector.visible && optionSelector.field === field) {
      closeOptionSelector();
      return;
    }

    setOptionSelector({
      visible: true,
      field,
      ...nextConfig,
    });
  };

  const closeOptionSelector = () => {
    setOptionSelector((prev) => ({ ...prev, visible: false }));
  };

  const handleOptionSelect = (value) => {
    if (!optionSelector.field) {
      return;
    }

    updateFormField(optionSelector.field, value);
    closeOptionSelector();
  };

  const pickPromotionImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    updateFormField('image', {
      existing: false,
      uri: asset.uri,
      name: asset.fileName || `promotion_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const buildPromotionFormData = () => {
    const scopePayload = {
      kind: form.scopeKind,
      vehicleIds: [],
      brands: form.scopeKind === 'brand' && form.targetBrand.trim() ? [form.targetBrand.trim()] : [],
      models: form.scopeKind === 'model' && form.targetModel.trim() ? [form.targetModel.trim()] : [],
      categories: form.scopeKind === 'category' && form.targetCategory.trim() ? [form.targetCategory.trim()] : [],
    };

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      promotionType: form.promotionType,
      targetListingType: form.targetListingType || '',
      discountType: form.discountType,
      discountPercentage: form.discountType === 'percentage' ? String(form.discountPercentage || '').trim() : '',
      discountAmount: form.discountType === 'amount' ? sanitizeDigits(form.discountAmount) : '',
      startDate: form.startDate.trim(),
      endDate: form.endDate.trim(),
      status: getAutomaticPromotionStatus(form.startDate.trim(), todayDate),
      highlightLabel: form.highlightLabel.trim(),
      priority: '0',
      showOnInventoryBanner: String(form.showOnInventoryBanner),
      showOnVehicleCard: String(form.showOnVehicleCard),
      showOnVehicleDetails: String(form.showOnVehicleDetails),
      targetBrand: scopePayload.brands[0] || '',
      targetModel: scopePayload.models[0] || '',
      targetCategory: scopePayload.categories[0] || '',
      targetVehicleIds: JSON.stringify(scopePayload.vehicleIds),
      targetScope: JSON.stringify(scopePayload),
    };

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    if (form.image?.uri && form.image.existing === false) {
      formData.append('image', {
        uri: form.image.uri,
        name: form.image.name,
        type: form.image.type,
      });
    }

    return formData;
  };

  const submitPromotion = async () => {
    const nextErrors = validatePromotionForm(form, { minimumStartDate });
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      showAlert('Complete the promotion form', 'Please fix the highlighted fields before saving.', undefined, { tone: 'warning' });
      return;
    }

    setSubmitting(true);

    try {
      const formData = buildPromotionFormData();

      if (formMode === 'edit' && editingPromotion?._id) {
        await promotionAPI.update(editingPromotion._id, formData);
        showSuccessToast('Promotion updated');
      } else {
        await promotionAPI.add(formData);
        showSuccessToast('Promotion created');
      }

      closePromotionModal(true);
      await loadDashboard();
    } catch (error) {
      showAlert(
        formMode === 'edit' ? 'Update failed' : 'Creation failed',
        error?.response?.data?.message || 'Unable to save this promotion right now.',
        undefined,
        { tone: 'danger' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const togglePromotionStatus = async (promotion) => {
    const nextStatus = promotion.baseStatus === 'Active' ? 'Inactive' : 'Active';

    try {
      await promotionAPI.updateStatus(promotion._id, nextStatus);
      showSuccessToast(nextStatus === 'Active' ? 'Promotion activated' : 'Promotion deactivated');
      await loadDashboard({ pullToRefresh: true });
    } catch (error) {
      showAlert('Status update failed', error?.response?.data?.message || 'Unable to update promotion status right now.', undefined, { tone: 'danger' });
    }
  };

  const closePromotionDeleteModal = useCallback(() => {
    if (promotionDeleteLoading) {
      return;
    }

    setPromotionDeleteVisible(false);
    setPromotionToDelete(null);
  }, [promotionDeleteLoading]);

  const openPromotionDeleteModal = useCallback((promotion) => {
    setPromotionToDelete(promotion);
    setPromotionDeleteVisible(true);
  }, []);

  const submitPromotionDelete = useCallback(async () => {
    if (!promotionToDelete?._id || promotionDeleteLoading) {
      return;
    }

    setPromotionDeleteLoading(true);
    try {
      await promotionAPI.delete(promotionToDelete._id);
      showSuccessToast('Promotion removed');
      setPromotionDeleteVisible(false);
      setPromotionToDelete(null);
      await loadDashboard();
    } catch (error) {
      showAlert('Delete failed', error?.response?.data?.message || 'Unable to delete this promotion right now.', undefined, { tone: 'danger' });
    } finally {
      setPromotionDeleteLoading(false);
    }
  }, [loadDashboard, promotionDeleteLoading, promotionToDelete, showAlert]);

  const updateInquiryStatus = async (inquiryId, status) => {
    try {
      await inquiryAPI.updateStatus(inquiryId, status);
      await loadDashboard();
    } catch (error) {
      showAlert('Inquiry update failed', error?.response?.data?.message || 'Unable to update inquiry status right now.', undefined, { tone: 'danger' });
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading marketing dashboard..." />;
  }

  return (
    <>
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top + 6, 18), paddingBottom: Math.max(insets.bottom + 120, 132) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.blue} />}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerIdentity}>
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle} numberOfLines={1}>Hi, Marketing</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>Manager</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={refresh} activeOpacity={0.88}>
              <MaterialCommunityIcons name="refresh" size={20} color="#111111" />
            </TouchableOpacity>
          </View>

          <Card style={styles.heroCard}>
            <View style={styles.chartHeader}>
              <View style={styles.chartCopy}>
                <Text style={styles.eyebrow}>Live Activity</Text>
                <Text style={styles.chartTitle}>Campaign pulse</Text>
              </View>

              <View style={styles.ringCard}>
                <View style={styles.ringTrack}>
                  {ringSegments.map((segment) => (
                    <View
                      key={segment.label}
                      style={[
                        styles.ringSlice,
                        {
                          flex: ringTotal > 0 ? segment.value || 0.15 : 1,
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
              {ringSegments.map((segment) => (
                <View key={segment.label} style={styles.barItem}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max((segment.value / maxChartValue) * 100, segment.value > 0 ? 16 : 6)}%`,
                          backgroundColor: segment.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>{segment.value}</Text>
                  <Text style={styles.barLabel}>{segment.label}</Text>
                </View>
              ))}
            </View>
          </Card>

          <View onLayout={registerSection('campaigns')}>
            <SectionHeader title="Campaign Board" actionLabel="New Campaign" onActionPress={openCreatePromotion} />
            {promotions.length ? (
              promotions.map((promotion) => {
                const matchedCount = vehicles.filter((vehicle) => promotionMatchesVehicle(promotion, vehicle, { placement: 'vehicleCard' })).length;

                return (
                  <Card key={promotion._id} style={styles.recordCard}>
                    <TouchableOpacity style={styles.recordHeader} onPress={() => openPromotionDetail(promotion)} activeOpacity={0.9}>
                      {promotion?.imageUrl ? (
                        <Image source={{ uri: imageUri(promotion.imageUrl) }} style={styles.campaignBannerThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.mediaThumbFallback}>
                          <MaterialCommunityIcons name="tag-multiple-outline" size={18} color="#9ca3af" />
                        </View>
                      )}
                      <View style={styles.listCopy}>
                        <View style={styles.campaignTitleRow}>
                          <Text style={styles.listTitle}>{promotion.title}</Text>
                          <StatusBadge status={getPromotionComputedStatus(promotion)} />
                        </View>
                        <View style={styles.campaignDetailList}>
                          <View style={styles.campaignDetailRow}>
                            <Text style={styles.campaignDetailLabel}>Type</Text>
                            <Text style={styles.campaignDetailValue}>{promotion.promotionType || 'Promotion'}</Text>
                          </View>
                          <View style={styles.campaignDetailDivider} />
                          <View style={styles.campaignDetailRow}>
                            <Text style={styles.campaignDetailLabel}>Discount</Text>
                            <Text style={styles.campaignDetailValue}>{formatPromotionDiscountValue(promotion) || 'Not set'}</Text>
                          </View>
                          <View style={styles.campaignDetailDivider} />
                          <View style={styles.campaignDetailRow}>
                            <Text style={styles.campaignDetailLabel}>Scope</Text>
                            <Text style={styles.campaignDetailValue}>{getPromotionScopeLabel(promotion, vehicles)}</Text>
                          </View>
                          <View style={styles.campaignDetailDivider} />
                          <View style={styles.campaignDetailRow}>
                            <Text style={styles.campaignDetailLabel}>Dates</Text>
                            <Text style={styles.campaignDetailValue}>{getPromotionDateRangeLabel(promotion) || 'Not set'}</Text>
                          </View>
                          <View style={styles.campaignDetailDivider} />
                          <View style={styles.campaignDetailRow}>
                            <Text style={styles.campaignDetailLabel}>Matches</Text>
                            <Text style={styles.campaignDetailValue}>{matchedCount} listings</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.campaignMetaPanel}>
                      <Text style={styles.campaignMetaTitle}>Visibility</Text>
                      <View style={styles.badgeRow}>
                        <Badge label={getPromotionScopeTypeLabel(promotion)} color="#111111" bg="#f3f4f6" />
                        <Badge label={promotion.showOnInventoryBanner === false ? 'Banner Off' : 'Banner On'} color="#111111" bg="#f3f4f6" />
                        <Badge label={promotion.showOnVehicleCard === false ? 'Cards Off' : 'Cards On'} color="#111111" bg="#f3f4f6" />
                        <Badge label={promotion.showOnVehicleDetails === false ? 'Details Off' : 'Details On'} color="#111111" bg="#f3f4f6" />
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.secondaryActionButton} onPress={() => openEditPromotion(promotion)} activeOpacity={0.88}>
                        <Text style={styles.secondaryActionText}>Edit Campaign</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionButton, styles.quickAccent]} onPress={() => togglePromotionStatus(promotion)} activeOpacity={0.88}>
                        <Text style={styles.quickAccentText}>{promotion.baseStatus === 'Active' ? 'Deactivate' : 'Activate'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={() => openPromotionDeleteModal(promotion)} activeOpacity={0.88}>
                        <Text style={styles.dangerText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })
            ) : (
              <DashboardListCard>
                <EmptyState
                  icon="tag-plus-outline"
                  title="No promotions available"
                />
              </DashboardListCard>
            )}
          </View>

          <View onLayout={registerSection('modules')}>
            <SectionHeader title="Management Modules" />
            <View style={styles.moduleGrid}>
              {modules.map(([title, subtitle, meta, icon, action]) => (
                <ModuleCard
                  key={title}
                  title={title}
                  meta={meta}
                  icon={icon}
                  onPress={action}
                />
              ))}
            </View>
          </View>

          <View onLayout={registerSection('snapshot')}>
            <SectionHeader title="Promotion Snapshot" />
            <View style={styles.quickRow}>
              <Card style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{activePromotions.length}</Text>
                <Text style={styles.quickStatLabel}>Active</Text>
              </Card>
              <Card style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{inactivePromotions.length}</Text>
                <Text style={styles.quickStatLabel}>Inactive</Text>
              </Card>
              <Card style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{expiredPromotions.length}</Text>
                <Text style={styles.quickStatLabel}>Expired</Text>
              </Card>
            </View>
          </View>

          <View onLayout={registerSection('highlights')}>
            <SectionHeader title="Featured Campaigns" actionLabel="Create" onActionPress={openCreatePromotion} />
            <DashboardListCard>
              {featuredCampaigns.length ? (
                featuredCampaigns.map((promotion, index) => (
                  <View key={promotion._id} style={[styles.listRow, index === featuredCampaigns.length - 1 && styles.lastRow]}>
                    <View style={styles.visualRow}>
                      <View style={styles.mediaThumbFallback}>
                        <MaterialCommunityIcons name="bullhorn-outline" size={18} color="#9ca3af" />
                      </View>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{promotion.title}</Text>
                        <Text style={styles.listSubtitle}>
                          {[promotion.promotionType || 'Promotion', formatPromotionDiscountValue(promotion), getPromotionScopeLabel(promotion, vehicles)].filter(Boolean).join(' | ')}
                        </Text>
                      </View>
                    </View>
                    <StatusBadge status={getPromotionComputedStatus(promotion)} />
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="tag-plus-outline"
                  title="No featured campaigns yet"
                />
              )}
            </DashboardListCard>
          </View>

          <View onLayout={registerSection('vehicles')}>
            <SectionHeader title="Vehicle Promotion Reach" />
            <DashboardListCard>
              {featuredVehicleHighlights.length ? (
                featuredVehicleHighlights.map((item, index) => (
                  <View key={item.vehicle._id} style={[styles.listRow, index === featuredVehicleHighlights.length - 1 && styles.lastRow]}>
                    <View style={styles.visualRow}>
                      {item.vehicle?.image1 ? (
                        <Image source={{ uri: imageUri(item.vehicle.image1) }} style={styles.vehicleThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.vehicleThumbFallback}>
                          <MaterialCommunityIcons name="car-sports" size={20} color="#9ca3af" />
                        </View>
                      )}
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{item.vehicle.brand} {item.vehicle.model}</Text>
                        <Text style={styles.listSubtitle}>
                          {[item.vehicle.listingType, item.vehicle.category, formatCurrency(item.vehicle.price)].filter(Boolean).join(' | ')}
                        </Text>
                        <Text style={styles.note}>
                          {item.promotion.title} | {formatPromotionDiscountValue(item.promotion)}
                        </Text>
                      </View>
                    </View>
                    <Badge label={getPromotionScopeTypeLabel(item.promotion)} color="#111111" bg="#f3f4f6" />
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="car-multiple"
                  title="No promoted vehicles yet"
                />
              )}
            </DashboardListCard>
          </View>

          <View onLayout={registerSection('leads')}>
            <SectionHeader title="Inquiry Queue" />
            <DashboardListCard>
              {inquiries.length ? (
                inquiries.slice(0, 8).map((inquiry, index) => (
                  <View key={inquiry._id} style={[styles.listRow, index === Math.min(inquiries.length, 8) - 1 && styles.lastRow]}>
                    <View style={styles.visualRow}>
                      <View style={styles.mediaStrip}>
                        {inquiry.vehicleId?.image1 ? (
                          <Image source={{ uri: imageUri(inquiry.vehicleId.image1) }} style={styles.mediaThumb} resizeMode="cover" />
                        ) : (
                          <View style={styles.mediaThumbFallback}>
                            <MaterialCommunityIcons name="car-sports" size={18} color="#9ca3af" />
                          </View>
                        )}
                        <View style={[styles.mediaThumbFallback, styles.mediaThumbRound]}>
                          <Text style={styles.mediaThumbText}>{initials(inquiry.customerName)}</Text>
                        </View>
                      </View>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{inquiry.customerName}</Text>
                        <Text style={styles.listSubtitle}>{[inquiry.email, inquiry.phone].filter(Boolean).join(' | ')}</Text>
                        <Text style={styles.note}>
                          {[`${inquiry.vehicleId?.brand || 'Vehicle'} ${inquiry.vehicleId?.model || ''}`.trim(), `Received ${formatDate(inquiry.inquiryDate || inquiry.createdAt)}`].filter(Boolean).join(' | ')}
                        </Text>
                        {!!inquiry.message && <Text style={styles.note} numberOfLines={2}>{inquiry.message}</Text>}
                      </View>
                    </View>
                    <View style={styles.recordSide}>
                      <StatusBadge status={inquiry.status || 'Pending'} />
                      {String(inquiry.status || 'Pending') === 'Pending' ? (
                        <View style={styles.miniActionRow}>
                          {INQUIRY_ACTIONS.map((status) => (
                            <TouchableOpacity
                              key={status}
                              style={[styles.miniActionButton, status === 'Rejected' && styles.miniActionButtonDanger]}
                              onPress={() => updateInquiryStatus(inquiry._id, status)}
                              activeOpacity={0.88}
                            >
                              <Text style={[styles.miniActionText, status === 'Rejected' && styles.miniActionTextDanger]}>{status}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="message-text-outline"
                  title="No inquiries yet"
                />
              )}
            </DashboardListCard>
          </View>

          <View onLayout={registerSection('activity')}>
            <SectionHeader title="Recent Activity" />
            <DashboardListCard>
              {recentActivities.length ? (
                recentActivities.map((activity, index) => (
                  <View key={activity.id} style={[styles.listRow, index === recentActivities.length - 1 && styles.lastRow]}>
                    <View style={styles.visualRow}>
                      <View style={styles.mediaThumbFallback}>
                        <MaterialCommunityIcons name={activity.icon} size={18} color="#9ca3af" />
                      </View>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{activity.title}</Text>
                        <Text style={styles.listSubtitle}>{activity.subtitle}</Text>
                      </View>
                    </View>
                    <View style={styles.recordSide}>
                      <StatusBadge status={activity.status} />
                      <Text style={styles.timeStamp}>{formatDateTime(activity.timestamp)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="history"
                  title="No recent activity"
                />
              )}
            </DashboardListCard>
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={promotionModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closePromotionModal}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.modalScreen}
            contentContainerStyle={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalTopBar}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>{formMode === 'edit' ? 'Edit Promotion' : 'Create Promotion'}</Text>
              </View>
            </View>

            <View style={styles.modalContent}>
              <PromotionFormSection
                icon="card-text-outline"
                title="Basic information"
              >
                <PromotionField
                  label="Title"
                  value={form.title}
                  onChangeText={(value) => updateFormField('title', value)}
                  placeholder="Weekend SUV Campaign"
                  error={formErrors.title}
                />
                <PromotionField
                  label="Description"
                  value={form.description}
                  onChangeText={(value) => updateFormField('description', value)}
                  placeholder="Short campaign description"
                  multiline
                />
              </PromotionFormSection>

              <PromotionFormSection
                icon="brightness-percent"
                title="Promotion configuration"
              >
                <Text style={styles.fieldLabel}>Promotion type</Text>
                <View style={styles.optionWrap}>
                  {PROMOTION_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.optionChip, styles.optionChipCompact, form.promotionType === type && styles.optionChipSelected]}
                      onPress={() => updateFormField('promotionType', type)}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.optionChipText, form.promotionType === type && styles.optionChipTextSelected]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Discount style</Text>
                <View style={styles.optionWrap}>
                  {DISCOUNT_TYPES.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.optionChip, form.discountType === item.key && styles.optionChipSelected]}
                      onPress={() => updateFormField('discountType', item.key)}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.optionChipText, form.discountType === item.key && styles.optionChipTextSelected]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {form.discountType === 'amount' ? (
                  <PromotionField
                    label="Discount amount"
                    value={formatGroupedNumber(form.discountAmount)}
                    onChangeText={(value) => updateFormField('discountAmount', value)}
                    placeholder="10,000"
                    keyboardType="numeric"
                    error={formErrors.discountAmount}
                  />
                ) : (
                  <PromotionField
                    label="Discount percentage"
                    value={form.discountPercentage}
                    onChangeText={(value) => updateFormField('discountPercentage', value)}
                    placeholder="10"
                    keyboardType="numeric"
                    error={formErrors.discountPercentage}
                    suffix="%"
                  />
                )}

                <PromotionField
                  label="Highlight label"
                  value={form.highlightLabel}
                  onChangeText={(value) => updateFormField('highlightLabel', value)}
                  placeholder="Limited time"
                />
              </PromotionFormSection>

              <PromotionFormSection
                icon="crosshairs-gps"
                title="Scope"
              >
                <Text style={styles.fieldLabel}>Applicable scope</Text>
                <View style={styles.optionWrap}>
                  {SCOPE_OPTIONS.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.optionChip, form.scopeKind === item.key && styles.optionChipSelected]}
                      onPress={() => handleScopeChange(item.key)}
                      activeOpacity={0.88}
                    >
                      <MaterialCommunityIcons name={item.icon} size={16} color={form.scopeKind === item.key ? '#111111' : Colors.muted} />
                      <Text style={[styles.optionChipText, form.scopeKind === item.key && styles.optionChipTextSelected]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.scopeKind === 'brand' ? (
                  <>
                    <PromotionSelectField
                      label="Target brand"
                      value={form.targetBrand}
                      placeholder="Select a brand"
                      error={formErrors.scope}
                      onPress={() => openOptionSelector('targetBrand')}
                    />
                    {optionSelector.visible && optionSelector.field === 'targetBrand' ? (
                      <View style={styles.inlineSelectorCard}>
                        <View style={styles.selectorHeader}>
                          <View style={styles.selectorHeaderCopy}>
                            <Text style={styles.selectorTitle}>{optionSelector.title}</Text>
                          </View>
                          <TouchableOpacity onPress={closeOptionSelector} activeOpacity={0.88}>
                            <MaterialCommunityIcons name="close" size={20} color="#111111" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.inlineSelectorList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {optionSelector.options.length ? (
                            optionSelector.options.map((item) => {
                              const selected = optionSelector.value === item;

                              return (
                                <TouchableOpacity
                                  key={item}
                                  style={[styles.selectorRow, selected && styles.selectorRowSelected]}
                                  onPress={() => handleOptionSelect(item)}
                                  activeOpacity={0.88}
                                >
                                  <View style={[styles.selectorCheck, selected && styles.selectorCheckSelected]}>
                                    {selected ? <MaterialCommunityIcons name="check" size={16} color="#ffffff" /> : null}
                                  </View>
                                  <View style={styles.selectorVehicleCopy}>
                                    <Text style={styles.selectorVehicleTitle}>{item}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          ) : (
                            <EmptyState icon="format-list-bulleted-square" title="No options available" />
                          )}
                        </ScrollView>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {form.scopeKind === 'model' ? (
                  <>
                    <PromotionSelectField
                      label="Target model"
                      value={form.targetModel}
                      placeholder="Select a model"
                      error={formErrors.scope}
                      onPress={() => openOptionSelector('targetModel')}
                    />
                    {optionSelector.visible && optionSelector.field === 'targetModel' ? (
                      <View style={styles.inlineSelectorCard}>
                        <View style={styles.selectorHeader}>
                          <View style={styles.selectorHeaderCopy}>
                            <Text style={styles.selectorTitle}>{optionSelector.title}</Text>
                          </View>
                          <TouchableOpacity onPress={closeOptionSelector} activeOpacity={0.88}>
                            <MaterialCommunityIcons name="close" size={20} color="#111111" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.inlineSelectorList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {optionSelector.options.length ? (
                            optionSelector.options.map((item) => {
                              const selected = optionSelector.value === item;

                              return (
                                <TouchableOpacity
                                  key={item}
                                  style={[styles.selectorRow, selected && styles.selectorRowSelected]}
                                  onPress={() => handleOptionSelect(item)}
                                  activeOpacity={0.88}
                                >
                                  <View style={[styles.selectorCheck, selected && styles.selectorCheckSelected]}>
                                    {selected ? <MaterialCommunityIcons name="check" size={16} color="#ffffff" /> : null}
                                  </View>
                                  <View style={styles.selectorVehicleCopy}>
                                    <Text style={styles.selectorVehicleTitle}>{item}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          ) : (
                            <EmptyState icon="format-list-bulleted-square" title="No options available" />
                          )}
                        </ScrollView>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {form.scopeKind === 'category' ? (
                  <>
                    <PromotionSelectField
                      label="Target category"
                      value={form.targetCategory}
                      placeholder="Select a category"
                      error={formErrors.scope}
                      onPress={() => openOptionSelector('targetCategory')}
                    />
                    {optionSelector.visible && optionSelector.field === 'targetCategory' ? (
                      <View style={styles.inlineSelectorCard}>
                        <View style={styles.selectorHeader}>
                          <View style={styles.selectorHeaderCopy}>
                            <Text style={styles.selectorTitle}>{optionSelector.title}</Text>
                          </View>
                          <TouchableOpacity onPress={closeOptionSelector} activeOpacity={0.88}>
                            <MaterialCommunityIcons name="close" size={20} color="#111111" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.inlineSelectorList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {optionSelector.options.length ? (
                            optionSelector.options.map((item) => {
                              const selected = optionSelector.value === item;

                              return (
                                <TouchableOpacity
                                  key={item}
                                  style={[styles.selectorRow, selected && styles.selectorRowSelected]}
                                  onPress={() => handleOptionSelect(item)}
                                  activeOpacity={0.88}
                                >
                                  <View style={[styles.selectorCheck, selected && styles.selectorCheckSelected]}>
                                    {selected ? <MaterialCommunityIcons name="check" size={16} color="#ffffff" /> : null}
                                  </View>
                                  <View style={styles.selectorVehicleCopy}>
                                    <Text style={styles.selectorVehicleTitle}>{item}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          ) : (
                            <EmptyState icon="format-list-bulleted-square" title="No options available" />
                          )}
                        </ScrollView>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </PromotionFormSection>

              <PromotionFormSection
                icon="calendar-range"
                title="Schedule"
              >
                <View style={styles.fieldRow}>
                  <View style={styles.rowField}>
                    <CalendarDateField
                      label="Start date"
                      value={form.startDate}
                      onChange={(value) => updateFormField('startDate', value)}
                      minDate={minimumStartDate}
                      error={formErrors.startDate}
                    />
                  </View>
                  <View style={styles.rowField}>
                    <CalendarDateField
                      label="End date"
                      value={form.endDate}
                      onChange={(value) => updateFormField('endDate', value)}
                      minDate={form.startDate || minimumStartDate}
                      error={formErrors.endDate}
                    />
                  </View>
                </View>
              </PromotionFormSection>

              <PromotionFormSection
                icon="eye-outline"
                title="Status and visibility"
              >
                <View style={styles.statusPreviewCard}>
                  <View style={styles.statusPreviewCopy}>
                    <Text style={styles.statusPreviewLabel}>Campaign status</Text>
                  </View>
                  <StatusBadge status={form.status} />
                </View>

                <View style={styles.switchCard}>
                  <PromotionSwitchRow
                    title="Show on inventory banner"
                    value={form.showOnInventoryBanner}
                    onValueChange={(value) => updateFormField('showOnInventoryBanner', value)}
                    showDivider
                  />
                  <PromotionSwitchRow
                    title="Show on vehicle cards"
                    value={form.showOnVehicleCard}
                    onValueChange={(value) => updateFormField('showOnVehicleCard', value)}
                    showDivider
                  />
                  <PromotionSwitchRow
                    title="Show on vehicle details"
                    value={form.showOnVehicleDetails}
                    onValueChange={(value) => updateFormField('showOnVehicleDetails', value)}
                  />
                </View>
              </PromotionFormSection>

              <PromotionFormSection
                icon="image-outline"
                title="Promotion visual"
              >
                <TouchableOpacity style={styles.uploadPanelButton} onPress={pickPromotionImage} activeOpacity={0.88}>
                  <MaterialCommunityIcons name={form.image?.uri ? 'image-edit-outline' : 'image-plus'} size={18} color="#111111" />
                  <Text style={styles.uploadPanelButtonText}>{form.image?.uri ? 'Replace visual' : 'Upload visual'}</Text>
                </TouchableOpacity>

                {form.image?.uri ? (
                  <View style={styles.promoImageWrap}>
                    <Image source={{ uri: form.image.uri }} style={styles.promoImagePreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImageButton} onPress={() => updateFormField('image', null)} activeOpacity={0.88}>
                      <MaterialCommunityIcons name="close" size={16} color="#111111" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyImageState}>
                    <MaterialCommunityIcons name="image-outline" size={26} color="#94a3b8" />
                  </View>
                )}
              </PromotionFormSection>
            </View>

            <View style={styles.modalFooter}>
              <SecondaryButton title="Cancel" onPress={closePromotionModal} style={[styles.modalFooterButton, styles.modalFooterButtonSecondary]} />
              <PrimaryButton
                title={formMode === 'edit' ? 'Save Changes' : 'Create Promotion'}
                onPress={submitPromotion}
                loading={submitting}
                style={[styles.modalFooterButton, styles.modalFooterButtonPrimary]}
                textStyle={styles.modalFooterPrimaryText}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={promotionDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closePromotionDetail}
      >
        <View style={styles.modalScreen}>
          <View style={[styles.deleteSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.deleteSheetBody} showsVerticalScrollIndicator={false}>
              {selectedPromotionDetail?.imageUrl ? (
                <Image source={{ uri: imageUri(selectedPromotionDetail.imageUrl) }} style={styles.promotionDetailHeroImage} resizeMode="cover" />
              ) : (
                <View style={styles.promotionDetailHeroFallback}>
                  <MaterialCommunityIcons name="tag-multiple-outline" size={34} color="#94a3b8" />
                </View>
              )}

              <View style={styles.promotionDetailHeaderBlock}>
                <View style={styles.promotionDetailTitleRow}>
                  <Text style={styles.modalTitle}>{selectedPromotionDetail?.title || 'Promotion Details'}</Text>
                  <StatusBadge status={selectedPromotionDetail ? getPromotionComputedStatus(selectedPromotionDetail) : 'Inactive'} />
                </View>
                {!!selectedPromotionDetail?.description ? (
                  <Text style={styles.promotionDetailDescription}>{selectedPromotionDetail.description}</Text>
                ) : null}
              </View>

              <View style={styles.promotionDetailGrid}>
                <View style={styles.promotionDetailCard}>
                  <Text style={styles.promotionDetailCardLabel}>Type</Text>
                  <Text style={styles.promotionDetailCardValue}>{selectedPromotionDetail?.promotionType || 'Promotion'}</Text>
                </View>
                <View style={styles.promotionDetailCard}>
                  <Text style={styles.promotionDetailCardLabel}>Discount</Text>
                  <Text style={styles.promotionDetailCardValue}>{selectedPromotionDetail ? (formatPromotionDiscountValue(selectedPromotionDetail) || 'Not set') : 'Not set'}</Text>
                </View>
                <View style={styles.promotionDetailCard}>
                  <Text style={styles.promotionDetailCardLabel}>Scope</Text>
                  <Text style={styles.promotionDetailCardValue}>{selectedPromotionDetail ? (getPromotionScopeLabel(selectedPromotionDetail, vehicles) || 'All vehicles') : 'All vehicles'}</Text>
                </View>
                <View style={styles.promotionDetailCard}>
                  <Text style={styles.promotionDetailCardLabel}>Scope Type</Text>
                  <Text style={styles.promotionDetailCardValue}>{selectedPromotionDetail ? getPromotionScopeTypeLabel(selectedPromotionDetail) : 'All vehicles'}</Text>
                </View>
                <View style={styles.promotionDetailCard}>
                  <Text style={styles.promotionDetailCardLabel}>Schedule</Text>
                  <Text style={styles.promotionDetailCardValue}>{selectedPromotionDetail ? (getPromotionDateRangeLabel(selectedPromotionDetail) || 'Not set') : 'Not set'}</Text>
                </View>
                <View style={styles.promotionDetailCard}>
                  <Text style={styles.promotionDetailCardLabel}>Matched Vehicles</Text>
                  <Text style={styles.promotionDetailCardValue}>
                    {vehicles.filter((vehicle) => promotionMatchesVehicle(selectedPromotionDetail, vehicle, { placement: 'vehicleCard' })).length} listings
                  </Text>
                </View>
              </View>

              <View style={styles.campaignMetaPanel}>
                <Text style={styles.campaignMetaTitle}>Visibility</Text>
                <View style={styles.badgeRow}>
                  <Badge label={selectedPromotionDetail?.showOnInventoryBanner === false ? 'Banner Off' : 'Banner On'} color="#111111" bg="#f3f4f6" />
                  <Badge label={selectedPromotionDetail?.showOnVehicleCard === false ? 'Cards Off' : 'Cards On'} color="#111111" bg="#f3f4f6" />
                  <Badge label={selectedPromotionDetail?.showOnVehicleDetails === false ? 'Details Off' : 'Details On'} color="#111111" bg="#f3f4f6" />
                  <Badge label={selectedPromotionDetail?.targetListingType || 'All'} color="#111111" bg="#f3f4f6" />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={promotionDeleteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={closePromotionDeleteModal}
      >
        <View style={styles.modalScreen}>
          <View style={[styles.deleteSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <ScrollView style={styles.deleteSheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.deleteSheetMediaCard}>
                {promotionToDelete?.imageUrl ? (
                  <Image source={{ uri: imageUri(promotionToDelete.imageUrl) }} style={styles.deleteSheetMediaImage} resizeMode="cover" />
                ) : (
                  <View style={styles.deleteSheetMediaFallback}>
                    <MaterialCommunityIcons name="tag-outline" size={36} color="#cbd5e1" />
                  </View>
                )}
                <View style={styles.deleteSheetMediaShade} />
                <View style={styles.deleteSheetMediaContent}>
                  <Text style={styles.deleteSheetMediaTitle}>
                    {promotionToDelete?.title || 'Promotion'}
                  </Text>
                  <Text style={styles.deleteSheetMediaSubtitle}>
                    {promotionToDelete?.promotionType || 'Campaign'}
                  </Text>
                </View>
              </View>

              <View style={styles.deleteSheetInfoCard}>
                <Text style={styles.deleteSheetInfoText}>
                  This promotion will be permanently deleted from the marketing dashboard.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.deleteSheetFooter}>
              <TouchableOpacity
                style={[styles.deleteSheetPrimaryButton, styles.deleteSheetDangerButton]}
                onPress={submitPromotionDelete}
                activeOpacity={0.9}
                disabled={promotionDeleteLoading}
              >
                {promotionDeleteLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="delete-outline" size={18} color="#ffffff" />
                    <Text style={styles.deleteSheetPrimaryText}>Delete Promotion</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View pointerEvents="box-none" style={styles.floatingWrap}>
        <Animated.View
          pointerEvents={floatingVisible ? 'auto' : 'none'}
          style={[
            styles.floatingActions,
            {
              bottom: insets.bottom + 12,
              opacity: floatingOpacity,
              transform: [{ translateY: floatingTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.floatingPrimaryButton}
            onPress={openCreatePromotion}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons name="bullhorn-outline" size={22} color="#111111" />
            <View style={styles.floatingPrimaryBadge}>
              <MaterialCommunityIcons name="plus" size={10} color="#111111" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.floatingSecondaryButton}
            onPress={() => setLogoutVisible(true)}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons name="logout-variant" size={20} color="#dc2626" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <LogoutConfirmationSheet
        visible={logoutVisible}
        onClose={() => setLogoutVisible(false)}
        onConfirm={logout}
      />
      <SuccessToast visible={toastVisible} message={toastMessage} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f6f8fc',
  },
  scrollContent: {
    paddingHorizontal: 18,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 12,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
    lineHeight: 31,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#f9fafb',
    padding: 22,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  chartCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chartTitle: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.7,
  },
  chartSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
  },
  ringCard: {
    width: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    width: 104,
    height: 16,
    borderRadius: Radius.full,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    marginBottom: 14,
  },
  ringSlice: {
    height: '100%',
  },
  ringValue: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  ringLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  barChart: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    rowGap: 18,
    columnGap: 12,
    minHeight: 162,
    marginBottom: 18,
  },
  barItem: {
    width: '30%',
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    maxWidth: 54,
    height: 104,
    borderRadius: 18,
    justifyContent: 'flex-end',
    backgroundColor: '#eef2f7',
    padding: 6,
    marginBottom: 10,
  },
  barFill: {
    width: '100%',
    borderRadius: 12,
    minHeight: 8,
  },
  barValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  barLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },
  sectionAction: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 18,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
  },
  statLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.sm,
  },
  moduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleBadge: {
    marginTop: 16,
  },
  moduleTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccent: {
    backgroundColor: '#fde047',
    borderColor: '#fde047',
  },
  quickAccentText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  quickStatCard: {
    minWidth: 108,
    paddingVertical: 20,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
  },
  quickStatLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  listCard: {
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  visualRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  listCopy: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  listSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  note: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  campaignDetailList: {
    marginTop: 8,
    paddingTop: 2,
  },
  campaignTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  campaignDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 14,
    paddingVertical: 7,
  },
  campaignDetailDivider: {
    height: 1,
    backgroundColor: '#eef2f7',
  },
  campaignDetailLabel: {
    minWidth: 64,
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
  },
  campaignDetailValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    color: '#111111',
  },
  recordCard: {
    padding: 18,
  },
  campaignBannerThumb: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordSide: {
    alignItems: 'flex-end',
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  campaignMetaPanel: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  campaignMetaTitle: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '900',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  dangerButton: {
    backgroundColor: '#fee2e2',
  },
  dangerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#b91c1c',
  },
  mediaStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaThumb: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  mediaThumbFallback: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  mediaThumbRound: {
    borderRadius: 21,
  },
  mediaThumbText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
  vehicleThumb: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  vehicleThumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  miniActionRow: {
    gap: 8,
    alignItems: 'flex-end',
  },
  miniActionButton: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: '#ecfdf3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniActionButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  miniActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  miniActionTextDanger: {
    color: '#b91c1c',
  },
  timeStamp: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'right',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalSheet: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.9,
  },
  modalSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#6b7280',
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  modalFooterButton: {
    flex: 1,
    borderRadius: Radius.full,
  },
  modalFooterButtonSecondary: {
    borderRadius: Radius.full,
  },
  modalFooterButtonPrimary: {
    backgroundColor: '#facc15',
    borderColor: '#facc15',
    borderRadius: Radius.full,
  },
  modalFooterPrimaryText: {
    color: '#111111',
  },
  deleteSheet: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  deleteSheetBody: {
    flex: 1,
    minHeight: 0,
  },
  deleteSheetMediaCard: {
    minHeight: 208,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#111111',
    justifyContent: 'flex-end',
  },
  deleteSheetMediaImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  deleteSheetMediaFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  deleteSheetMediaShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  deleteSheetMediaContent: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 6,
  },
  deleteSheetMediaTitle: {
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.7,
  },
  deleteSheetMediaSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.84)',
  },
  deleteSheetInfoCard: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  deleteSheetInfoText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: '#9a3412',
  },
  deleteSheetFooter: {
    paddingTop: 18,
  },
  deleteSheetPrimaryButton: {
    minHeight: 56,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteSheetDangerButton: {
    backgroundColor: '#dc2626',
  },
  deleteSheetPrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  promotionDetailHeroImage: {
    width: '100%',
    height: 220,
    borderRadius: 28,
  },
  promotionDetailHeroFallback: {
    width: '100%',
    height: 220,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  promotionDetailHeaderBlock: {
    paddingTop: 18,
    gap: 10,
  },
  promotionDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  promotionDetailDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    fontWeight: '600',
  },
  promotionDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  promotionDetailCard: {
    width: '47%',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  promotionDetailCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  promotionDetailCardValue: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    color: '#111111',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10,
  },
  composerSection: {
    marginBottom: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  composerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  composerSectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  composerSectionCopy: {
    flex: 1,
  },
  composerSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  composerSectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },
  composerFieldWrap: {
    marginBottom: 16,
  },
  composerFieldShell: {
    position: 'relative',
    justifyContent: 'center',
  },
  composerFieldLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  composerFieldInput: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111111',
  },
  composerFieldInputWithSuffix: {
    paddingRight: 42,
  },
  composerFieldInputMultiline: {
    minHeight: 132,
    paddingTop: 14,
    paddingBottom: 14,
  },
  composerFieldInputError: {
    borderColor: Colors.danger,
  },
  composerFieldError: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '700',
  },
  composerFieldSuffix: {
    position: 'absolute',
    right: 16,
    fontSize: 15,
    fontWeight: '900',
    color: '#475569',
  },
  selectFieldButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectFieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  selectFieldPlaceholder: {
    color: Colors.muted,
    fontWeight: '600',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  optionChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionChipCompact: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  optionChipSelected: {
    backgroundColor: '#fef3c7',
    borderColor: '#facc15',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  optionChipTextSelected: {
    color: '#111111',
  },
  scopeCard: {
    marginBottom: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  scopeHeaderCopy: {
    flex: 1,
  },
  scopeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  scopeSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  scopeActionButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  selectedVehicleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  selectedVehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedVehicleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  scopeEmptyText: {
    marginTop: 14,
    fontSize: 12,
    color: '#6b7280',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  statusPreviewCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusPreviewCopy: {
    flex: 1,
  },
  statusPreviewLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  statusPreviewText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  switchCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  switchSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  switchDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  uploadPanelButton: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#facc15',
    backgroundColor: '#facc15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadPanelButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  promoImageWrap: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  promoImagePreview: {
    width: '100%',
    height: 184,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  emptyImageState: {
    marginTop: 16,
    height: 132,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
  },
  emptyImageText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '700',
  },
  floatingWrap: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  floatingActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  floatingSecondaryButton: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  floatingPrimaryButton: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    backgroundColor: '#ffd400',
    borderWidth: 1,
    borderColor: '#ffd400',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  floatingPrimaryBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
  },
  inlineSelectorCard: {
    marginTop: -2,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadow.sm,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  selectorHeaderCopy: {
    flex: 1,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  selectorSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  inlineSelectorList: {
    maxHeight: 240,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectorRowSelected: {
    borderColor: Colors.blueMid,
    backgroundColor: Colors.blueSoft,
  },
  selectorCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  selectorCheckSelected: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  selectorVehicleCopy: {
    flex: 1,
  },
  selectorVehicleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  selectorVehicleSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
});
