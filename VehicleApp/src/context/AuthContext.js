import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, adminAPI, customerAPI, inquiryAPI, promotionAPI } from '../api';

const AuthContext = createContext(null);

const STORAGE_KEYS = ['jwtToken', 'userEmail', 'userRole', 'userName', 'userId', 'isPremium'];

const clearStoredSession = async () => {
  await AsyncStorage.multiRemove(STORAGE_KEYS);
};

const isAuthFailure = (error) => {
  const status = Number(error?.response?.status || 0);
  return status === 401 || status === 403;
};

const validateSessionByRole = async (role) => {
  if (role === 'ADMIN') {
    await adminAPI.getStats();
    return;
  }

  if (role === 'MARKETING_MANAGER') {
    await promotionAPI.getAll();
    return;
  }

  await customerAPI.getProfile();
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);   // { token, email, role, fullName, isPremium, userId }
  const [loading, setLoading] = useState(true);

  const updateStoredUser = async (patch = {}) => {
    const storageUpdates = [];

    if (Object.prototype.hasOwnProperty.call(patch, 'fullName')) {
      storageUpdates.push(['userName', patch.fullName || '']);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'isPremium')) {
      storageUpdates.push(['isPremium', String(Boolean(patch.isPremium))]);
    }

    if (storageUpdates.length) {
      await AsyncStorage.multiSet(storageUpdates);
    }

    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const completeLogin = async (data) => {
    await AsyncStorage.multiSet([
      ['jwtToken',   data.token],
      ['userEmail',  data.email],
      ['userRole',   data.role],
      ['userName',   data.fullName],
      ['userId',     String(data.userId)],
      ['isPremium',  String(data.isPremium)],
    ]);
    setUser({
      token:     data.token,
      email:     data.email,
      role:      data.role,
      fullName:  data.fullName,
      userId:    data.userId,
      isPremium: data.isPremium,
    });
    return data;
  };

  // Restore session on app launch
  useEffect(() => {
    (async () => {
      try {
        const token    = await AsyncStorage.getItem('jwtToken');
        const email    = await AsyncStorage.getItem('userEmail');
        const role     = await AsyncStorage.getItem('userRole');
        const fullName = await AsyncStorage.getItem('userName');
        const userId   = await AsyncStorage.getItem('userId');
        const isPremium = (await AsyncStorage.getItem('isPremium')) === 'true';

        if (!token || !role) {
          await clearStoredSession();
        } else {
          try {
            await validateSessionByRole(role);
            setUser({ token, email, role, fullName, userId, isPremium });
          } catch (error) {
            if (isAuthFailure(error)) {
              await clearStoredSession();
              setUser(null);
            } else {
              setUser({ token, email, role, fullName, userId, isPremium });
            }
          }
        }
      } catch (_) {
        await clearStoredSession();
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const login = async ({ email, password, deferSession = false }) => {
    const { data } = await authAPI.login({ email, password });
    if (!deferSession) {
      await completeLogin(data);
    }
    return data;
  };

  const logout = async () => {
    await clearStoredSession();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await (await import('../api')).customerAPI.getProfile();
      await updateStoredUser({
        fullName: data.fullName,
        isPremium: data.isPremium,
      });
      return data;
    } catch (_) {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, completeLogin, logout, refreshUser, updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
