import axios from 'axios';
const defaultBaseURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5001/api';
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || defaultBaseURL,
});
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('quizpulse_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
export default api;
