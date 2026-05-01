import React, { useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';
import { PrimaryButton, SecondaryButton } from './UI';
import { MAX_REVIEW_IMAGES } from './ReviewShared';

function resolvePreviewUri(item) {
  if (!item) {
    return null;
  }

  return item.uri || null;
}

export default function ReviewComposerModal({
  visible,
  mode = 'create',
  vehicleLabel,
  rating,
  onChangeRating,
  message,
  onChangeMessage,
  images = [],
  onPickImages,
  onRemoveImage,
  onClose,
  onSubmit,
  submitting = false,
  errorMessage = '',
}) {
  const insets = useSafeAreaInsets();
  const [messageFocused, setMessageFocused] = useState(false);
  const messageDragResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!messageFocused) {
            return false;
          }

          return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          setMessageFocused(false);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 62) {
            onClose?.();
          }
        },
      }),
    [messageFocused, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Text style={styles.title}>{mode === 'edit' ? 'Edit Review' : 'Write a Review'}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.88}>
              <MaterialCommunityIcons name="close" size={22} color="#111111" />
            </TouchableOpacity>
          </View>

          {!!vehicleLabel && (
            <Text style={styles.subtitle}>
              Share your rental experience for {vehicleLabel}.
            </Text>
          )}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your Rating</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => onChangeRating?.(star)} activeOpacity={0.85}>
                  <MaterialCommunityIcons
                    name={star <= Number(rating || 0) ? 'star' : 'star-outline'}
                    size={34}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard} {...messageDragResponder.panHandlers}>
            <Text style={styles.sectionTitle}>Your Review</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Tell other renters about your experience"
              placeholderTextColor={Colors.muted}
              value={message}
              onChangeText={onChangeMessage}
              multiline
              numberOfLines={6}
              scrollEnabled={false}
              onFocus={() => setMessageFocused(true)}
              onBlur={() => setMessageFocused(false)}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.mediaHeader}>
              <Text style={styles.sectionTitle}>Review Photos</Text>
              <Text style={styles.mediaMeta}>{images.length}/{MAX_REVIEW_IMAGES}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                images.length < MAX_REVIEW_IMAGES ? styles.uploadButtonActive : styles.uploadButtonDisabled,
              ]}
              onPress={onPickImages}
              activeOpacity={images.length >= MAX_REVIEW_IMAGES ? 1 : 0.88}
              disabled={images.length >= MAX_REVIEW_IMAGES}
            >
              <MaterialCommunityIcons
                name={images.length < MAX_REVIEW_IMAGES ? 'image-plus' : 'image-off-outline'}
                size={18}
                color="#111111"
              />
              <Text style={styles.uploadButtonText}>
                {images.length >= MAX_REVIEW_IMAGES
                  ? 'Image limit reached'
                  : `Add more photos ${images.length}/${MAX_REVIEW_IMAGES}`}
              </Text>
            </TouchableOpacity>

            {images.length ? (
              <View style={styles.previewGrid}>
                {images.map((item, index) => {
                  const previewUri = resolvePreviewUri(item);

                  return (
                    <View key={`${item.serverPath || item.uri || 'review-image'}-${index}`} style={styles.previewTile}>
                      {previewUri ? (
                        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.previewFallback}>
                          <MaterialCommunityIcons name="image-outline" size={20} color="#94a3b8" />
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => onRemoveImage?.(index)}
                        activeOpacity={0.88}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#111111" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.actionRow}>
            <SecondaryButton title="Cancel" onPress={onClose} style={[styles.actionButton, styles.secondaryReviewButton]} />
            <PrimaryButton
              title={mode === 'edit' ? 'Update Review' : 'Submit Review'}
              onPress={onSubmit}
              loading={submitting}
              style={[styles.actionButton, styles.primaryReviewButton]}
              textStyle={styles.primaryReviewButtonText}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.muted,
  },
  sectionCard: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  textArea: {
    minHeight: 150,
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaMeta: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.muted,
  },
  uploadButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonActive: {
    borderColor: '#facc15',
    backgroundColor: '#facc15',
  },
  uploadButtonDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    opacity: 0.55,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  previewTile: {
    width: 92,
    height: 92,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#eef2f7',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 22,
  },
  actionButton: {
    flex: 1,
  },
  secondaryReviewButton: {
    borderRadius: Radius.full,
  },
  primaryReviewButton: {
    backgroundColor: '#facc15',
    borderColor: '#facc15',
    borderRadius: Radius.full,
  },
  primaryReviewButtonText: {
    color: '#111111',
  },
});
