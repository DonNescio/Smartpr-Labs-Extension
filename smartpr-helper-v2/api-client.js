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
async function callProxyAPI(endpoint, payload, options = {}) {
  try {
    // Get user email from storage
    const email = await storage.get('smartpr_user_email');

    if (!email) {
      throw {
        code: 'INVALID_EMAIL',
        message: ERROR_MESSAGES.INVALID_EMAIL
      };
    }

    // Make API request with 30s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          ...payload
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

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
    // Timeout errors (AbortController)
    if (error.name === 'AbortError') {
      throw {
        code: 'NETWORK_ERROR',
        message: ERROR_MESSAGES.NETWORK_ERROR,
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

/**
 * Process paragraph text (grammar, rephrase, synonyms, translate, shorten)
 * @param {string} text - The text to process
 * @param {string} action - The action: 'grammar', 'rephrase', 'synonyms', 'translate', 'shorter'
 * @param {object} options - Additional options (e.g., { targetLanguage: 'Dutch' } for translate)
 * @returns {Promise<object>} - Processed text result
 */
async function processParagraph(text, action, options = {}) {
  try {
    const response = await callProxyAPI('/process-paragraph', {
      text: text,
      action: action,
      options: options
    });

    if (!response.success || !response.text) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from server'
      };
    }

    return {
      text: response.text,
      synonyms: response.synonyms || null,
      rephraseOptions: response.rephraseOptions || null,
      changes: response.changes || null,
      usage: response.usage
    };

  } catch (error) {
    console.error('[API Client] Process paragraph error:', error);
    throw error;
  }
}

/**
 * Submit user feedback
 * @param {string} feedback - The feedback text
 * @returns {Promise<object>} - Response from server
 */
async function submitFeedback(feedback) {
  try {
    const response = await callProxyAPI('/submit-feedback', {
      feedback: feedback
    });
    return response;
  } catch (error) {
    console.error('[API Client] Submit feedback error:', error);
    throw error;
  }
}

/**
 * Ask a question to the Knowledge Base
 * @param {string} question - The user's question
 * @param {string|null} conversationId - OpenAI conversation ID for follow-ups
 * @returns {Promise<object>} - { answer, conversationId, citations }
 */
async function askKnowledgeBase(question, conversationId = null) {
  try {
    const payload = { question };
    if (conversationId) payload.conversation_id = conversationId;
    const response = await callProxyAPI('/ask-kb', payload, { timeout: 45000 });

    if (!response.success || !response.answer) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from server'
      };
    }

    return {
      answer: response.answer,
      conversationId: response.conversation_id || null,
      citations: response.citations || []
    };

  } catch (error) {
    console.error('[API Client] Knowledge base error:', error);
    throw error;
  }
}

/**
 * Summarize full mailing content in a chosen format
 * @param {string} subject - The mailing subject line
 * @param {string} body - The full mailing body text
 * @param {string} format - One of: 'oneliner', 'pitch', 'executive', 'bullets'
 * @param {object} options - Additional options
 * @returns {Promise<object>} - { summary, usage }
 */
async function summarizeMailing(subject, body, format, options = {}) {
  try {
    const response = await callProxyAPI('/summarize', {
      subject,
      body,
      format,
      options
    }, { timeout: 45000 });

    if (!response.success || !response.summary) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from server'
      };
    }

    return {
      summary: response.summary,
      usage: response.usage
    };

  } catch (error) {
    console.error('[API Client] Summarize mailing error:', error);
    throw error;
  }
}

// Export for use in other scripts
window.SmartPRAPI = {
  generateSubjectLines,
  getSubjectFeedback,
  processParagraph,
  submitFeedback,
  askKnowledgeBase,
  summarizeMailing,
  validateUser,
  getErrorMessage,
  isValidEmail,
  ERROR_MESSAGES
};
