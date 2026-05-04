import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || '';
const DEVICE_TYPE = import.meta.env.VITE_DEVICE_TYPE || 'WEB';
const REFRESH_TOKEN_BASE_URL = import.meta.env.VITE_REFRESH_TOKEN_BASE_URL || import.meta.env.VITE_AUTH_BASE_URL || '';

// Production Environment Placeholders
const PROD_API_BASE_URL = import.meta.env.VITE_PROD_API_BASE_URL || '';
const PROD_REFRESH_TOKEN_BASE_URL = import.meta.env.VITE_PROD_REFRESH_TOKEN_BASE_URL || '';
const HARDCODED_PROD_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMTU4LCJuYW1lIjoiKzkxNzk3OTc1NzkwNSIsIm1vYmlsZSI6Iis5MTc5Nzk3NTc5MDUiLCJpc19zdGFmZiI6dHJ1ZSwiY3VzdG9tZXJfaWQiOjY3OSwiY3VzdG9tZXJfbmFtZSI6IlRJVEFHQVJIIFNURUVMIiwiaXNfZGxtc19hZG1pbiI6dHJ1ZSwiZGxtc190ZW1wbGF0ZXMiOltdLCJleHAiOjE3Nzc2MzExMzd9.emn-yCE4GHdu8CXGRFS8Vtman_bD6Ef-_YIpL7gR1GA';
const HARDCODED_PROD_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMTU4LCJuYW1lIjoiKzkxNzk3OTc1NzkwNSIsIm1vYmlsZSI6Iis5MTc5Nzk3NTc5MDUiLCJjdXN0b21lcl9pZCI6Njc5LCJjdXN0b21lcl9uYW1lIjoiVElUQUdBUkggU1RFRUwiLCJpc19kbG1zX2FkbWluIjp0cnVlLCJkbG1zX3RlbXBsYXRlcyI6W10sImV4cCI6MTc4MDEyMDc1OX0.V5uHE44HY0-Ya26KvVklj6IIzTm8o1fmqQ19n9Yhfs4';

export const getProdToken = () => {
  let token = localStorage.getItem('prod_dlms_auth_token');
  if (!token || token === 'undefined' || token === 'INSERT_PROD_ACCESS_TOKEN_HERE') {
    token = HARDCODED_PROD_ACCESS_TOKEN;
    localStorage.setItem('prod_dlms_auth_token', token);
    localStorage.setItem('prod_refresh_token', HARDCODED_PROD_REFRESH_TOKEN);
  }
  return token;
};

if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn('VITE_API_BASE_URL is not set in .env file');
}

if (!AUTH_BASE_URL && import.meta.env.DEV) {
  console.warn('VITE_AUTH_BASE_URL is not set in .env file');
}

export const getToken = () => localStorage.getItem('dlms_auth_token') || sessionStorage.getItem('dlms_auth_token');

export const setToken = (token, persist = true) => {
  const storage = persist ? localStorage : sessionStorage;
  storage.setItem('dlms_auth_token', token);
};

export const removeToken = () => {
  localStorage.removeItem('dlms_auth_token');
  sessionStorage.removeItem('dlms_auth_token');
  localStorage.removeItem('auth');
  sessionStorage.removeItem('auth');
  localStorage.removeItem('nowpurchase_token');
  sessionStorage.removeItem('nowpurchase_token');
  // Also remove legacy authToken if it exists
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
};

// Store NowPurchase token separately for old API calls
export const getNowPurchaseToken = () => localStorage.getItem('nowpurchase_token') || sessionStorage.getItem('nowpurchase_token');

export const setNowPurchaseToken = (token, persist = true) => {
  const storage = persist ? localStorage : sessionStorage;
  storage.setItem('nowpurchase_token', token);
};

// Validate that both tokens are present for authenticated requests
export const validateAuth = () => {
  const dlmsToken = getToken();
  const nowpurchaseToken = getNowPurchaseToken();
  return !!(dlmsToken && nowpurchaseToken);
};

export const getUserFromToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

// Check if user is fully authenticated with both tokens
export const isAuthenticated = () => {
  return validateAuth();
};

const parseError = async (response) => {
  try {
    const data = await response.json();

    // Handle Django-style validation errors (400 Bad Request)
    // Format: { "field_name": ["error message 1", "error message 2"] }
    // Check if response is a validation error object (has field names as keys with array values)
    const isValidationError = response.status === 400 &&
      typeof data === 'object' &&
      !data.error &&
      Object.keys(data).some(key => Array.isArray(data[key]));

    if (isValidationError) {
      const fieldErrors = {};
      const errorMessages = [];

      // Extract field errors
      Object.keys(data).forEach(field => {
        if (Array.isArray(data[field])) {
          fieldErrors[field] = data[field];
          errorMessages.push(`${field}: ${data[field].join(', ')}`);
        } else if (typeof data[field] === 'string') {
          // Handle single string errors
          fieldErrors[field] = [data[field]];
          errorMessages.push(`${field}: ${data[field]}`);
        }
      });

      return {
        code: 'validation_error',
        message: errorMessages.length > 0 ? errorMessages.join('; ') : 'Validation error occurred',
        details: fieldErrors,
        status: response.status,
      };
    }

    // Handle standard error format
    return {
      code: data.error?.code || (response.status === 400 ? 'validation_error' : 'unknown_error'),
      message: data.error?.message || 'An unexpected error occurred',
      details: data.error?.details || {},
      status: response.status,
    };
  } catch (parseErr) {
    // If JSON parsing fails, return a generic error
    return {
      code: 'parse_error',
      message: `HTTP ${response.status}: ${response.statusText}`,
      details: {},
      status: response.status,
    };
  }
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await parseError(response);
    if (response.status === 401) {
      removeToken();
      if (window.location.pathname !== '/') window.location.href = '/';
    }
    throw error;
  }
  return response;
};

const parseJson = async (response) => {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  return null;
};
const clearAndRedirect = () => {
  localStorage.clear();
  window.location.href = '/';
};
const refreshAccessToken = async (isProd = false) => {
  const refreshKey = isProd ? 'prod_refresh_token' : 'refresh_token';
  const refreshToken = localStorage.getItem(refreshKey);
  if (!refreshToken || refreshToken === 'undefined') {
    if (!isProd) clearAndRedirect();
    return null;
  }
  let res;
  try {
    const baseUrl = isProd ? PROD_REFRESH_TOKEN_BASE_URL : REFRESH_TOKEN_BASE_URL;
    res = await axios.post(
      `${baseUrl}/a/auth/jwt/refresh/`,
      { refresh_token: refreshToken }
    );
  } catch (e) {
    if (e.response?.status === 401) {
      if (!isProd) clearAndRedirect();
      return null;
    }
  }
  if (!res?.data?.access_token) {
    if (!isProd) clearAndRedirect();
    return null;
  }
  const accessKey = isProd ? 'prod_dlms_auth_token' : 'dlms_auth_token';
  localStorage.setItem(accessKey, res.data.access_token);
  
  if (res.data.refresh_token) {
    const refreshKey = isProd ? 'prod_refresh_token' : 'refresh_token';
    localStorage.setItem(refreshKey, res.data.refresh_token);
  }
  
  return res.data.access_token;
};

// --- Refresh Token Synchronization ---
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (error, token) => {
  refreshSubscribers.forEach((cb) => cb(error, token));
  refreshSubscribers = [];
};
// -------------------------------------

const request = async (endpoint, options = {}, _retry = false) => {
  const isProd = options.env === 'prod';
  const baseUrl = isProd ? PROD_API_BASE_URL : API_BASE_URL;
  const url = `${baseUrl}${endpoint}`;
  console.log(`[API Request] isProd: ${isProd}, env option: ${options.env}, URL: ${url}`);

  const token = isProd ? getProdToken() : getToken();
  const nowpurchaseToken = getNowPurchaseToken();

  // Validate both tokens are present for authenticated requests
  if (!isProd && token && !nowpurchaseToken) {
    removeToken();
    if (window.location.pathname !== '/') window.location.href = '/';
    throw {
      code: 'auth_error',
      message: 'Authentication failed: Missing required tokens',
      details: {},
      status: 401,
    };
  }

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      // Always set Authorization header if token exists, overriding any existing one
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  try {
    const response = await fetch(url, config);

    if ((response.status === 401 || response.status === 403) && !_retry) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshAccessToken(isProd)
          .then((newToken) => {
            isRefreshing = false;
            onRefreshed(null, newToken);
          })
          .catch((err) => {
            isRefreshing = false;
            onRefreshed(err, null);
          });
      }

      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((error, newToken) => {
          if (error || !newToken) {
            reject({
              code: 'auth_error',
              message: 'Session expired',
              details: {},
              status: response.status,
            });
          } else {
            resolve(request(endpoint, options, true));
          }
        });
      });
    }

    return await handleResponse(response);

  } catch (error) {
    if (error.code) throw error;
    throw {
      code: 'network_error',
      message: error.message || 'Network request failed',
      details: {},
      status: 0,
    };
  }
};

export const apiGet = async (endpoint, options = {}) => {
  const response = await request(endpoint, { ...options, method: 'GET' });
  return parseJson(response);
};

export const apiGetText = async (endpoint, options = {}) => {
  const response = await request(endpoint, { ...options, method: 'GET' });
  return await response.text();
};

export const apiPost = async (endpoint, data = {}, options = {}) => {
  const response = await request(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseJson(response);
};

export const apiPut = async (endpoint, data = {}, options = {}) => {
  const response = await request(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return parseJson(response);
};

export const apiPatch = async (endpoint, data = {}, options = {}) => {
  const response = await request(endpoint, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return parseJson(response);
};

// Request function for old NowPurchase API (for customer data, etc.)
const requestOldApi = async (endpoint, options = {}) => {
  const url = `${AUTH_BASE_URL}${endpoint}`;
  const token = getNowPurchaseToken(); // Use NowPurchase token for old API

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      // Old API uses Token format
      ...(token && { Authorization: `Token ${token}` }),
    },
  };

  try {
    const response = await fetch(url, config);
    const handledResponse = await handleResponse(response);
    return handledResponse;
  } catch (error) {
    if (error.code) throw error;
    throw {
      code: 'network_error',
      message: error.message || 'Network request failed',
      details: {},
      status: 0,
    };
  }
};

export const apiGetOld = async (endpoint, options = {}) => {
  const response = await requestOldApi(endpoint, { ...options, method: 'GET' });
  return parseJson(response);
};

export const apiGetOldText = async (endpoint, options = {}) => {
  const response = await requestOldApi(endpoint, { ...options, method: 'GET' });
  return await response.text();
};

// Generate or retrieve device ID (consistent per browser)
const getDeviceId = () => {
  const storageKey = 'device_id';
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    // Generate a unique device ID (similar to the example format)
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    deviceId = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
};

// Get Auth base URL for OTP endpoints
// Uses separate VITE_AUTH_BASE_URL environment variable
// Auth endpoints are at domain.com/a/auth/, not under /api/
const getAuthBaseUrl = () => {
  if (!AUTH_BASE_URL) {
    throw new Error('VITE_AUTH_BASE_URL is not configured. Please set it in your .env file (e.g., https://test-api.nowpurchase.com)');
  }

  // Remove trailing slash if present
  return AUTH_BASE_URL.replace(/\/$/, '');
};

// Send OTP to mobile number
export const sendOTP = async (mobile) => {
  const baseUrl = getAuthBaseUrl();
  const url = `${baseUrl}/a/auth/mobile/`;

  const config = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mobile }),
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await parseError(response);
      throw error;
    }
    return await parseJson(response);
  } catch (error) {
    if (error.code) throw error;
    throw {
      code: 'network_error',
      message: error.message || 'Failed to send OTP',
      details: {},
      status: 0,
    };
  }
};

// Verify OTP and get NowPurchase authentication token
export const verifyOTP = async (mobile, token) => {
  const baseUrl = getAuthBaseUrl();
  const url = `${baseUrl}/a/auth/token/`;
  const deviceId = getDeviceId();

  const config = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile,
      token,
      device_type: DEVICE_TYPE,
      device_id: deviceId,
    }),
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await parseError(response);
      throw error;
    }
    let res = await parseJson(response);
    localStorage.setItem('dlms_auth_token', res?.access_token)
    localStorage.setItem('refresh_token', res?.refresh_token)
    return res
  } catch (error) {
    if (error.code) throw error;
    throw {
      code: 'network_error',
      message: error.message || 'Failed to verify OTP',
      details: {},
      status: 0,
    };
  }
};

// Login to DLMS API with NowPurchase token and get JWT token
export const loginWithNowPurchaseToken = async (nowpurchase_token) => {
  const url = `${API_BASE_URL}/api/v1/auth/login`;

  const config = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nowpurchase_token }),
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await parseError(response);
      throw error;
    }
    return await parseJson(response);
  } catch (error) {
    if (error.code) throw error;
    throw {
      code: 'network_error',
      message: error.message || 'Failed to login with NowPurchase token',
      details: {},
      status: 0,
    };
  }
};

