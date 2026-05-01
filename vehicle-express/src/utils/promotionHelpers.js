const mongoose = require('mongoose');

const ACTIVE_STATUS = 'Active';
const INACTIVE_STATUS = 'Inactive';
const EXPIRED_STATUS = 'Expired';
const DISABLED_STATUS = 'Disabled';

const PERCENTAGE_DISCOUNT = 'percentage';
const AMOUNT_DISCOUNT = 'amount';
const DEFAULT_PROMOTION_TYPE = 'Seasonal';
const VALID_SCOPE_KINDS = ['all', 'vehicle', 'brand', 'model', 'category'];
const DEFAULT_APP_TIME_ZONE = 'Asia/Colombo';

const normalizeText = (value) => String(value || '').trim();

const normalizeDate = (value) => {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

const safeParseNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveNumber = (value) => {
  const parsed = safeParseNumber(value);
  if (parsed === null) {
    return null;
  }

  return parsed > 0 ? parsed : null;
};

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(text)) {
    return false;
  }

  return fallback;
};

const parseStructuredValue = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
    || (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return value;
    }
  }

  return value;
};

const normalizeStringArray = (value) => {
  const parsed = parseStructuredValue(value);

  if (Array.isArray(parsed)) {
    return [...new Set(parsed.map((item) => normalizeText(item)).filter(Boolean))];
  }

  const text = normalizeText(parsed);
  if (!text) {
    return [];
  }

  return [...new Set(text.split(',').map((item) => normalizeText(item)).filter(Boolean))];
};

const normalizeObjectIdArray = (value) => normalizeStringArray(value)
  .filter((item) => mongoose.Types.ObjectId.isValid(item));

const getDateInTimeZone = (date = new Date(), timeZone = process.env.APP_TIME_ZONE || DEFAULT_APP_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  return `${year}-${month}-${day}`;
};

const getToday = () => getDateInTimeZone();

const normalizeStoredStatus = (value) => {
  const status = normalizeText(value);

  if (status === INACTIVE_STATUS || status === DISABLED_STATUS) {
    return INACTIVE_STATUS;
  }

  if (status === ACTIVE_STATUS) {
    return ACTIVE_STATUS;
  }

  return ACTIVE_STATUS;
};

const getComputedPromotionStatus = (promotion, today = getToday()) => {
  const endDate = normalizeDate(promotion?.endDate);
  if (endDate && endDate < today) {
    return EXPIRED_STATUS;
  }

  return normalizeStoredStatus(promotion?.status);
};

const normalizeDiscountType = (rawType, raw = {}) => {
  const type = normalizeText(rawType).toLowerCase();

  if (type === PERCENTAGE_DISCOUNT || type === AMOUNT_DISCOUNT) {
    return type;
  }

  if (toPositiveNumber(raw.discountAmount) !== null) {
    return AMOUNT_DISCOUNT;
  }

  return PERCENTAGE_DISCOUNT;
};

const getPromotionDiscountDefinition = (promotion) => {
  const discountType = normalizeDiscountType(promotion?.discountType, promotion);
  const discountPercentage = toPositiveNumber(promotion?.discountPercentage);
  const discountAmount = toPositiveNumber(promotion?.discountAmount);

  if (discountType === AMOUNT_DISCOUNT) {
    return {
      discountType,
      discountPercentage: null,
      discountAmount,
      discountValue: discountAmount,
    };
  }

  return {
    discountType: PERCENTAGE_DISCOUNT,
    discountPercentage,
    discountAmount: null,
    discountValue: discountPercentage,
  };
};

const getNormalizedTargetScope = (promotion = {}) => {
  const rawScope = promotion?.targetScope || {};
  let kind = normalizeText(
    rawScope.kind
    || promotion.scopeType
    || promotion.applicableVehicleScope
    || promotion.scopeKind,
  ).toLowerCase();

  const vehicleIds = normalizeObjectIdArray(
    rawScope.vehicleIds
    || rawScope.vehicles
    || promotion.targetVehicleIds
    || promotion.applicableVehicleIds,
  );
  const brands = normalizeStringArray(rawScope.brands || promotion.targetBrand);
  const models = normalizeStringArray(rawScope.models || promotion.targetModel);
  const categories = normalizeStringArray(rawScope.categories || promotion.targetCategory);

  if (!VALID_SCOPE_KINDS.includes(kind)) {
    if (normalizeBoolean(promotion.appliesToAllVehicles, false)) {
      kind = 'all';
    } else if (vehicleIds.length) {
      kind = 'vehicle';
    } else if (brands.length) {
      kind = 'brand';
    } else if (models.length) {
      kind = 'model';
    } else if (categories.length) {
      kind = 'category';
    } else {
      kind = 'all';
    }
  }

  return {
    kind,
    vehicleIds,
    brands,
    models,
    categories,
  };
};

const stringifyMatch = (value) => normalizeText(value).toLowerCase();

const arrayIncludesMatch = (items, target) => {
  const normalizedTarget = stringifyMatch(target);
  if (!normalizedTarget) {
    return false;
  }

  return items.some((item) => stringifyMatch(item) === normalizedTarget);
};

const matchesVehicle = (promotion, vehicle, options = {}) => {
  if (!promotion || !vehicle) {
    return false;
  }

  const placement = normalizeText(options.placement);
  if (placement === 'vehicleCard' && promotion.showOnVehicleCard === false) {
    return false;
  }
  if (placement === 'vehicleDetails' && promotion.showOnVehicleDetails === false) {
    return false;
  }
  if (placement === 'inventoryBanner' && promotion.showOnInventoryBanner === false) {
    return false;
  }

  const scope = getNormalizedTargetScope(promotion);
  const vehicleId = String(vehicle?._id || vehicle?.id || '');

  if (scope.kind === 'vehicle') {
    if (!vehicleId || !scope.vehicleIds.some((id) => String(id) === vehicleId)) {
      return false;
    }
  } else if (scope.kind === 'brand') {
    if (!arrayIncludesMatch(scope.brands, vehicle?.brand)) {
      return false;
    }
  } else if (scope.kind === 'model') {
    if (!arrayIncludesMatch(scope.models, vehicle?.model)) {
      return false;
    }
  } else if (scope.kind === 'category') {
    if (!arrayIncludesMatch(scope.categories, vehicle?.category)) {
      return false;
    }
  }

  const targetListingType = normalizeText(promotion.targetListingType);
  if (targetListingType && stringifyMatch(targetListingType) !== stringifyMatch(vehicle?.listingType)) {
    return false;
  }
  if (promotion.targetFuelType && stringifyMatch(promotion.targetFuelType) !== stringifyMatch(vehicle?.fuelType)) {
    return false;
  }
  if (promotion.targetVehicleCondition && stringifyMatch(promotion.targetVehicleCondition) !== stringifyMatch(vehicle?.vehicleCondition)) {
    return false;
  }

  return true;
};

const buildPromotionPayload = (raw = {}, existing = null) => {
  const source = existing ? { ...existing, ...raw } : raw;
  const scope = getNormalizedTargetScope(source);
  const discountType = normalizeDiscountType(source.discountType, source);
  const discountPercentage = discountType === PERCENTAGE_DISCOUNT
    ? toPositiveNumber(source.discountPercentage ?? source.discountValue)
    : null;
  const discountAmount = discountType === AMOUNT_DISCOUNT
    ? toPositiveNumber(source.discountAmount ?? source.discountValue)
    : null;

  return {
    title: normalizeText(source.title),
    description: normalizeText(source.description),
    promotionType: normalizeText(source.promotionType) || DEFAULT_PROMOTION_TYPE,
    discountType,
    discountPercentage,
    discountAmount,
    startDate: normalizeDate(source.startDate),
    endDate: normalizeDate(source.endDate),
    status: normalizeStoredStatus(source.status),
    priority: safeParseNumber(source.priority) ?? 0,
    highlightLabel: normalizeText(source.highlightLabel),
    appliesToAllVehicles: scope.kind === 'all',
    targetScope: scope,
    targetVehicleIds: scope.vehicleIds,
    targetBrand: scope.brands[0] || '',
    targetModel: scope.models[0] || '',
    targetCategory: scope.categories[0] || '',
    targetListingType: normalizeText(source.targetListingType),
    targetFuelType: normalizeText(source.targetFuelType),
    targetVehicleCondition: normalizeText(source.targetVehicleCondition),
    showOnInventoryBanner: normalizeBoolean(source.showOnInventoryBanner, true),
    showOnVehicleCard: normalizeBoolean(source.showOnVehicleCard, true),
    showOnVehicleDetails: normalizeBoolean(source.showOnVehicleDetails, true),
  };
};

const validatePromotionPayload = (payload) => {
  if (!payload.title) {
    return 'Promotion title is required.';
  }

  if (!payload.promotionType) {
    return 'Promotion type is required.';
  }

  if (!payload.startDate || !payload.endDate) {
    return 'Start date and end date are required in YYYY-MM-DD format.';
  }

  if (payload.endDate < payload.startDate) {
    return 'End date must be later than or equal to the start date.';
  }

  if (payload.discountType === AMOUNT_DISCOUNT) {
    if (payload.discountAmount === null) {
      return 'Discount amount must be greater than 0.';
    }
  } else if (payload.discountPercentage === null) {
    return 'Discount percentage must be greater than 0.';
  }

  if (payload.targetScope.kind === 'vehicle' && payload.targetScope.vehicleIds.length === 0) {
    return 'Select at least one target vehicle.';
  }

  if (payload.targetScope.kind === 'brand' && payload.targetScope.brands.length === 0) {
    return 'Target brand is required.';
  }

  if (payload.targetScope.kind === 'model' && payload.targetScope.models.length === 0) {
    return 'Target model is required.';
  }

  if (payload.targetScope.kind === 'category' && payload.targetScope.categories.length === 0) {
    return 'Target category is required.';
  }

  return '';
};

const serializePromotion = (promotion) => {
  const raw = promotion?.toObject ? promotion.toObject() : { ...promotion };
  const discount = getPromotionDiscountDefinition(raw);
  const targetScope = getNormalizedTargetScope(raw);
  const status = getComputedPromotionStatus(raw);

  return {
    ...raw,
    status,
    baseStatus: normalizeStoredStatus(raw.status),
    isExpired: status === EXPIRED_STATUS,
    discountType: discount.discountType,
    discountPercentage: discount.discountPercentage,
    discountAmount: discount.discountAmount,
    discountValue: discount.discountValue,
    promotionType: normalizeText(raw.promotionType) || DEFAULT_PROMOTION_TYPE,
    targetScope,
    targetVehicleIds: targetScope.vehicleIds,
  };
};

module.exports = {
  ACTIVE_STATUS,
  INACTIVE_STATUS,
  EXPIRED_STATUS,
  PERCENTAGE_DISCOUNT,
  AMOUNT_DISCOUNT,
  DEFAULT_PROMOTION_TYPE,
  buildPromotionPayload,
  getToday,
  getComputedPromotionStatus,
  getNormalizedTargetScope,
  getPromotionDiscountDefinition,
  matchesVehicle,
  serializePromotion,
  validatePromotionPayload,
};
