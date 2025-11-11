export const formatErrorMessage = (error) => {
  if (!error) {
    return 'An unexpected error occurred';
  }

  // If error is a string, return it directly
  if (typeof error === 'string') {
    return error;
  }

  // If error has a message property, use it
  if (error.message) {
    return error.message;
  }

  // If error has code, provide context-specific messages
  if (error.code) {
    const errorMessages = {
      validation_error: error.details && Object.keys(error.details).length > 0
        ? formatValidationErrors(error.details)
        : 'Please check your input and try again',
      authentication_failed: 'Your session has expired. Please login again.',
      not_found: 'The requested resource was not found',
      forbidden: 'You do not have permission to perform this action',
      internal_error: 'A server error occurred. Please try again later',
      network_error: 'Network error. Please check your connection',
      parse_error: 'Failed to process server response',
      unknown_error: 'An unexpected error occurred',
    };

    return errorMessages[error.code] || error.message || 'An error occurred';
  }

  return 'An unexpected error occurred';
};

// Format validation errors from details object
const formatValidationErrors = (details) => {
  if (!details || typeof details !== 'object') {
    return 'Validation error occurred';
  }

  const messages = [];
  Object.keys(details).forEach(field => {
    if (Array.isArray(details[field])) {
      details[field].forEach(msg => {
        // Capitalize field name and add error message
        const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        messages.push(`${fieldName}: ${msg}`);
      });
    } else if (typeof details[field] === 'string') {
      const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      messages.push(`${fieldName}: ${details[field]}`);
    }
  });

  return messages.length > 0 ? messages.join('. ') : 'Validation error occurred';
};

export const getFieldErrors = (error) => {
  if (!error || !error.details) {
    return {};
  }

  return error.details;
};

export const isValidationError = (error) => {
  return error?.code === 'validation_error' || error?.status === 400;
};

export const isAuthenticationError = (error) => {
  return error?.code === 'authentication_failed' || error?.status === 401;
};

export const isNetworkError = (error) => {
  return error?.code === 'network_error' || error?.status === 0;
};

export const logError = (error, context = '') => {
  if (import.meta.env.DEV) {
    console.error(`[Error${context ? ` in ${context}` : ''}]:`, error);
  }
};

