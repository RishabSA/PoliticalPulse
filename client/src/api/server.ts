import type { Congressperson, ReportResponse } from "../types";
import api from "./axios";

export const fetchHouseMembers = async (limit = 438): Promise<Congressperson[]> => {
	const { data } = await api.get<Congressperson[]>("/house_rep_members", { params: { limit } });
	return data;
};

export const fetchSenateMembers = async (limit = 100): Promise<Congressperson[]> => {
	const { data } = await api.get<Congressperson[]>("/senate_members", { params: { limit } });
	return data;
};

export const fetchMemberFeedback = async (name: string, limit = 10): Promise<ReportResponse> => {
	const { data } = await api.get<ReportResponse>("/member_feedback", {
		params: { name, limit },
	});
	return data;
};
