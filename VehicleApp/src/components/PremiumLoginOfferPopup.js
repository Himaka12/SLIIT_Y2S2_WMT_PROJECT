import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';

export default function PremiumLoginOfferPopup({
  visible,
  isPremium = false,
  onPress,
  onDismiss,
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.stopAnimation();
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return undefined;
    }

    if (mounted) {
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }

    return undefined;
  }, [mounted, progress, visible]);

  if (!mounted) {
    return null;
  }

  const cardTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 0],
  });
  const cardOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const cardScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 10 }]}>
      <Animated.View
        style={[
          styles.cardWrap,
          {
            opacity: cardOpacity,
            transform: [
              { translateY: cardTranslateY },
              { scale: cardScale },
            ],
          },
        ]}
      >
        <BlurView intensity={42} tint="light" style={styles.cardBlur}>
          <Pressable onPress={onPress} style={styles.card} disabled={!onPress}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={isPremium ? 'crown' : 'crown-outline'}
                size={22}
                color="#111111"
              />
            </View>

            <View style={styles.copyWrap}>
              <Text style={styles.eyebrow}>
                {isPremium ? 'Premium Active' : 'Premium Member Offer'}
              </Text>
              <Text style={styles.title}>
                {isPremium ? 'Your 10% rent benefit is ready.' : 'Unlock 10% off eligible rent vehicles.'}
              </Text>
              <Text style={styles.copy}>
                {isPremium ? 'Enjoy your member savings across eligible rentals.' : 'Tap to view premium benefits for the next 1 year.'}
              </Text>
            </View>

            <Pressable onPress={onDismiss} hitSlop={10} style={styles.dismissButton}>
              <MaterialCommunityIcons name="close" size={18} color="rgba(17,17,17,0.72)" />
            </Pressable>
          </Pressable>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 18,
  },
  cardWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardBlur: {
    borderRadius: 24,
  },
  card: {
    minHeight: 96,
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 247, 214, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 48, 0.35)',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4c430',
  },
  copyWrap: {
    flex: 1,
    paddingRight: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#9a6700',
  },
  title: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
  copy: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: '#4b5563',
    fontWeight: '600',
  },
  dismissButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
});
