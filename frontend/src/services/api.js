import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export const getData = async (url, config = {}) => {
  const res = await api.get(url, config);
  return res.data;
};

export const postData = async (url, data, isFormData = false, config = {}) => {
  const res = await api.post(url, data, {
    ...config,
    headers: {
      ...(config.headers || {}),
      ...(isFormData ? { "Content-Type": "multipart/form-data" } : {}),
    },
  });
  return res.data;
};

export const putData = async (url, data, config = {}) => {
  const res = await api.put(url, data, config);
  return res.data;
};

export const patchData = async (url, data = {}, config = {}) => {
  const res = await api.patch(url, data, config);
  return res.data;
};

export const deleteData = async (url, config = {}) => {
  const res = await api.delete(url, config);
  return res.data;
};

export default api;