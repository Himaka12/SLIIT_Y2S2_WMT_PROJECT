import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, vehicleAPI } from '../../api';
import SuccessToast from '../../components/SuccessToast';
import { Radius, Shadow } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';

const LISTING_TYPES = ['Rent', 'Sale'];
const CONDITIONS = ['New', 'Used'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Other'];
const TRANSMISSIONS = ['Manual', 'Automatic', 'Semi-Automatic'];
const CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Van', 'Pickup', 'Coupe', 'Motorcycle', 'Other'];
const BASE_STATUSES = ['Available', 'Coming Soon'];
const MAX_IMAGES = 5;

const DIGIT_ONLY_FIELDS = new Set([
  'manufactureYear',
  'quantity',
  'mileage',
  'seatCount',
  'engineCapacity',
  'price',
]);

function sanitizeDigits(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function formatNumberWithSpaces(value) {
  const digits = sanitizeDigits(value);
  if (!digits) {
    return '';
  }

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function normalizeStatus(status, quantity) {
  const parsedQuantity = Number(quantity);

  if (status === 'Sold') {
    return 'Sold';
  }

  if (parsedQuantity === 0) {
    return 'Coming Soon';
  }

  if (status === 'Coming Soon') {
    return 'Coming Soon';
  }

  return 'Available';
}

function buildInitialForm(existing) {
  const initialCondition = existing?.vehicleCondition || 'New';
  const initialMileage = initialCondition === 'New'
    ? '0'
    : String(existing?.mileage ?? '');
  const initialQuantity = String(existing?.quantity ?? 1);

  return {
    listingType: existing?.listingType || 'Rent',
    vehicleCondition: initialCondition,
    brand: existing?.brand || '',
    model: existing?.model || '',
    category: existing?.category || 'Sedan',
    manufactureYear: String(existing?.manufactureYear ?? ''),
    color: existing?.color || '',
    quantity: initialQuantity,
    mileage: initialMileage,
    seatCount: String(existing?.seatCount ?? ''),
    engineCapacity: String(existing?.engineCapacity ?? ''),
    fuelType: existing?.fuelType || 'Petrol',
    transmission: TRANSMISSIONS.includes(existing?.transmission) ? existing.transmission : 'Automatic',
    description: existing?.description || '',
    price: String(existing?.price ?? ''),
    status: normalizeStatus(existing?.status, initialQuantity),
  };
}

function validateForm(values, images, existing = null) {
  const nextErrors = {};
  const currentYear = new Date().getFullYear();
  const manufactureYear = Number(values.manufactureYear);
  const quantity = Number(values.quantity);
  const mileage = Number(values.mileage);
  const seatCount = Number(values.seatCount);
  const engineCapacity = Number(values.engineCapacity);
  const price = Number(values.price);

  if (!values.brand.trim()) {
    nextErrors.brand = 'Brand is required.';
  }

  if (
    existing?.vehicleCondition === 'Used'
    && values.vehicleCondition === 'New'
  ) {
    nextErrors.vehicleCondition = 'A used vehicle cannot be changed back to new.';
  }

  if (!values.model.trim()) {
    nextErrors.model = 'Model is required.';
  }

  if (!values.manufactureYear.trim()) {
    nextErrors.manufactureYear = 'Manufacture year is required.';
  } else if (values.manufactureYear.length !== 4 || Number.isNaN(manufactureYear)) {
    nextErrors.manufactureYear = 'Enter a valid 4 digit year.';
  } else if (manufactureYear < 1900) {
    nextErrors.manufactureYear = 'Year is out of range.';
  } else if (values.status === 'Available' && manufactureYear > currentYear) {
    nextErrors.manufactureYear = 'Available vehicles cannot use a future year.';
  } else if (values.status === 'Coming Soon' && manufactureYear > currentYear + 1) {
    nextErrors.manufactureYear = 'Coming Soon vehicles can only be up to next year.';
  }

  if (!values.color.trim()) {
    nextErrors.color = 'Color is required.';
  }

  if (!values.quantity.trim()) {
    nextErrors.quantity = 'Quantity is required.';
  } else if (!/^\d+$/.test(values.quantity)) {
    nextErrors.quantity = 'Quantity must contain numbers only.';
  } else if (quantity < 0) {
    nextErrors.quantity = 'Quantity cannot be negative.';
  } else if ((values.status === 'Coming Soon' || values.status === 'Sold') && quantity !== 0) {
    nextErrors.quantity = `Quantity must be exactly 0 for ${values.status}.`;
  } else if (values.status === 'Available' && quantity === 0) {
    nextErrors.quantity = 'Quantity must be greater than 0 for Available.';
  }

  if (!values.mileage.trim()) {
    nextErrors.mileage = 'Mileage is required.';
  } else if (!/^\d+$/.test(values.mileage)) {
    nextErrors.mileage = 'Mileage must contain numbers only.';
  } else if (mileage < 0) {
    nextErrors.mileage = 'Mileage cannot be negative.';
  } else if (values.vehicleCondition === 'New' && mileage !== 0) {
    nextErrors.mileage = 'Mileage must stay at 0 for new vehicles.';
  }

  if (!values.engineCapacity.trim()) {
    nextErrors.engineCapacity = 'Engine capacity is required.';
  } else if (!/^\d+$/.test(values.engineCapacity)) {
    nextErrors.engineCapacity = 'Engine capacity must contain numbers only.';
  } else if (engineCapacity <= 0) {
    nextErrors.engineCapacity = 'Engine capacity must be greater than 0.';
  }

  if (!values.seatCount.trim()) {
    nextErrors.seatCount = 'Seat count is required.';
  } else if (!/^\d+$/.test(values.seatCount)) {
    nextErrors.seatCount = 'Seat count must contain numbers only.';
  } else if (seatCount <= 0) {
    nextErrors.seatCount = 'Seat count must be greater than 0.';
  }

  if (!values.price.trim()) {
    nextErrors.price = 'Price is required.';
  } else if (!/^\d+$/.test(values.price)) {
    nextErrors.price = 'Price must contain numbers only.';
  } else if (price <= 0) {
    nextErrors.price = 'Price must be greater than 0.';
  }

  if (values.status === 'Coming Soon' && quantity !== 0) {
    nextErrors.status = 'Coming Soon requires quantity 0.';
  }

  if (values.status === 'Sold' && quantity !== 0) {
    nextErrors.status = 'Sold vehicles must have quantity 0.';
  }

  if (values.status === 'Available' && quantity === 0) {
    nextErrors.status = 'Available vehicles must have stock.';
  }

  if (images.length > MAX_IMAGES) {
    nextErrors.images = `You can upload up to ${MAX_IMAGES} images only.`;
  }

  return nextErrors;
}

function OptionPicker({ label, options, value, onChange, error, helperText, getOptionDisabled }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {options.map((option) => {
          const active = value === option;
          const disabled = typeof getOptionDisabled === 'function' ? Boolean(getOptionDisabled(option)) : false;
          return (
            <TouchableOpacity
              key={option}
              activeOpacity={0.88}
              onPress={() => {
                if (!disabled) {
                  onChange(option);
                }
              }}
              disabled={disabled}
              style={[
                styles.optionPill,
                active && styles.optionPillActive,
                disabled && styles.optionPillDisabled,
              ]}
            >
              <Text
                style={[
                  styles.optionPillText,
                  active && styles.optionPillTextActive,
                  disabled && styles.optionPillTextDisabled,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {helperText && !error ? <Text style={styles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType,
  error,
  editable = true,
  multiline = false,
  numberOfLines,
  suffix,
  helperText,
  style,
}) {
  return (
    <View style={[styles.fieldBlock, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          multiline && styles.inputShellMultiline,
          error && styles.inputShellError,
          !editable && styles.inputShellDisabled,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType={keyboardType}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          style={[
            styles.input,
            multiline && styles.textArea,
            suffix ? styles.inputWithSuffix : null,
            !editable && styles.inputDisabled,
          ]}
        />
        {suffix ? (
          <View style={styles.suffixChip}>
            <Text style={styles.suffixText}>{suffix}</Text>
          </View>
        ) : null}
      </View>
      {helperText && !error ? <Text style={styles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function VehicleFormSection({ icon, title, subtitle, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <MaterialCommunityIcons name={icon} size={18} color="#111111" />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

export function VehicleEditorForm({
  existing = null,
  onClose,
  onSaved,
  showHeader = true,
  showIntro = true,
  topPadding = 42,
  embedded = false,
}) {
  const isEdit = Boolean(existing);
  const statusOptions = isEdit ? [...BASE_STATUSES, 'Sold'] : BASE_STATUSES;
  const { showAlert } = useAppAlert();
  const [form, setForm] = useState(buildInitialForm(existing));
  const [images, setImages] = useState(
    isEdit
      ? [existing.image1, existing.image2, existing.image3, existing.image4, existing.image5].filter(Boolean)
      : [],
  );
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const floatingSaveTranslateY = useRef(new Animated.Value(0)).current;
  const floatingSaveOpacity = useRef(new Animated.Value(1)).current;
  const lastScrollOffsetRef = useRef(0);
  const [floatingSaveVisible, setFloatingSaveVisibleState] = useState(true);

  const errors = useMemo(() => validateForm(form, images, existing), [existing, form, images]);

  const setFloatingSaveVisible = (visible) => {
    setFloatingSaveVisibleState((current) => {
      if (current === visible) {
        return current;
      }

      Animated.parallel([
        Animated.timing(floatingSaveTranslateY, {
          toValue: visible ? 0 : 96,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(floatingSaveOpacity, {
          toValue: visible ? 1 : 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();

      return visible;
    });
  };

  const handleFormScroll = ({ nativeEvent }) => {
    if (!embedded) {
      return;
    }

    const nextOffset = Math.max(nativeEvent?.contentOffset?.y || 0, 0);
    const visibleHeight = Number(nativeEvent?.layoutMeasurement?.height || 0);
    const contentHeight = Number(nativeEvent?.contentSize?.height || 0);
    const delta = nextOffset - lastScrollOffsetRef.current;
    const nearBottom = visibleHeight > 0 && contentHeight > 0
      ? nextOffset + visibleHeight >= contentHeight - 140
      : false;

    if (nextOffset < 24 || nearBottom) {
      setFloatingSaveVisible(true);
    } else if (delta > 10) {
      setFloatingSaveVisible(false);
    } else if (delta < -10) {
      setFloatingSaveVisible(true);
    }

    lastScrollOffsetRef.current = nextOffset;
  };

  const markTouched = (...fieldNames) => {
    if (!fieldNames.length) {
      return;
    }

    setTouched((prev) => {
      const next = { ...prev };
      fieldNames.forEach((fieldName) => {
        next[fieldName] = true;
      });
      return next;
    });
  };

  const updateField = (fieldName, nextValue) => {
    const cleanedValue = DIGIT_ONLY_FIELDS.has(fieldName) ? sanitizeDigits(nextValue) : nextValue;

    setForm((prev) => ({
      ...prev,
      [fieldName]: cleanedValue,
    }));
  };

  const handleConditionChange = (value) => {
    markTouched('vehicleCondition', 'mileage');

    setForm((prev) => ({
      ...prev,
      vehicleCondition: value,
      mileage: value === 'New' ? '0' : prev.mileage,
    }));
  };

  const handleQuantityChange = (value) => {
    const cleaned = sanitizeDigits(value);
    markTouched('quantity', 'status');

    setForm((prev) => {
      const next = {
        ...prev,
        quantity: cleaned,
      };

      if (prev.status === 'Sold') {
        next.quantity = '0';
        next.status = 'Sold';
      } else if (cleaned === '0') {
        next.status = 'Coming Soon';
      } else if (cleaned && Number(cleaned) > 0 && prev.status === 'Coming Soon') {
        next.status = 'Available';
      }

      return next;
    });
  };

  const handleStatusChange = (value) => {
    markTouched('status', 'quantity');

    setForm((prev) => {
      if (value === 'Sold') {
        return {
          ...prev,
          status: value,
          quantity: '0',
        };
      }

      if (value === 'Coming Soon') {
        return {
          ...prev,
          status: value,
          quantity: '0',
        };
      }

      return {
        ...prev,
        status: value,
        quantity: prev.quantity === '0' || !prev.quantity ? '1' : prev.quantity,
      };
    });
  };

  const pickImages = async () => {
    markTouched('images');

    if (images.length >= MAX_IMAGES) {
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

    const remainingSlots = MAX_IMAGES - images.length;
    const selectedAssets = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName || `vehicle_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));

    const assetsToAppend = selectedAssets.slice(0, remainingSlots);

    setImages((prev) => [...prev, ...assetsToAppend]);

    if (selectedAssets.length > remainingSlots) {
      showAlert('Image limit reached', `Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} could be added. Maximum is ${MAX_IMAGES}.`);
    }
  };

  const removeImage = (index) => {
    markTouched('images');
    setImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const getFieldError = (fieldName) => (touched[fieldName] ? errors[fieldName] : undefined);

  const handleSubmit = async () => {
    const allTouched = {
      listingType: true,
      vehicleCondition: true,
      brand: true,
      model: true,
      category: true,
      manufactureYear: true,
      color: true,
      quantity: true,
      mileage: true,
      seatCount: true,
      engineCapacity: true,
      fuelType: true,
      transmission: true,
      price: true,
      status: true,
      images: true,
    };

    setTouched(allTouched);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const formData = new FormData();
      const payload = {
        ...form,
        brand: form.brand.trim(),
        model: form.model.trim(),
        color: form.color.trim(),
        description: form.description.trim(),
        listedDate: existing?.listedDate || today,
      };

      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      images.forEach((image, index) => {
        if (typeof image === 'string') {
          formData.append(`image${index + 1}`, image);
          return;
        }

        formData.append('images', {
          uri: image.uri,
          name: image.name,
          type: image.type,
        });
      });

      if (isEdit) {
        await vehicleAPI.update(existing._id, formData);
        onSaved?.({
          title: 'Vehicle updated',
          message: 'Vehicle Updated successfully',
        });
      } else {
        await vehicleAPI.add(formData);
        onSaved?.({
          title: 'Vehicle added',
          message: 'Vehicle Added successfully',
        });
      }
    } catch (error) {
      showAlert('Save failed', error?.response?.data?.message || 'Unable to save vehicle right now.', undefined, { tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, embedded && styles.embeddedRoot]}>
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[
          styles.content,
          embedded && styles.embeddedContent,
          embedded && styles.embeddedContentWithFloatingSave,
          { paddingTop: topPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleFormScroll}
      >
        {(showHeader || showIntro) ? (
          <View style={styles.pageHeader}>
            <View style={styles.pageHeaderCopy}>
              {showIntro ? (
                <>
                  <Text style={styles.pageTitle}>{isEdit ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

      <VehicleFormSection
        icon="car-info"
        title="Basic information"
        subtitle="Set the main listing details."
      >
        <OptionPicker
          label="Listing Type"
          options={LISTING_TYPES}
          value={form.listingType}
          onChange={(value) => {
            markTouched('listingType');
            setForm((prev) => ({ ...prev, listingType: value }));
          }}
        />

        <OptionPicker
          label="Condition"
          options={CONDITIONS}
          value={form.vehicleCondition}
          onChange={handleConditionChange}
          getOptionDisabled={(option) => isEdit && existing?.vehicleCondition === 'Used' && option === 'New'}
          helperText={isEdit && existing?.vehicleCondition === 'Used' ? 'Used vehicles cannot be changed back to New.' : undefined}
          error={getFieldError('vehicleCondition')}
        />

        <LabeledInput
          label="Brand *"
          value={form.brand}
          onChangeText={(value) => updateField('brand', value)}
          onBlur={() => markTouched('brand')}
          placeholder="Toyota"
          editable={!isEdit}
          error={getFieldError('brand')}
        />

        <LabeledInput
          label="Model *"
          value={form.model}
          onChangeText={(value) => updateField('model', value)}
          onBlur={() => markTouched('model')}
          placeholder="Corolla"
          editable={!isEdit}
          error={getFieldError('model')}
        />

        <OptionPicker
          label="Category"
          options={CATEGORIES}
          value={form.category}
          onChange={(value) => {
            markTouched('category');
            setForm((prev) => ({ ...prev, category: value }));
          }}
        />

        <View style={styles.row}>
          <LabeledInput
            label="Year *"
            value={form.manufactureYear}
            onChangeText={(value) => updateField('manufactureYear', value)}
            onBlur={() => markTouched('manufactureYear')}
            placeholder="2024"
            keyboardType="number-pad"
            editable={!isEdit}
            error={getFieldError('manufactureYear')}
            style={styles.flexField}
          />
          <LabeledInput
            label="Color *"
            value={form.color}
            onChangeText={(value) => updateField('color', value)}
            onBlur={() => markTouched('color')}
            placeholder="White"
            error={getFieldError('color')}
            style={styles.flexField}
          />
        </View>
      </VehicleFormSection>

      <VehicleFormSection
        icon="cog-outline"
        title="Technical specs"
        subtitle="Fill in the core vehicle specifications."
      >
        <OptionPicker
          label="Fuel Type"
          options={FUEL_TYPES}
          value={form.fuelType}
          onChange={(value) => {
            markTouched('fuelType');
            setForm((prev) => ({ ...prev, fuelType: value }));
          }}
        />

        <OptionPicker
          label="Transmission"
          options={TRANSMISSIONS}
          value={form.transmission}
          onChange={(value) => {
            markTouched('transmission');
            setForm((prev) => ({ ...prev, transmission: value }));
          }}
        />

        <View style={styles.row}>
          <LabeledInput
            label="Mileage *"
            value={form.mileage}
            onChangeText={(value) => updateField('mileage', value)}
            onBlur={() => markTouched('mileage')}
            placeholder="50000"
            keyboardType="number-pad"
            editable={form.vehicleCondition !== 'New'}
            suffix="Km"
            error={getFieldError('mileage')}
            style={styles.flexField}
          />
          <LabeledInput
            label="Seat Count *"
            value={form.seatCount}
            onChangeText={(value) => updateField('seatCount', value)}
            onBlur={() => markTouched('seatCount')}
            placeholder="5"
            keyboardType="number-pad"
            error={getFieldError('seatCount')}
            style={styles.flexField}
          />
        </View>

        <View style={styles.row}>
          <LabeledInput
            label="Engine Capacity *"
            value={form.engineCapacity}
            onChangeText={(value) => updateField('engineCapacity', value)}
            onBlur={() => markTouched('engineCapacity')}
            placeholder="1500"
            keyboardType="number-pad"
            suffix="Cc"
            error={getFieldError('engineCapacity')}
            style={styles.flexField}
          />
        </View>

        <LabeledInput
          label="Quantity *"
          value={form.quantity}
          onChangeText={handleQuantityChange}
          onBlur={() => markTouched('quantity', 'status')}
          placeholder="1"
          keyboardType="number-pad"
          error={getFieldError('quantity')}
        />
      </VehicleFormSection>

      <VehicleFormSection
        icon="cash-multiple"
        title="Pricing and status"
        subtitle="Manage the price and listing state."
      >
        <LabeledInput
          label={`Price * ${form.listingType === 'Rent' ? '(per day in Rs.)' : '(total in Rs.)'}`}
          value={formatNumberWithSpaces(form.price)}
          onChangeText={(value) => updateField('price', value)}
          onBlur={() => markTouched('price')}
          placeholder="34 500"
          keyboardType="number-pad"
          error={getFieldError('price')}
        />

        <OptionPicker
          label="Status"
          options={statusOptions}
          value={form.status}
          onChange={handleStatusChange}
          error={getFieldError('status')}
        />
      </VehicleFormSection>

      <VehicleFormSection
        icon="text-box-outline"
        title="Description"
        subtitle="Add a short vehicle summary."
      >
        <LabeledInput
          label="Vehicle Description"
          value={form.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Describe the condition, features, service history, or standout details..."
          multiline
          numberOfLines={7}
          style={styles.fullField}
        />
      </VehicleFormSection>

      <VehicleFormSection
        icon="image-multiple-outline"
        title="Vehicle images"
        subtitle="Upload up to 5 vehicle images."
      >
        <View style={styles.mediaHeader}>
          <Text style={styles.fieldLabel}>Listing photos</Text>
          <Text style={styles.imageCountText}>{images.length}/{MAX_IMAGES}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.uploadButton,
            images.length < MAX_IMAGES ? styles.uploadButtonActive : styles.uploadButtonDisabled,
          ]}
          onPress={pickImages}
          activeOpacity={images.length >= MAX_IMAGES ? 1 : 0.88}
          disabled={images.length >= MAX_IMAGES}
        >
          <MaterialCommunityIcons
            name={images.length < MAX_IMAGES ? 'camera-plus-outline' : 'image-off-outline'}
            size={18}
            color="#111111"
          />
          <Text style={styles.uploadButtonText}>
            {images.length >= MAX_IMAGES ? 'Image limit reached' : `Add more photos ${images.length}/${MAX_IMAGES}`}
          </Text>
        </TouchableOpacity>

        {images.length ? (
          <View style={styles.imageGrid}>
            {images.map((image, index) => {
              const uri = typeof image === 'string' ? `${BASE_URL}${image}` : image.uri;
              return (
                <View key={`${uri}-${index}`} style={styles.imageTile}>
                  <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    style={styles.removeImageButton}
                    activeOpacity={0.88}
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#111111" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyImageState}>
            <MaterialCommunityIcons name="image-outline" size={26} color="#94a3b8" />
            <Text style={styles.emptyImageText}>No images selected yet</Text>
          </View>
        )}

        {getFieldError('images') ? <Text style={styles.fieldError}>{getFieldError('images')}</Text> : null}
      </VehicleFormSection>

        {!embedded ? (
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.88}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} activeOpacity={0.9} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={isEdit ? 'content-save-outline' : 'plus-circle-outline'}
                    size={18}
                    color="#111111"
                  />
                  <Text style={styles.saveButtonText}>{isEdit ? 'Update Vehicle' : 'Add Vehicle'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {embedded ? (
        <Animated.View
          pointerEvents={floatingSaveVisible ? 'auto' : 'none'}
          style={[
            styles.floatingSaveWrap,
            {
              opacity: floatingSaveOpacity,
              transform: [{ translateY: floatingSaveTranslateY }],
            },
          ]}
        >
          <TouchableOpacity style={styles.floatingSaveButton} onPress={handleSubmit} activeOpacity={0.9} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={isEdit ? 'content-save-outline' : 'plus-circle-outline'}
                  size={18}
                  color="#111111"
                />
                <Text style={styles.saveButtonText}>{isEdit ? 'Update Vehicle' : 'Add Vehicle'}</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function AddEditVehicleScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const existing = params?.vehicle || null;
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  return (
    <View style={styles.screenRoot}>
      <SuccessToast visible={showToast} message={toastMessage} />
      <VehicleEditorForm
        existing={existing}
        onClose={() => navigation.goBack()}
        onSaved={(notice) => {
          setToastMessage(notice?.message || (existing ? 'Vehicle Updated successfully' : 'Vehicle Added successfully'));
          setShowToast(true);
          if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
          }
          toastTimeoutRef.current = setTimeout(() => {
            setShowToast(false);
            navigation.goBack();
            toastTimeoutRef.current = null;
          }, 900);
        }}
        showHeader
        showIntro
        topPadding={Math.max(insets.top + 18, 42)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formScroll: {
    flex: 1,
  },
  embeddedRoot: {
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  embeddedContent: {
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  embeddedContentWithFloatingSave: {
    paddingBottom: 112,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  pageHeaderCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.9,
  },
  pageSubtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 24,
    color: '#6b7280',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
  },
  optionRow: {
    paddingRight: 8,
  },
  optionPill: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#facc15',
  },
  optionPillDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e5e7eb',
    opacity: 0.55,
  },
  optionPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  optionPillTextActive: {
    color: '#111111',
  },
  optionPillTextDisabled: {
    color: '#6b7280',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  fullField: {
    marginBottom: 0,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputShellMultiline: {
    minHeight: 168,
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 10,
  },
  inputShellError: {
    borderColor: '#ef4444',
  },
  inputShellDisabled: {
    backgroundColor: '#f3f4f6',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    paddingVertical: 14,
  },
  inputWithSuffix: {
    paddingRight: 10,
  },
  inputDisabled: {
    color: '#6b7280',
  },
  textArea: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  suffixChip: {
    minWidth: 46,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  suffixText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  imageCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
  },
  uploadButton: {
    marginTop: 12,
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
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  imageTile: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e5e7eb',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImageState: {
    marginTop: 10,
    height: 132,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyImageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    marginBottom: 24,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  saveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.full,
    backgroundColor: '#facc15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadow.sm,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  floatingSaveWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  floatingSaveButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: '#facc15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadow.md,
  },
});
