const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn('VITE_API_BASE_URL is not set in .env file');
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

export const apiDelete = async (endpoint, options = {}) => {
  const response = await request(endpoint, { ...options, method: 'DELETE' });
  return parseJson(response);
};

// Login function without authentication token
export const apiLogin = async (mobile, password) => {
  const url = `${API_BASE_URL}/mobile_pass_login/`;
  
  const config = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mobile, password }),
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
      message: error.message || 'Network request failed',
      details: {},
      status: 0,
    };
  }
};
