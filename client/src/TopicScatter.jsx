import React, { useMemo, useState } from "react";
import {
	Cell,
	Legend,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

const PALETTE = [
	"#1f77b4",
	"#ff7f0e",
	"#2ca02c",
	"#d62728",
	"#9467bd",
	"#8c564b",
	"#e377c2",
	"#7f7f7f",
	"#bcbd22",
	"#17becf",
];

const TopicTooltip = ({ active, payload }) => {
	if (!active || !payload || !payload.length) return null;
	const p = payload[0].payload;

	return (
		<div className="space-y-2 bg-white/95 dark:bg-neutral-800 rounded-lg p-4 text-sm z-5 shadow-md border-1 border-neutral-200 dark:border-neutral-600">
			<div className="font-bold text-neutral-800 dark:text-neutral-200">
				{p.title}
			</div>
			<div className="text-sm opacity-80 text-neutral-800 dark:text-neutral-200">
				<strong>Main Topic(s):</strong> {p.topic}
			</div>
			<a
				href={p.url}
				target="_blank"
				rel="noopener noreferrer"
				className="text-neutral-800 dark:text-neutral-200 font-bold">
				Click the point to open the article
			</a>
		</div>
	);
};

const convertDataToPoints = (data, model) => {
	const points = [];
	for (let i = 0; i < data.article_titles.length; i++) {
		let x, y;
		if (model === "t-SNE") {
			x = Number(data.article_tsne_xs[i]);
			y = Number(data.article_tsne_ys[i]);
		} else if (model === "PCA") {
			x = Number(data.article_pca_xs[i]);
			y = Number(data.article_pca_ys[i]);
		}

		points.push({
			x,
			y,
			title: data.article_titles[i],
			url: data.article_projected_urls[i],
			cluster: Number(data.article_clusters[i]),
			topic: data.article_topics[i],
		});
	}

	return points;
};

export default function TopicScatter({ data }) {
	const [clusterDropdownOpen, setClusterDropdownOpen] = useState(false);
	const [chosenClusteringModel, setChosenClusteringModel] = useState("t-SNE"); // or "PCA"

	const points = useMemo(
		() => convertDataToPoints(data, chosenClusteringModel),
		[data, chosenClusteringModel]
	);

	// Group by cluster for colored series and legend
	const groups = useMemo(() => {
		const map = new Map();

		for (const p of points) {
			const k = Number(p.cluster);
			if (!map.has(k)) map.set(k, []);

			map.get(k).push(p);
		}

		return [...map.entries()].sort((a, b) => a[0] - b[0]);
	}, [points]);

	const clusterLabels = useMemo(() => {
		const m = new Map();

		for (const p of points) {
			if (!m.has(p.cluster)) {
				m.set(p.cluster, p.topic);
			}
		}

		return m;
	}, [points]);

	const handlePointClick = e => {
		if (e.url) window.open(e.url, "_blank", "noopener, noreferrer");
	};

	return (
		<div className="text-center" style={{ width: "100%", height: 500 }}>
			<div className="relative inline-block">
				<button
					onClick={() => setClusterDropdownOpen(o => !o)}
					className="font-semibold cursor-pointer text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-sm px-5 py-2.5 inline-flex items-center">
					{chosenClusteringModel === "t-SNE"
						? "Cluster View 1 (t-SNE)"
						: "Cluster View 2 (PCA)"}
				</button>

				{clusterDropdownOpen && (
					<div className="absolute left-0 top-full z-50 bg-white shadow-md dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 w-max">
						<ul className="py-2 text-sm text-neutral-600 dark:text-neutral-400">
							<li>
								<button
									onClick={() => {
										setChosenClusteringModel("t-SNE");
										setClusterDropdownOpen(false);
									}}
									className="font-semibold cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700">
									Cluster View 1 (t-SNE)
								</button>
							</li>
							<li>
								<button
									onClick={() => {
										setChosenClusteringModel("PCA");
										setClusterDropdownOpen(false);
									}}
									className="font-semibold cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700">
									Cluster View 2 (PCA)
								</button>
							</li>
						</ul>
					</div>
				)}
			</div>
			<ResponsiveContainer>
				<ScatterChart>
					<XAxis type="number" dataKey="x" tick={false} />
					<YAxis type="number" dataKey="y" tick={false} />

					<Tooltip content={<TopicTooltip />} />

					<Legend
						payload={groups.map(([c]) => ({
							id: String(c),
							type: "circle",
							value: `${c}: ${clusterLabels.get(c)}`,
							color: PALETTE[c % PALETTE.length],
						}))}
						wrapperStyle={{ fontSize: 12 }}
						verticalAlign="bottom"
						align="center"
					/>
					<Scatter
						data={points}
						shape="circle"
						cursor="pointer"
						legendType="none"
						onClick={e => handlePointClick(e.payload)}>
						{points.map((p, i) => (
							<Cell key={i} fill={PALETTE[p.cluster % PALETTE.length]} />
						))}
					</Scatter>
					{groups.map(([c, pts]) => (
						<Scatter
							key={c}
							data={pts}
							name={pts[0].topic}
							fill={PALETTE[c % PALETTE.length]}
							legendType="circle" // show a circle in the legend
							shape={() => null} // Don't render anythning (only use this for the legend as a workaround)
							isAnimationActive={false}
						/>
					))}
				</ScatterChart>
			</ResponsiveContainer>
		</div>
	);
}
