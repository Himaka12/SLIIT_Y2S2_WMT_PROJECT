import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';

function normalizeQuantity(quantity) {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

function formatUnitCount(quantity) {
  return `${quantity} vehicle${quantity === 1 ? '' : 's'} available`;
}

export function getVehicleAvailabilityMeta(quantity) {
  const normalizedQuantity = normalizeQuantity(quantity);

  if (normalizedQuantity === 0) {
    return {
      available: false,
      tone: 'danger',
      title: 'Out of Stock',
      subtitle: 'Currently unavailable',
      quantity: normalizedQuantity,
    };
  }

  if (normalizedQuantity <= 3) {
    return {
      available: true,
      tone: 'warning',
      title: 'Limited Availability',
      subtitle: formatUnitCount(normalizedQuantity),
      quantity: normalizedQuantity,
    };
  }

  return {
    available: true,
    tone: 'success',
    title: 'Available',
    subtitle: formatUnitCount(normalizedQuantity),
    quantity: normalizedQuantity,
  };
}

export function getCompactVehicleAvailabilityMeta(quantity) {
  const meta = getVehicleAvailabilityMeta(quantity);

  if (!meta.available) {
    return {
      ...meta,
      shortLabel: 'Out of stock',
    };
  }

  return {
    ...meta,
    shortLabel: `${meta.quantity} in stock`,
  };
}

export function getSlotAvailabilityMeta({
  available,
  quantity,
  remainingQuantity,
  bookedUnits,
  activeBookings,
  totalQuantity,
  bookedCount,
  requestedUnits,
  projectedRemainingQuantity,
} = {}) {
  const normalizedAvailable = typeof available === 'boolean' ? available : true;
  const normalizedQuantity = normalizeQuantity(quantity ?? totalQuantity);
  const normalizedBookedUnits = Math.max(0, Math.floor(Number(bookedUnits) || 0));
  const normalizedActiveBookings = Math.max(0, Math.floor(Number(activeBookings ?? bookedCount) || 0));
  const normalizedRequestedUnits = Math.max(0, Math.floor(Number(requestedUnits) || 0));
  const remainingUnits = Number.isFinite(Number(remainingQuantity))
    ? Math.max(0, Math.floor(Number(remainingQuantity)))
    : Math.max(normalizedQuantity - normalizedBookedUnits, 0);
  const normalizedProjectedRemainingQuantity = Number.isFinite(Number(projectedRemainingQuantity))
    ? Math.max(0, Math.floor(Number(projectedRemainingQuantity)))
    : remainingUnits;

  if (normalizedQuantity === 0) {
    return {
      available: false,
      tone: 'danger',
      title: 'Unavailable',
      subtitle: 'Currently unavailable',
      detail: 'This vehicle is not open for bookings right now.',
      quantity: normalizedQuantity,
      bookedUnits: normalizedBookedUnits,
      activeBookings: normalizedActiveBookings,
      remainingUnits,
    };
  }

  if (remainingUnits === 0) {
    return {
      available: false,
      tone: 'danger',
      title: 'Fully Booked',
      subtitle: 'Selected slot is unavailable',
      detail: 'All available units are already booked for this date and time slot.',
      quantity: normalizedQuantity,
      bookedUnits: normalizedBookedUnits,
      activeBookings: normalizedActiveBookings,
      remainingUnits,
    };
  }

  if (!normalizedAvailable && normalizedRequestedUnits > remainingUnits) {
    return {
      available: false,
      tone: 'danger',
      title: 'Requested Quantity Unavailable',
      subtitle: `Only ${remainingUnits} unit${remainingUnits === 1 ? '' : 's'} available`,
      detail: `You requested ${normalizedRequestedUnits} unit${normalizedRequestedUnits === 1 ? '' : 's'}, but only ${remainingUnits} ${remainingUnits === 1 ? 'is' : 'are'} available for this date and time. Reduce the quantity to continue.`,
      quantity: normalizedQuantity,
      bookedUnits: normalizedBookedUnits,
      activeBookings: normalizedActiveBookings,
      remainingUnits,
      requestedUnits: normalizedRequestedUnits,
    };
  }

  if (remainingUnits <= 3) {
    return {
      available: true,
      tone: 'warning',
      title: 'Limited Availability',
      subtitle: `${remainingUnits} unit${remainingUnits === 1 ? '' : 's'} available`,
      detail: `${normalizedProjectedRemainingQuantity} unit${normalizedProjectedRemainingQuantity === 1 ? '' : 's'} left after your request for the selected slot.`,
      quantity: normalizedQuantity,
      bookedUnits: normalizedBookedUnits,
      activeBookings: normalizedActiveBookings,
      remainingUnits,
    };
  }

  return {
    available: true,
    tone: 'success',
    title: 'Available',
    subtitle: `${remainingUnits} unit${remainingUnits === 1 ? '' : 's'} available`,
    detail: `${normalizedProjectedRemainingQuantity} unit${normalizedProjectedRemainingQuantity === 1 ? '' : 's'} available after your request for the selected slot.`,
    quantity: normalizedQuantity,
    bookedUnits: normalizedBookedUnits,
    activeBookings: normalizedActiveBookings,
    remainingUnits,
  };
}

export default function AvailabilityStatusBox({
  title,
  subtitle,
  detail,
  detailRows,
  compactDetailRows = false,
  tone = 'success',
  style,
}) {
  const toneStyle = toneStyles[tone] || toneStyles.success;

  return (
    <View style={[styles.box, toneStyle.box, style]}>
      <Text style={[styles.title, toneStyle.title]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, toneStyle.subtitle]}>{subtitle}</Text> : null}
      {Array.isArray(detailRows) && detailRows.length ? (
        <View style={styles.detailRows}>
          {detailRows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[styles.detailRow, compactDetailRows && styles.detailRowCompact]}
            >
              <View style={[styles.detailPair, compactDetailRows && styles.detailPairCompact]}>
                <Text style={[styles.detailRowLabel, toneStyle.detail]}>{row.label}</Text>
                <Text style={[styles.detailRowValue, toneStyle.detail]}>{row.value}</Text>
              </View>
              {typeof row.secondaryLabel === 'string' ? (
                <View style={[styles.detailPair, compactDetailRows && styles.detailPairCompact]}>
                  <Text style={[styles.detailRowLabel, toneStyle.detail]}>{row.secondaryLabel}</Text>
                  <Text style={[styles.detailRowValue, toneStyle.detail]}>{row.secondaryValue}</Text>
                </View>
              ) : (
                <View style={[styles.detailPair, compactDetailRows && styles.detailPairCompact]} />
              )}
            </View>
          ))}
        </View>
      ) : null}
      {detail ? <Text style={[styles.detail, toneStyle.detail]}>{detail}</Text> : null}
    </View>
  );
}

const toneStyles = {
  success: {
    box: {
      backgroundColor: Colors.successSoft,
      borderColor: Colors.rentMid,
    },
    title: { color: Colors.success },
    subtitle: { color: '#166534' },
    detail: { color: '#166534' },
  },
  warning: {
    box: {
      backgroundColor: Colors.promoSoft,
      borderColor: '#fcd34d',
    },
    title: { color: '#b45309' },
    subtitle: { color: '#92400e' },
    detail: { color: '#92400e' },
  },
  danger: {
    box: {
      backgroundColor: Colors.dangerSoft,
      borderColor: '#fecaca',
    },
    title: { color: Colors.danger },
    subtitle: { color: '#b91c1c' },
    detail: { color: '#b91c1c' },
  },
};

const styles = StyleSheet.create({
  box: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 4,
    ...Shadow.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  detail: {
    marginTop: Spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },
  detailRows: {
    marginTop: Spacing.xs,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailRowCompact: {
    justifyContent: 'flex-start',
    gap: 18,
  },
  detailPair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailPairCompact: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: 6,
  },
  detailRowLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailRowValue: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
});
