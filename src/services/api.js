const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || '';
const DEVICE_TYPE = import.meta.env.VITE_DEVICE_TYPE || 'WEB';

if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn('VITE_API_BASE_URL is not set in .env file');
}

if (!AUTH_BASE_URL && import.meta.env.DEV) {
  console.warn('VITE_AUTH_BASE_URL is not set in .env file');
}

export const getToken = () => localStorage.getItem('auth') || sessionStorage.getItem('auth');

export const setToken = (token, persist = true) => {
  const storage = persist ? localStorage : sessionStorage;
  storage.setItem('auth', token);
};

export const removeToken = () => {
  localStorage.removeItem('auth');
  sessionStorage.removeItem('auth');
  // Also remove legacy authToken if it exists
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
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

const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      // Always set Authorization header if token exists, overriding any existing one
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

// Verify OTP and get authentication token
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
    return await parseJson(response);
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

