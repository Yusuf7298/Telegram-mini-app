const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!apiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

const nodeEnv = (process.env.NEXT_PUBLIC_NODE_ENV ?? 'development').trim();

export const env = {
  API_BASE_URL: apiBaseUrl,
  NODE_ENV: nodeEnv,
} as const;
