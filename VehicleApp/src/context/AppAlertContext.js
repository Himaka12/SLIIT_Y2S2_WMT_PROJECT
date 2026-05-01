import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Shadow } from '../constants/theme';

const AppAlertContext = createContext({
  showAlert: () => {},
  updateAlert: () => {},
  hideAlert: () => {},
});

const DEFAULT_BUTTON = { text: 'OK' };

function toneForAlert(buttons = [], options = {}) {
  if (options?.tone) {
    return options.tone;
  }

  if (buttons.some((button) => button?.style === 'destructive')) {
    return 'danger';
  }

  if (buttons.some((button) => button?.text?.toLowerCase().includes('success'))) {
    return 'success';
  }

  return 'neutral';
}

function iconForTone(tone) {
  if (tone === 'danger') return { name: 'alert-circle-outline', bg: '#fff1f2', color: '#dc2626' };
  if (tone === 'success') return { name: 'check-circle-outline', bg: '#f0fdf4', color: '#16a34a' };
  return { name: 'information-outline', bg: '#eff6ff', color: '#2563eb' };
}

export function AppAlertProvider({ children }) {
  const [alertState, setAlertState] = useState(null);

  const hideAlert = useCallback(() => {
    setAlertState(null);
  }, []);

  const showAlert = useCallback((title, message, buttons = [DEFAULT_BUTTON], options = {}) => {
    const normalizedButtons = options?.hideActions
      ? []
      : (Array.isArray(buttons) && buttons.length ? buttons : [DEFAULT_BUTTON]);
    const nextState = {
      id: Date.now() + Math.random(),
      title,
      message,
      buttons: normalizedButtons,
      options,
    };
    setAlertState(nextState);
    return nextState.id;
  }, []);

  const updateAlert = useCallback((id, nextConfig = {}) => {
    setAlertState((current) => {
      if (!current || current.id !== id) {
        return current;
      }

      const nextButtons = nextConfig.options?.hideActions
        ? []
        : nextConfig.buttons === undefined
        ? current.buttons
        : (Array.isArray(nextConfig.buttons) && nextConfig.buttons.length ? nextConfig.buttons : [DEFAULT_BUTTON]);

      return {
        ...current,
        ...(nextConfig.title !== undefined ? { title: nextConfig.title } : {}),
        ...(nextConfig.message !== undefined ? { message: nextConfig.message } : {}),
        buttons: nextButtons,
        options: {
          ...(current.options || {}),
          ...(nextConfig.options || {}),
        },
      };
    });
  }, []);

  const handleButtonPress = useCallback((button) => {
    setAlertState(null);

    if (typeof button?.onPress === 'function') {
      setTimeout(() => {
        button.onPress();
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (!alertState?.options?.autoHideMs) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setAlertState((current) => (current?.id === alertState.id ? null : current));
    }, alertState.options.autoHideMs);

    return () => clearTimeout(timer);
  }, [alertState]);

  const value = useMemo(() => ({ showAlert, updateAlert, hideAlert }), [hideAlert, showAlert, updateAlert]);
  const buttons = alertState?.buttons || [];
  const tone = toneForAlert(buttons, alertState?.options);
  const iconMeta = iconForTone(tone);

  return (
    <AppAlertContext.Provider value={value}>
      {children}

      <Modal
        visible={Boolean(alertState)}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.backdrop}>
          <BlurView intensity={38} tint="light" style={styles.blurLayer} />
          <Pressable style={styles.dimLayer} onPress={hideAlert} />

          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: iconMeta.bg }]}>
              <MaterialCommunityIcons name={iconMeta.name} size={22} color={iconMeta.color} />
            </View>

            <Text style={styles.title}>{alertState?.title || 'Notice'}</Text>
            {!!alertState?.message && <Text style={styles.message}>{alertState.message}</Text>}
            {alertState?.options?.loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color="#111111" />
              </View>
            ) : null}

            {buttons.length > 0 ? (
              <View style={[styles.actions, buttons.length > 2 && styles.actionsStacked]}>
                {buttons.map((button, index) => {
                  const style = button?.style;
                  const isDestructive = style === 'destructive';
                  const isCancel = style === 'cancel';

                  return (
                  <TouchableOpacity
                    key={`${button?.text || 'button'}-${index}`}
                    style={[
                      styles.button,
                      isCancel && styles.cancelButton,
                      isDestructive && styles.destructiveButton,
                      buttons.length > 2 && styles.buttonFull,
                    ]}
                    activeOpacity={0.88}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.cancelButtonText,
                        isDestructive && styles.destructiveButtonText,
                      ]}
                    >
                      {button?.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  return useContext(AppAlertContext);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.20)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    ...Shadow.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingWrap: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  buttonFull: {
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  destructiveButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  cancelButtonText: {
    color: '#111111',
  },
  destructiveButtonText: {
    color: '#ffffff',
  },
});
