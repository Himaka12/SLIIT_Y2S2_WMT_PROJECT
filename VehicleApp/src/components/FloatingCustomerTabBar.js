import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Radius, Shadow } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { subscribeCustomerTabBarVisibility } from '../utils/customerTabBarEvents';
import LogoutConfirmationSheet from './LogoutConfirmationSheet';

const TAB_META = {
  InventoryTab: { icon: 'home-variant-outline' },
  Dashboard: { icon: 'car-outline' },
  WishlistTab: { icon: 'heart-outline' },
  LogoutTab: { icon: 'logout-variant' },
};

const SEARCH_BUTTON_SIZE = 58;
const NAV_BUTTON_SIZE = 44;
const LAYOUT_GAP = 12;
const SIDE_GROUP_GAP = 8;
const SIDE_GROUP_PADDING = 8;
const VISIBLE_NAV_ROUTES = ['InventoryTab', 'Dashboard', 'LogoutTab'];

function FloatingTabButton({ route, isFocused, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const meta = TAB_META[route.name] || { icon: 'circle-outline' };
  const iconColor = route.name === 'LogoutTab'
    ? '#dc2626'
    : isFocused
      ? '#facc15'
      : '#9ca3af';

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.94,
      duration: 100,
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.button,
          styles.navButton,
          isFocused && styles.buttonFocused,
        ]}
      >
        <MaterialCommunityIcons
          name={meta.icon}
          size={22}
          color={iconColor}
        />
      </Pressable>
    </Animated.View>
  );
}

function FloatingActionButton({ icon, color = '#ffffff', onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.94,
      duration: 100,
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, styles.navButton, styles.searchButton]}
      >
        <MaterialCommunityIcons name={icon} size={22} color="#9ca3af" />
      </Pressable>
    </Animated.View>
  );
}

export default function FloatingCustomerTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const focusedRoute = state.routes[state.index];
  const nestedState = focusedRoute?.state;
  const nestedRouteName = nestedState?.routes?.[nestedState.index ?? 0]?.name;
  const isProfileInNestedStack = nestedRouteName === 'CustomerProfileMain' && focusedRoute?.name !== 'Dashboard';
  const isInventoryListInNestedStack = focusedRoute?.name === 'InventoryTab' && nestedRouteName === 'InventoryMain';
  const shouldHide =
    (focusedRoute?.name === 'InventoryTab' && nestedRouteName && !['CustomerSearchMain', 'InventoryMain'].includes(nestedRouteName)) ||
    (focusedRoute?.name === 'Dashboard' && nestedRouteName && nestedRouteName !== 'CustomerProfileMain') ||
    (focusedRoute?.name === 'WishlistTab' && nestedRouteName && nestedRouteName !== 'CustomerWishlistMain');

  useEffect(() => {
    const unsubscribe = subscribeCustomerTabBarVisibility((visible) => {
      setIsVisible(visible);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isVisible ? 0 : 120,
        duration: isVisible ? 180 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: isVisible ? 160 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVisible, opacity, translateY]);

  const getLayoutMetrics = () => {
    const screen = Dimensions.get('window');
    const visibleRouteCount = VISIBLE_NAV_ROUTES.length;
    const sideGroupWidth =
      (SIDE_GROUP_PADDING * 2) +
      (visibleRouteCount * NAV_BUTTON_SIZE) +
      ((visibleRouteCount - 1) * SIDE_GROUP_GAP);
    const layoutWidth = SEARCH_BUTTON_SIZE + LAYOUT_GAP + sideGroupWidth;
    const layoutLeft = (screen.width / 2) - (layoutWidth / 2);
    const searchCenterX = layoutLeft + (SEARCH_BUTTON_SIZE / 2);
    const sideGroupLeft = layoutLeft + SEARCH_BUTTON_SIZE + LAYOUT_GAP;

    return {
      screen,
      searchCenterX,
      sideGroupLeft,
    };
  };

  const getTabAnchor = (routeName) => {
    const { screen, sideGroupLeft } = getLayoutMetrics();
    const routeIndex = VISIBLE_NAV_ROUTES.indexOf(routeName);
    const centerX =
      sideGroupLeft +
      SIDE_GROUP_PADDING +
      (routeIndex * (NAV_BUTTON_SIZE + SIDE_GROUP_GAP)) +
      (NAV_BUTTON_SIZE / 2);

    return {
      x: centerX,
      y: screen.height - (insets.bottom + 10) - (NAV_BUTTON_SIZE / 2),
    };
  };

  const getSearchAnchor = () => {
    const { screen, searchCenterX } = getLayoutMetrics();

    return {
      x: searchCenterX,
      y: screen.height - (insets.bottom + 10) - (SEARCH_BUTTON_SIZE / 2),
    };
  };

  const getPreferredProfileHostRoute = () => {
    if (focusedRoute?.name === 'InventoryTab' || focusedRoute?.name === 'WishlistTab') {
      return focusedRoute.name;
    }

    const history = Array.isArray(state.history) ? [...state.history].reverse() : [];
    for (const entry of history) {
      const matchedRoute = state.routes.find((route) => route.key === entry?.key);
      if (matchedRoute && (matchedRoute.name === 'InventoryTab' || matchedRoute.name === 'WishlistTab')) {
        return matchedRoute.name;
      }
    }

    return 'InventoryTab';
  };

  if (shouldHide) {
    return null;
  }

  const openSearchOverlay = () => {
    navigation.navigate('InventoryTab', {
      screen: 'InventoryMain',
      params: {
        focusSearchAt: Date.now(),
        tabTransitionAt: Date.now(),
        tabTransitionAnchor: getSearchAnchor(),
      },
    });
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents={isVisible ? 'auto' : 'none'}
        style={[
          styles.wrap,
          {
            bottom: insets.bottom + 10,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.layout}>
          <FloatingActionButton icon="magnify" onPress={openSearchOverlay} />

          <View style={styles.sideGroup}>
            {state.routes
              .filter((route) => VISIBLE_NAV_ROUTES.includes(route.name))
              .map((route, index) => {
                const isFocused =
                  route.name === 'Dashboard'
                    ? (
                      isInventoryListInNestedStack
                    )
                    : (
                      route.name !== 'LogoutTab' &&
                      state.index === state.routes.findIndex((item) => item.key === route.key) &&
                      !isProfileInNestedStack &&
                      !isInventoryListInNestedStack
                    );

                const handlePress = async () => {
                  if (route.name === 'InventoryTab') {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!event.defaultPrevented) {
                      navigation.navigate('InventoryTab', {
                        screen: 'CustomerSearchMain',
                        params: {
                          tabTransitionAt: Date.now(),
                          tabTransitionAnchor: getTabAnchor('InventoryTab'),
                        },
                      });
                    }
                    return;
                  }

                  if (route.name === 'Dashboard') {
                    navigation.navigate('InventoryTab', {
                      screen: 'InventoryMain',
                      params: {
                        tabTransitionAt: Date.now(),
                        tabTransitionAnchor: getTabAnchor('Dashboard'),
                      },
                    });
                    return;
                  }

                  if (route.name === 'LogoutTab') {
                    setLogoutSheetVisible(true);
                    return;
                  }

                  if (route.name === 'WishlistTab') {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!event.defaultPrevented) {
                      navigation.navigate('WishlistTab', {
                        screen: 'CustomerWishlistMain',
                        params: {
                          tabTransitionAt: Date.now(),
                          tabTransitionAnchor: getTabAnchor('WishlistTab'),
                        },
                      });
                    }
                    return;
                  }

                };

                return (
                  <FloatingTabButton
                    key={route.key || index}
                    route={route}
                    isFocused={isFocused}
                    onPress={handlePress}
                  />
                );
              })}
          </View>
        </View>
      </Animated.View>

      <LogoutConfirmationSheet
        visible={logoutSheetVisible}
        onClose={() => setLogoutSheetVisible(false)}
        onConfirm={logout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  layout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sideGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    ...Shadow.sm,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  navButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    ...Shadow.sm,
  },
  searchButton: {
    width: 58,
    height: 58,
    backgroundColor: '#FFFFFF',
  },
  buttonFocused: {
    backgroundColor: 'rgba(250, 204, 21, 0.14)',
    opacity: 1,
  },
});
