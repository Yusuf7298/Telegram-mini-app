const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() ?? '';

const nodeEnv = (process.env.NEXT_PUBLIC_NODE_ENV ?? 'development').trim();

export const env = {
  API_BASE_URL: apiBaseUrl,
  FRONTEND_URL: frontendUrl,
  NODE_ENV: nodeEnv,
} as const;
