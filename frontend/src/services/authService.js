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