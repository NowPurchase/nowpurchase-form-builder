/**
 * API Interceptor - Redirects production API URLs to staging/test URLs
 *
 * Mappings:
 * - api.nowpurchase.com → test-api.nowpurchase.com
 * - dlms-api.iotnp.com → dlms-api-stage.iotnp.com
 */

const URL_MAPPINGS = [
  { from: 'api.nowpurchase.com', to: 'test-api.nowpurchase.com' },
  { from: 'dlms-api.iotnp.com', to: 'dlms-api-stage.iotnp.com' },
];

/**
 * Rewrite URL if it matches any mapping
 * Skips if URL already contains the target domain (prevents double-redirect)
 */
const rewriteUrl = (url) => {
  if (!url) return url;

  let newUrl = typeof url === 'string' ? url : url.toString();

  for (const mapping of URL_MAPPINGS) {
    // Skip if already using the target URL
    if (newUrl.includes(mapping.to)) {
      return newUrl;
    }
    if (newUrl.includes(mapping.from)) {
      newUrl = newUrl.replace(mapping.from, mapping.to);
      console.log(`[API Interceptor] Redirected: ${mapping.from} → ${mapping.to}`);
      break;
    }
  }

  return newUrl;
};

/**
 * Install fetch interceptor
 */
const installFetchInterceptor = () => {
  const originalFetch = window.fetch;

  window.fetch = function(input, init) {
    // Handle Request object
    if (input instanceof Request) {
      const newUrl = rewriteUrl(input.url);
      if (newUrl !== input.url) {
        input = new Request(newUrl, input);
      }
    }
    // Handle string URL
    else if (typeof input === 'string') {
      input = rewriteUrl(input);
    }
    // Handle URL object
    else if (input instanceof URL) {
      input = new URL(rewriteUrl(input.toString()));
    }

    return originalFetch.call(this, input, init);
  };

  console.log('[API Interceptor] Fetch interceptor installed');
};

/**
 * Install XMLHttpRequest interceptor
 */
const installXHRInterceptor = () => {
  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    const newUrl = rewriteUrl(url);
    return originalOpen.call(this, method, newUrl, ...rest);
  };

  console.log('[API Interceptor] XHR interceptor installed');
};

/**
 * Install axios interceptor
 */
const installAxiosInterceptor = (axios) => {
  if (!axios) return;

  axios.interceptors.request.use((config) => {
    if (config.url) {
      config.url = rewriteUrl(config.url);
    }
    if (config.baseURL) {
      config.baseURL = rewriteUrl(config.baseURL);
    }
    return config;
  });

  console.log('[API Interceptor] Axios interceptor installed');
};

/**
 * Install all interceptors
 */
export const installApiInterceptors = (axios = null) => {
  installFetchInterceptor();
  installXHRInterceptor();
  if (axios) {
    installAxiosInterceptor(axios);
  }
  console.log('[API Interceptor] All interceptors installed');
  console.log('[API Interceptor] URL Mappings:', URL_MAPPINGS);
};

export default installApiInterceptors;
