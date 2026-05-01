import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../api';
import { Colors, Radius, Shadow, Spacing } from '../constants/theme';

export const MAX_REVIEW_IMAGES = 5;

export function resolveReviewAssetUri(path) {
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

export function getReviewStatusMeta(review) {
  if (review?.adminDeleted) {
    return {
      label: 'Deleted by Admin',
      color: Colors.danger,
      backgroundColor: Colors.dangerSoft,
      icon: 'delete-outline',
    };
  }

  if (review?.isVisible === false) {
    return {
      label: 'Hidden by Admin',
      color: Colors.promo,
      backgroundColor: Colors.promoSoft,
      icon: 'eye-off-outline',
    };
  }

  return {
    label: 'Visible',
    color: Colors.success,
    backgroundColor: Colors.successSoft,
    icon: 'eye-outline',
  };
}

export function formatReviewDate(review) {
  const value = review?.updatedAt || review?.createdAt || review?.reviewDate;
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
}

export function StarRatingRow({
  rating = 0,
  size = 16,
  gap = 3,
  color = '#f59e0b',
  style,
}) {
  const rounded = Math.max(0, Math.min(5, Number(rating || 0)));

  return (
    <View style={[styles.starRow, { gap }, style]}>
      {[1, 2, 3, 4, 5].map((star) => (
        <MaterialCommunityIcons
          key={star}
          name={star <= rounded ? 'star' : 'star-outline'}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

export function ReviewStatusBadge({ review, style }) {
  const meta = getReviewStatusMeta(review);

  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.backgroundColor }, style]}>
      <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
      <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

export function ReviewImageGallery({ images = [] }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(() => ({
    width: Math.min(width - 40, 320),
    height: Math.min((width - 40) * 0.62, 240),
  }));
  const previewGalleryRef = useRef(null);
  const galleryImages = useMemo(
    () => (Array.isArray(images) ? images.map(resolveReviewAssetUri).filter(Boolean) : []),
    [images],
  );
  const galleryImageKey = useMemo(
    () => galleryImages.join('|'),
    [galleryImages],
  );

  useEffect(() => {
    if (!previewVisible) {
      return;
    }

    requestAnimationFrame(() => {
      previewGalleryRef.current?.scrollToIndex?.({
        index: selectedIndex,
        animated: false,
      });
    });
  }, [previewVisible, selectedIndex]);

  useEffect(() => {
    let cancelled = false;
    const setPreviewFrameIfChanged = (nextFrame) => {
      setPreviewFrame((current) => (
        current.width === nextFrame.width && current.height === nextFrame.height
          ? current
          : nextFrame
      ));
    };

    if (!galleryImages.length) {
      setPreviewFrameIfChanged({
        width: Math.min(width - 40, 320),
        height: Math.min((width - 40) * 0.62, 240),
      });
      return undefined;
    }

    const maxPreviewWidth = width - 40;
    const maxPreviewHeight = Math.max(160, height - (insets.top + 180));

    Promise.all(
      galleryImages.map((uri) => new Promise((resolve) => {
        Image.getSize(
          uri,
          (imageWidth, imageHeight) => resolve({ width: imageWidth, height: imageHeight }),
          () => resolve(null),
        );
      })),
    ).then((sizes) => {
      if (cancelled) {
        return;
      }

      const validSizes = sizes.filter(Boolean);
      if (!validSizes.length) {
        setPreviewFrameIfChanged({
          width: Math.min(width - 40, 320),
          height: Math.min((width - 40) * 0.62, 240),
        });
        return;
      }

      const smallestImage = validSizes.reduce((smallest, current) => {
        if (!smallest) {
          return current;
        }

        return (current.width * current.height) < (smallest.width * smallest.height)
          ? current
          : smallest;
      }, null);

      const smallestWidth = smallestImage?.width || validSizes[0].width;
      const smallestHeight = smallestImage?.height || validSizes[0].height;
      const scale = Math.min(
        maxPreviewWidth / Math.max(smallestWidth, 1),
        maxPreviewHeight / Math.max(smallestHeight, 1),
        1,
      );

      setPreviewFrameIfChanged({
        width: Math.round(smallestWidth * scale),
        height: Math.round(smallestHeight * scale),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [galleryImageKey, height, insets.top, width]);

  const openPreview = (index) => {
    setSelectedIndex(index);
    setPreviewVisible(true);
  };

  const closePreview = () => {
    setPreviewVisible(false);
  };

  if (!galleryImages.length) {
    return null;
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.galleryList}
      >
        {galleryImages.map((uri, index) => (
          <TouchableOpacity
            key={`${uri}-${index}`}
            style={styles.galleryThumbWrap}
            onPress={() => openPreview(index)}
            activeOpacity={0.9}
          >
            <Image source={{ uri }} style={styles.galleryThumb} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewBackdrop}>
          <BlurView intensity={32} tint="light" style={styles.previewBlurLayer} />
          <Pressable style={styles.previewDimLayer} onPress={closePreview} />
          <View style={[styles.previewCard, { width: previewFrame.width }]}>
            <FlatList
              ref={previewGalleryRef}
              data={galleryImages}
              style={{ width: previewFrame.width }}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              disableIntervalMomentum
              bounces={false}
              keyExtractor={(item, index) => `${item}-preview-${index}`}
              getItemLayout={(_, index) => ({
                length: previewFrame.width,
                offset: previewFrame.width * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(
                  event.nativeEvent.contentOffset.x / Math.max(previewFrame.width, 1),
                );
                setSelectedIndex(nextIndex);
              }}
              renderItem={({ item }) => (
                <View style={[styles.previewSlide, { width: previewFrame.width, height: previewFrame.height }]}>
                  <View style={[styles.previewImageFrame, { width: previewFrame.width, height: previewFrame.height }]}>
                    <Image
                      source={{ uri: item }}
                      style={[styles.previewImage, { width: previewFrame.width, height: previewFrame.height }]}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              )}
            />

            {galleryImages.length > 1 ? (
              <View style={styles.previewIndicatorRow}>
                {galleryImages.map((_, index) => {
                  const isActive = index === selectedIndex;

                  return (
                    <View
                      key={`preview-indicator-${index}`}
                      style={[
                        styles.previewIndicatorBar,
                        isActive && styles.previewIndicatorBarActive,
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ReviewSummaryCard({ reviews = [] }) {
  const visibleReviews = useMemo(
    () => (Array.isArray(reviews) ? reviews.filter((review) => !review?.adminDeleted && review?.isVisible !== false) : []),
    [reviews],
  );

  const summary = useMemo(() => {
    const totalReviews = visibleReviews.length;
    const totalRating = visibleReviews.reduce((sum, review) => sum + Number(review?.rating || 0), 0);
    const average = totalReviews ? totalRating / totalReviews : 0;
    const breakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: visibleReviews.filter((review) => Number(review?.rating || 0) === star).length,
    }));

    return {
      average,
      totalReviews,
      breakdown,
    };
  }, [visibleReviews]);

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeadlineRow}>
        <View>
          <Text style={styles.summaryValue}>{summary.average.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Average rating</Text>
        </View>

        <View style={styles.summaryRight}>
          <StarRatingRow rating={Math.round(summary.average)} size={18} />
          <Text style={styles.summaryRightText}>{summary.totalReviews} review{summary.totalReviews === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <View style={styles.breakdownList}>
        {summary.breakdown.map((item) => {
          const widthPercent = summary.totalReviews ? `${(item.count / summary.totalReviews) * 100}%` : '0%';

          return (
            <View key={item.star} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.star}★</Text>
              <View style={styles.breakdownTrack}>
                <View style={[styles.breakdownFill, { width: widthPercent }]} />
              </View>
              <Text style={styles.breakdownCount}>{item.count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ReviewPrivateNotice({ review, style }) {
  if (review?.adminDeleted) {
    return (
      <View style={[styles.noticeCard, styles.noticeDanger, style]}>
        <Text style={styles.noticeTitle}>Your review was deleted by admin</Text>
        <Text style={styles.noticeBody}>
          {review?.adminDeleteReason || 'A moderation reason was provided by the admin.'}
        </Text>
      </View>
    );
  }

  if (review?.isVisible === false) {
    return (
      <View style={[styles.noticeCard, styles.noticeWarning, style]}>
        <Text style={styles.noticeTitle}>Your review is hidden from public view</Text>
        <Text style={styles.noticeBody}>
          Admin has temporarily hidden this review, but you can still manage it from your portal.
        </Text>
      </View>
    );
  }

  return null;
}

export function ReviewBusinessReply({ review, style, title = 'Wheelzy Reply' }) {
  const replyText = String(review?.businessReply || '').trim();
  if (!replyText) {
    return null;
  }

  const replyMeta = [
    review?.adminResponderName || review?.replySource || 'Admin',
    review?.businessReplyDate || review?.adminResponseDate || '',
  ].filter(Boolean).join(' • ');

  return (
    <View style={[styles.replyCard, style]}>
      <View style={styles.replyHeader}>
        <View style={styles.replyBadge}>
          <MaterialCommunityIcons name="reply-outline" size={14} color="#111111" />
          <Text style={styles.replyBadgeText}>{title}</Text>
        </View>
        {replyMeta ? (
          <Text style={styles.replyMeta}>{replyMeta}</Text>
        ) : null}
      </View>
      <Text style={styles.replyBody}>{replyText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  galleryList: {
    gap: 10,
    paddingTop: 12,
  },
  galleryThumbWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eef2f7',
    ...Shadow.sm,
  },
  galleryThumb: {
    width: 86,
    height: 86,
    borderRadius: 16,
  },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  previewBlurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  previewDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.24)',
  },
  previewCard: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  previewSlide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  previewImage: {
    backgroundColor: 'transparent',
  },
  previewIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  previewIndicatorBar: {
    width: 26,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: '#dbe3ef',
  },
  previewIndicatorBarActive: {
    backgroundColor: '#111111',
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  summaryHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1,
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryRightText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
  },
  breakdownList: {
    marginTop: 18,
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLabel: {
    width: 26,
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  breakdownTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: '#eef2f7',
    overflow: 'hidden',
  },
  breakdownFill: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.promo,
  },
  breakdownCount: {
    width: 24,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: Colors.muted,
  },
  noticeCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  noticeWarning: {
    backgroundColor: Colors.promoSoft,
    borderColor: '#fde68a',
  },
  noticeDanger: {
    backgroundColor: Colors.dangerSoft,
    borderColor: '#fecaca',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  noticeBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.muted,
  },
  replyCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fff9db',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  replyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#ffe36a',
  },
  replyBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
  },
  replyMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7c6a11',
  },
  replyBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    fontWeight: '600',
  },
});
