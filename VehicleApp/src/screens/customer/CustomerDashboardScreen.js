import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import LogoutConfirmationSheet from '../../components/LogoutConfirmationSheet';
import PremiumCrownBadge from '../../components/PremiumCrownBadge';
import { bookingAPI, reviewAPI, inquiryAPI, wishlistAPI } from '../../api';
import { Card, StatusBadge, LoadingSpinner, EmptyState, Badge } from '../../components/UI';
import { Colors, Radius, Spacing, Shadow } from '../../constants/theme';

const TABS = ['Overview', 'Bookings', 'Wishlist', 'Reviews', 'Inquiries', 'Profile'];

export default function CustomerDashboardScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('Overview');
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);

  const load = async () => {
    try {
      const [bookingsRes, reviewsRes, inquiriesRes, wishlistRes] = await Promise.all([
        bookingAPI.myBookings(),
        reviewAPI.myReviews(),
        inquiryAPI.myInquiries(),
        wishlistAPI.getList(),
      ]);

      setBookings(bookingsRes.data);
      setReviews(reviewsRes.data);
      setInquiries(inquiriesRes.data);
      setWishlist(wishlistRes.data);
    } catch (_) {
      // Keep the dashboard resilient if one request fails.
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openLogoutSheet = useCallback(() => {
    if (logoutSheetVisible) {
      return;
    }

    setLogoutSheetVisible(true);
  }, [logoutSheetVisible]);

  const pendingBookings = bookings.filter((booking) => booking.status === 'Pending').length;
  const approvedBookings = bookings.filter((booking) => booking.status === 'Approved').length;

  const openInventory = () => {
    navigation.navigate('InventoryTab', { screen: 'InventoryMain' });
  };

  const openVehicle = (vehicleId) => {
    if (!vehicleId) {
      return;
    }

    navigation.navigate('InventoryTab', {
      screen: 'VehicleDetail',
      params: { vehicleId },
    });
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const renderOverview = () => (
    <ScrollView>
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeCopy}>
          <View style={styles.welcomeNameRow}>
            <Text style={styles.welcomeText}>Welcome back, {user?.fullName?.split(' ')[0]}!</Text>
            {user?.isPremium ? <PremiumCrownBadge style={styles.welcomeCrown} /> : null}
          </View>
          <Text style={styles.welcomeSub}>Your bookings, saved vehicles, and account tools are here.</Text>
        </View>
        <View style={styles.welcomeActions}>
          <TouchableOpacity style={styles.bannerLogoutBtn} onPress={openLogoutSheet}>
            <Text style={styles.bannerLogoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Bookings', value: bookings.length, color: Colors.blue },
          { label: 'Pending', value: pendingBookings, color: Colors.promo },
          { label: 'Approved', value: approvedBookings, color: Colors.rent },
          { label: 'Wishlist', value: wishlist.length, color: Colors.danger },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={[styles.statNum, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Card>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {[
            { icon: 'Cars', label: 'Browse Vehicles', onPress: openInventory },
            { icon: 'Rent', label: 'My Bookings', onPress: () => setActiveTab('Bookings') },
            { icon: 'Save', label: 'My Wishlist', onPress: () => setActiveTab('Wishlist') },
            { icon: 'Rate', label: 'My Reviews', onPress: () => setActiveTab('Reviews') },
          ].map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickAction} onPress={action.onPress}>
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {bookings.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>Recent Bookings</Text>
          {bookings.slice(0, 3).map((booking) => (
            <View key={booking._id} style={styles.bookingItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingVehicle}>
                  {booking.vehicle?.brand} {booking.vehicle?.model}
                </Text>
                <Text style={styles.bookingDates}>
                  {booking.startDate} to {booking.endDate}
                </Text>
              </View>
              <StatusBadge status={booking.status} />
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {bookings.length === 0 ? (
        <EmptyState icon="Bookings" title="No bookings yet" />
      ) : (
        bookings.map((booking) => (
          <Card key={booking._id}>
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingVehicle}>{booking.vehicle?.brand} {booking.vehicle?.model}</Text>
              <StatusBadge status={booking.status} />
            </View>
            <Text style={styles.bookingDates}>
              {booking.startDate} {booking.startTime} to {booking.endDate} {booking.endTime}
            </Text>
            {booking.status === 'Pending' ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={async () => {
                  try {
                    await bookingAPI.cancel(booking._id);
                    load();
                  } catch (err) {
                    alert(err?.response?.data?.message || 'Failed to cancel');
                  }
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel Booking</Text>
              </TouchableOpacity>
            ) : null}
            {booking?.refundMeta?.status === 'Refund Available' ? (
              <TouchableOpacity style={styles.refundBtn} onPress={() => navigation.navigate('ClaimRefund', { booking })}>
                <Text style={styles.refundBtnText}>Request Refund</Text>
              </TouchableOpacity>
            ) : null}
            {booking?.refundMeta?.status && !['Refund Available', 'Refund Not Available'].includes(booking.refundMeta.status) ? (
              <View style={{ marginTop: Spacing.sm }}>
                <StatusBadge status={booking.refundMeta.status} />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );

  const renderWishlist = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {wishlist.length === 0 ? (
        <EmptyState icon="Wishlist" title="Wishlist is empty" />
      ) : (
        wishlist.map((item) => (
          <TouchableOpacity key={item._id} onPress={() => openVehicle(item.vehicle?._id)}>
            <Card>
              <Text style={styles.wishVehicle}>{item.vehicle?.brand} {item.vehicle?.model}</Text>
              <Text style={styles.wishPrice}>Rs. {Number(item.vehicle?.price || 0).toLocaleString()}</Text>
              <Text style={styles.wishDate}>Saved on {new Date(item.addedDate).toLocaleDateString()}</Text>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderReviews = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {reviews.length === 0 ? (
        <EmptyState icon="Reviews" title="No reviews yet" />
      ) : (
        reviews.map((review) => (
          <Card key={review._id}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewVehicle}>Vehicle Review</Text>
              <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}</Text>
            </View>
            <Text style={styles.reviewComment}>{review.comment}</Text>
            <Text style={styles.reviewDate}>{review.reviewDate}</Text>
            <View style={styles.aiRow}>
              {review.aiSentiment ? (
                <Badge label={`AI ${review.aiSentiment}`} color={Colors.blue} bg={Colors.blueSoft} />
              ) : null}
              <StatusBadge status={review.reviewStatus} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );

  const renderInquiries = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {inquiries.length === 0 ? (
        <EmptyState icon="Inquiries" title="No inquiries yet" />
      ) : (
        inquiries.map((inquiry) => (
          <Card key={inquiry._id}>
            <View style={styles.inquiryHeader}>
              <Text style={styles.inquiryVehicle}>Sales Inquiry</Text>
              <StatusBadge status={inquiry.status} />
            </View>
            <Text style={styles.inquiryDate}>{inquiry.inquiryDate}</Text>
            {inquiry.message ? <Text style={styles.inquiryMsg} numberOfLines={2}>{inquiry.message}</Text> : null}
          </Card>
        ))
      )}
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Card>
        <Text style={styles.cardTitle}>Account Details</Text>
        <View style={styles.profileItem}>
          <Text style={styles.profileLabel}>Name</Text>
          <View style={styles.profileValueRow}>
            <Text style={styles.profileValue}>{user?.fullName}</Text>
            {user?.isPremium ? <PremiumCrownBadge style={styles.profileValueCrown} size={24} iconSize={13} /> : null}
          </View>
        </View>
        <View style={styles.profileItem}><Text style={styles.profileLabel}>Email</Text><Text style={styles.profileValue}>{user?.email}</Text></View>
        <View style={styles.profileItem}><Text style={styles.profileLabel}>Role</Text><Text style={styles.profileValue}>{user?.role}</Text></View>
        <View style={styles.profileItem}><Text style={styles.profileLabel}>Premium</Text><Text style={styles.profileValue}>{user?.isPremium ? 'Active' : 'Basic'}</Text></View>
      </Card>
      <TouchableOpacity style={styles.logoutBtn} onPress={openLogoutSheet}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const tabContent = {
    Overview: renderOverview(),
    Bookings: renderBookings(),
    Wishlist: renderWishlist(),
    Reviews: renderReviews(),
    Inquiries: renderInquiries(),
    Profile: renderProfile(),
  };

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.content}>
        {tabContent[activeTab]}
      </View>

      <LogoutConfirmationSheet
        visible={logoutSheetVisible}
        onClose={() => setLogoutSheetVisible(false)}
        onConfirm={logout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  tabBar: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 52 },
  tabBarContent: { paddingHorizontal: Spacing.lg, gap: 4, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.full, marginVertical: 8 },
  tabActive: { backgroundColor: Colors.blue },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  tabTextActive: { color: '#fff' },
  content: { flex: 1 },

  welcomeBanner: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.blueSoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.blueMid,
    gap: Spacing.md,
  },
  welcomeCopy: { gap: 4 },
  welcomeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  welcomeText: { fontSize: 18, fontWeight: '800', color: Colors.blue },
  welcomeCrown: { marginTop: 1 },
  welcomeSub: { fontSize: 13, color: Colors.text },
  welcomeActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'space-between' },
  bannerLogoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerLogoutText: { fontSize: 12, fontWeight: '700', color: Colors.text },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  statNum: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', marginTop: 2 },

  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickAction: {
    width: '47%',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.soft,
    borderRadius: Radius.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.stroke,
  },
  quickActionIcon: { fontSize: 13, fontWeight: '700', color: Colors.blue },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },

  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bookingVehicle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bookingDates: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cancelBtn: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft, borderWidth: 1, borderColor: '#fecaca' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Colors.danger, textAlign: 'center' },
  refundBtn: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.blueSoft, borderWidth: 1, borderColor: Colors.blueMid },
  refundBtnText: { fontSize: 13, fontWeight: '700', color: Colors.blue, textAlign: 'center' },

  tabContent: { padding: Spacing.lg, paddingBottom: 30 },
  wishVehicle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  wishPrice: { fontSize: 14, fontWeight: '700', color: Colors.blue, marginTop: 4 },
  wishDate: { fontSize: 12, color: Colors.muted, marginTop: 4 },

  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewVehicle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  reviewStars: { fontSize: 14 },
  reviewComment: { fontSize: 14, color: Colors.muted, lineHeight: 20 },
  reviewDate: { fontSize: 11, color: Colors.muted, marginTop: 6 },
  aiRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },

  inquiryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  inquiryVehicle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  inquiryDate: { fontSize: 12, color: Colors.muted },
  inquiryMsg: { fontSize: 13, color: Colors.muted, marginTop: 6 },

  profileItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileLabel: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  profileValue: { fontSize: 13, color: Colors.text, fontWeight: '700' },
  profileValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '62%' },
  profileValueCrown: { marginTop: 1 },

  logoutBtn: { margin: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.dangerSoft, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.danger },
});
