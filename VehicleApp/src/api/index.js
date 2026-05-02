import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RENDER_API_BASE_URL = 'https://sliit-y2s2-wmt-project.onrender.com';
const HEALTHCHECK_PATH = '/api/health';
const API_TIMEOUT_MS = 75000;
const BASE_URL_PROBE_TIMEOUT_MS = 15000;
const BACKEND_WARMUP_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 16000];

const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '');
const unique = (values) => [...new Set(values.filter(Boolean))];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getBaseUrlCandidates = () => {
  return unique([
    normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL),
    RENDER_API_BASE_URL,
  ].map(normalizeBaseUrl));
};

export let BASE_URL = getBaseUrlCandidates()[0] || RENDER_API_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT_MS,
});

let baseUrlResolutionPromise = null;
let hasResolvedInitialBaseUrl = false;

const setBaseUrl = (nextBaseUrl, reason = 'runtime-update') => {
  const normalized = normalizeBaseUrl(nextBaseUrl);
  if (!normalized) {
    return BASE_URL;
  }

  if (normalized !== BASE_URL) {
    BASE_URL = normalized;
    api.defaults.baseURL = normalized;
    console.log(`[API] Switched backend URL to ${normalized} (${reason})`);
  }

  return BASE_URL;
};

const probeBaseUrl = async (candidateBaseUrl) => {
  try {
    const response = await axios.get(`${candidateBaseUrl}${HEALTHCHECK_PATH}`, {
      timeout: BASE_URL_PROBE_TIMEOUT_MS,
      validateStatus: () => true,
      headers: { 'Cache-Control': 'no-cache' },
    });

    return response.status > 0;
  } catch {
    return false;
  }
};

const resolveReachableBaseUrl = async ({ force = false } = {}) => {
  if (baseUrlResolutionPromise) {
    return baseUrlResolutionPromise;
  }

  baseUrlResolutionPromise = (async () => {
    const prioritizedCandidates = unique([BASE_URL, ...getBaseUrlCandidates()]);

    if (!force && prioritizedCandidates.length === 1) {
      return setBaseUrl(prioritizedCandidates[0], 'single-candidate');
    }

    for (const candidate of prioritizedCandidates) {
      if (await probeBaseUrl(candidate)) {
        return setBaseUrl(candidate, 'healthcheck');
      }
    }

    return BASE_URL;
  })().finally(() => {
    baseUrlResolutionPromise = null;
    hasResolvedInitialBaseUrl = true;
  });

  return baseUrlResolutionPromise;
};

const shouldRetryWithFreshBaseUrl = (error) => {
  if (error?.response || error?.config?._retryWithFreshBaseUrl) {
    return false;
  }

  if (String(error?.code || '').toUpperCase() === 'ECONNABORTED') {
    return true;
  }

  return /network error|timeout|timed out/i.test(String(error?.message || ''));
};

const isBackendWarmingResponse = (error) => {
  if (Number(error?.response?.status || 0) !== 503) {
    return false;
  }

  const message = String(error?.response?.data?.message || '').toLowerCase();
  return message.includes('database unavailable')
    || message.includes('mongodb is unavailable')
    || message.includes('database is not responding')
    || message.includes('backend is starting')
    || message.includes('temporarily unavailable');
};

const shouldRetryBackendWarmup = (error) => {
  const config = error?.config || {};
  const retryCount = Number(config._backendWarmupRetryCount || 0);

  if (!isBackendWarmingResponse(error)) {
    return false;
  }

  return retryCount < BACKEND_WARMUP_RETRY_DELAYS_MS.length;
};

void resolveReachableBaseUrl();

const METHOD_COLORS = {
  GET: '\x1b[34m',
  POST: '\x1b[32m',
  PUT: '\x1b[33m',
  DELETE: '\x1b[31m',
  PATCH: '\x1b[35m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

const pad = (str, len = 7) => String(str).padEnd(len);
const now = () => new Date().toISOString().slice(11, 23);

const logRequest = (config) => {
  const method = (config.method || 'GET').toUpperCase();
  const color = METHOD_COLORS[method] || RESET;
  const url = `${config.baseURL || ''}${config.url}`;
  const isMultipart = typeof FormData !== 'undefined' && config.data instanceof FormData;

  console.log(`\n${BOLD}${color}► [REQUEST]${RESET}  ${DIM}${now()}${RESET}`);
  console.log(`  ${color}${BOLD}${pad(method)}${RESET}  ${CYAN}${url}${RESET}`);

  if (config.params && Object.keys(config.params).length) {
    console.log(`  ${DIM}Params:${RESET}`, JSON.stringify(config.params));
  }

  if (config.data) {
    try {
      if (typeof config.data === 'string') {
        const parsed = JSON.parse(config.data);
        const safe = { ...parsed };
        if (safe.password) safe.password = '••••••••';
        console.log(`  ${DIM}Body:${RESET}`, JSON.stringify(safe, null, 2));
      } else if (isMultipart) {
        console.log(`  ${DIM}Body:${RESET} [FormData / multipart]`);
      } else {
        const safe = { ...config.data };
        if (safe.password) safe.password = '••••••••';
        console.log(`  ${DIM}Body:${RESET}`, JSON.stringify(safe, null, 2));
      }
    } catch {
      console.log(`  ${DIM}Body:${RESET}`, config.data);
    }
  }

  const authHeader = config.headers?.Authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    console.log(`  ${DIM}Auth:${RESET} Bearer ${token.slice(0, 20)}...${DIM}(${token.length} chars)${RESET}`);
  } else {
    console.log(`  ${DIM}Auth:${RESET} ${YELLOW}none (unauthenticated)${RESET}`);
  }
};

const logResponse = (response) => {
  const method = (response.config.method || 'GET').toUpperCase();
  const color = METHOD_COLORS[method] || RESET;
  const url = `${response.config.baseURL || ''}${response.config.url}`;
  const status = response.status;
  const statusColor = status >= 200 && status < 300 ? GREEN : YELLOW;

  console.log(`\n${BOLD}${GREEN}◄ [RESPONSE]${RESET}  ${DIM}${now()}${RESET}`);
  console.log(`  ${color}${BOLD}${pad(method)}${RESET}  ${CYAN}${url}${RESET}`);
  console.log(`  ${DIM}Status:${RESET} ${statusColor}${BOLD}${status} ${response.statusText}${RESET}`);

  if (response.data !== undefined) {
    try {
      const preview = JSON.stringify(response.data);
      if (preview.length <= 500) {
        console.log(`  ${DIM}Data:${RESET}`, JSON.stringify(response.data, null, 2));
      } else {
        console.log(`  ${DIM}Data (truncated):${RESET}`, `${preview.slice(0, 500)}…`);
      }
    } catch {
      console.log(`  ${DIM}Data:${RESET}`, response.data);
    }
  }
  console.log('');
};

const logError = (error) => {
  const config = error.config || {};
  const method = (config.method || '?').toUpperCase();
  const url = `${config.baseURL || ''}${config.url || ''}`;

  console.log(`\n${BOLD}${RED}✖ [ERROR]${RESET}  ${DIM}${now()}${RESET}`);
  console.log(`  ${RED}${BOLD}${pad(method)}${RESET}  ${CYAN}${url}${RESET}`);

  if (error.response) {
    console.log(`  ${DIM}Status:${RESET} ${RED}${BOLD}${error.response.status} ${error.response.statusText}${RESET}`);
    console.log(`  ${DIM}Server message:${RESET}`, JSON.stringify(error.response.data, null, 2));
  } else if (error.request) {
    console.log(`  ${RED}${BOLD}NO RESPONSE RECEIVED${RESET}`);
    console.log(`  ${DIM}Possible causes:${RESET}`);
    console.log(`    • Backend not running on ${config.baseURL || BASE_URL}`);
    console.log(`    • Wrong backend host for this device/emulator`);
    console.log(`    • Android blocking HTTP (add usesCleartextTraffic:true in app.json)`);
    console.log(`    • Firewall or network issue`);
    console.log(`  ${DIM}Error code:${RESET} ${error.code}`);
    console.log(`  ${DIM}Error msg:${RESET} ${error.message}`);
  } else {
    console.log(`  ${RED}Request setup error:${RESET} ${error.message}`);
  }
  console.log('');
};

api.interceptors.request.use(
  async (config) => {
    if (!hasResolvedInitialBaseUrl) {
      await resolveReachableBaseUrl();
    }

    config.baseURL = BASE_URL;
    config.headers = config.headers || {};

    const token = await AsyncStorage.getItem('jwtToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    logRequest(config);
    return config;
  },
  (error) => {
    logError(error);
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    logResponse(response);
    return response;
  },
  async (error) => {
    if (shouldRetryBackendWarmup(error)) {
      const originalConfig = error.config || {};
      const retryCount = Number(originalConfig._backendWarmupRetryCount || 0);
      const delayMs = BACKEND_WARMUP_RETRY_DELAYS_MS[retryCount];

      originalConfig._backendWarmupRetryCount = retryCount + 1;
      console.log(`[API] Backend is warming up. Retrying ${String(originalConfig.url || '')} in ${delayMs}ms (${retryCount + 1}/${BACKEND_WARMUP_RETRY_DELAYS_MS.length})`);
      await sleep(delayMs);
      return api.request(originalConfig);
    }

    if (shouldRetryWithFreshBaseUrl(error)) {
      const originalConfig = error.config || {};
      const previousBaseUrl = normalizeBaseUrl(originalConfig.baseURL) || BASE_URL;
      const refreshedBaseUrl = await resolveReachableBaseUrl({ force: true });

      if (refreshedBaseUrl && refreshedBaseUrl !== previousBaseUrl) {
        originalConfig._retryWithFreshBaseUrl = true;
        originalConfig.baseURL = refreshedBaseUrl;
        console.log(`[API] Retrying ${String(originalConfig.url || '')} with ${refreshedBaseUrl}`);
        return api.request(originalConfig);
      }
    }

    logError(error);
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  getUsers: () => api.get('/api/auth/users'),
  getDeleteUserPreview: (id) => api.get(`/api/auth/delete-user-preview/${id}`),
  deleteUser: (id) => api.delete(`/api/auth/delete-user/${id}`),
  verifyAdminPassword: (data) => api.post('/api/auth/verify-admin-password', data),
  hardDeleteUser: (id) => api.delete(`/api/auth/hard-delete-user/${id}`),
  getSubAdmins: () => api.get('/api/auth/subadmins'),
  addSubAdmin: (data) => api.post('/api/auth/add-subadmin', data),
  deleteSubAdmin: (id) => api.delete(`/api/auth/delete-subadmin/${id}`),
  updateSubAdmin: (id, data) => api.put(`/api/auth/update-subadmin/${id}`, data),
};

export const vehicleAPI = {
  getAll: () => api.get('/api/vehicles/all'),
  getById: (id) => api.get(`/api/vehicles/${id}`),
  getDeletePreview: (id) => api.get(`/api/vehicles/delete-preview/${id}`),
  delete: (id) => api.delete(`/api/vehicles/delete/${id}`),
  hardDelete: (id) => api.delete(`/api/vehicles/hard-delete/${id}`),
  add: (formData) => api.post('/api/vehicles/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/api/vehicles/update/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const bookingAPI = {
  checkAvailability: (params) => api.get('/api/bookings/check-availability', { params }),
  create: (formData) => api.post('/api/bookings/rent', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/api/bookings/update/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  cancel: (id) => api.delete(`/api/bookings/delete/${id}`),
  myBookings: () => api.get('/api/bookings/my-bookings'),
  getAll: () => api.get('/api/bookings/all'),
  markSlipViewed: (id) => api.post(`/api/bookings/${id}/view-slip`),
  updateStatus: (id, status) => api.put(`/api/bookings/status/${id}`, { status }),
  hardDelete: (id) => api.delete(`/api/bookings/admin-delete/${id}`),
};

export const refundAPI = {
  claim: (bookingId, data) => api.post(`/api/refunds/claim/${bookingId}`, data),
  process: (refundId, formData) => api.post(`/api/refunds/process/${refundId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  markViewed: () => api.post('/api/refunds/mark-viewed'),
  getMy: () => api.get('/api/refunds/my'),
  getPending: () => api.get('/api/refunds/pending'),
  getAll: () => api.get('/api/refunds/all'),
  hardDelete: (id) => api.delete(`/api/refunds/admin-delete/${id}`),
};

export const reviewAPI = {
  create: (formData) => api.post('/api/reviews', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  add: (formData) => api.post('/api/reviews/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getByVehicle: (vehicleId) => api.get(`/api/reviews/vehicle/${vehicleId}`),
  getEligibility: (vehicleId) => api.get(`/api/reviews/eligibility/${vehicleId}`),
  canReview: (vehicleId) => api.get(`/api/reviews/can-review/${vehicleId}`),
  update: (id, formData) => api.put(`/api/reviews/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/api/reviews/${id}`),
  getAll: () => api.get('/api/reviews/all'),
  myReviews: () => api.get('/api/reviews/my'),
  adminList: (params) => api.get('/api/admin/reviews', { params }),
  adminHide: (id) => api.patch(`/api/admin/reviews/${id}/hide`),
  adminShow: (id) => api.patch(`/api/admin/reviews/${id}/show`),
  adminDelete: (id, data) => api.delete(`/api/admin/reviews/${id}`, { data }),
  adminPurge: (id) => api.delete(`/api/reviews/admin-purge/${id}`),
  adminRespond: (id, data) => api.put(`/api/reviews/admin-respond/${id}`, data),
};

export const inquiryAPI = {
  add: (data) => api.post('/api/inquiries/add', data),
  getAll: () => api.get('/api/inquiries/all'),
  updateStatus: (id, status) => api.put(`/api/inquiries/update-status/${id}`, { status }),
  myInquiries: () => api.get('/api/inquiries/my-inquiries'),
  check: (vehicleId) => api.get(`/api/inquiries/check/${vehicleId}`),
  hardDelete: (id) => api.delete(`/api/inquiries/admin-delete/${id}`),
};

export const promotionAPI = {
  add: (formData) => api.post('/api/promotions/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: () => api.get('/api/promotions/all'),
  getActive: () => api.get('/api/promotions/active'),
  showcase: () => api.get('/api/promotions/showcase'),
  updateStatus: (id, status) => api.put(`/api/promotions/status/${id}`, { status }),
  delete: (id) => api.delete(`/api/promotions/${id}`),
  update: (id, formData) => api.put(`/api/promotions/update/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const customerAPI = {
  getProfile: () => api.get('/api/customer/profile'),
  updateProfile: (data, config = undefined) => api.put('/api/customer/update', data, config),
  updateSecurityQuestion: (data) => api.put('/api/customer/security-question', data),
  changePassword: (data) => api.put('/api/customer/change-password', data),
  premiumUpgrade: (data) => api.post('/api/customer/premium-upgrade', data),
  previewDeleteAccount: (data) => api.post('/api/customer/delete-preview', data),
  getNotifications: () => api.get('/api/customer/notifications'),
  markNotificationViewed: (type, entityId) => api.post('/api/customer/notifications/mark-viewed', { type, entityId }),
  addCard: (data) => api.post('/api/customer/add-card', data),
  removeCard: () => api.delete('/api/customer/remove-card'),
  deleteAccount: (data) => api.delete('/api/customer/delete', { data }),
};

export const adminAPI = {
  getStats: () => api.get('/api/admin/stats'),
  getNotifications: () => api.get('/api/admin/notifications'),
  markNotificationViewed: (type, entityId) => api.post('/api/admin/notifications/mark-viewed', { type, entityId }),
};

export const wishlistAPI = {
  toggle: (vehicleId) => api.post(`/api/wishlist/toggle/${vehicleId}`),
  getList: () => api.get('/api/wishlist/my-wishlist'),
  getIds: () => api.get('/api/wishlist/my-wishlist-ids'),
};

export default api;
