import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';

const VEHICLE_TYPES = ['All', 'SUV', 'Sedan', 'Luxury', 'Hatchback'];
const BUDGET_RANGES = ['Any', 'Under 5M', '5M - 10M', '10M+'];
const LISTING_TYPES = ['All', 'Rent', 'Buy'];

function AnimatedAction({ children, style, onPress, textStyle }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.fillPressable}>
        {typeof children === 'string' ? <Text style={textStyle}>{children}</Text> : children}
      </Pressable>
    </Animated.View>
  );
}

function SelectChip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionIcon({ name, color, backgroundColor }) {
  return (
    <View style={[styles.actionIcon, { backgroundColor }]}>
      <MaterialCommunityIcons name={name} size={18} color={color} />
    </View>
  );
}

export default function CustomerSearchOverlay({
  visible,
  anchor,
  onClose,
  onSearch,
  onClear,
  initialFilters,
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateX = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(170)).current;
  const panelScale = useRef(new Animated.Value(0.88)).current;
  const [query, setQuery] = useState('');
  const [vehicleType, setVehicleType] = useState('All');
  const [budget, setBudget] = useState('Any');
  const [listingType, setListingType] = useState('All');
  const isClosing = useRef(false);

  const getAnchorMotion = () => {
    const screen = Dimensions.get('window');
    const fallbackY = 170;

    if (!anchor?.x || !anchor?.y) {
      return { translateX: 0, translateY: fallbackY, scale: 0.88 };
    }

    return {
      translateX: anchor.x - (screen.width / 2),
      translateY: anchor.y - (screen.height / 2),
      scale: 0.2,
    };
  };

  const animateClose = (callback) => {
    if (isClosing.current) {
      return;
    }

    isClosing.current = true;
    const anchorMotion = getAnchorMotion();

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: anchorMotion.translateY,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateX, {
        toValue: anchorMotion.translateX,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelScale, {
        toValue: anchorMotion.scale,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        isClosing.current = false;
        callback?.();
      }
    });
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    setQuery(initialFilters?.query || '');
    setVehicleType(initialFilters?.vehicleType || 'All');
    setBudget(initialFilters?.budget || 'Any');
    setListingType(initialFilters?.listingType === 'Sale' ? 'Buy' : (initialFilters?.listingType || 'All'));
  }, [initialFilters, visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      isClosing.current = false;
      const anchorMotion = getAnchorMotion();

      backdropOpacity.setValue(0);
      panelOpacity.setValue(0);
      panelTranslateX.setValue(anchorMotion.translateX);
      panelTranslateY.setValue(anchorMotion.translateY);
      panelScale.setValue(anchorMotion.scale);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateX, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.spring(panelScale, {
          toValue: 1,
          tension: 68,
          friction: 15,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    animateClose();
  }, [anchor, backdropOpacity, panelOpacity, panelScale, panelTranslateX, panelTranslateY, visible]);

  const handleClear = () => {
    setQuery('');
    setVehicleType('All');
    setBudget('Any');
    setListingType('All');
    onClear?.();
  };

  const handleSearch = () => {
    onSearch?.({
      query: query.trim(),
      vehicleType,
      budget,
      listingType: listingType === 'Buy' ? 'Sale' : listingType,
      appliedAt: Date.now(),
    });
  };

    if (!mounted) {
      return null;
    }

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Animated.View style={[styles.backdropSoftener, { opacity: backdropOpacity }]} />
        <Pressable style={styles.dismissLayer} onPress={() => animateClose(onClose)} />

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.overlayContent,
            {
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 18,
              opacity: panelOpacity,
              transform: [{ translateX: panelTranslateX }, { translateY: panelTranslateY }, { scale: panelScale }],
            },
          ]}
        >
          <View pointerEvents="box-none" style={styles.topRow}>
            <View style={styles.topSpacer} />
            <AnimatedAction style={styles.closeButton} onPress={() => animateClose(onClose)}>
              <MaterialCommunityIcons name="close" size={28} color={Colors.text} />
            </AnimatedAction>
          </View>

          <View pointerEvents="box-none" style={styles.body}>
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Search vehicles</Text>

                <View style={styles.searchInputWrap}>
                  <MaterialCommunityIcons name="magnify" size={24} color={Colors.text} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by brand, model, or vehicle name"
                    placeholderTextColor="#7b8491"
                    style={styles.searchInput}
                  />
                </View>

                <Text style={styles.sectionLabel}>Vehicle type</Text>
                <View style={styles.chipGrid}>
                  {VEHICLE_TYPES.map((item) => (
                    <SelectChip
                      key={item}
                      label={item}
                      active={vehicleType === item}
                      onPress={() => setVehicleType(item)}
                    />
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Budget</Text>
                <View style={styles.chipGrid}>
                  {BUDGET_RANGES.map((item) => (
                    <SelectChip
                      key={item}
                      label={item}
                      active={budget === item}
                      onPress={() => setBudget(item)}
                    />
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Buy or rent</Text>
                <View style={styles.segmentWrap}>
                  {LISTING_TYPES.map((item) => (
                    <SelectChip
                      key={item}
                      label={item}
                      active={listingType === item}
                      onPress={() => setListingType(item)}
                    />
                  ))}
                </View>

                <View style={styles.bottomActionsShell}>
                  <View style={styles.bottomActions}>
                    <AnimatedAction style={styles.clearAction} onPress={handleClear}>
                      <View style={styles.actionInner}>
                        <ActionIcon name="close" color={Colors.white} backgroundColor="rgba(255,255,255,0.18)" />
                        <Text style={styles.clearText}>Clear all</Text>
                      </View>
                    </AnimatedAction>

                    <AnimatedAction style={styles.searchAction} onPress={handleSearch}>
                      <View style={styles.searchActionInner}>
                        <ActionIcon name="magnify" color="#111111" backgroundColor="rgba(255,255,255,0.45)" />
                        <Text style={styles.searchActionText}>Search</Text>
                      </View>
                    </AnimatedAction>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(246, 243, 238, 0.965)',
  },
  backdropSoftener: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    flex: 1,
    paddingHorizontal: 18,
  },
  body: {
    flexGrow: 0,
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  topSpacer: {
    width: 52,
    height: 52,
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.96)',
    ...Shadow.sm,
  },
  card: {
    marginTop: 6,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.98)',
    ...Shadow.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  searchInputWrap: {
    minHeight: 74,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#d7dce3',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segmentWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: '#f4f6f8',
    borderWidth: 1,
    borderColor: '#e3e7ee',
  },
  chipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#556273',
  },
  chipTextActive: {
    color: Colors.white,
  },
  bottomActionsShell: {
    marginTop: 24,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  clearAction: {
    minWidth: 112,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: '#ef4444',
    ...Shadow.md,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.white,
  },
  searchAction: {
    minWidth: 120,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: '#16a34a',
    ...Shadow.md,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: '100%',
  },
  searchActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: '100%',
  },
  actionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.white,
  },
  fillPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
