// API Client for Smart.pr Helper
// Handles all communication with the proxy API server

// API Configuration
const API_BASE_URL = 'https://smarthelper.replit.app/api';

// Storage helper
const storage = {
  get: (key) =>
    new Promise(resolve =>
      chrome.storage.sync.get([key], result => resolve(result[key]))
    ),
  set: (key, value) =>
    new Promise(resolve =>
      chrome.storage.sync.set({ [key]: value }, resolve)
    )
};

// Error codes and user-friendly messages
const ERROR_MESSAGES = {
  USER_NOT_AUTHORIZED: 'Please enter your Smart.pr email address in the extension settings.',
  INVALID_EMAIL: 'Please enter a valid email address in the extension settings.',
  RATE_LIMIT_EXCEEDED: "You've reached your usage limit. Please try again later.",
  OPENAI_ERROR: 'Our AI service encountered an error. Please try again.',
  SERVER_ERROR: 'Our service is temporarily unavailable. Please try again in a moment.',
  NETWORK_ERROR: 'Connection failed. Please check your internet connection.',
  EXTENSION_CONTEXT_INVALIDATED: 'Extension updated. Refresh the page to continue.',
  INVALID_REQUEST: 'Invalid request. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

/**
 * Make a request to the proxy API
 * @param {string} endpoint - API endpoint (e.g., '/generate-subjects')
 * @param {object} payload - Request payload
 * @returns {Promise<object>} - API response
 */
async function callProxyAPI(endpoint, payload) {
  try {
    // Get user email from storage
    const email = await storage.get('smartpr_user_email');

    if (!email) {
      throw {
        code: 'INVALID_EMAIL',
        message: ERROR_MESSAGES.INVALID_EMAIL
      };
    }

    // Make API request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        ...payload
      })
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Map HTTP status codes to error codes
      if (response.status === 403) {
        throw {
          code: 'USER_NOT_AUTHORIZED',
          message: errorData.message || ERROR_MESSAGES.USER_NOT_AUTHORIZED,
          details: errorData
        };
      } else if (response.status === 429) {
        throw {
          code: 'RATE_LIMIT_EXCEEDED',
          message: errorData.message || ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          retryAfter: errorData.retryAfter,
          limits: errorData.limits,
          details: errorData
        };
      } else if (response.status === 400) {
        throw {
          code: 'INVALID_REQUEST',
          message: errorData.message || ERROR_MESSAGES.INVALID_REQUEST,
          details: errorData
        };
      } else if (response.status >= 500) {
        throw {
          code: 'SERVER_ERROR',
          message: ERROR_MESSAGES.SERVER_ERROR,
          details: errorData
        };
      }

      // Unknown error
      throw {
        code: 'UNKNOWN_ERROR',
        message: ERROR_MESSAGES.UNKNOWN_ERROR,
        details: errorData
      };
    }

    // Parse and return successful response
    const data = await response.json();
    return data;

  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('Extension context invalidated')) {
      throw {
        code: 'EXTENSION_CONTEXT_INVALIDATED',
        message: ERROR_MESSAGES.EXTENSION_CONTEXT_INVALIDATED,
        originalError: error
      };
    }
    // Network errors (fetch failed)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw {
        code: 'NETWORK_ERROR',
        message: ERROR_MESSAGES.NETWORK_ERROR,
        originalError: error
      };
    }

    // Re-throw our custom errors
    if (error.code) {
      throw error;
    }

    // Unexpected errors
    console.error('[API Client] Unexpected error:', error);
    throw {
      code: 'UNKNOWN_ERROR',
      message: ERROR_MESSAGES.UNKNOWN_ERROR,
      originalError: error
    };
  }
}

/**
 * Generate subject line suggestions
 * @param {string} userPrompt - The user's request/description
 * @param {object} context - Additional context
 * @returns {Promise<string[]>} - Array of subject line suggestions
 */
async function generateSubjectLines(userPrompt, context = {}) {
  try {
    const response = await callProxyAPI('/generate-subjects', {
      prompt: userPrompt,
      context: context
    });

    if (!response.success || !response.subjects) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from server'
      };
    }

    return {
      subjects: response.subjects,
      usage: response.usage
    };

  } catch (error) {
    console.error('[API Client] Generate subjects error:', error);
    throw error;
  }
}

/**
 * Get feedback on a subject line
 * @param {string} subjectLine - The subject line to analyze
 * @param {object} context - Optional context (e.g., { keepLanguage: true })
 * @returns {Promise<string>} - Feedback text
 */
async function getSubjectFeedback(subjectLine, context = undefined) {
  try {
    const payload = { subject: subjectLine };
    if (context && Object.keys(context).length) {
      payload.context = context;
    }
    const response = await callProxyAPI('/feedback-subject', payload);

    if (!response.success || !response.feedback) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from server'
      };
    }

    return {
      feedback: response.feedback,
      usage: response.usage
    };

  } catch (error) {
    console.error('[API Client] Get feedback error:', error);
    throw error;
  }
}

/**
 * Validate if user email is authorized
 * @param {string} email - User's email address
 * @returns {Promise<object>} - Validation result with limits
 */
async function validateUser(email) {
  try {
    const response = await fetch(`${API_BASE_URL}/validate-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      throw {
        code: 'USER_NOT_AUTHORIZED',
        message: data.message || ERROR_MESSAGES.USER_NOT_AUTHORIZED
      };
    }

    return data;

  } catch (error) {
    if (error.code) {
      throw error;
    }

    throw {
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
      originalError: error
    };
  }
}

/**
 * Get user-friendly error message from error object
 * @param {object} error - Error object
 * @returns {string} - User-friendly error message
 */
function getErrorMessage(error) {
  if (error && error.message) {
    return error.message;
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Check if email format is valid
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export for use in other scripts
window.SmartPRAPI = {
  generateSubjectLines,
  getSubjectFeedback,
  validateUser,
  getErrorMessage,
  isValidEmail,
  ERROR_MESSAGES
};
