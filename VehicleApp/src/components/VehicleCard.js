import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';
import { BASE_URL } from '../api';
import { getPromotionDiscountMeta } from '../utils/promotionUtils';

const TYPE_COLORS = {
  Rent: { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
  Sale: { bg: '#eff6ff', text: '#2563eb', dot: '#2563eb' },
};

const SPEC_ICONS = {
  fuel: 'gas-station-outline',
  transmission: 'cog-outline',
  color: 'palette-outline',
};

const GIFT_MARKER = '\uD83C\uDF81';

export default function VehicleCard({
  vehicle,
  onPress,
  promotion = null,
  wishlistIds = [],
  onToggleWishlist,
}) {
  const typeStyle = TYPE_COLORS[vehicle.listingType] || TYPE_COLORS.Sale;
  const imageUri = vehicle.image1 ? `${BASE_URL}${vehicle.image1}` : null;
  const isWishlisted = wishlistIds.includes(String(vehicle._id));
  const promotionDiscount = getPromotionDiscountMeta(vehicle, promotion);
  const hasPromotion = Boolean(promotion && promotionDiscount.hasDiscount);
  const displayPrice = promotionDiscount.hasDiscount ? promotionDiscount.finalPrice : vehicle.price;

  return (
    <TouchableOpacity style={[styles.card, hasPromotion && styles.cardPromoted]} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="car-sports" size={44} color="#94a3b8" />
          </View>
        )}

        {hasPromotion ? (
          <View pointerEvents="none" style={styles.offerGiftWrap}>
            <Text style={styles.offerGiftIcon}>{GIFT_MARKER}</Text>
          </View>
        ) : null}

        <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }, hasPromotion && styles.typeBadgePromoted]}>
          <View style={[styles.typeDot, { backgroundColor: typeStyle.dot }, hasPromotion && styles.typeDotPromoted]} />
          <Text style={[styles.typeText, { color: typeStyle.text }, hasPromotion && styles.typeTextPromoted]}>
            {vehicle.listingType}
          </Text>
        </View>

        {onToggleWishlist ? (
          <TouchableOpacity
            style={[styles.wishBtn, hasPromotion && styles.wishBtnPromoted]}
            onPress={() => onToggleWishlist(vehicle._id)}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? '#dc2626' : '#111111'}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, hasPromotion && styles.namePromoted]} numberOfLines={1}>
          {vehicle.brand} {vehicle.model}
        </Text>
        <Text style={[styles.year, hasPromotion && styles.metaTextPromoted]}>
          {vehicle.manufactureYear} · {vehicle.vehicleCondition}
        </Text>

        <View style={styles.specRow}>
          <SpecChip icon={SPEC_ICONS.fuel} label={vehicle.fuelType} promoted={hasPromotion} />
          <SpecChip icon={SPEC_ICONS.transmission} label={vehicle.transmission} promoted={hasPromotion} />
          <SpecChip icon={SPEC_ICONS.color} label={vehicle.color} promoted={hasPromotion} />
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceStack}>
            {promotionDiscount.hasDiscount ? (
              <Text style={[styles.oldPrice, hasPromotion && styles.metaTextPromoted]}>
                Rs. {Number(vehicle.price).toLocaleString()}
                {vehicle.listingType === 'Rent' ? ' /day' : ''}
              </Text>
            ) : null}
            <Text style={[styles.price, hasPromotion && styles.pricePromoted]}>
              Rs. {Number(displayPrice).toLocaleString()}
              {vehicle.listingType === 'Rent' ? (
                <Text style={[styles.perDay, hasPromotion && styles.metaTextPromoted]}> /day</Text>
              ) : null}
            </Text>
          </View>

          {promotionDiscount.hasDiscount ? (
            <View style={[styles.discountPill, hasPromotion && styles.discountPillPromoted]}>
              <Text style={[styles.discountPillText, hasPromotion && styles.discountPillTextPromoted]}>
                {promotionDiscount.badgeLabel}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.statusPill,
              vehicle.status === 'Available' ? styles.statusAvailable : styles.statusUnavailable,
              hasPromotion && styles.statusPillPromoted,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                vehicle.status === 'Available' ? styles.statusTextGreen : styles.statusTextGray,
                hasPromotion && styles.metaTextPromoted,
              ]}
            >
              {vehicle.status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SpecChip({ icon, label, promoted = false }) {
  return (
    <View style={[styles.specChip, promoted && styles.specChipPromoted]}>
      <MaterialCommunityIcons
        name={icon}
        size={12}
        color={promoted ? '#d7aa2f' : '#64748b'}
        style={styles.specIcon}
      />
      <Text style={[styles.specLabel, promoted && styles.metaTextPromoted]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardPromoted: {
    borderColor: '#ead7a3',
    shadowColor: '#b88922',
    shadowOpacity: 0.12,
  },
  imageWrap: {
    position: 'relative',
    height: 180,
    backgroundColor: Colors.soft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.soft2,
  },
  offerGiftWrap: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 3,
  },
  offerGiftIcon: {
    fontSize: 38,
    textShadowColor: 'rgba(15, 23, 42, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  typeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  typeBadgePromoted: {
    backgroundColor: 'rgba(76, 54, 8, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(245, 211, 122, 0.44)',
  },
  typeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  typeDotPromoted: {
    backgroundColor: '#d7aa2f',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  typeTextPromoted: {
    color: '#f5d37a',
  },
  wishBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishBtnPromoted: {
    top: 66,
    right: 10,
  },
  info: {
    padding: Spacing.lg,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  namePromoted: {
    color: '#b88922',
  },
  year: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },
  metaTextPromoted: {
    color: '#c9972d',
  },
  specRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.soft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.stroke,
  },
  specChipPromoted: {
    backgroundColor: '#fff7e6',
    borderColor: '#ead7a3',
  },
  specIcon: {
    marginTop: 0.5,
  },
  specLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  priceStack: {
    flex: 1,
    paddingRight: 10,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.blue,
  },
  pricePromoted: {
    color: '#b88922',
  },
  oldPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  perDay: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.muted,
  },
  discountPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.promoSoft,
    marginRight: 8,
  },
  discountPillPromoted: {
    backgroundColor: '#fff6de',
    borderWidth: 1,
    borderColor: '#ead7a3',
  },
  discountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.promo,
  },
  discountPillTextPromoted: {
    color: '#9b6d12',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillPromoted: {
    backgroundColor: '#fff7e6',
    borderWidth: 1,
    borderColor: '#ead7a3',
  },
  statusAvailable: {
    backgroundColor: Colors.rentSoft,
  },
  statusUnavailable: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextGreen: {
    color: Colors.rent,
  },
  statusTextGray: {
    color: Colors.muted,
  },
});
