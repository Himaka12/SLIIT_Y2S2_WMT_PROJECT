import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { reviewAPI } from '../../api';
import ReviewComposerModal from '../../components/ReviewComposerModal';
import {
  ReviewBusinessReply,
  ReviewImageGallery,
  ReviewPrivateNotice,
  ReviewStatusBadge,
  StarRatingRow,
  resolveReviewAssetUri,
} from '../../components/ReviewShared';
import SuccessToast from '../../components/SuccessToast';
import { EmptyState } from '../../components/UI';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { emitCustomerTabBarVisibility } from '../../utils/customerTabBarEvents';
import { useCustomerTabPageTransition } from '../../utils/useCustomerTabPageTransition';
import { useAppAlert } from '../../context/AppAlertContext';

let reviewListCache = [];
const PREVIEW_SHEET_OFFSET = 640;

function getVehicleImageUri(vehicle) {
  const imagePath = vehicle?.image1 || vehicle?.image2 || vehicle?.image3 || vehicle?.image4 || vehicle?.image5;
  return resolveReviewAssetUri(imagePath);
}

function getVehicleLabel(vehicle) {
  return [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ').trim() || 'Rental vehicle';
}

function getVehicleSubtitle(vehicle) {
  return [vehicle?.category, vehicle?.manufactureYear, vehicle?.listingType].filter(Boolean).join(' • ');
}

function createRemoteImage(serverPath) {
  return {
    kind: 'remote',
    uri: resolveReviewAssetUri(serverPath),
    serverPath,
  };
}

export default function CustomerReviewsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { showAlert } = useAppAlert();
  const lastScrollOffset = useRef(0);
  const hasLoadedOnceRef = useRef(reviewListCache.length > 0);
  const previewClosingRef = useRef(false);
  const previewSheetTranslateY = useRef(new Animated.Value(PREVIEW_SHEET_OFFSET)).current;
  const previewBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => reviewListCache.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState(() => reviewListCache);
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [previewReview, setPreviewReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const pageTransitionStyle = useCustomerTabPageTransition(
    route.params?.tabTransitionAt,
    route.params?.tabTransitionAnchor,
  );

  const showToast = useCallback((nextMessage) => {
    setToastMessage(nextMessage);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  }, []);

  const animatePreviewOpen = useCallback(() => {
    previewClosingRef.current = false;
    previewSheetTranslateY.stopAnimation();
    previewBackdropOpacity.stopAnimation();
    previewSheetTranslateY.setValue(PREVIEW_SHEET_OFFSET);
    previewBackdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(previewSheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      }),
      Animated.timing(previewBackdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [previewBackdropOpacity, previewSheetTranslateY]);

  const closePreview = useCallback(() => {
    if (!previewReview || previewClosingRef.current) {
      return;
    }

    previewClosingRef.current = true;
    previewSheetTranslateY.stopAnimation();
    previewBackdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(previewSheetTranslateY, {
        toValue: PREVIEW_SHEET_OFFSET,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(previewBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setPreviewReview(null);
      }
      previewClosingRef.current = false;
    });
  }, [previewBackdropOpacity, previewReview, previewSheetTranslateY]);

  const openPreview = useCallback((review) => {
    setPreviewReview(review);
  }, []);

  useEffect(() => {
    if (previewReview) {
      animatePreviewOpen();
    }
  }, [animatePreviewOpen, previewReview]);

  const previewPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        previewSheetTranslateY.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.9) {
          closePreview();
          return;
        }

        Animated.spring(previewSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(previewSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
        }).start();
      },
    }),
  ).current;

  const load = useCallback(async () => {
    try {
      const reviewsRes = await reviewAPI.myReviews();
      const nextItems = reviewsRes.data || [];
      reviewListCache = nextItems;
      setItems(nextItems);
    } catch (_) {
      if (!reviewListCache.length) {
        setItems([]);
      }
    }

    hasLoadedOnceRef.current = true;
    setHasLoadedOnce(true);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    emitCustomerTabBarVisibility(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnceRef.current) {
        load();
      }
    }, [load]),
  );

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setEditingReview(null);
    setRating(5);
    setMessage('');
    setImages([]);
    setFormError('');
  }, []);

  const openEditComposer = useCallback((review) => {
    setEditingReview(review);
    setRating(Number(review?.rating || 5));
    setMessage(review?.message || review?.comment || '');
    setImages((review?.images || []).map(createRemoteImage));
    setFormError('');
    setComposerVisible(true);
  }, []);

  const pickImages = async () => {
    if (images.length >= 5) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.82,
    });

    if (result.canceled) {
      return;
    }

    const remainingSlots = Math.max(0, 5 - images.length);
    const selectedAssets = (result.assets || []).map((asset) => ({
      kind: 'local',
      uri: asset.uri,
      name: asset.fileName || `review_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));

    const nextAssets = selectedAssets.slice(0, remainingSlots);
    setImages((prev) => [...prev, ...nextAssets]);

    if (selectedAssets.length > remainingSlots) {
      showAlert('Image limit reached', `Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} can be added.`, undefined, { tone: 'warning' });
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  };

  const submitEdit = async () => {
    if (!editingReview?._id) {
      return;
    }

    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
      setFormError('Please write a short review first.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('rating', String(rating));
      formData.append('message', trimmedMessage);
      formData.append('existingImages', JSON.stringify(
        images
          .filter((item) => item.kind === 'remote' && item.serverPath)
          .map((item) => item.serverPath),
      ));

      images
        .filter((item) => item.kind === 'local' && item.uri)
        .forEach((item) => {
          formData.append('images', {
            uri: item.uri,
            name: item.name,
            type: item.type || 'image/jpeg',
          });
        });

      await reviewAPI.update(editingReview._id, formData);
      closeComposer();
      showToast('Review updated');
      load();
    } catch (error) {
      setFormError(error?.response?.data?.message || 'Failed to update review.');
    }

    setSubmitting(false);
  };

  const deleteReview = (review) => {
    showAlert(
      'Delete Review',
      'Delete your review for this rental vehicle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await reviewAPI.delete(review._id);
              showToast('Review deleted');
              load();
            } catch (error) {
              showAlert('Error', error?.response?.data?.message || 'Failed to delete review.', undefined, { tone: 'danger' });
            }
          },
        },
      ],
      { tone: 'danger' },
    );
  };

  const previewVehicle = previewReview?.vehicleId;
  const previewVehicleImageUri = getVehicleImageUri(previewVehicle);
  const previewVehicleMeta = [
    previewVehicle?.listingType,
    previewVehicle?.category,
    previewVehicle?.manufactureYear,
  ].filter(Boolean);

  return (
    <Animated.View style={[styles.scene, pageTransitionStyle]}>
      <SuccessToast visible={toastVisible} message={toastMessage} />

      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={items.filter((item) => item?.vehicleId)}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const vehicle = item.vehicleId;
          const imageUri = getVehicleImageUri(vehicle);
          const canEdit = Boolean(item?.canEdit) && !item?.adminDeleted;
          const canDelete = Boolean(item?.canDelete) && !item?.adminDeleted;
          const canManage = canEdit || canDelete;
          const vehicleYear = vehicle?.manufactureYear ? String(vehicle.manufactureYear) : '';

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.card}
              onPress={() => openPreview(item)}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={styles.cardImageFallback}>
                  <MaterialCommunityIcons name="car-sports" size={28} color="#94a3b8" />
                </View>
              )}

              <View style={styles.cardCopy}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardHeadingWrap}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{getVehicleLabel(vehicle)}</Text>
                      {vehicleYear ? (
                        <Text style={styles.cardYear}>{vehicleYear}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.ratingRow}>
                  <StarRatingRow rating={item?.rating || 0} size={16} />
                  <Text style={styles.ratingValue}>{Number(item?.rating || 0).toFixed(1)}</Text>
                  <Text style={styles.reviewDate}>{item?.reviewDate || ''}</Text>
                </View>

                <Text style={styles.reviewMessage} numberOfLines={2} ellipsizeMode="tail">
                  {item?.message || item?.comment}
                </Text>

                {canManage ? (
                  <View style={styles.actionRow}>
                    {canEdit ? (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => openEditComposer(item)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.secondaryButtonText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canDelete ? (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteReview(item)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
              </TouchableOpacity>

              <Text style={styles.pageTitle}>My Reviews</Text>

              <View style={styles.backButtonPlaceholder} />
            </View>
          </View>
        )}
        ListEmptyComponent={hasLoadedOnce ? (
          <EmptyState
            icon="star-outline"
            title="No reviews yet"
            subtitle="Your rental reviews will appear here."
          />
        ) : null}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        )}
        onScroll={(event) => {
          const currentOffset = event.nativeEvent.contentOffset.y;

          if (currentOffset <= 8) {
            emitCustomerTabBarVisibility(true);
          } else if (currentOffset > lastScrollOffset.current + 8) {
            emitCustomerTabBarVisibility(false);
          } else if (currentOffset < lastScrollOffset.current - 8) {
            emitCustomerTabBarVisibility(true);
          }

          lastScrollOffset.current = currentOffset;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <ReviewComposerModal
        visible={composerVisible}
        mode="edit"
        vehicleLabel={getVehicleLabel(editingReview?.vehicleId)}
        rating={rating}
        onChangeRating={setRating}
        message={message}
        onChangeMessage={setMessage}
        images={images}
        onPickImages={pickImages}
        onRemoveImage={removeImage}
        onClose={closeComposer}
        onSubmit={submitEdit}
        submitting={submitting}
        errorMessage={formError}
      />

      <Modal visible={Boolean(previewReview)} transparent animationType="none" onRequestClose={closePreview}>
        <View style={styles.previewModalRoot}>
          <Animated.View style={[styles.previewBackdrop, { opacity: previewBackdropOpacity }]}>
            <Pressable style={styles.previewBackdropPressable} onPress={closePreview} />
          </Animated.View>

          <Animated.View
            style={[
              styles.previewSheet,
              {
                transform: [{ translateY: previewSheetTranslateY }],
              },
            ]}
          >
            <View style={styles.previewHandleArea} {...previewPanResponder.panHandlers}>
              <View style={styles.previewHandle} />
            </View>

            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.previewTopRow}>
                <View style={styles.previewTitleWrap}>
                  <Text style={styles.previewTitle}>Review Preview</Text>
                  <Text style={styles.previewSubtitle}>Full review details for this rental vehicle</Text>
                </View>
                <TouchableOpacity style={styles.previewCloseButton} onPress={closePreview} activeOpacity={0.88}>
                  <MaterialCommunityIcons name="close" size={22} color="#111111" />
                </TouchableOpacity>
              </View>

              <View style={styles.previewVehicleCard}>
                {previewVehicleImageUri ? (
                  <Image source={{ uri: previewVehicleImageUri }} style={styles.previewVehicleImage} resizeMode="cover" />
                ) : (
                  <View style={styles.previewVehicleFallback}>
                    <MaterialCommunityIcons name="car-sports" size={32} color="#94a3b8" />
                  </View>
                )}

                <View style={styles.previewVehicleCopy}>
                  <View style={styles.previewVehicleHeadingRow}>
                    <Text style={styles.previewVehicleTitle}>{getVehicleLabel(previewVehicle)}</Text>
                    <ReviewStatusBadge review={previewReview} />
                  </View>
                  <Text style={styles.previewVehicleMeta}>
                    {getVehicleSubtitle(previewVehicle) || 'Rental vehicle'}
                  </Text>

                  {previewVehicleMeta.length ? (
                    <View style={styles.previewTagRow}>
                      {previewVehicleMeta.map((tag) => (
                        <View key={tag} style={styles.previewTag}>
                          <Text style={styles.previewTagText}>{String(tag)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.previewReviewSection}>
                <View style={styles.previewReviewHeader}>
                  <Text style={styles.previewSectionTitle}>Your Review</Text>
                  <View style={styles.previewRatingPill}>
                    <StarRatingRow rating={previewReview?.rating || 0} size={14} />
                    <Text style={styles.previewRatingValue}>{Number(previewReview?.rating || 0).toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.previewReviewText}>
                  {previewReview?.message || previewReview?.comment || 'No review text provided.'}
                </Text>
              </View>

              <ReviewImageGallery images={previewReview?.images || []} />
              <ReviewBusinessReply review={previewReview} style={styles.previewReply} />
              <ReviewPrivateNotice review={previewReview} style={styles.previewNotice} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 130,
    gap: 14,
  },
  headerBlock: {
    marginBottom: 14,
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
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 12,
    gap: 12,
    minHeight: 144,
    ...Shadow.sm,
  },
  cardImage: {
    width: 92,
    height: 120,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
  },
  cardImageFallback: {
    width: 92,
    height: 120,
    borderRadius: 18,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    gap: 6,
  },
  cardHeadingWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  cardYear: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  reviewDate: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  reviewMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 'auto',
    paddingTop: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.full,
    borderWidth: 1.4,
    borderColor: '#dbe4ef',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  deleteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.full,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  previewModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.3)',
  },
  previewBackdropPressable: {
    flex: 1,
  },
  previewSheet: {
    maxHeight: '86%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 22,
    ...Shadow.lg,
  },
  previewHandleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  previewHandle: {
    width: 56,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: '#d6dde8',
  },
  previewScroll: {
    flexGrow: 0,
  },
  previewScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  previewTitleWrap: {
    flex: 1,
    paddingTop: 4,
  },
  previewTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
  },
  previewSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.muted,
  },
  previewCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVehicleCard: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  previewVehicleImage: {
    width: 106,
    height: 128,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  previewVehicleFallback: {
    width: 106,
    height: 128,
    borderRadius: 20,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVehicleCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewVehicleHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewVehicleTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  previewVehicleMeta: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.muted,
  },
  previewTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  previewTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'capitalize',
  },
  previewReviewSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.sm,
  },
  previewReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
  },
  previewRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#fff8db',
  },
  previewRatingValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  previewReviewText: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  previewReply: {
    marginTop: 16,
  },
  previewNotice: {
    marginTop: 16,
  },
});
