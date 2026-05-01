import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { vehicleAPI, promotionAPI } from '../../api';
import { BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import VehicleCard from '../../components/VehicleCard';
import { LoadingSpinner, Badge } from '../../components/UI';
import { Colors, Radius, Spacing, Shadow } from '../../constants/theme';
import { formatPromotionDiscountValue, getVehiclePromotion } from '../../utils/promotionUtils';

export default function HomeScreen() {
  const navigation  = useNavigation();
  const { user }    = useAuth();

  const [vehicles,    setVehicles]    = useState([]);
  const [promotions,  setPromotions]  = useState([]);
  const [activePromotions, setActivePromotions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = async () => {
    try {
      const [vRes, pRes, activePromotionRes] = await Promise.all([
        vehicleAPI.getAll(),
        promotionAPI.showcase(),
        promotionAPI.getActive().catch(() => ({ data: [] })),
      ]);
      setVehicles(vRes.data);
      setPromotions(pRes.data);
      setActivePromotions(activePromotionRes.data || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const saleCount = vehicles.filter(v => v.listingType === 'Sale').length;
  const rentCount = vehicles.filter(v => v.listingType === 'Rent').length;
  const featured  = vehicles.slice(0, 6);
  const promotionMap = useMemo(
    () => Object.fromEntries(
      featured.map((vehicle) => [
        String(vehicle._id),
        getVehiclePromotion(vehicle, activePromotions, { placement: 'vehicleCard' }),
      ]),
    ),
    [activePromotions, featured],
  );

  const openInventory = () => {
    if (user) {
      navigation.navigate('InventoryTab', { screen: 'InventoryMain' });
      return;
    }

    navigation.navigate('Inventory');
  };

  const openVehicle = (vehicleId) => {
    if (user) {
      navigation.navigate('InventoryTab', {
        screen: 'VehicleDetail',
        params: { vehicleId },
      });
      return;
    }

    navigation.navigate('Inventory', {
      screen: 'VehicleDetail',
      params: { vehicleId },
    });
  };

  const openDashboard = () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    if (user.role === 'ADMIN') {
      navigation.navigate('AdminDash');
      return;
    }

    if (user.role === 'MARKETING_MANAGER') {
      navigation.navigate('MarketingDash');
      return;
    }

    navigation.navigate('Dashboard');
  };

  if (loading) return <LoadingSpinner message="Loading marketplace..." />;

  return (
    <ScrollView
      style={styles.root}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Hero Banner */}
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.logoPill}>
            <Text style={styles.logoIcon}>🚗</Text>
            <Text style={styles.logoText}>K.D. <Text style={styles.logoAccent}>Auto Traders</Text></Text>
          </View>
          <Text style={styles.heroTitle}>Find the right{'\n'}
            <Text style={styles.heroAccent}>vehicle faster</Text>
          </Text>
          <Text style={styles.heroSub}>
            Premium sales &amp; rentals with clearer pricing and smarter browsing.
          </Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{vehicles.length}</Text>
              <Text style={styles.statLabel}>live listings</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{saleCount}</Text>
              <Text style={styles.statLabel}>for sale</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{rentCount}</Text>
              <Text style={styles.statLabel}>for rent</Text>
            </View>
          </View>

          {/* CTA Buttons */}
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroBtnPrimary}
              onPress={openInventory}
            >
              <Text style={styles.heroBtnPrimaryText}>🔍  Browse Inventory</Text>
            </TouchableOpacity>
            {!user && (
              <TouchableOpacity
                style={styles.heroBtnSecondary}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.heroBtnSecondaryText}>✨  Sign Up Free</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Trust badges */}
      <View style={styles.trustRow}>
        {[
          { icon: '🏷️', label: 'Live Promotions' },
          { icon: '🔒', label: 'Secure Booking' },
          { icon: '⭐', label: 'Verified Reviews' },
          { icon: '💳', label: 'Easy Payments' },
        ].map(item => (
          <View key={item.label} style={styles.trustItem}>
            <Text style={styles.trustIcon}>{item.icon}</Text>
            <Text style={styles.trustLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Live Promotions */}
      {promotions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>✨ Live Campaigns</Text>
              <Text style={styles.sectionTitle}>Current Promotions</Text>
            </View>
            <Badge label={`${promotions.length} active`} color={Colors.promo} bg={Colors.promoSoft} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoScroll}>
            {promotions.map(promo => (
              <View key={promo._id} style={styles.promoCard}>
                {promo.imageUrl && (
                  <Image
                    source={{ uri: `${BASE_URL}${promo.imageUrl}` }}
                    style={styles.promoImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.promoBody}>
                  <View style={styles.promoDiscountBadge}>
                    <Text style={styles.promoDiscountText}>{formatPromotionDiscountValue(promo)}</Text>
                  </View>
                  <Text style={styles.promoTitle} numberOfLines={2}>{promo.title}</Text>
                  <Text style={styles.promoDesc} numberOfLines={2}>{promo.description}</Text>
                  <Text style={styles.promoDates}>
                    {promo.startDate} → {promo.endDate}
                  </Text>
                  {promo.highlightLabel && (
                    <View style={styles.promoHighlight}>
                      <Text style={styles.promoHighlightText}>{promo.highlightLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Featured Vehicles */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>🚗 Featured Vehicles</Text>
            <Text style={styles.sectionTitle}>Fresh Inventory</Text>
          </View>
          <TouchableOpacity onPress={openInventory}>
            <Text style={styles.seeAllLink}>See all →</Text>
          </TouchableOpacity>
        </View>

        {featured.map(vehicle => (
          <VehicleCard
            key={vehicle._id}
            vehicle={vehicle}
            promotion={promotionMap[String(vehicle._id)]}
            onPress={() => openVehicle(vehicle._id)}
          />
        ))}

        {vehicles.length > 6 && (
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={openInventory}
          >
            <Text style={styles.viewAllText}>View All {vehicles.length} Vehicles</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* About / CTA strip */}
      <View style={styles.ctaStrip}>
        <Text style={styles.ctaTitle}>A smarter dealership experience.</Text>
        <Text style={styles.ctaSub}>
          K.D. Auto Traders is built to feel like a trusted premium dealership —
          not a noisy listing site.
        </Text>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={openDashboard}
        >
          <Text style={styles.ctaBtnText}>
            {user ? '📊 Go to Dashboard' : '🔑 Sign In'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 K.D. Auto Traders · Premium Vehicle Marketplace</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  /* Hero */
  hero: {
    backgroundColor: Colors.navy,
    paddingTop: 60, paddingBottom: 40,
    paddingHorizontal: Spacing.xl,
  },
  heroContent: { gap: Spacing.lg },
  logoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  logoIcon: { fontSize: 16 },
  logoText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  logoAccent: { color: Colors.blue3 },

  heroTitle: { fontSize: 34, fontWeight: '900', color: '#fff', lineHeight: 40, letterSpacing: -0.5 },
  heroAccent: { color: Colors.blue3 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 22 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statPill: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', gap: 3,
  },
  statNum: { fontSize: 20, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },

  heroActions: { flexDirection: 'row', gap: Spacing.sm },
  heroBtnPrimary: {
    flex: 1, height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },
  heroBtnPrimaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  heroBtnSecondary: {
    flex: 1, height: 50, borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBtnSecondaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* Trust row */
  trustRow: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  trustItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  trustIcon: { fontSize: 18 },
  trustLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  /* Sections */
  section: { padding: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Spacing.lg },
  sectionKicker: { fontSize: 12, fontWeight: '800', color: Colors.blue, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  seeAllLink: { fontSize: 14, fontWeight: '700', color: Colors.blue },

  /* Promotions */
  promoScroll: { marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl },
  promoCard: {
    width: 280, marginRight: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  promoImage: { width: '100%', height: 140 },
  promoBody: { padding: Spacing.md, gap: 6 },
  promoDiscountBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.promoSoft, borderRadius: Radius.full,
  },
  promoDiscountText: { fontSize: 12, fontWeight: '900', color: Colors.promo },
  promoTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  promoDesc: { fontSize: 13, color: Colors.muted, lineHeight: 18 },
  promoDates: { fontSize: 11, color: Colors.muted },
  promoHighlight: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.blueSoft, borderRadius: Radius.full, alignSelf: 'flex-start',
  },
  promoHighlightText: { fontSize: 11, fontWeight: '700', color: Colors.blue },

  viewAllBtn: {
    height: 50, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  viewAllText: { fontSize: 15, fontWeight: '700', color: Colors.blue },

  /* CTA Strip */
  ctaStrip: {
    margin: Spacing.xl, padding: Spacing.xxl,
    backgroundColor: Colors.navy, borderRadius: Radius.xxl,
    gap: Spacing.md, ...Shadow.lg,
  },
  ctaTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  ctaSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22 },
  ctaBtn: {
    height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  /* Footer */
  footer: { padding: Spacing.xl, alignItems: 'center' },
  footerText: { fontSize: 12, color: Colors.muted, textAlign: 'center' },
});
