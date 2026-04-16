import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000/api/auth",
});

export async function loginUser(data) {
  const response = await API.post("/login", data);
  return response.data;
}

export async function registerUser(data) {
  const response = await API.post("/register", data);
  return response.data;
}

export async function googleLogin(data) {
  const response = await API.post("/google-login", data);
  return response.data;
}

export async function sendPhoneOtp(data) {
  const response = await API.post("/phone/send-otp", data);
  return response.data;
}

export async function verifyPhoneOtp(data) {
  const response = await API.post("/phone/verify-otp", data);
  return response.data;
}