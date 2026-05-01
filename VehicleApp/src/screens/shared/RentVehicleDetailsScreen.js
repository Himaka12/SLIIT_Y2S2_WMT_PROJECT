import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  promotionAPI,
  reviewAPI,
  vehicleAPI,
  wishlistAPI,
} from '../../api';
import { getVehicleAvailabilityMeta } from '../../components/AvailabilityStatusBox';
import ReviewComposerModal from '../../components/ReviewComposerModal';
import {
  ReviewBusinessReply,
  ReviewImageGallery,
  ReviewPrivateNotice,
  ReviewStatusBadge,
  ReviewSummaryCard,
  StarRatingRow,
  formatReviewDate,
  resolveReviewAssetUri,
} from '../../components/ReviewShared';
import {
  VehicleBottomCTA,
  VehicleDetailsSheet,
  VehicleDetailsStats,
  VehicleFeatureGrid,
  VehicleHeroGallery,
  VehicleHostInfo,
  VehiclePromotionCard,
  PremiumRentOfferCard,
  formatPrice,
  getDiscountedPrice,
  getPremiumRentPriceMeta,
  getVehiclePromotion,
} from '../../components/VehicleDetailsShared';
import LogoutConfirmationSheet from '../../components/LogoutConfirmationSheet';
import SuccessToast from '../../components/SuccessToast';
import { LoadingSpinner, PrimaryButton, SecondaryButton } from '../../components/UI';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';
import { useAuth } from '../../context/AuthContext';
import { getPromotionDiscountMeta } from '../../utils/promotionUtils';

function openLoginScreen(navigation) {
  if (navigation.getState?.()?.routeNames?.includes('Login')) {
    navigation.navigate('Login');
    return;
  }

  const parent = navigation.getParent?.();
  if (parent?.getState?.()?.routeNames?.includes('Login')) {
    parent.navigate('Login');
    return;
  }

  const grandParent = parent?.getParent?.();
  if (grandParent?.getState?.()?.routeNames?.includes('Login')) {
    grandParent.navigate('Login');
  }
}

function createRemoteImage(serverPath) {
  return {
    kind: 'remote',
    uri: resolveReviewAssetUri(serverPath),
    serverPath,
  };
}

function getVehicleTitle(vehicle) {
  return [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ').trim() || 'Rental vehicle';
}

function getVehicleSubtitle(vehicle) {
  return [vehicle?.category, vehicle?.manufactureYear, vehicle?.fuelType].filter(Boolean).join(' - ');
}

function getPublicReviewSummary(reviews) {
  const items = Array.isArray(reviews) ? reviews : [];
  const total = items.length;
  const average = total
    ? items.reduce((sum, review) => sum + Number(review?.rating || 0), 0) / total
    : 0;

  return {
    total,
    average,
  };
}

function isVehicleBookable(vehicle) {
  const quantity = Math.max(0, Number(vehicle?.quantity || 0));
  const normalizedStatus = String(vehicle?.status || '').trim().toLowerCase();

  if (quantity <= 0) {
    return false;
  }

  if (!normalizedStatus) {
    return true;
  }

  return normalizedStatus === 'available';
}

export default function RentVehicleDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { showAlert } = useAppAlert();
  const vehicleId = route.params?.vehicleId;
  const initialVehicle = route.params?.initialVehicle || null;
  const hasLoadedOnceRef = useRef(false);
  const lastScrollY = useRef(0);
  const ctaTranslateY = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(1)).current;

  const [vehicle, setVehicle] = useState(initialVehicle);
  const [promotion, setPromotion] = useState(null);
  const [publicReviews, setPublicReviews] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(!initialVehicle);
  const [submitting, setSubmitting] = useState(false);
  const [showBottomCta, setShowBottomCta] = useState(true);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState('create');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]);
  const [formError, setFormError] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastBackgroundColor, setToastBackgroundColor] = useState('#16a34a');
  const [deleteReviewVisible, setDeleteReviewVisible] = useState(false);

  const showWishlist = !user || user.role === 'CUSTOMER';
  const showCustomerCTA = !user || user.role === 'CUSTOMER';
  const existingReview = eligibility?.existingReview || null;
  const eligibleBookingId = eligibility?.bookingId || null;
  const canWriteAnotherReview = Boolean(eligibility?.eligible && eligibleBookingId);
  const publicSummary = useMemo(() => getPublicReviewSummary(publicReviews), [publicReviews]);
  const availabilityMeta = useMemo(() => getVehicleAvailabilityMeta(vehicle?.quantity), [vehicle?.quantity]);
  const premiumRentMeta = useMemo(() => getPremiumRentPriceMeta(user, vehicle), [user, vehicle]);
  const promotionDiscount = useMemo(() => getPromotionDiscountMeta(vehicle, promotion), [promotion, vehicle]);
  const vehicleBookable = useMemo(() => isVehicleBookable(vehicle), [vehicle]);

  const load = useCallback(async ({ keepSpinner = false } = {}) => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    if (!keepSpinner && !hasLoadedOnceRef.current && !initialVehicle) {
      setLoading(true);
    }

    try {
      const [vehicleRes, promotionsRes, wishlistRes, reviewsRes, eligibilityRes] = await Promise.all([
        vehicleAPI.getById(vehicleId),
        promotionAPI.getActive().catch(() => ({ data: [] })),
        user ? wishlistAPI.getIds().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        reviewAPI.getByVehicle(vehicleId).catch(() => ({ data: [] })),
        user?.role === 'CUSTOMER'
          ? reviewAPI.getEligibility(vehicleId).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);

      const nextVehicle = vehicleRes.data || null;
      const nextPromotion = getVehiclePromotion(nextVehicle, promotionsRes.data || []);
      const nextReviews = reviewsRes.data || [];
      const nextEligibility = eligibilityRes.data || null;

      setVehicle(nextVehicle);
      setPromotion(nextPromotion);
      setIsWishlisted((wishlistRes.data || []).map(String).includes(String(vehicleId)));
      setEligibility(nextEligibility);
      setPublicReviews(nextReviews);
      hasLoadedOnceRef.current = true;
    } catch (_) {
      setVehicle((current) => current || null);
      setEligibility((current) => current || null);
      setPublicReviews((current) => current || []);
    } finally {
      setLoading(false);
    }
  }, [initialVehicle, user, vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnceRef.current) {
        load({ keepSpinner: true });
      }
    }, [load]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ctaTranslateY, {
        toValue: showBottomCta ? 0 : 120,
        duration: showBottomCta ? 180 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(ctaOpacity, {
        toValue: showBottomCta ? 1 : 0,
        duration: showBottomCta ? 160 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [ctaOpacity, ctaTranslateY, showBottomCta]);

  const visiblePublicReviews = useMemo(() => {
    if (!existingReview?._id) {
      return publicReviews;
    }

    return publicReviews.filter((item) => String(item?._id) !== String(existingReview._id));
  }, [existingReview?._id, publicReviews]);
  const hasVisibleOwnerReview = Boolean(
    existingReview
    && existingReview?.adminDeleted !== true
    && existingReview?.customerDeleted !== true
    && existingReview?.isVisible !== false,
  );
  const hasPrivateOwnerReviewNotice = Boolean(
    existingReview
    && (
      existingReview?.adminDeleted === true
      || existingReview?.isVisible === false
    ),
  );
  const shouldShowPublicEmptyState = Boolean(
    !visiblePublicReviews.length
    && !hasVisibleOwnerReview
    && !hasPrivateOwnerReviewNotice,
  );
  const hasCompactReviewEnding = !visiblePublicReviews.length;
  const scrollBottomPadding = hasCompactReviewEnding ? 84 : 112;

  const displayPrice = useMemo(() => {
    if (premiumRentMeta.eligible) {
      return formatPrice(premiumRentMeta.discountedPrice, vehicle?.listingType);
    }

    if (promotionDiscount.hasDiscount) {
      return formatPrice(getDiscountedPrice(vehicle, promotion), vehicle?.listingType);
    }

    return formatPrice(vehicle?.price, vehicle?.listingType);
  }, [premiumRentMeta, promotion, promotionDiscount.hasDiscount, vehicle]);

  const displayPriceSubLabel = useMemo(() => {
    if (premiumRentMeta.eligible) {
      return `Original ${formatPrice(premiumRentMeta.originalPrice, vehicle?.listingType)}`;
    }

    if (promotionDiscount.hasDiscount) {
      return `Original ${formatPrice(vehicle?.price, vehicle?.listingType)}`;
    }

    return 'Rental price per day';
  }, [premiumRentMeta, promotionDiscount.hasDiscount, vehicle]);

  const summaryLine = [
    vehicle?.seatCount ? `${vehicle.seatCount} seats` : null,
    vehicle?.transmission,
    vehicle?.fuelType,
    vehicle?.location || vehicle?.district,
  ].filter(Boolean).join(' - ');

  const highlightItems = useMemo(() => ([
    {
      value: publicSummary.total ? publicSummary.average.toFixed(1) : 'New',
      label: 'Rating',
      caption: publicSummary.total ? `${publicSummary.total} review${publicSummary.total === 1 ? '' : 's'}` : 'No reviews yet',
    },
    {
      value: String(Math.max(0, Number(vehicle?.quantity || 0))),
      label: 'Units',
      caption: availabilityMeta.title,
    },
    {
      value: vehicle?.manufactureYear ? String(vehicle.manufactureYear) : '-',
      label: 'Year',
      caption: vehicle?.category || 'Rental',
    },
  ]), [availabilityMeta.title, publicSummary.average, publicSummary.total, vehicle]);

  const featureItems = useMemo(() => ([
    { label: 'Transmission', value: vehicle?.transmission || 'Not set' },
    { label: 'Fuel Type', value: vehicle?.fuelType || 'Not set' },
    { label: 'Seats', value: vehicle?.seatCount ? String(vehicle.seatCount) : 'Not set' },
    { label: 'Condition', value: vehicle?.vehicleCondition || 'Not set' },
    { label: 'Category', value: vehicle?.category || 'Not set' },
    { label: 'Location', value: vehicle?.location || vehicle?.district || 'Not set' },
  ]), [vehicle]);

  const showToast = useCallback((nextMessage) => {
    setToastMessage(nextMessage);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setComposerMode('create');
    setRating(5);
    setMessage('');
    setImages([]);
    setFormError('');
  }, []);

  const openCreateComposer = () => {
    setComposerMode('create');
    setRating(5);
    setMessage('');
    setImages([]);
    setFormError('');
    setComposerVisible(true);
  };

  const openEditComposer = () => {
    if (!existingReview) {
      return;
    }

    setComposerMode('edit');
    setRating(Number(existingReview?.rating || 5));
    setMessage(existingReview?.message || existingReview?.comment || '');
    setImages((existingReview?.images || []).map(createRemoteImage));
    setFormError('');
    setComposerVisible(true);
  };

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

    setImages((current) => [...current, ...nextAssets]);

    if (selectedAssets.length > remainingSlots) {
      showAlert(
        'Image limit reached',
        `Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} can be added.`,
        undefined,
        { tone: 'warning' },
      );
    }
  };

  const removeImage = (index) => {
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleWishlist = async () => {
    if (!showWishlist) {
      return;
    }

    if (!user) {
      openLoginScreen(navigation);
      return;
    }

    const previousWishlisted = isWishlisted;
    const nextWishlisted = !previousWishlisted;
    setIsWishlisted(nextWishlisted);
    setToastBackgroundColor('#16a34a');
    setToastMessage(nextWishlisted ? 'Added to favourites' : 'Removed from favourites');
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);

    try {
      await wishlistAPI.toggle(vehicleId);
    } catch (_) {
      setIsWishlisted(previousWishlisted);
      showAlert('Error', 'Unable to update wishlist right now.', undefined, { tone: 'danger' });
    }
  };

  const handleBookNow = () => {
    if (!user) {
      openLoginScreen(navigation);
      return;
    }

    if (!vehicleBookable) {
      setToastBackgroundColor(Colors.danger);
      setToastMessage(Number(vehicle?.quantity || 0) <= 0 ? 'Out of stock' : 'Currently unavailable');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1800);
      return;
    }

    navigation.navigate('BookVehicle', {
      vehicle,
    });
  };

  const submitReview = async () => {
    const trimmedMessage = String(message || '').trim();

    if (!trimmedMessage) {
      setFormError('Please write a short review first.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('vehicleId', vehicleId);
      formData.append('rating', String(rating));
      formData.append('message', trimmedMessage);
      if (composerMode !== 'edit' && eligibleBookingId) {
        formData.append('bookingId', String(eligibleBookingId));
      }

      if (composerMode === 'edit') {
        formData.append('existingImages', JSON.stringify(
          images
            .filter((item) => item.kind === 'remote' && item.serverPath)
            .map((item) => item.serverPath),
        ));
      }

      images
        .filter((item) => item.kind === 'local' && item.uri)
        .forEach((item) => {
          formData.append('images', {
            uri: item.uri,
            name: item.name,
            type: item.type || 'image/jpeg',
          });
        });

      if (composerMode === 'edit' && existingReview?._id) {
        await reviewAPI.update(existingReview._id, formData);
        showToast('Review updated');
      } else {
        await reviewAPI.create(formData);
        showToast('Review submitted');
      }

      closeComposer();
      load({ keepSpinner: true });
    } catch (error) {
      setFormError(error?.response?.data?.message || 'Failed to save review.');
    }

    setSubmitting(false);
  };

  const deleteReview = () => {
    if (!existingReview?._id) {
      return;
    }

    setDeleteReviewVisible(true);
  };

  const confirmDeleteReview = async () => {
    if (!existingReview?._id) {
      return;
    }

    try {
      await reviewAPI.delete(existingReview._id);
      showToast('Review deleted');
      load({ keepSpinner: true });
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || 'Failed to delete review.', undefined, { tone: 'danger' });
    }
  };

  const handleScroll = (event) => {
    const nextY = event.nativeEvent.contentOffset.y;
    const previousY = lastScrollY.current;

    if (nextY <= 16) {
      if (!showBottomCta) {
        setShowBottomCta(true);
      }
    } else if (nextY > previousY + 12) {
      if (showBottomCta) {
        setShowBottomCta(false);
      }
    } else if (nextY < previousY - 12) {
      if (!showBottomCta) {
        setShowBottomCta(true);
      }
    }

    lastScrollY.current = nextY;
  };

  if (loading && !vehicle) {
    return <LoadingSpinner message="Opening vehicle..." />;
  }

  if (!vehicle) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Vehicle not found</Text>
      </View>
    );
  }

  const ownerCanEdit = Boolean(existingReview?.canEdit);
  const ownerCanDelete = Boolean(existingReview?.canDelete);
  const ownerCanManage = ownerCanEdit || ownerCanDelete;

  return (
    <View style={styles.screen}>
      <SuccessToast visible={toastVisible} message={toastMessage} backgroundColor={toastBackgroundColor} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <VehicleHeroGallery
          vehicle={vehicle}
          activeImage={activeImage}
          onChangeImage={setActiveImage}
          onBack={() => navigation.goBack()}
          onToggleWishlist={handleWishlist}
          isWishlisted={isWishlisted}
          showWishlist={showWishlist}
        />

        <VehicleDetailsSheet>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{getVehicleTitle(vehicle)}</Text>
          </View>
          <Text style={styles.subtitle}>{getVehicleSubtitle(vehicle) || 'Premium rental listing'}</Text>
          <Text style={styles.summary}>{summaryLine || 'Book this rental through Wheelzy with a smooth verified request flow.'}</Text>

          <VehicleDetailsStats items={highlightItems} />

          {promotionDiscount.hasDiscount ? (
            <View style={styles.sectionBlock}>
              <VehiclePromotionCard promotion={promotion} vehicle={vehicle} />
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <PremiumRentOfferCard user={user} vehicle={vehicle} />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Rental highlights</Text>
            <VehicleFeatureGrid items={featureItems} />
          </View>

          {vehicle?.description ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>About this rental</Text>
              <View style={styles.copyCard}>
                <Text style={styles.copyText}>{vehicle.description}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <ReviewSummaryCard reviews={publicReviews} />

            {user?.role === 'CUSTOMER' ? (
              <View style={styles.ownerSection}>
                {existingReview ? (
                  <>
                    <View style={styles.ownerReviewCard}>
                      <View style={styles.ownerReviewHeader}>
                        <Text style={styles.ownerReviewTitle}>Your Review</Text>
                        <ReviewStatusBadge review={existingReview} />
                      </View>

                      <View style={styles.ownerReviewRatingRow}>
                        <StarRatingRow rating={existingReview?.rating || 0} size={18} />
                        <Text style={styles.ownerReviewRatingValue}>
                          {Number(existingReview?.rating || 0).toFixed(1)}
                        </Text>
                        <Text style={styles.ownerReviewDate}>{formatReviewDate(existingReview)}</Text>
                      </View>

                      <Text style={styles.ownerReviewMessage}>
                        {existingReview?.message || existingReview?.comment || 'No review text provided.'}
                      </Text>

                      <ReviewImageGallery images={existingReview?.images || []} />
                      <ReviewBusinessReply review={existingReview} />
                      <ReviewPrivateNotice review={existingReview} style={styles.privateNotice} />

                      {ownerCanManage ? (
                        <View style={styles.ownerActionRow}>
                          {ownerCanEdit ? (
                            <SecondaryButton title="Edit Review" onPress={openEditComposer} style={styles.ownerActionButton} />
                          ) : null}
                          {ownerCanDelete ? (
                            <PrimaryButton
                              title="Delete Review"
                              onPress={deleteReview}
                              style={styles.deleteButton}
                              textStyle={styles.deleteButtonText}
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>

                    {canWriteAnotherReview ? (
                      <View style={styles.reviewPromptCard}>
                        <Text style={styles.reviewPromptTitle}>Add another booking review</Text>
                        <Text style={styles.reviewPromptText}>
                          You have another approved booking for this vehicle, so you can post one more review for that booking.
                        </Text>
                        <PrimaryButton
                          title="Write Another Review"
                          onPress={openCreateComposer}
                          style={styles.reviewPromptButton}
                          textStyle={styles.reviewPromptButtonText}
                        />
                      </View>
                    ) : null}
                  </>
                ) : canWriteAnotherReview ? (
                  <View style={styles.reviewPromptCard}>
                    <Text style={styles.reviewPromptTitle}>Share your rental experience</Text>
                    <Text style={styles.reviewPromptText}>
                      You completed a booking for this vehicle, so you can now post one public review for that booking with up to 5 photos.
                    </Text>
                    <PrimaryButton
                      title="Write Review"
                      onPress={openCreateComposer}
                      style={styles.reviewPromptButton}
                      textStyle={styles.reviewPromptButtonText}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.publicReviewList}>
              {visiblePublicReviews.length ? (
                visiblePublicReviews.map((review) => (
                  <View key={review._id} style={styles.publicReviewCard}>
                    <View style={styles.publicReviewHeader}>
                      <View style={styles.publicReviewHeading}>
                        <Text style={styles.publicReviewerName}>{review?.customerName || 'Customer'}</Text>
                        <Text style={styles.publicReviewDate}>{formatReviewDate(review)}</Text>
                      </View>
                      <View style={styles.publicReviewRatingPill}>
                        <MaterialCommunityIcons name="star" size={14} color="#f59e0b" />
                        <Text style={styles.publicReviewRatingText}>{Number(review?.rating || 0).toFixed(1)}</Text>
                      </View>
                    </View>

                    <StarRatingRow rating={review?.rating || 0} size={16} style={styles.publicStarRow} />
                    <Text style={styles.publicReviewMessage}>{review?.message || review?.comment || 'No review text provided.'}</Text>
                    <ReviewImageGallery images={review?.images || []} />
                    <ReviewBusinessReply review={review} />
                  </View>
                ))
              ) : shouldShowPublicEmptyState ? (
                <View style={[styles.reviewPromptCard, styles.reviewEmptyCard]}>
                  <Text style={[styles.reviewPromptTitle, styles.reviewEmptyTitle]}>No reviews yet</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.sectionBlock}>
            <VehicleHostInfo
              title="Managed by Wheelzy Rentals"
              subtitle={`${availabilityMeta.title} - ${vehicle?.status || 'Ready to book'}`}
              caption="Rental support, booking confirmation, and follow-up are handled through Wheelzy."
              accent="car-estate"
            />
          </View>
        </VehicleDetailsSheet>
      </ScrollView>

      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: ctaOpacity,
            transform: [{ translateY: ctaTranslateY }],
          },
        ]}
      >
        <VehicleBottomCTA
          hidden={!showCustomerCTA}
          priceLabel={displayPrice}
          priceSubLabel={displayPriceSubLabel}
          ctaText="Book Now"
          onPress={handleBookNow}
        />
      </Animated.View>

      <ReviewComposerModal
        visible={composerVisible}
        mode={composerMode}
        vehicleLabel={getVehicleTitle(vehicle)}
        rating={rating}
        onChangeRating={setRating}
        message={message}
        onChangeMessage={setMessage}
        images={images}
        onPickImages={pickImages}
        onRemoveImage={removeImage}
        onClose={closeComposer}
        onSubmit={submitReview}
        submitting={submitting}
        errorMessage={formError}
      />

      <LogoutConfirmationSheet
        visible={deleteReviewVisible}
        onClose={() => setDeleteReviewVisible(false)}
        onConfirm={confirmDeleteReview}
        title="Delete Review"
        message="Delete your review for this rental vehicle?"
        confirmLabel="Delete"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 112,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -1.4,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.muted,
  },
  summary: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 25,
    color: Colors.muted,
  },
  sectionBlock: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  copyCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  copyText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.muted,
  },
  ownerSection: {
    marginTop: 18,
  },
  ownerReviewCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  ownerReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  ownerReviewTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  ownerReviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  ownerReviewRatingValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  ownerReviewDate: {
    fontSize: 13,
    color: Colors.muted,
  },
  ownerReviewMessage: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  privateNotice: {
    marginTop: 14,
  },
  ownerActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 18,
  },
  ownerActionButton: {
    flex: 1,
    borderRadius: Radius.full,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: Radius.full,
  },
  deleteButtonText: {
    color: '#ffffff',
  },
  reviewPromptCard: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  reviewPromptTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  reviewPromptText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.muted,
  },
  reviewPromptButton: {
    marginTop: 16,
    backgroundColor: '#facc15',
    borderColor: '#facc15',
    borderRadius: Radius.full,
  },
  reviewPromptButtonText: {
    color: '#111111',
  },
  reviewEmptyCard: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderColor: 'rgba(148,163,184,0.1)',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  reviewEmptyTitle: {
    textAlign: 'center',
  },
  publicReviewList: {
    gap: 14,
    marginTop: 0,
  },
  publicReviewCard: {
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 18,
    ...Shadow.sm,
  },
  publicReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  publicReviewHeading: {
    flex: 1,
  },
  publicReviewerName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
  },
  publicReviewDate: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.muted,
  },
  publicReviewRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#fff7ed',
  },
  publicReviewRatingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
  },
  publicStarRow: {
    marginTop: 12,
  },
  publicReviewMessage: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
});














