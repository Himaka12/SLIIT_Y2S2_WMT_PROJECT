import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BASE_URL } from '../api';
import { Colors, Radius, Shadow } from '../constants/theme';
import {
  formatPromotionDiscountValue,
  getPromotionComputedStatus,
  getPromotionScopeLabel,
} from '../utils/promotionUtils';

function resolvePromotionImageUri(path) {
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

function formatDetailDate(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildRemainingTime(endDateText, nowTick) {
  if (!endDateText) {
    return 'Limited time';
  }

  const endDate = new Date(`${endDateText}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) {
    return 'Limited time';
  }

  const diff = endDate.getTime() - nowTick;
  if (diff <= 0) {
    return 'Offer ended';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${Math.max(minutes, 1)}m remaining`;
}

export default function PromotionQuickViewSheet({
  visible,
  promotion,
  matchedVehicles = [],
  bannerOrigin,
  onRequestClose,
  onApplyToVehicles,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const surfaceProgress = useSharedValue(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);
  const [nowTick, setNowTick] = useState(Date.now());

  const fallbackOrigin = useMemo(
    () => ({
      x: 20,
      y: Math.max(insets.top + 84, 140),
      width: windowWidth - 40,
      height: 188,
    }),
    [insets.top, windowWidth],
  );
  const origin = bannerOrigin || fallbackOrigin;
  const finalLeft = 14;
  const finalTop = Math.max(insets.top + 26, 54);
  const finalWidth = windowWidth - 28;
  const finalHeight = Math.min(windowHeight - finalTop - 20, windowHeight * 0.84);
  const imageUri = resolvePromotionImageUri(promotion?.imageUrl);
  const status = getPromotionComputedStatus(promotion);
  const discountLabel = formatPromotionDiscountValue(promotion) || 'Limited offer';
  const validUntilLabel = formatDetailDate(promotion?.endDate);
  const matchedVehicleLabel = `${matchedVehicles.length} vehicle${matchedVehicles.length === 1 ? '' : 's'} eligible`;
  const remainingTime = buildRemainingTime(promotion?.endDate, nowTick);
  const scopeLabel = getPromotionScopeLabel(promotion, matchedVehicles);
  const terms = useMemo(
    () => [
      `Applies to ${scopeLabel.toLowerCase()}.`,
      promotion?.targetListingType ? `Valid for ${String(promotion.targetListingType).toLowerCase()} listings only.` : 'Available while this promotion stays active.',
      promotion?.endDate ? `Discount availability ends on ${validUntilLabel}.` : 'Offer timing depends on active campaign rules.',
    ],
    [promotion?.endDate, promotion?.targetListingType, scopeLabel, validUntilLabel],
  );

  useEffect(() => {
    let timer;
    if (visible) {
      setMounted(true);
      dragY.value = 0;
      progress.value = 0;
      surfaceProgress.value = 0;
      progress.value = withSpring(1, {
        damping: 26,
        stiffness: 240,
        mass: 1,
        overshootClamping: true,
        restDisplacementThreshold: 0.001,
        restSpeedThreshold: 0.001,
      });
      surfaceProgress.value = withTiming(1, {
        duration: 170,
        easing: Easing.out(Easing.cubic),
      });
      timer = setInterval(() => setNowTick(Date.now()), 1000);
    } else if (mounted) {
      surfaceProgress.value = withTiming(0, {
        duration: 90,
        easing: Easing.out(Easing.quad),
      });
      dragY.value = withTiming(0, {
        duration: 140,
        easing: Easing.out(Easing.quad),
      });
      progress.value = withTiming(0, {
        duration: 190,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      }, (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [dragY, mounted, progress, surfaceProgress, visible]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        dragY.value = Math.max(0, gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 1.05) {
          onRequestClose?.();
          return;
        }

        dragY.value = withSpring(0, {
          damping: 20,
          stiffness: 220,
          mass: 0.9,
          overshootClamping: true,
        });
      },
      onPanResponderTerminate: () => {
        dragY.value = withSpring(0, {
          damping: 20,
          stiffness: 220,
          mass: 0.9,
          overshootClamping: true,
        });
      },
    }),
    [dragY, onRequestClose],
  );

  const initialScaleX = Math.max(origin.width / finalWidth, 0.72);
  const initialScaleY = Math.max(origin.height / finalHeight, 0.42);
  const finalCenterX = finalLeft + (finalWidth / 2);
  const finalCenterY = finalTop + (finalHeight / 2);
  const originCenterX = origin.x + (origin.width / 2);
  const originCenterY = origin.y + (origin.height / 2);
  const startTranslateX = originCenterX - finalCenterX;
  const startTranslateY = originCenterY - finalCenterY;

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [startTranslateX, 0], Extrapolation.CLAMP);
    const translateY = interpolate(progress.value, [0, 1], [startTranslateY, 0], Extrapolation.CLAMP) + dragY.value;
    const scaleX = interpolate(progress.value, [0, 1], [initialScaleX, 1], Extrapolation.CLAMP);
    const scaleY = interpolate(progress.value, [0, 1], [initialScaleY, 1], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.15, 1], [0.82, 0.96, 1], Extrapolation.CLAMP);
    const borderRadius = interpolate(progress.value, [0, 1], [30, 34], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(progress.value, [0, 1], [0.06, 0.22], Extrapolation.CLAMP);

    return {
      top: finalTop,
      left: finalLeft,
      width: finalWidth,
      height: finalHeight,
      borderRadius,
      opacity,
      shadowOpacity,
      transform: [
        { translateX },
        { translateY },
        { scaleX },
        { scaleY },
      ],
    };
  });

  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(surfaceProgress.value, [0, 1], [0.996, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(surfaceProgress.value, [0, 0.28, 1], [0.82, 0.9, 1], Extrapolation.CLAMP),
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[StyleSheet.absoluteFillObject, overlayStyle]}>
          <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backdropPressable} onPress={onRequestClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetCard,
            sheetAnimatedStyle,
          ]}
        >
          <Animated.View style={[styles.sheetSurface, surfaceAnimatedStyle]} {...panResponder.panHandlers}>
            <View style={styles.heroWrap}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroFallback}>
                  <MaterialCommunityIcons name="tag-multiple-outline" size={34} color="#f4c430" />
                </View>
              )}
              <View style={styles.heroShade} />
              <TouchableOpacity style={styles.closeButton} onPress={onRequestClose} activeOpacity={0.88}>
                <BlurView intensity={28} tint="light" style={styles.closeButtonBlur} />
                <MaterialCommunityIcons name="close" size={20} color="#111111" />
              </TouchableOpacity>
              <View style={styles.heroTagRow}>
                <View style={styles.heroTag}>
                  <MaterialCommunityIcons name="tag-outline" size={14} color="#111111" />
                  <Text style={styles.heroTagText}>{promotion?.promotionType || 'Promotion'}</Text>
                </View>
                <View style={[styles.heroTag, styles.heroTagDark]}>
                  <Text style={styles.heroTagDarkText}>{status}</Text>
                </View>
              </View>
            </View>

            <Animated.View style={[styles.bodyWrap, contentAnimatedStyle]}>
              <ScrollView
                style={styles.scrollBody}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 176, 220) }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.title}>{promotion?.title || 'Promotion details'}</Text>

                <View style={styles.highlightRow}>
                  <View style={styles.discountCard}>
                    <Text style={styles.discountLabel}>Discount</Text>
                    <Text style={styles.discountValue}>{discountLabel.toUpperCase()}</Text>
                  </View>
                  <View style={styles.countdownCard}>
                    <Text style={styles.countdownLabel}>{status === 'Active' ? 'Remaining Time' : 'Campaign Status'}</Text>
                    <Text style={styles.countdownValue}>{status === 'Active' ? remainingTime : status}</Text>
                    <Text style={styles.countdownMeta}>{validUntilLabel ? `Valid until ${validUntilLabel}` : 'Limited time offer'}</Text>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Campaign</Text>
                  {!!promotion?.description ? (
                    <Text style={styles.sectionCopy}>{promotion.description}</Text>
                  ) : (
                    <Text style={styles.sectionCopy}>Premium savings crafted for selected vehicles in this campaign.</Text>
                  )}

                  <View style={styles.metaPillRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{promotion?.promotionType || 'Promotion'}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{scopeLabel}</Text>
                    </View>
                    {promotion?.highlightLabel ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{promotion.highlightLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Eligible Vehicles</Text>
                  <Text style={styles.sectionMeta}>{matchedVehicleLabel}</Text>
                  <View style={styles.vehicleChipRow}>
                    {matchedVehicles.slice(0, 6).map((vehicle) => (
                      <View key={String(vehicle._id)} style={styles.vehicleChip}>
                        <Text style={styles.vehicleChipText} numberOfLines={1}>
                          {`${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim()}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Terms</Text>
                  {terms.map((item) => (
                    <View key={item} style={styles.termRow}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#f4c430" />
                      <Text style={styles.termText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={[styles.footerBar, { paddingBottom: Math.max(insets.bottom + 12, 18) }]}>
                <TouchableOpacity style={styles.primaryButton} onPress={onApplyToVehicles} activeOpacity={0.9}>
                  <Text style={styles.primaryButtonText}>Matching Vehicles</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  backdropPressable: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.18)',
  },
  sheetCard: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 36,
    elevation: 18,
    overflow: 'hidden',
  },
  sheetSurface: {
    flex: 1,
    backgroundColor: '#fffaf0',
  },
  heroWrap: {
    height: 212,
    backgroundColor: '#111111',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  closeButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTagRow: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#f4c430',
  },
  heroTagDark: {
    backgroundColor: 'rgba(17,17,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTagDarkText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bodyWrap: {
    flex: 1,
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.9,
  },
  highlightRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  discountCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f4c430',
  },
  discountLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  discountValue: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
  },
  countdownCard: {
    flex: 1.1,
    minHeight: 88,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#111111',
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f4c430',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  countdownValue: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  countdownMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
  },
  sectionCard: {
    marginTop: 14,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  sectionCopy: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '600',
  },
  metaPillRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#fff7d6',
    borderWidth: 1,
    borderColor: '#f7d774',
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111111',
  },
  sectionMeta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  vehicleChipRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleChip: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
  },
  vehicleChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  termRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  termText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#475569',
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    minHeight: 74,
    backgroundColor: 'rgba(255,250,240,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.16)',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4c430',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',
  },
});
