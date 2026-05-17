import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { LayerProps, MapLayerMouseEvent, MapRef } from "react-map-gl/maplibre";
import { Layer, Map, Source } from "react-map-gl/maplibre";
import type { Congressperson } from "./types";

const fipsToState: Record<string, string> = {
	"01": "Alabama",
	"02": "Alaska",
	"04": "Arizona",
	"05": "Arkansas",
	"06": "California",
	"08": "Colorado",
	"09": "Connecticut",
	"10": "Delaware",
	"11": "District of Columbia",
	"12": "Florida",
	"13": "Georgia",
	"15": "Hawaii",
	"16": "Idaho",
	"17": "Illinois",
	"18": "Indiana",
	"19": "Iowa",
	"20": "Kansas",
	"21": "Kentucky",
	"22": "Louisiana",
	"23": "Maine",
	"24": "Maryland",
	"25": "Massachusetts",
	"26": "Michigan",
	"27": "Minnesota",
	"28": "Mississippi",
	"29": "Missouri",
	"30": "Montana",
	"31": "Nebraska",
	"32": "Nevada",
	"33": "New Hampshire",
	"34": "New Jersey",
	"35": "New Mexico",
	"36": "New York",
	"37": "North Carolina",
	"38": "North Dakota",
	"39": "Ohio",
	"40": "Oklahoma",
	"41": "Oregon",
	"42": "Pennsylvania",
	"44": "Rhode Island",
	"45": "South Carolina",
	"46": "South Dakota",
	"47": "Tennessee",
	"48": "Texas",
	"49": "Utah",
	"50": "Vermont",
	"51": "Virginia",
	"53": "Washington",
	"54": "West Virginia",
	"55": "Wisconsin",
	"56": "Wyoming",
	"60": "American Samoa",
	"66": "Guam",
	"69": "Northern Mariana Islands",
	"72": "Puerto Rico",
	"78": "U.S. Virgin Islands",
};

const stateOutlineLayer: LayerProps = {
	id: "state-outline",
	type: "line",
	paint: {
		"line-color": "#111111",
		"line-width": 1.25,
	},
};

const lineLayer: LayerProps = {
	id: "cd-line",
	type: "line",
	source: "cd",
	paint: {
		"line-color": "#272829",
		"line-width": 0.5,
	},
};

const houseLabelLayer: LayerProps = {
	id: "cd-labels",
	type: "symbol",
	source: "cd",
	layout: {
		"text-field": [
			"coalesce",
			["get", "CD119FP"],
			["get", "CD118FP"],
			["get", "DISTRICT"],
			["get", "CD"],
			["get", "CDSESSN"],
			["slice", ["get", "NAMELSAD"], ["-", ["length", ["get", "NAMELSAD"]], 2]],
		],
		"text-size": 12,
		"text-allow-overlap": false,
		"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
		"symbol-placement": "point",
	},
	paint: {
		"text-color": "#111111",
	},
};

const senateLabelLayer: LayerProps = {
	id: "state-labels",
	type: "symbol",
	source: "states",
	layout: {
		"text-field": [
			"coalesce",
			["get", "STUSPS"],
			["get", "NAME"],
			["get", "NAMELSAD"],
		],
		"text-size": 12,
		"text-allow-overlap": false,
		"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
		"symbol-placement": "point",
	},
	paint: {
		"text-color": "#111111",
	},
};

// Uses deprecated maplibre "interval" stop syntax — cast to bypass strict type check
const dataLayer = {
	id: "data",
	type: "fill",
	source: "cd",
	paint: {
		"fill-color": {
			type: "interval",
			property: "bucket",
			stops: [
				[0, "#3288bd"],
				[1, "#66c2a5"],
				[2, "#abdda4"],
				[3, "#e6f598"],
				[4, "#ffffbf"],
				[5, "#fee08b"],
				[6, "#fdae61"],
				[7, "#f46d43"],
				[8, "#d53e4f"],
				[9, "#9ecae1"],
				[10, "#c7e9b4"],
				[11, "#fff7bc"],
				[12, "#fdb863"],
				[13, "#e34a33"],
			],
		},
		"fill-opacity": 0.5,
	},
} as unknown as LayerProps;

type HoverInfo =
	| { kind: "house"; x: number; y: number; state: string; district: string; rep: string }
	| { kind: "senate"; x: number; y: number; state: string; senators: string[] };

interface InteractiveMapProps {
	houseMembers: Congressperson[];
	senateMembers: Congressperson[];
	setCongressperson: (member: Congressperson | null) => void;
	setPossibleSenators: (senators: Congressperson[]) => void;
	setIsChooseSenatorModalOpen: (open: boolean) => void;
	congress: string;
}

export default function InteractiveMap({
	houseMembers,
	senateMembers,
	setCongressperson,
	setPossibleSenators,
	setIsChooseSenatorModalOpen,
	congress,
}: InteractiveMapProps) {
	const mapRef = useRef<MapRef | null>(null);
	const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
	const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
	const [statesGeo, setStatesGeo] = useState<FeatureCollection | null>(null);

	useEffect(() => {
		(async () => {
			const response = await fetch("/data/us_state.geojson");
			const states_gj = await response.json() as FeatureCollection;
			setStatesGeo(states_gj);
		})();
	}, []);

	useEffect(() => {
		(async () => {
			const geojson_path =
				congress === "House of Representatives"
					? "/data/us_cd_119.geojson"
					: "/data/us_state.geojson";

			const response = await fetch(geojson_path);
			const gj = await response.json() as FeatureCollection;

			for (const f of gj.features) {
				const geoid = Number(String(f.properties?.GEOID ?? f.id));
				const bucket = Number.isFinite(geoid)
					? geoid % 14
					: Math.floor(Math.random() * 14);
				f.properties = { ...f.properties, bucket };
			}

			setGeojson(gj);
		})();
	}, [congress]);

	useEffect(() => {
		const map = mapRef.current?.getMap?.();
		if (!map) return;
		map.once("load", () => {
			map.fitBounds(
				[
					[-125.001, 24.949],
					[-66.933, 49.591],
				],
				{ padding: 40, duration: 0 }
			);
		});
	}, []);

	const onHover = (e: MapLayerMouseEvent) => {
		const f = e.features?.[0];
		if (!f || !f.properties) {
			setHoverInfo(null);
			return;
		}

		const state = fipsToState[String(f.properties.STATEFP)];

		if (congress === "House of Representatives") {
			const district = String(f.properties.NAMELSAD ?? "").replace(
				"Congressional District",
				""
			);
			let rep: Congressperson | undefined;
			if (district === " (at Large)") {
				rep = houseMembers.find(member => member.state === state);
			} else {
				rep = houseMembers.find(
					member =>
						member.district === parseInt(district) && member.state === state
				);
			}

			setHoverInfo({
				kind: "house",
				x: e.point.x,
				y: e.point.y,
				state,
				district,
				rep: rep ? rep.name : "Not found",
			});
		} else {
			const senators = senateMembers
				.filter(member => member.state === state)
				.map(senator => senator.name);

			setHoverInfo({
				kind: "senate",
				x: e.point.x,
				y: e.point.y,
				state,
				senators,
			});
		}
	};

	const onChoose = (e: MapLayerMouseEvent) => {
		const f = e.features?.[0];
		if (!f || !f.properties) {
			setHoverInfo(null);
			return;
		}

		const state = fipsToState[String(f.properties.STATEFP)];

		if (congress === "House of Representatives") {
			const district = String(f.properties.NAMELSAD ?? "").replace(
				"Congressional District",
				""
			);

			let rep: Congressperson | undefined;
			if (district === " (at Large)") {
				rep = houseMembers.find(member => member.state === state);
			} else {
				rep = houseMembers.find(
					member =>
						member.district === parseInt(district) && member.state === state
				);
			}

			setCongressperson(rep ?? null);
		} else {
			const senators = senateMembers.filter(member => member.state === state);

			setPossibleSenators(senators);
			setIsChooseSenatorModalOpen(true);
		}
	};

	return (
		<div
			style={{ width: "100%", height: "100%" }}
			className="relative border-neutral-200 dark:border-neutral-800 border-2 rounded-xl"
			onMouseLeave={() => setHoverInfo(null)}>
			<Map
				ref={mapRef}
				initialViewState={{ longitude: -98.5, latitude: 39.8, zoom: 3 }}
				style={{ width: "100%", height: "100%" }}
				mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
				interactiveLayerIds={["data"]}
				onMouseMove={onHover}
				onMouseLeave={() => setHoverInfo(null)}
				onClick={onChoose}>
				{geojson && (
					<Source type="geojson" data={geojson} promoteId="GEOID">
						<Layer {...dataLayer} />
						<Layer {...lineLayer} />
						{congress === "House of Representatives" ? (
							<Layer key="labels-house" {...houseLabelLayer} />
						) : (
							<Layer key="labels-senate" {...senateLabelLayer} />
						)}
					</Source>
				)}

				{statesGeo && (
					<Source id="states-outline" type="geojson" data={statesGeo}>
						<Layer {...stateOutlineLayer} />
					</Source>
				)}
			</Map>

			{hoverInfo && (
				<div
					className="absolute bg-white/95 rounded-lg p-4 text-xs z-5 pointer-events-none shadow-md border-1 border-neutral-200"
					style={{
						left: hoverInfo.x + 10,
						top: hoverInfo.y + 10,
					}}>
					{hoverInfo.kind === "house" ? (
						<>
							<div className="font-bold text-md text-neutral-900">
								{hoverInfo.state} - District {hoverInfo.district}
							</div>
							<div className="mt-2 text-neutral-600">Rep. {hoverInfo.rep}</div>
						</>
					) : (
						<>
							<div className="font-bold text-md text-neutral-900">
								{hoverInfo.state}
							</div>
							<ul className="flex flex-col mt-4 space-y-1 text-neutral-600">
								{hoverInfo.senators.map(senator => (
									<li key={senator}>Senator {senator}</li>
								))}
							</ul>
						</>
					)}
				</div>
			)}
		</div>
	);
}
