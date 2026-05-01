import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../../constants/theme';

const SUPPORT_EMAIL = 'support@wheelzy.lk';
const SUPPORT_PHONE = '0700000000';

const FAQS = [
  {
    question: 'How do I make a rental booking?',
    answer: 'Open a rental vehicle, choose your pickup and return details, upload the payment slip, and submit the booking request.',
  },
  {
    question: 'Where can I see my booking status?',
    answer: 'Go to Profile, then My Bookings. Pending, approved, cancelled, and refund states are shown there.',
  },
  {
    question: 'How do I ask about a sale vehicle?',
    answer: 'Open a sale vehicle and send an inquiry with your preferred contact method. The team can follow up from the inquiry record.',
  },
  {
    question: 'Can I change my account details?',
    answer: 'Use Edit Details for profile information and Manage Profile for password, security question, and account settings.',
  },
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
      <Text style={styles.pageTitle}>Help</Text>
      <View style={styles.backButtonPlaceholder} />
    </View>
  );
}

function ContactAction({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.contactAction} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.contactIcon}>
        <MaterialCommunityIcons name={icon} size={22} color="#111111" />
      </View>
      <View style={styles.contactCopy}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#9ca3af" />
    </TouchableOpacity>
  );
}

function FaqItem({ item, hideBorder = false }) {
  return (
    <View style={[styles.faqItem, hideBorder && styles.faqItemLast]}>
      <View style={styles.faqQuestionRow}>
        <MaterialCommunityIcons name="help-circle-outline" size={20} color={Colors.blue} />
        <Text style={styles.faqQuestion}>{item.question}</Text>
      </View>
      <Text style={styles.faqAnswer}>{item.answer}</Text>
    </View>
  );
}

export default function HelpSupportScreen({ navigation }) {
  const openPhone = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {});
  };

  const openEmail = () => {
    const subject = encodeURIComponent('Wheelzy customer support');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {});
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TopBar navigation={navigation} />

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="lifebuoy" size={34} color="#111111" />
        </View>
        <Text style={styles.heroTitle}>How can we help?</Text>
        <Text style={styles.heroSubtitle}>
          Get quick guidance for bookings, inquiries, refunds, account settings, and vehicle activity.
        </Text>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Contact Support</Text>
        <View style={styles.contactCard}>
          <ContactAction
            icon="phone-outline"
            title="Call Support"
            subtitle={SUPPORT_PHONE}
            onPress={openPhone}
          />
          <ContactAction
            icon="email-outline"
            title="Email Support"
            subtitle={SUPPORT_EMAIL}
            onPress={openEmail}
          />
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Common Questions</Text>
        <View style={styles.faqCard}>
          {FAQS.map((item, index) => (
            <FaqItem
              key={item.question}
              item={item}
              hideBorder={index === FAQS.length - 1}
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
    backgroundColor: Colors.blueSoft,
    borderWidth: 1,
    borderColor: Colors.blueMid,
    alignItems: 'center',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...Shadow.sm,
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 27,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
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
  contactCard: {
    marginTop: 16,
    gap: 12,
  },
  contactAction: {
    minHeight: 76,
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#edf2f7',
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.sm,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  contactCopy: {
    flex: 1,
    marginLeft: 14,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  contactSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  faqCard: {
    marginTop: 16,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#edf2f7',
    ...Shadow.sm,
  },
  faqItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    color: '#111111',
  },
  faqAnswer: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },
});
