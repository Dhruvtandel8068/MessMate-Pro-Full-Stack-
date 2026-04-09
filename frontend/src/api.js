import axios from "axios";
import { getToken, logout } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    // Only logout on 401 (token invalid)
    if (status === 401) {
      logout();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // Always reject so pages can show error message instead of crashing
    return Promise.reject(err);
  }
);

export default api;