import axios from "axios";

// const server_url = "http://localhost:8000";
const server_url = "https://political-pulse-server.onrender.com";

const api = axios.create({
	baseURL: server_url,
});

api.interceptors.response.use(
	res => res,
	err => {
		console.error(
			"[API ERROR]",
			err?.response?.status,
			err?.response?.data || err.message
		);
		return Promise.reject(err);
	}
);

export default api;
