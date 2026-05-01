import React, { useEffect, useLayoutEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { vehicleAPI } from '../../api';
import { LoadingSpinner } from '../../components/UI';

export default function VehicleDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialVehicle = route.params?.vehicle || route.params?.initialVehicle || null;
  const vehicleId = route.params?.vehicleId || initialVehicle?._id;

  useLayoutEffect(() => {
    if (!initialVehicle?.listingType || !vehicleId) {
      return;
    }

    const targetRoute = initialVehicle.listingType === 'Rent'
      ? 'RentVehicleDetails'
      : 'SaleVehicleDetails';

    navigation.replace(targetRoute, {
      vehicleId,
      initialVehicle,
    });
  }, [initialVehicle, navigation, vehicleId]);

  useEffect(() => {
    let mounted = true;

    const forwardToTypedScreen = async () => {
      if (initialVehicle?.listingType) {
        return;
      }

      if (!vehicleId) {
        navigation.goBack();
        return;
      }

      try {
        const vehicle = (await vehicleAPI.getById(vehicleId)).data;

        if (!mounted || !vehicle) {
          return;
        }

        const targetRoute = vehicle.listingType === 'Rent'
          ? 'RentVehicleDetails'
          : 'SaleVehicleDetails';

        navigation.replace(targetRoute, {
          vehicleId: vehicle._id,
          initialVehicle: vehicle,
        });
      } catch (_) {
        if (mounted) {
          navigation.goBack();
        }
      }
    };

    forwardToTypedScreen();
    return () => {
      mounted = false;
    };
  }, [initialVehicle, navigation, vehicleId]);

  if (initialVehicle?.listingType) {
    return null;
  }

  return <LoadingSpinner message="Opening vehicle..." />;
}
