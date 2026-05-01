const ACTIVE_STATUS = 'Active';
const INACTIVE_STATUS = 'Inactive';
const EXPIRED_STATUS = 'Expired';
const SCHEDULED_STATUS = 'Scheduled';
const PERCENTAGE_DISCOUNT = 'percentage';
const AMOUNT_DISCOUNT = 'amount';

const normalizeText = (value) => String(value || '').trim();
const stringifyMatch = (value) => normalizeText(value).toLowerCase();

const normalizeDate = (value) => {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const positiveNumber = (value) => {
  const parsed = safeNumber(value);
  if (parsed === null) {
    return null;
  }

  return parsed > 0 ? parsed : null;
};

const getToday = () => new Date().toISOString().split('T')[0];

export function normalizePromotionStatus(status) {
  const value = normalizeText(status);
  if (value === INACTIVE_STATUS || value === 'Disabled') {
    return INACTIVE_STATUS;
  }
  if (value === ACTIVE_STATUS) {
    return ACTIVE_STATUS;
  }
  if (value === SCHEDULED_STATUS) {
    return SCHEDULED_STATUS;
  }
  return ACTIVE_STATUS;
}

export function getPromotionComputedStatus(promotion, today = getToday()) {
  const startDate = normalizeDate(promotion?.startDate);
  const endDate = normalizeDate(promotion?.endDate);
  const baseStatus = normalizePromotionStatus(promotion?.status || promotion?.baseStatus);

  if (endDate && endDate < today) {
    return EXPIRED_STATUS;
  }

  if (baseStatus === INACTIVE_STATUS) {
    return INACTIVE_STATUS;
  }

  if (startDate && startDate > today) {
    return SCHEDULED_STATUS;
  }

  return ACTIVE_STATUS;
}

export function getPromotionScope(promotion = {}) {
  const rawScope = promotion?.targetScope || {};
  let kind = normalizeText(
    rawScope.kind
    || promotion?.scopeType
    || promotion?.applicableVehicleScope
    || promotion?.scopeKind,
  ).toLowerCase();

  const vehicleIds = Array.isArray(rawScope.vehicleIds)
    ? rawScope.vehicleIds.map((item) => String(item)).filter(Boolean)
    : Array.isArray(promotion?.targetVehicleIds)
      ? promotion.targetVehicleIds.map((item) => String(item)).filter(Boolean)
      : [];

  const brands = []
    .concat(rawScope.brands || [])
    .concat(promotion?.targetBrand ? [promotion.targetBrand] : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const models = []
    .concat(rawScope.models || [])
    .concat(promotion?.targetModel ? [promotion.targetModel] : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const categories = []
    .concat(rawScope.categories || [])
    .concat(promotion?.targetCategory ? [promotion.targetCategory] : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (!['all', 'vehicle', 'brand', 'model', 'category'].includes(kind)) {
    if (promotion?.appliesToAllVehicles) {
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
}

function arrayMatches(items, target) {
  const normalizedTarget = stringifyMatch(target);
  if (!normalizedTarget) {
    return false;
  }

  return items.some((item) => stringifyMatch(item) === normalizedTarget);
}

export function promotionMatchesVehicle(promotion, vehicle, options = {}) {
  if (!promotion || !vehicle) {
    return false;
  }

  const placement = normalizeText(options.placement);
  if (placement === 'vehicleCard' && promotion?.showOnVehicleCard === false) {
    return false;
  }
  if (placement === 'vehicleDetails' && promotion?.showOnVehicleDetails === false) {
    return false;
  }
  if (placement === 'inventoryBanner' && promotion?.showOnInventoryBanner === false) {
    return false;
  }

  const scope = getPromotionScope(promotion);
  const vehicleId = String(vehicle?._id || vehicle?.id || '');

  if (scope.kind === 'vehicle' && !scope.vehicleIds.includes(vehicleId)) {
    return false;
  }
  if (scope.kind === 'brand' && !arrayMatches(scope.brands, vehicle?.brand)) {
    return false;
  }
  if (scope.kind === 'model' && !arrayMatches(scope.models, vehicle?.model)) {
    return false;
  }
  if (scope.kind === 'category' && !arrayMatches(scope.categories, vehicle?.category)) {
    return false;
  }

  const targetListingType = normalizeText(promotion?.targetListingType || 'Sale');
  if (targetListingType && stringifyMatch(targetListingType) !== stringifyMatch(vehicle?.listingType)) {
    return false;
  }
  if (promotion?.targetFuelType && stringifyMatch(promotion.targetFuelType) !== stringifyMatch(vehicle?.fuelType)) {
    return false;
  }
  if (promotion?.targetVehicleCondition && stringifyMatch(promotion.targetVehicleCondition) !== stringifyMatch(vehicle?.vehicleCondition)) {
    return false;
  }

  return true;
}

export function getPromotionDiscountMeta(vehicle, promotion) {
  const originalPrice = Number(vehicle?.price || 0);
  const discountType = normalizeText(promotion?.discountType).toLowerCase() === AMOUNT_DISCOUNT
    ? AMOUNT_DISCOUNT
    : PERCENTAGE_DISCOUNT;
  const discountPercentage = positiveNumber(promotion?.discountPercentage);
  const discountAmount = positiveNumber(promotion?.discountAmount);

  if (discountType === AMOUNT_DISCOUNT && discountAmount !== null) {
    const finalPrice = Math.max(originalPrice - discountAmount, 0);
    return {
      hasDiscount: finalPrice < originalPrice,
      discountType,
      discountPercentage: null,
      discountAmount,
      originalPrice,
      finalPrice,
      savings: Math.max(originalPrice - finalPrice, 0),
      badgeLabel: `-Rs. ${discountAmount.toLocaleString()}`,
      valueLabel: `Rs. ${discountAmount.toLocaleString()} off`,
      valueShortLabel: `Save Rs. ${discountAmount.toLocaleString()}`,
    };
  }

  if (discountPercentage !== null) {
    const finalPrice = Math.max(Math.round(originalPrice * (1 - (discountPercentage / 100))), 0);
    return {
      hasDiscount: finalPrice < originalPrice,
      discountType: PERCENTAGE_DISCOUNT,
      discountPercentage,
      discountAmount: null,
      originalPrice,
      finalPrice,
      savings: Math.max(originalPrice - finalPrice, 0),
      badgeLabel: `-${discountPercentage}%`,
      valueLabel: `${discountPercentage}% off`,
      valueShortLabel: `Save ${discountPercentage}%`,
    };
  }

  return {
    hasDiscount: false,
    discountType: PERCENTAGE_DISCOUNT,
    discountPercentage: null,
    discountAmount: null,
    originalPrice,
    finalPrice: originalPrice,
    savings: 0,
    badgeLabel: '',
    valueLabel: '',
    valueShortLabel: '',
  };
}

export function getVehiclePromotion(vehicle, promotions = [], options = {}) {
  return [...promotions]
    .filter((promotion) => promotionMatchesVehicle(promotion, vehicle, options))
    .sort((left, right) => {
      const priorityGap = Number(right?.priority || 0) - Number(left?.priority || 0);
      if (priorityGap !== 0) {
        return priorityGap;
      }

      const rightSavings = getPromotionDiscountMeta(vehicle, right).savings;
      const leftSavings = getPromotionDiscountMeta(vehicle, left).savings;
      return rightSavings - leftSavings;
    })[0] || null;
}

export function formatPromotionDiscountValue(promotion) {
  if (promotion?.discountType === AMOUNT_DISCOUNT || positiveNumber(promotion?.discountAmount) !== null) {
    const amount = positiveNumber(promotion?.discountAmount);
    return amount !== null ? `Rs. ${amount.toLocaleString()} off` : '';
  }

  const percentage = positiveNumber(promotion?.discountPercentage);
  return percentage !== null ? `${percentage}% off` : '';
}

export function getPromotionScopeLabel(promotion, vehicles = []) {
  const scope = getPromotionScope(promotion);

  if (scope.kind === 'vehicle') {
    const matchedVehicle = vehicles.find((vehicle) => scope.vehicleIds.includes(String(vehicle?._id)));
    if (matchedVehicle) {
      return `${matchedVehicle.brand} ${matchedVehicle.model}`.trim();
    }
    return 'Specific vehicle';
  }

  if (scope.kind === 'brand') {
    return scope.brands[0] || 'Brand';
  }

  if (scope.kind === 'model') {
    return scope.models[0] || 'Model';
  }

  if (scope.kind === 'category') {
    return scope.categories[0] || 'Category';
  }

  return 'All vehicles';
}

export function getPromotionScopeTypeLabel(promotion) {
  const scope = getPromotionScope(promotion);
  const labels = {
    all: 'All vehicles',
    vehicle: 'Specific vehicle',
    brand: 'Brand',
    model: 'Model',
    category: 'Category',
  };

  return labels[scope.kind] || 'All vehicles';
}

export function getPromotionDateRangeLabel(promotion) {
  return [promotion?.startDate, promotion?.endDate].filter(Boolean).join(' - ');
}
