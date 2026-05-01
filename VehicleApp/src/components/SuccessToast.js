import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../constants/theme';

export default function SuccessToast({
  visible,
  message,
  backgroundColor = '#16a34a',
  textColor = Colors.white,
  topOffset,
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const toastStyle = useMemo(() => ({ backgroundColor }), [backgroundColor]);
  const textStyle = useMemo(() => ({ color: textColor }), [textColor]);

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : -12,
        duration: visible ? 220 : 140,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [opacity, translateY, visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        toastStyle,
        {
          top: topOffset ?? (insets.top + 12),
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    zIndex: 30,
    elevation: 30,
    ...Shadow.md,
  },
  text: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
