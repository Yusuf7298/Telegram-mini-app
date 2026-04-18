import axios, { AxiosError } from "axios";
import { env } from "./env";
import { emitToast } from "./toast";

const DEVICE_ID_STORAGE_KEY = "boxplay_device_id";

function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing && existing.trim()) return existing;

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    const generated = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  }

  return null;
}

function resolveApiBaseUrl(): string {
  const apiBaseUrl = env.API_BASE_URL?.trim();

  if (apiBaseUrl) {
    if (env.NODE_ENV === "production" && !apiBaseUrl.toLowerCase().startsWith("https://")) {
      return "https://localhost:5000/api";
    }

    return apiBaseUrl.replace(/\/$/, "");
  }

  return "https://localhost:5000/api";
}

type BackendErrorPayload = {
  success?: boolean;
  error?: string | { message?: string; code?: string };
  message?: string;
};
function mapApiErrorMessage(status?: number): string {
  if (status === 429) return "Too fast, wait";
  if (status === 409) return "Duplicate request";
  if (status === 500) return "Try again";
  if (status === 401) return "Unauthorized";
  return "Something went wrong";
}
const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("boxplay_token");
    const deviceId = getOrCreateDeviceId();

    config.headers = config.headers ?? {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (deviceId) {
      config.headers["X-Device-Id"] = deviceId;
    }
  }
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<BackendErrorPayload>) => {
    const status = error.response?.status;
    const message = mapApiErrorMessage(status);
    const endpoint = error.config?.url || "unknown-endpoint";
    console.error(`[API ERROR] ${endpoint}: ${message}`);

    emitToast({
      type: "error",
      message,
    });

    if (typeof window !== "undefined") {
      if (status === 401) {
        window.location.href = "/login";
      }
    }

    return Promise.reject({
      status,
      endpoint,
      message,
    });
  }
);
export default apiClient;
