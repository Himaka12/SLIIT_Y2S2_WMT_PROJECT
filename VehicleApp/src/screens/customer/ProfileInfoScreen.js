import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, customerAPI } from '../../api';
import PremiumCrownBadge from '../../components/PremiumCrownBadge';
import { Colors, Shadow } from '../../constants/theme';

function resolveAssetUri(path) {
  if (!path || typeof path !== 'string') {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/')) {
    return `${BASE_URL}${path}`;
  }

  return `${BASE_URL}/${path}`;
}

function splitFullName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function formatAddress(address) {
  const parts = [
    address?.houseNo,
    address?.lane,
    address?.city,
    address?.district,
    address?.province,
    address?.postalCode,
  ].filter((part) => String(part || '').trim());

  return parts.length ? parts.join(', ') : 'Not added yet';
}

function InfoItem({ label, value, hideBorder = false }) {
  return (
    <View style={[styles.infoRow, hideBorder && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Not added yet'}</Text>
    </View>
  );
}

export default function ProfileInfoScreen({ navigation }) {
  const route = useRoute();
  const initialProfile = route.params?.initialProfile || null;
  const [profile, setProfile] = useState(initialProfile);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await customerAPI.getProfile();
        setProfile(data || null);
      } catch (_) {
        setProfile((current) => current || null);
      }
    };

    load();
  }, []);

  const nameParts = useMemo(
    () => splitFullName(profile?.fullName),
    [profile?.fullName],
  );
  const profileImageUri = resolveAssetUri(profile?.profileImage);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Profile Info</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <View style={styles.headerCard}>
        {profileImageUri ? (
          <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>
              {(profile?.fullName || 'W').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerNameRow}>
          <Text style={styles.headerName}>{profile?.fullName || 'Wheelzy User'}</Text>
          {profile?.isPremium ? <PremiumCrownBadge style={styles.headerNameCrown} size={30} iconSize={17} /> : null}
        </View>
        <Text style={styles.headerEmail}>{profile?.email || 'No email available'}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoItem label="First Name" value={profile?.firstName || nameParts.firstName} />
        <InfoItem label="Last Name" value={profile?.lastName || nameParts.lastName} />
        <InfoItem label="Email" value={profile?.email} />
        <InfoItem label="Primary Phone" value={profile?.phone || profile?.contactNumber} />
        <InfoItem label="Secondary Phone" value={profile?.secondaryPhone} />
        <InfoItem label="Address" value={formatAddress(profile?.address)} hideBorder />
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
    paddingBottom: 40,
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
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  headerCard: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    ...Shadow.sm,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e5e7eb',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  avatarFallbackText: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.white,
  },
  headerNameRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },
  headerNameCrown: {
    marginTop: 1,
  },
  headerEmail: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  infoCard: {
    marginTop: 22,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    ...Shadow.sm,
  },
  infoRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: '#111111',
  },
});
