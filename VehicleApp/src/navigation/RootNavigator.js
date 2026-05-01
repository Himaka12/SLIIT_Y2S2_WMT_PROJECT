import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import FloatingCustomerTabBar from '../components/FloatingCustomerTabBar';
import FloatingAdminTabBar from '../components/FloatingAdminTabBar';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import RegisterAgreementScreen from '../screens/auth/RegisterAgreementScreen';
import OnboardingIntroScreen from '../screens/onboarding/OnboardingIntroScreen';

import HomeScreen from '../screens/shared/HomeScreen';
import InventoryScreen from '../screens/shared/InventoryScreen';
import VehicleDetailScreen from '../screens/shared/VehicleDetailScreen';
import SaleVehicleDetailsScreen from '../screens/shared/SaleVehicleDetailsScreen';
import RentVehicleDetailsScreen from '../screens/shared/RentVehicleDetailsScreen';

import CustomerDashboardScreen from '../screens/customer/CustomerDashboardScreen';
import CustomerSearchScreen from '../screens/customer/CustomerSearchScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import ManageProfileScreen from '../screens/customer/ManageProfileScreen';
import EditDetailsScreen from '../screens/customer/EditDetailsScreen';
import ProfileInfoScreen from '../screens/customer/ProfileInfoScreen';
import PremiumUpgradeScreen from '../screens/customer/PremiumUpgradeScreen';
import CustomerWishlistScreen from '../screens/customer/CustomerWishlistScreen';
import CustomerInquiriesScreen from '../screens/customer/CustomerInquiriesScreen';
import CustomerBookingsScreen from '../screens/customer/CustomerBookingsScreen';
import CustomerReviewsScreen from '../screens/customer/CustomerReviewsScreen';
import CustomerPromotionsScreen from '../screens/customer/CustomerPromotionsScreen';
import BookVehicleScreen from '../screens/customer/BookVehicleScreen';
import ClaimRefundScreen from '../screens/customer/ClaimRefundScreen';
import AboutAppScreen from '../screens/customer/AboutAppScreen';
import HelpSupportScreen from '../screens/customer/HelpSupportScreen';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminVehicleCatalogScreen from '../screens/admin/AdminVehicleCatalogScreen';
import AddEditVehicleScreen from '../screens/admin/AddEditVehicleScreen';
import ProcessRefundScreen from '../screens/admin/ProcessRefundScreen';
import MarketingDashboardScreen from '../screens/admin/MarketingDashboardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const IOS_PUSH_GESTURE_OPTIONS = {
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  fullScreenGestureEnabled: true,
  animation: 'slide_from_right',
};
const REFUND_MODAL_OPTIONS = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'slide_from_bottom',
  gestureEnabled: true,
  contentStyle: { backgroundColor: 'transparent' },
};
const VEHICLE_EDITOR_SHEET_OPTIONS = {
  headerShown: false,
  presentation: 'modal',
  animation: 'slide_from_bottom',
  gestureEnabled: true,
  contentStyle: { backgroundColor: '#fff' },
};

function SignInRedirectScreen() {
  return null;
}

function CustomerLogoutPlaceholderScreen() {
  return null;
}

function GuestTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.blue,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: '#fff',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryStack}
        options={{ tabBarLabel: 'Vehicles', tabBarIcon: ({ color }) => <TabIcon icon="🚗" color={color} /> }}
      />
      <Tab.Screen
        name="SignIn"
        component={SignInRedirectScreen}
        options={{ tabBarLabel: 'Sign In', tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} /> }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('Login');
          },
        })}
      />
    </Tab.Navigator>
  );
}

function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <FloatingCustomerTabBar {...props} />}
    >
      <Tab.Screen
        name="InventoryTab"
        component={CustomerSearchStack}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen
        name="Dashboard"
        component={CustomerProfileStack}
        options={{ tabBarLabel: 'Profile' }}
      />
      <Tab.Screen
        name="WishlistTab"
        component={CustomerWishlistStack}
        options={{ tabBarLabel: 'Wishlist' }}
      />
      <Tab.Screen
        name="LogoutTab"
        component={CustomerLogoutPlaceholderScreen}
        options={{ tabBarLabel: 'Logout' }}
      />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <FloatingAdminTabBar {...props} />}
    >
      <Tab.Screen
        name="HomeTab"
        component={AdminVehicleStack}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }}
      />
      <Tab.Screen
        name="AdminDash"
        component={AdminStack}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={CustomerLogoutPlaceholderScreen}
        options={{ tabBarLabel: 'Vehicles', tabBarIcon: ({ color }) => <TabIcon icon="🚗" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function MarketingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="MarketingDash"
        component={MarketingDashboardScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'K.D. Auto Traders', headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="InventoryMain" component={InventoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SaleVehicleDetails" component={SaleVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RentVehicleDetails" component={RentVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookVehicle" component={BookVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
      <Stack.Screen
        name="CustomerPromotionsMain"
        component={CustomerPromotionsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function CustomerSearchStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="CustomerSearchMain"
        component={CustomerSearchScreen}
        options={{ headerShown: false, animation: 'none' }}
      />
      <Stack.Screen
        name="CustomerProfileMain"
        component={CustomerProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageProfileMain"
        component={ManageProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditDetailsMain"
        component={EditDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PremiumUpgradeMain"
        component={PremiumUpgradeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProfileInfoMain"
        component={ProfileInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerWishlistMain"
        component={CustomerWishlistScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerInquiriesMain"
        component={CustomerInquiriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerBookingsMain"
        component={CustomerBookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerReviewsMain"
        component={CustomerReviewsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPromotionsMain"
        component={CustomerPromotionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AboutAppMain"
        component={AboutAppScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HelpSupportMain"
        component={HelpSupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ClaimRefund" component={ClaimRefundScreen} options={REFUND_MODAL_OPTIONS} />
      <Stack.Screen
        name="InventoryMain"
        component={InventoryScreen}
        options={{ headerShown: false, animation: 'none' }}
      />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SaleVehicleDetails" component={SaleVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RentVehicleDetails" component={RentVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookVehicle" component={BookVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
    </Stack.Navigator>
  );
}

function GuestNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingIntro" component={OnboardingIntroScreen} />
      <Stack.Screen name="GuestTabs" component={GuestTabs} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          ...VEHICLE_EDITOR_SHEET_OPTIONS,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="RegisterAgreement"
        component={RegisterAgreementScreen}
        options={{
          ...VEHICLE_EDITOR_SHEET_OPTIONS,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          ...VEHICLE_EDITOR_SHEET_OPTIONS,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack.Navigator>
  );
}

function CustomerDashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="CustomerDashMain"
        component={CustomerDashboardScreen}
        options={{ title: 'My Dashboard' }}
      />
      <Stack.Screen
        name="CustomerReviewsMain"
        component={CustomerReviewsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPromotionsMain"
        component={CustomerPromotionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ClaimRefund" component={ClaimRefundScreen} options={REFUND_MODAL_OPTIONS} />
    </Stack.Navigator>
  );
}

function CustomerProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="CustomerProfileMain"
        component={CustomerProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageProfileMain"
        component={ManageProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditDetailsMain"
        component={EditDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PremiumUpgradeMain"
        component={PremiumUpgradeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProfileInfoMain"
        component={ProfileInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerWishlistMain"
        component={CustomerWishlistScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerInquiriesMain"
        component={CustomerInquiriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerBookingsMain"
        component={CustomerBookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerReviewsMain"
        component={CustomerReviewsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPromotionsMain"
        component={CustomerPromotionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AboutAppMain"
        component={AboutAppScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HelpSupportMain"
        component={HelpSupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerDashMain"
        component={CustomerDashboardScreen}
        options={{ title: 'My Dashboard' }}
      />
      <Stack.Screen name="ClaimRefund" component={ClaimRefundScreen} options={REFUND_MODAL_OPTIONS} />
    </Stack.Navigator>
  );
}

function CustomerWishlistStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="CustomerWishlistMain"
        component={CustomerWishlistScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerInquiriesMain"
        component={CustomerInquiriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerBookingsMain"
        component={CustomerBookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerReviewsMain"
        component={CustomerReviewsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPromotionsMain"
        component={CustomerPromotionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ClaimRefund" component={ClaimRefundScreen} options={REFUND_MODAL_OPTIONS} />
      <Stack.Screen
        name="CustomerProfileMain"
        component={CustomerProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageProfileMain"
        component={ManageProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditDetailsMain"
        component={EditDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PremiumUpgradeMain"
        component={PremiumUpgradeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProfileInfoMain"
        component={ProfileInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AboutAppMain"
        component={AboutAppScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HelpSupportMain"
        component={HelpSupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SaleVehicleDetails" component={SaleVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RentVehicleDetails" component={RentVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookVehicle" component={BookVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
      <Stack.Screen name="InventoryMain" component={InventoryScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function AdminVehicleStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="AdminVehiclesMain"
        component={AdminVehicleCatalogScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SaleVehicleDetails" component={SaleVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RentVehicleDetails" component={RentVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddVehicle" component={AddEditVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
      <Stack.Screen name="EditVehicle" component={AddEditVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...IOS_PUSH_GESTURE_OPTIONS,
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="AdminDashMain" component={AdminDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SaleVehicleDetails" component={SaleVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RentVehicleDetails" component={RentVehicleDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddVehicle" component={AddEditVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
      <Stack.Screen name="EditVehicle" component={AddEditVehicleScreen} options={VEHICLE_EDITOR_SHEET_OPTIONS} />
      <Stack.Screen name="ProcessRefund" component={ProcessRefundScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PromotionManagement" component={MarketingDashboardScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

const TabIcon = ({ icon }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 18 }}>{icon}</Text>
  </View>
);

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.navy }}>
        <ActivityIndicator size="large" color={Colors.blue} />
      </View>
    );
  }

  let RootComponent;
  if (!user) {
    RootComponent = GuestNavigator;
  } else if (user.role === 'ADMIN') {
    RootComponent = AdminTabs;
  } else if (user.role === 'MARKETING_MANAGER') {
    RootComponent = MarketingStack;
  } else {
    RootComponent = CustomerTabs;
  }

  return (
    <NavigationContainer>
      <RootComponent />
    </NavigationContainer>
  );
}

