import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:5000/api" });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const signup = (data) => API.post("/auth/signup", data);
export const login = (data) => API.post("/auth/login", data);
export const forgotPassword = (email) => API.post("/auth/forgot-password", { email });
export const verifyOTP = (email, code) => API.post("/auth/verify-otp", { email, code });
export const resetPassword = (email, reset_token, new_password) => API.post("/auth/reset-password", { email, reset_token, new_password });
export const changePassword = (current_password, new_password) => API.post("/auth/change-password", { current_password, new_password });
export const resendVerification = () => API.post("/auth/resend-verification");

// Profile
export const getProfile = () => API.get("/profile");
export const updateProfile = (data) => API.put("/profile", data);
export const deleteAccount = () => API.delete("/profile");

// Reports
export const getReports = (params) => API.get("/reports", { params });
export const getReport = (id) => API.get(`/reports/${id}`);
export const createReport = (data) => API.post("/reports", data);
export const updateReport = (id, data) => API.put(`/reports/${id}`, data);
export const deleteReport = (id) => API.delete(`/reports/${id}`);
export const duplicateReport = (id) => API.post(`/reports/${id}/duplicate`);
export const toggleShare = (id) => API.post(`/reports/${id}/share`);
export const exportDocx = (id) => API.get(`/reports/${id}/export-docx`, { responseType: "blob" });
export const getSharedReport = (token) => API.get(`/shared/${token}`);

// Uploads
export const uploadFile = (formData) => API.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const getReportUploads = (reportId) => API.get(`/uploads/report/${reportId}`);
export const deleteUpload = (id) => API.delete(`/uploads/${id}`);

export default API;
