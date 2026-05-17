export interface Congressperson {
	name: string;
	state: string;
	imageUrl: string;
	district: number | null;
}

export interface ReportResponse {
	pulseSentiment: number;
	summary: string;
	positives: string;
	negatives: string;
	improvements: string;
	article_links: string[];
	article_titles: string[];
	article_tsne_xs: number[];
	article_tsne_ys: number[];
	article_pca_xs: number[];
	article_pca_ys: number[];
	article_clusters: number[];
	article_topics: string[];
	article_projected_urls: string[];
}

export interface FeedbackHistoryItem extends ReportResponse {
	name: string;
	state: string;
	imageUrl: string;
	district: number | string;
	congress: string;
}
