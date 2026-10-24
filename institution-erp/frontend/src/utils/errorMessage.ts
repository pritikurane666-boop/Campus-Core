/**
 * Helper to extract actionable, plain-language error messages for users.
 * Guarantees that raw exception names, database codes, stack traces, and SQL snippets
 * are never shown to the user.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  // Handle Axios / HTTP response errors
  if (typeof error === 'object' && error !== null) {
    const err = error as any;

    // Check for network failure / timeout
    if (
      err.code === 'ERR_NETWORK' ||
      err.message === 'Network Error' ||
      err.code === 'ECONNABORTED' ||
      (!err.response && (err.isAxiosError || err.request))
    ) {
      return 'Unable to reach the server. Please check your internet connection and try again.';
    }

    if (err.response) {
      const status: number = err.response.status;
      const data = err.response.data;

      // Extract raw message from server payload if present
      let rawMsg = '';
      if (typeof data === 'string') {
        rawMsg = data;
      } else if (data && typeof data === 'object') {
        // FluentValidation / ProblemDetails field errors
        if (data.errors && typeof data.errors === 'object') {
          const validationMessages = Object.entries(data.errors)
            .map(([field, msgs]) => {
              const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
              const messageList = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
              return `${fieldName}: ${messageList}`;
            })
            .filter(Boolean);

          if (validationMessages.length > 0) {
            return validationMessages.join(' | ');
          }
        }

        rawMsg = data.message || data.detail || data.title || '';
      }

      // Check for specific HTTP status codes
      if (status === 401) {
        const url = err.config?.url || '';
        if (url.includes('/auth/login')) {
          return 'Invalid email/username or password. Please try again.';
        }
        return 'Your session has expired. Please log in again.';
      }

      if (status === 403) {
        return 'You do not have permission to perform this action.';
      }

      if (status === 423) {
        return rawMsg && isSafeMessage(rawMsg) ? rawMsg : 'Account locked. Please try again later.';
      }

      if (status === 404) {
        if (rawMsg && isSafeMessage(rawMsg)) {
          return rawMsg;
        }
        return 'The requested record or resource could not be found.';
      }

      if (status === 409) {
        if (rawMsg.includes('23505') || /duplicate|already exists/i.test(rawMsg)) {
          return 'A record with this information already exists.';
        }
        if (rawMsg.includes('23503') || /foreign key|used by other|linked/i.test(rawMsg)) {
          return 'This item cannot be deleted because it is being used by other records.';
        }
        if (/concurrency|someone else/i.test(rawMsg)) {
          return 'Someone else changed this record. Please refresh and try again.';
        }
        if (rawMsg && isSafeMessage(rawMsg)) {
          return rawMsg;
        }
        return 'This record conflicts with existing data. Please check and try again.';
      }

      if (status === 413) {
        return 'The uploaded file is too large. Please select a PDF file up to 2 MB.';
      }

      if (status === 429) {
        return 'Too many requests. Please wait a moment and try again.';
      }

      if (status === 502 || status === 503 || status === 504) {
        return 'The server is currently unavailable. Please try again in a moment.';
      }

      if (status >= 500) {
        const traceId = data?.traceId;
        if (traceId) {
          return `Something went wrong on our end. Please try again in a moment. (Reference: ${traceId})`;
        }
        return 'Something went wrong on our end. Please try again in a moment. If the problem continues, contact support.';
      }

      // 400 Bad Request or other client error
      if (rawMsg && isSafeMessage(rawMsg)) {
        return rawMsg;
      }
      return 'The request could not be processed. Please check your inputs and try again.';
    }

    // Fallback if err.message is an Axios generic string like "Request failed with status code 500"
    if (typeof err.message === 'string') {
      const match = err.message.match(/status code (\d+)/i);
      if (match) {
        const statusCode = parseInt(match[1], 10);
        if (statusCode >= 500) {
          return 'Something went wrong on our end. Please try again in a moment. If the problem continues, contact support.';
        }
        if (statusCode === 401) {
          return 'Your session has expired. Please log in again.';
        }
        if (statusCode === 403) {
          return 'You do not have permission to perform this action.';
        }
        if (statusCode === 404) {
          return 'The requested record could not be found.';
        }
        if (statusCode === 409) {
          return 'A record with this information already exists.';
        }
      }

      if (isSafeMessage(err.message)) {
        return err.message;
      }
    }
  }

  // Handle direct string errors
  if (typeof error === 'string') {
    if (isSafeMessage(error)) {
      return error;
    }
  }

  return 'An unexpected error occurred. Please try again. If the problem continues, contact support.';
}

/**
 * Validates that an error message is clean and does not leak technical internals,
 * exception names, SQL syntax, or stack traces.
 */
function isSafeMessage(msg: string): boolean {
  if (!msg || typeof msg !== 'string') return false;

  const technicalKeywords = [
    'Exception',
    'Npgsql',
    'Postgres',
    'SQLSTATE',
    '23505',
    '23503',
    'StackTrace',
    'at System.',
    'at Microsoft.',
    'at Npgsql.',
    'Request failed with status code',
    'NullReference',
    'connection refused',
    'password hash',
    'SELECT ',
    'INSERT INTO',
    'UPDATE ',
    'DELETE FROM',
    'syntax error at or near',
  ];

  return !technicalKeywords.some((keyword) =>
    msg.toLowerCase().includes(keyword.toLowerCase())
  );
}
