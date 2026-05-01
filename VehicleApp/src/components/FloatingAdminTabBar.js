import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Shadow } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { subscribeCustomerTabBarVisibility } from '../utils/customerTabBarEvents';
import { subscribeAdminTabBarAction } from '../utils/adminTabBarActionEvents';
import LogoutConfirmationSheet from './LogoutConfirmationSheet';

const PRIMARY_ROUTE = 'HomeTab';
const SIDE_ROUTES = ['AdminDash', 'InventoryTab'];
const NAV_BUTTON_SIZE = 44;
const PRIMARY_BUTTON_SIZE = 58;
const LAYOUT_GAP = 12;
const SIDE_GROUP_GAP = 8;
const SIDE_GROUP_PADDING = 8;

const TAB_META = {
  HomeTab: { icon: 'car-multiple' },
  AdminDash: { icon: 'view-dashboard-outline' },
  InventoryTab: { icon: 'logout-variant' },
};

function FloatingButton({ routeName, isFocused, onPress, size = NAV_BUTTON_SIZE }) {
  const scale = useRef(new Animated.Value(1)).current;
  const meta = TAB_META[routeName] || { icon: 'circle-outline' };
  const iconColor = routeName === 'InventoryTab'
    ? '#dc2626'
    : isFocused
      ? '#facc15'
      : '#9ca3af';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          Animated.timing(scale, {
            toValue: 0.94,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }}
        style={[
          styles.button,
          styles.navButton,
          {
            width: size,
            height: size,
          },
          size === PRIMARY_BUTTON_SIZE && styles.primaryButton,
          isFocused && styles.buttonFocused,
        ]}
      >
        <MaterialCommunityIcons name={meta.icon} size={22} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}

function FloatingActionButton({ icon, showPlusBadge, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          Animated.timing(scale, {
            toValue: 0.94,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }}
        style={styles.actionButton}
      >
        <MaterialCommunityIcons name={icon} size={22} color="#111111" />
        {showPlusBadge ? (
          <View style={styles.actionBadge}>
            <MaterialCommunityIcons name="plus" size={10} color="#111111" />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default function FloatingAdminTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [actionConfig, setActionConfig] = useState(null);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const focusedRoute = state.routes[state.index];
  const nestedState = focusedRoute?.state;
  const nestedRouteName = nestedState?.routes?.[nestedState.index ?? 0]?.name;
  const canShowActionButton = Boolean(
    actionConfig && (
      focusedRoute?.name === 'AdminDash' ||
      focusedRoute?.name === 'HomeTab'
    ),
  );

  const shouldHide =
    (focusedRoute?.name === 'HomeTab' && nestedRouteName && nestedRouteName !== 'AdminVehiclesMain') ||
    (focusedRoute?.name === 'AdminDash' && nestedRouteName && nestedRouteName !== 'AdminDashMain');

  useEffect(() => {
    const unsubscribe = subscribeCustomerTabBarVisibility((visible) => {
      setIsVisible(visible);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAdminTabBarAction((action) => {
      setActionConfig(action);
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
    const sideGroupWidth =
      (SIDE_GROUP_PADDING * 2) +
      (SIDE_ROUTES.length * NAV_BUTTON_SIZE) +
      ((SIDE_ROUTES.length - 1) * SIDE_GROUP_GAP);
    const layoutWidth = PRIMARY_BUTTON_SIZE + LAYOUT_GAP + sideGroupWidth;
    const layoutLeft = (screen.width / 2) - (layoutWidth / 2);
    const primaryCenterX = layoutLeft + (PRIMARY_BUTTON_SIZE / 2);
    const sideGroupLeft = layoutLeft + PRIMARY_BUTTON_SIZE + LAYOUT_GAP;

    return {
      screen,
      primaryCenterX,
      sideGroupLeft,
    };
  };

  const getAnchor = (routeName) => {
    const { screen, primaryCenterX, sideGroupLeft } = getLayoutMetrics();

    if (routeName === PRIMARY_ROUTE) {
      return {
        x: primaryCenterX,
        y: screen.height - (insets.bottom + 10) - (PRIMARY_BUTTON_SIZE / 2),
      };
    }

    const routeIndex = SIDE_ROUTES.indexOf(routeName);
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

  if (shouldHide) {
    return null;
  }

  const navigateToRoot = (routeName, screenName, extraParams = {}) => {
    navigation.navigate(routeName, {
      screen: screenName,
      params: {
        tabTransitionAt: Date.now(),
        tabTransitionAnchor: getAnchor(routeName),
        ...extraParams,
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
          <FloatingButton
            routeName={PRIMARY_ROUTE}
            isFocused={focusedRoute?.name === PRIMARY_ROUTE}
            size={PRIMARY_BUTTON_SIZE}
            onPress={() => navigateToRoot('HomeTab', 'AdminVehiclesMain')}
          />

          <View style={styles.sideGroup}>
            <FloatingButton
              routeName="AdminDash"
              isFocused={focusedRoute?.name === 'AdminDash'}
              onPress={() => navigateToRoot('AdminDash', 'AdminDashMain', { resetToOverviewAt: Date.now() })}
            />
            <FloatingButton
              routeName="InventoryTab"
              isFocused={false}
              onPress={() => {
                setLogoutSheetVisible(true);
              }}
            />
          </View>
          {canShowActionButton ? (
            <FloatingActionButton
              icon={actionConfig.icon}
              showPlusBadge={Boolean(actionConfig.showPlusBadge)}
              onPress={actionConfig.onPress}
            />
          ) : null}
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    ...Shadow.sm,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
  },
  buttonFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(17,17,17,0.08)',
  },
  actionButton: {
    width: PRIMARY_BUTTON_SIZE,
    height: PRIMARY_BUTTON_SIZE,
    borderRadius: PRIMARY_BUTTON_SIZE / 2,
    backgroundColor: '#ffd400',
    borderWidth: 1,
    borderColor: '#ffd400',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  actionBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
  },
});
