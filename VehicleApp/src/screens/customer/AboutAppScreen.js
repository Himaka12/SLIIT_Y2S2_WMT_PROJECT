import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../../constants/theme';

const FEATURES = [
  {
    icon: 'car-search-outline',
    title: 'Browse vehicles',
    body: 'Explore sales and rental vehicles with photos, prices, availability, and vehicle details.',
  },
  {
    icon: 'calendar-check-outline',
    title: 'Book rentals',
    body: 'Send rental booking requests, upload payment slips, and track booking status from your dashboard.',
  },
  {
    icon: 'heart-outline',
    title: 'Save favorites',
    body: 'Keep a shortlist of vehicles in your wishlist so you can return to them quickly.',
  },
  {
    icon: 'message-text-outline',
    title: 'Inquiries and reviews',
    body: 'Contact the team about sale vehicles and share feedback after eligible bookings.',
  },
];

const DETAILS = [
  ['App Name', 'Wheelzy'],
  ['Business', 'K.D. Auto Traders'],
  ['Version', '1.0.0'],
  ['Platform', 'Vehicle sales and rental mobile app'],
];

function TopBar({ navigation }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
      </TouchableOpacity>
      <Text style={styles.pageTitle}>About App</Text>
      <View style={styles.backButtonPlaceholder} />
    </View>
  );
}

function FeatureCard({ item }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <MaterialCommunityIcons name={item.icon} size={24} color="#111111" />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{item.title}</Text>
        <Text style={styles.featureBody}>{item.body}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value, hideBorder = false }) {
  return (
    <View style={[styles.detailRow, hideBorder && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function AboutAppScreen({ navigation }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TopBar navigation={navigation} />

      <View style={styles.heroCard}>
        <View style={styles.logoMark}>
          <MaterialCommunityIcons name="steering" size={34} color="#ffffff" />
        </View>
        <Text style={styles.heroTitle}>Wheelzy</Text>
        <Text style={styles.heroSubtitle}>
          A mobile experience for browsing, renting, buying, and managing vehicles from K.D. Auto Traders.
        </Text>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>What You Can Do</Text>
        <View style={styles.featureList}>
          {FEATURES.map((item) => (
            <FeatureCard key={item.title} item={item} />
          ))}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>App Details</Text>
        <View style={styles.detailCard}>
          {DETAILS.map(([label, value], index) => (
            <DetailRow
              key={label}
              label={label}
              value={value}
              hideBorder={index === DETAILS.length - 1}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 52,
    paddingBottom: 42,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },
  heroCard: {
    marginTop: 20,
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#111111',
    alignItems: 'center',
    ...Shadow.sm,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.blue,
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#d1d5db',
    textAlign: 'center',
  },
  sectionWrap: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
  },
  featureList: {
    marginTop: 16,
    gap: 12,
  },
  featureCard: {
    minHeight: 92,
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#edf2f7',
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.sm,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  featureCopy: {
    flex: 1,
    marginLeft: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  featureBody: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },
  detailCard: {
    marginTop: 16,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#edf2f7',
    ...Shadow.sm,
  },
  detailRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    color: '#111111',
  },
});
