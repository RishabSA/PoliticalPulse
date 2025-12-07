import api from "./axios";

// GET /house_rep_members?limit=438
export const fetchHouseMembers = async (limit = 438) => {
	const { data } = await api.get("/house_rep_members", { params: { limit } });
	return data; // list[Congressperson]
};

// GET /senate_members?limit=100
export const fetchSenateMembers = async (limit = 100) => {
	const { data } = await api.get("/senate_members", { params: { limit } });
	return data; // list[Congressperson]
};

// GET /member_feedback?name=...&limit=...
export const fetchMemberFeedback = async (name, limit = 10) => {
	const { data } = await api.get("/member_feedback", {
		params: { name, limit },
	});
	return data; // ReportResponse
};
