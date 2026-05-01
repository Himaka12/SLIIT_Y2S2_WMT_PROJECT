import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';

export function useCustomerTabPageTransition(trigger, anchor) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!trigger) {
      return;
    }

    const screen = Dimensions.get('window');
    const originX = anchor?.x ? (anchor.x - (screen.width / 2)) * 0.14 : 0;
    const originY = anchor?.y ? Math.min(36, Math.max(18, (screen.height - anchor.y) * 0.09)) : 24;

    opacity.setValue(0);
    translateX.setValue(originX);
    translateY.setValue(originY);
    scale.setValue(0.975);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 48,
        friction: 18,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [anchor, opacity, scale, translateX, translateY, trigger]);

  return {
    opacity,
    transform: [{ translateX }, { translateY }, { scale }],
  };
}
