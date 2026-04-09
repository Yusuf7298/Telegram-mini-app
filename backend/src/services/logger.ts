export async function logJackpotSkip(details: object) {
  setImmediate(() => {
    // Replace with your logger or external service
    console.warn('[JackpotSkip]', JSON.stringify(details));
  });
}

export async function logError(error: Error, context?: object) {
  setImmediate(() => {
    console.error('[Error]', error.message, context ? JSON.stringify(context) : '');
  });
}
