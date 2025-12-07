import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	AlertCircle,
	ArrowRight,
	BarChart2,
	ChevronDown,
	Download,
	GitHub,
	Globe,
	Info,
	Linkedin,
	Menu,
	Monitor,
	Moon,
	Search,
	Sun,
	Trash,
	X,
} from "react-feather";
import Markdown from "react-markdown";
import { Bounce, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
	fetchHouseMembers,
	fetchMemberFeedback,
	fetchSenateMembers,
} from "./api/server";
import InteractiveMap from "./Map";
import TextCarousel from "./TextCarousel";
import TopicScatter from "./TopicScatter";

function App() {
	const [theme, setTheme] = useState(() => {
		return localStorage.getItem("theme") || "Light";
	});
	const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
	const [sourceLimit, setSourceLimit] = useState(25);
	const [sourceLimitDropdownOpen, setSourceLimitDropdownOpen] = useState(false);
	const [congresspersonDropdownOpen, setCongresspersonDropdownOpen] =
		useState(false);
	const [dropdownSearch, setDropdownSearch] = useState("");
	const [congressperson, setCongressperson] = useState(null);
	const [possibleSenators, setPossibleSenators] = useState(null);
	const [houseMembers, setHouseMembers] = useState([]);
	const [senateMembers, setSenateMembers] = useState([]);
	const [feedback, setFeedback] = useState(null);
	const [loading, setLoading] = useState(false);
	const [feedbackLoading, setFeedbackLoading] = useState(false);
	const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
	const [isClustersModalOpen, setIsClustersModalOpen] = useState(false);
	const [isClearModalOpen, setIsClearModalOpen] = useState(false);
	const [isChooseSenatorModalOpen, setIsChooseSenatorModalOpen] =
		useState(false);
	const [feedbackHistory, setFeedbackHistory] = useState([]);
	const [feedbackHistoryIndexToDelete, setFeedbackHistoryIndexToDelete] =
		useState(0);
	const [openHistory, setOpenHistory] = useState(false);
	const [congressDropdownOpen, setCongressDropdownOpen] = useState(false);
	const [congress, setCongress] = useState("House of Representatives");

	const targetRef = useRef(null);

	const normalizeSearch = searchText =>
		(searchText ?? "").toString().toLowerCase().trim();

	const filteredMembers = useMemo(() => {
		const membersToFilter =
			congress === "House of Representatives" ? houseMembers : senateMembers;

		const normalizedSearchQuery = normalizeSearch(dropdownSearch);
		if (!normalizedSearchQuery) return membersToFilter;

		return membersToFilter.filter(member => {
			const name = normalizeSearch(member.name);
			const state = normalizeSearch(member.state);
			const district = (member.district ?? "").toString();

			// Match against name, state, district number, or padded district number
			return (
				name.includes(normalizedSearchQuery) ||
				state.includes(normalizedSearchQuery) ||
				district === normalizedSearchQuery ||
				district.padStart(2, "0") === normalizedSearchQuery
			);
		});
	}, [houseMembers, senateMembers, congress, dropdownSearch]);

	const loadAPIData = async () => {
		try {
			setLoading(true);

			const [houseResponse, senateResponse] = await Promise.all([
				fetchHouseMembers(438),
				fetchSenateMembers(100),
			]);

			setHouseMembers(houseResponse);
			setSenateMembers(senateResponse);
		} catch (e) {
			console.error(`Loading House and Senate members from API failed: ${e}`);
			toast.error("Something went wrong. Please try again later.");
		} finally {
			setLoading(false);
		}
	};

	const loadFeedbackHistory = () => {
		try {
			const raw = localStorage.getItem("feedback_history");
			return raw ? JSON.parse(raw) : [];
		} catch (e) {
			console.error(
				`An unexpected error occurred while loading past reports: ${e}`
			);
			toast.error("An unexpected error occurred while loading past reports.");

			// If the localStorage is corrupted, reset it
			localStorage.removeItem("feedback_history");
			return [];
		}
	};

	const saveNewFeedbackHistory = entry => {
		const history = feedbackHistory;
		history.unshift(entry); // Add to the start

		localStorage.setItem("feedback_history", JSON.stringify(history));
		setFeedbackHistory(history);
	};

	const deleteFeedbackHistoryItem = index => {
		const history = [
			...feedbackHistory.slice(0, index),
			...feedbackHistory.slice(index + 1),
		];

		localStorage.setItem("feedback_history", JSON.stringify(history));
		setFeedbackHistory(history);

		setFeedback(null);
		setCongressperson(null);
	};

	const analyzeCongressperson = async () => {
		try {
			setFeedbackLoading(true);
			setFeedback(null);

			const congressPersonCongress = congress;

			const name =
				congressPersonCongress === "House of Representatives"
					? "Rep. " + congressperson.name
					: "Senator " + congressperson.name;

			console.log(name);

			const feedbackData = await fetchMemberFeedback(name, sourceLimit);
			console.log(feedbackData);
			setFeedback(feedbackData);

			const feedbackDataWithId = {
				...feedbackData,
				name: congressperson.name,
				state: congressperson.state,
				imageUrl: congressperson.imageUrl,
				district: congressperson.district ?? "(at Large)",
				congress: congressPersonCongress,
			};

			saveNewFeedbackHistory(feedbackDataWithId);
		} catch (e) {
			console.error(`Obtaining feedback for ${congressperson} failed: ${e}`);
			toast.error("Something went wrong. Please try again later.");
		} finally {
			setFeedbackLoading(false);
		}
	};

	useEffect(() => {
		setFeedbackHistory(loadFeedbackHistory());
		loadAPIData();
	}, []);

	// Apply the theme whenever it changes
	useEffect(() => {
		const root = document.documentElement;

		if (theme === "Dark") {
			root.classList.add("dark");
		} else if (theme === "Light") {
			root.classList.remove("dark");
		} else {
			// System
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				root.classList.add("dark");
			} else {
				root.classList.remove("dark");
			}
		}

		localStorage.setItem("theme", theme);
	}, [theme]);

	// Prevent background scroll while loading
	useEffect(() => {
		if (loading) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => (document.body.style.overflow = "");
	}, [loading]);

	const saveAsPDF = async () => {
		const el = targetRef.current;
		if (!el) return;

		const pdf = new jsPDF({ unit: "px", format: "a4" });
		const pageWidth = pdf.internal.pageSize.getWidth();

		const margin = 24;
		const contentWidth = pageWidth - margin * 2;

		// Render DOM to canvas
		const canvas = await html2canvas(el, {
			scale: 2,
			backgroundColor: "#ffffff",
		});
		const imgData = canvas.toDataURL("image/png");

		// Scale the image to fit the content width
		const imgHeight = (canvas.height * contentWidth) / canvas.width;
		pdf.addImage(imgData, "PNG", margin, margin, contentWidth, imgHeight);

		pdf.save(`PoliticalPulse Report - ${congressperson.name}.pdf`);
	};

	const barColor = feedback
		? feedback.pulseSentiment >= 60
			? "bg-green-500 dark:bg-green-500"
			: feedback.pulseSentiment >= 40
			? "bg-yellow-400 dark:bg-yellow-500"
			: "bg-red-600 dark:bg-red-500"
		: "bg-neutral-600 dark:bg-neutral-600";

	return (
		<>
			{loading && (
				<div
					className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-xs"
					role="dialog"
					aria-modal="true"
					aria-label="Loading">
					<div role="status" aria-live="polite" aria-busy="true">
						<svg
							className="inline w-20 h-20 text-neutral-200 animate-spin dark:text-neutral-600 fill-blue-600"
							viewBox="0 0 100 101"
							fill="none"
							xmlns="http://www.w3.org/2000/svg">
							<path
								d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
								fill="currentColor"
							/>
							<path
								d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
								fill="currentFill"
							/>
						</svg>
						<span className="sr-only">Loading...</span>
					</div>
				</div>
			)}
			<div
				tabIndex="-1"
				onClick={() => setIsInfoModalOpen(false)}
				className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
					isInfoModalOpen
						? "bg-black/50 pointer-events-auto opacity-100"
						: "bg-black/0 pointer-events-none opacity-0"
				}`}>
				<div
					onClick={e => e.stopPropagation()}
					className={`relative p-4 w-full max-w-xs md:max-w-2xl max-h-full bg-white rounded-lg shadow-sm dark:bg-neutral-800 transform transition-transform duration-300 ${
						isInfoModalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
					}`}>
					<div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-neutral-600 border-neutral-200">
						<h3 className="flex items-center text-xl font-semibold text-neutral-900 dark:text-neutral-300">
							<Info
								size={24}
								strokeWidth={2}
								className="stroke-current text-neutral-500 dark:text-neutral-300 mr-4"
							/>
							Info
						</h3>
						<button
							aria-label="Close"
							className="cursor-pointer text-neutral-400 bg-transparent hover:bg-neutral-200 hover:text-neutral-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-neutral-600 dark:hover:text-white"
							onClick={() => setIsInfoModalOpen(false)}>
							<X
								size={24}
								strokeWidth={2}
								className="stroke-current text-neutral-500 dark:text-neutral-400"
							/>
						</button>
					</div>
					<div className="p-4 md:p-5 space-y-4">
						<p className="text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
							PoliticalPulse is an AI-powered tool that gives members of
							Congress, their staff, and constituents a real-time read of public
							sentiment. By scanning trusted sources, it summarizes public
							opinions and highlights key strengths, concerns, and opportunities
							for improvement.
						</p>
						<p className="text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
							See my personal links below to learn more about me and my work or
							get in contact with me!
						</p>
						<ul className="space-y-4 mb-4">
							<li>
								<label
									onClick={() =>
										window.open(
											"https://www.linkedin.com/in/rishab-alagharu",
											"_blank"
										)
									}
									className="transition-all inline-flex items-center justify-between w-full px-4 py-2 text-neutral-900 bg-white border border-neutral-200 rounded-lg cursor-pointer dark:hover:text-neutral-300 dark:border-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-white dark:bg-neutral-800 dark:hover:bg-neutral-700">
									<div className="flex items-center space-x-4">
										<Linkedin
											size={24}
											className="stroke-current text-blue-700 dark:text-blue-500"
										/>
										<div className="w-full text-lg font-semibold">LinkedIn</div>
									</div>
									<ArrowRight
										size={20}
										strokeWidth={3}
										className="stroke-current text-neutral-500 dark:text-neutral-400"
									/>
								</label>
							</li>
							<li>
								<label
									onClick={() =>
										window.open("https://rishabalagharu.com/", "_blank")
									}
									className="transition-all inline-flex items-center justify-between w-full px-4 py-2 text-neutral-900 bg-white border border-neutral-200 rounded-lg cursor-pointer dark:hover:text-neutral-300 dark:border-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-white dark:bg-neutral-800 dark:hover:bg-neutral-700">
									<div className="flex items-center space-x-4">
										<Globe
											size={24}
											className="stroke-current text-green-500 dark:text-green-400"
										/>
										<div className="w-full text-lg font-semibold">
											Personal Website
										</div>
									</div>
									<ArrowRight
										size={20}
										strokeWidth={3}
										className="stroke-current text-neutral-500 dark:text-neutral-400"
									/>
								</label>
							</li>
							<li>
								<label
									onClick={() =>
										window.open("https://github.com/RishabSA", "_blank")
									}
									className="transition-all inline-flex items-center justify-between w-full px-4 py-2 text-neutral-900 bg-white border border-neutral-200 rounded-lg cursor-pointer dark:hover:text-neutral-300 dark:border-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-white dark:bg-neutral-800 dark:hover:bg-neutral-700">
									<div className="flex items-center space-x-4">
										<GitHub
											size={24}
											className="stroke-current text-neutral-800 dark:text-neutral-300"
										/>

										<div className="w-full text-lg font-semibold">Github</div>
									</div>
									<ArrowRight
										size={20}
										strokeWidth={3}
										className="stroke-current text-neutral-500 dark:text-neutral-400"
									/>
								</label>
							</li>
						</ul>
					</div>
				</div>
			</div>

			{congressperson && feedback && (
				<div
					tabIndex="-1"
					onClick={() => setIsClustersModalOpen(false)}
					className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
						isClustersModalOpen
							? "bg-black/50 pointer-events-auto opacity-100"
							: "bg-black/0 pointer-events-none opacity-0"
					}`}>
					<div
						onClick={e => e.stopPropagation()}
						className={`relative p-4 w-full max-w-xs md:max-w-2xl max-h-full bg-white rounded-lg shadow-sm dark:bg-neutral-800 transform transition-transform duration-300 ${
							isClustersModalOpen
								? "scale-100 opacity-100"
								: "scale-95 opacity-0"
						}`}>
						<div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-neutral-600 border-neutral-200">
							<h3 className="flex items-center text-xl font-semibold text-neutral-900 dark:text-neutral-300">
								<BarChart2
									size={36}
									strokeWidth={4}
									className="stroke-current text-neutral-700 dark:text-neutral-300 mr-4"
								/>
								Topic Clusters for Articles on{" "}
								{congress === "House of Representatives" ? `Rep. ` : `Senator `}
								{congressperson.name}
							</h3>
							<button
								aria-label="Close"
								className="cursor-pointer text-neutral-400 bg-transparent hover:bg-neutral-200 hover:text-neutral-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-neutral-600 dark:hover:text-white"
								onClick={() => setIsClustersModalOpen(false)}>
								<X
									size={24}
									strokeWidth={2}
									className="stroke-current text-neutral-500 dark:text-neutral-400"
								/>
							</button>
						</div>
						<div className="px-4 pt-4 pb-12 flex items-center justify-center">
							<div className="w-full max-w-4xl">
								<TopicScatter data={feedback} />
							</div>
						</div>
					</div>
				</div>
			)}

			<div
				tabIndex="-1"
				onClick={() => setIsClearModalOpen(false)}
				className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
					isClearModalOpen
						? "bg-black/50 pointer-events-auto opacity-100"
						: "bg-black/0 pointer-events-none opacity-0"
				}`}>
				<div
					onClick={e => e.stopPropagation()}
					className={`relative p-4 w-full max-w-xs md:max-w-2xl max-h-full bg-white rounded-lg shadow-sm dark:bg-neutral-800 transform transition-transform duration-300 ${
						isClearModalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
					}`}>
					<button
						aria-label="Close"
						onClick={() => setIsClearModalOpen(false)}
						className="absolute right-3 top-3 cursor-pointer text-neutral-400 bg-transparent hover:bg-neutral-200 hover:text-neutral-900 rounded-lg text-sm w-8 h-8 inline-flex justify-center items-center dark:hover:bg-neutral-600 dark:hover:text-white">
						<X
							size={24}
							strokeWidth={2}
							className="stroke-current text-neutral-500 dark:text-neutral-400"
						/>
					</button>
					<div className="p-4 md:p-5 text-center items-center justify-center w-full">
						<AlertCircle
							size={64}
							className="mx-auto mb-4 stroke-current text-neutral-400 dark:text-neutral-200"
						/>
						<h3 className="mb-5 text-lg font-normal text-neutral-500 dark:text-neutral-400">
							Are you sure you want to delete this report?
						</h3>
						<button
							className="cursor-pointer text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 dark:focus:ring-red-800 font-medium rounded-lg text-sm inline-flex items-center px-5 py-2.5 text-center"
							onClick={() => {
								deleteFeedbackHistoryItem(feedbackHistoryIndexToDelete);

								setFeedback(null);
								setIsClearModalOpen(false);
								setCongressperson(null);

								setFeedbackHistoryIndexToDelete(0);
							}}>
							Yes, I'm sure
						</button>
						<button
							className="cursor-pointer py-2.5 px-5 ms-3 text-sm font-medium text-neutral-900 focus:outline-none bg-white rounded-lg border border-neutral-200 hover:bg-neutral-100 focus:z-10 focus:ring-4 focus:ring-neutral-100 dark:focus:ring-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-600 dark:hover:text-white dark:hover:bg-neutral-700"
							onClick={() => setIsClearModalOpen(false)}>
							No, cancel
						</button>
					</div>
				</div>
			</div>

			{possibleSenators && (
				<div
					tabIndex="-1"
					onClick={() => setIsChooseSenatorModalOpen(false)}
					className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
						isChooseSenatorModalOpen
							? "bg-black/50 pointer-events-auto opacity-100"
							: "bg-black/0 pointer-events-none opacity-0"
					}`}>
					<div
						onClick={e => e.stopPropagation()}
						className={`relative p-4 w-full max-w-xs md:max-w-2xl max-h-full bg-white rounded-lg shadow-sm dark:bg-neutral-800 transform transition-transform duration-300 ${
							isChooseSenatorModalOpen
								? "scale-100 opacity-100"
								: "scale-95 opacity-0"
						}`}>
						<button
							aria-label="Close"
							onClick={() => setIsChooseSenatorModalOpen(false)}
							className="absolute right-3 top-3 cursor-pointer text-neutral-400 bg-transparent hover:bg-neutral-200 hover:text-neutral-900 rounded-lg text-sm w-8 h-8 inline-flex justify-center items-center dark:hover:bg-neutral-600 dark:hover:text-white">
							<X
								size={24}
								strokeWidth={2}
								className="stroke-current text-neutral-500 dark:text-neutral-400"
							/>
						</button>
						<div className="p-4 md:p-5 text-center items-center justify-center w-full">
							<h2 className="mb-5 text-xl font-bold text-neutral-900 dark:text-neutral-100">
								Please select a senator
							</h2>
							<ul className="p-4 space-y-2 w-full h-full flex flex-col items-center bg-white dark:bg-neutral-900">
								{possibleSenators.map((senator, i) => (
									<li
										key={i}
										className="group relative flex w-full p-2 items-center justify-start border-neutral-200 dark:border-neutral-800 border-2 rounded-xl shadow-md text-sm cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all duration-300"
										onClick={() => {
											setCongressperson(senator);
											setIsChooseSenatorModalOpen(false);
										}}>
										<img
											src={senator.imageUrl}
											alt={senator.name}
											className="w-12 rounded-sm shadow-md"
										/>
										<div className="flex flex-col pl-4 cursor-pointer text-start">
											<label className="text-lg font-bold text-neutral-900 dark:text-neutral-300 cursor-pointer">
												{senator.name}
											</label>
											<label className="text-md font-medium text-neutral-900 dark:text-neutral-300 cursor-pointer">
												{senator.state}
											</label>
										</div>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			)}

			<div className="h-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col px-8 py-2">
				<ToastContainer
					position="top-right"
					autoClose={5000}
					hideProgressBar={false}
					newestOnTop={false}
					closeOnClick={false}
					rtl={false}
					pauseOnFocusLoss
					draggable={false}
					pauseOnHover
					theme="colored"
					transition={Bounce}
				/>

				{openHistory && (
					<div className="fixed inset-0 z-40 md:hidden">
						<div className="relative h-full w-full bg-white dark:bg-neutral-900 p-4 overflow-y-auto">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
									Report History
								</h2>
								<button
									aria-label="Close Report history"
									className="cursor-pointer rounded p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
									onClick={() => setOpenHistory(false)}>
									<X
										size={24}
										strokeWidth={2}
										className="stroke-current text-neutral-500 dark:text-neutral-400"
									/>
								</button>
							</div>

							<ul className="p-4 space-y-2 w-full h-full flex flex-col items-center border-neutral-200 dark:border-neutral-800 border-2 rounded-xl max-h-full overflow-y-auto bg-white dark:bg-neutral-900">
								{feedbackHistory.length > 0 ? (
									feedbackHistory.map((item, i) => (
										<li
											key={i}
											className="group relative flex w-full p-2 items-center justify-start border-neutral-200 dark:border-neutral-800 border-2 rounded-xl shadow-md text-sm cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all duration-300"
											onClick={() => {
												setFeedback(feedbackHistory[i]);

												const memberList =
													feedbackHistory[i].congress ===
													"House of Representatives"
														? houseMembers
														: senateMembers;

												setCongress(feedbackHistory[i].congress);

												const member = memberList.find(
													member => member.name === item.name
												);
												setCongressperson(member);
												setOpenHistory(false);
											}}>
											<img
												src={item.imageUrl}
												alt={item.name}
												className="w-12 rounded-sm shadow-md"
											/>
											<div className="flex flex-col pl-4 cursor-pointer">
												<label className="text-lg font-bold text-neutral-900 dark:text-neutral-300 cursor-pointer">
													{item.name}
												</label>
												<label className="text-md font-medium text-neutral-900 dark:text-neutral-300 cursor-pointer">
													{item.congress === "House of Representatives"
														? `${item.state} - ${item.district}`
														: `${item.state}`}
												</label>
											</div>

											<button
												aria-label="Delete this report"
												onClick={() => {
													setFeedbackHistoryIndexToDelete(i);
													setIsClearModalOpen(true);
												}}
												className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-red-600 transition-all duration-300 cursor-pointer">
												<Trash size={24} strokeWidth={4} />
											</button>
										</li>
									))
								) : (
									<div className="flex flex-col items-center text-center gap-y-8 pt-2">
										<h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-300">
											No reports yet
										</h2>
										<h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-300">
											Choose a congressperson and click{" "}
											<strong className="text-blue-600">analyze</strong> to get
											started
										</h3>
									</div>
								)}
							</ul>
						</div>
					</div>
				)}

				<div className="my-4 md:flex md:space-x-20 items-center justify-center">
					<div className="flex items-center space-x-4 justify-center">
						<img
							src="/assets/icon.svg"
							alt="PoliticalPulse Icon"
							className="h-16 w-auto"
						/>
						<h1 className="text-5xl font-semibold text-neutral-800 dark:text-neutral-200">
							PoliticalPulse
						</h1>
					</div>

					<div className="flex items-center space-x-4 mt-5 md:mt-0 justify-between">
						<button
							aria-label={
								openHistory ? "Close report history" : "Open report history"
							}
							title="Report History"
							className="md:hidden cursor-pointer h-10 w-10 text-neutral-500 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center rounded-lg transition-colors"
							aria-controls="mobile-menu"
							aria-expanded={openHistory}
							onClick={() => setOpenHistory(val => !val)}>
							<div className="flex items-center">
								<Menu
									size={24}
									strokeWidth={2}
									className="stroke-current text-neutral-500 dark:text-neutral-300"
								/>
							</div>
						</button>
						<div>
							<button
								onClick={() => setThemeDropdownOpen(o => !o)}
								className="cursor-pointer text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center">
								{theme === "Light" && <Sun size={16} className="mr-2" />}
								{theme === "Dark" && <Moon size={16} className="mr-2" />}
								{theme === "System" && <Monitor size={16} className="mr-2" />}
								<span>{theme}</span>
							</button>
							{themeDropdownOpen && (
								<div className="transition-all duration-300 ease-in-out absolute z-10 bg-white shadow-md dark:bg-neutral-800 rounded-lg">
									<ul className="py-2 text-sm text-neutral-600 dark:text-neutral-400">
										<li>
											<button
												onClick={() => {
													setTheme("Light");
													setThemeDropdownOpen(false);
												}}
												className="cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center">
												<Sun size={16} className="mr-2" />
												Light
											</button>
										</li>
										<li>
											<button
												onClick={() => {
													setTheme("Dark");
													setThemeDropdownOpen(false);
												}}
												className="cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center">
												<Moon size={16} className="mr-2" />
												Dark
											</button>
										</li>
										<li>
											<button
												onClick={() => {
													setTheme("System");
													setThemeDropdownOpen(false);
												}}
												className="cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center">
												<Monitor size={16} className="mr-2" />
												System
											</button>
										</li>
									</ul>
								</div>
							)}
						</div>
						<button
							aria-label="Open information panel"
							title="Info"
							className="cursor-pointer h-10 w-10 text-neutral-500 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center rounded-lg transition-colors"
							onClick={() => setIsInfoModalOpen(true)}>
							<div className="flex items-center">
								<Info
									size={24}
									strokeWidth={2}
									className="stroke-current text-neutral-500 dark:text-neutral-300"
								/>
							</div>
						</button>
					</div>
				</div>
				<div className="w-full flex">
					<ul className="hidden mr-4 p-4 space-y-2 w-full md:w-1/6 h-full md:flex flex-col items-center border-neutral-200 dark:border-neutral-800 border-2 rounded-xl max-h-screen overflow-y-auto">
						{feedbackHistory.length > 0 ? (
							feedbackHistory.map((item, i) => (
								<li
									key={i}
									className="group relative flex w-full p-2 items-center justify-start border-neutral-200 dark:border-neutral-800 border-2 rounded-xl shadow-md text-sm cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all duration-300"
									onClick={() => {
										setFeedback(feedbackHistory[i]);

										const memberList =
											feedbackHistory[i].congress === "House of Representatives"
												? houseMembers
												: senateMembers;

										setCongress(feedbackHistory[i].congress);

										const member = memberList.find(
											member => member.name === item.name
										);
										setCongressperson(member);
									}}>
									<img
										src={item.imageUrl}
										alt={item.name}
										className="w-8 rounded-sm shadow-md"
									/>
									<div className="flex flex-col pl-2 cursor-pointer">
										<label className="font-bold text-neutral-900 dark:text-neutral-300 cursor-pointer">
											{item.name}
										</label>
										<label className="text-sm font-medium text-neutral-900 dark:text-neutral-300 cursor-pointer">
											{item.congress === "House of Representatives"
												? `${item.state} - ${item.district}`
												: `${item.state}`}
										</label>
									</div>

									<button
										aria-label="Delete this report"
										onClick={e => {
											e.stopPropagation(); // Prevent clicking on the full list item
											setFeedbackHistoryIndexToDelete(i);
											setIsClearModalOpen(true);
										}}
										className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 transition-all duration-300 cursor-pointer">
										<Trash size={24} strokeWidth={4} />
									</button>
								</li>
							))
						) : (
							<div className="flex flex-col items-center text-center gap-y-8 pt-2">
								<h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-300">
									No reports yet
								</h2>
								<h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-300">
									Choose a congressperson and click{" "}
									<strong className="text-blue-600">analyze</strong> to get
									started
								</h3>
							</div>
						)}
					</ul>
					<div className="pb-4 w-full md:w-5/6 h-fit flex flex-col justify-center items-center border-neutral-200 dark:border-neutral-800 border-2 rounded-xl">
						<div className="text-center items-center p-4 pt-8 space-y-1">
							<div className="flex gap-2 md:gap-4 flex-col md:flex-row">
								<div className="flex space-x-4 mt-2 md:mt-0 justify-center">
									<div className="relative inline-block">
										<button
											onClick={() => setCongressDropdownOpen(o => !o)}
											className="h-12 md:h-16 cursor-pointer text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 font-semibold rounded-lg text-xs md:text-sm px-4 py-2.5 inline-flex items-center">
											<span className="whitespace-nowrap">{congress}</span>
											<ChevronDown size={24} className="ml-2" />
										</button>
										{congressDropdownOpen && (
											<div className="absolute top-full left-0 z-50 bg-white shadow-md dark:bg-neutral-800 rounded-lg w-max min-w-full border border-neutral-200 dark:border-neutral-700">
												<ul className="py-2 text-sm text-neutral-600 dark:text-neutral-400">
													<li
														onClick={() => {
															if (congress === "Senate") {
																setCongress("House of Representatives");
																setCongressperson(null);
															}
															setCongressDropdownOpen(false);
														}}
														className="cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center">
														House of Representatives
													</li>
													<li
														onClick={() => {
															if (congress === "House of Representatives") {
																setCongress("Senate");
																setCongressperson(null);
															}
															setCongressDropdownOpen(false);
														}}
														className="cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center">
														Senate
													</li>
												</ul>
											</div>
										)}
									</div>
								</div>

								<div className="relative w-full">
									<button
										onClick={() => setCongresspersonDropdownOpen(o => !o)}
										className="h-16 w-full md:w-100 cursor-pointer text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 font-semibold rounded-lg text-xs md:text-sm px-5 inline-flex items-center justify-between">
										{congressperson ? (
											<div className="inline-flex items-center justify-between font-semibold gap-4">
												<img
													src={congressperson.imageUrl}
													alt={congressperson.name}
													className="w-8 rounded-sm shadow-md"
												/>
												{congress === "House of Representatives"
													? `${congressperson.name}: ${
															congressperson.state
													  } - ${
															congressperson.district
																? congressperson.district
																: "(at Large)"
													  }`
													: `${congressperson.name}: ${congressperson.state}`}
											</div>
										) : congress === "House of Representatives" ? (
											"Choose a Representative"
										) : (
											"Choose a Senator"
										)}
										<ChevronDown size={24} className="ml-2" />
									</button>
									{congresspersonDropdownOpen && (
										<div
											className="absolute top-full left-0 z-50 w-full bg-white dark:bg-neutral-800 rounded-lg shadow-md border border-neutral-200 dark:border-neutral-700"
											role="listbox">
											<div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
												<label
													htmlFor="input-congressperson-search"
													className="sr-only">
													Search
												</label>
												<div className="relative">
													<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
														<Search
															size={18}
															className="text-neutral-500 dark:text-neutral-400"
														/>
													</div>
													<input
														type="text"
														id="input-congressperson-search"
														value={dropdownSearch}
														onChange={e => setDropdownSearch(e.target.value)}
														className="block w-full p-2 ps-10 text-sm text-neutral-900 border border-neutral-300 rounded-lg bg-neutral-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-neutral-700 dark:border-neutral-500 dark:placeholder-neutral-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
														placeholder={`Search ${
															congress === "House of Representatives"
																? "representatives"
																: "senators"
														} by name, state, or district`}
													/>
												</div>
											</div>
											<ul className="text-left max-h-80 overflow-y-auto px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200">
												{filteredMembers.length === 0 && (
													<li className="p-2 text-neutral-500 dark:text-neutral-400">
														No matches
													</li>
												)}

												{filteredMembers.map(
													({ name, state, district, imageUrl }) => (
														<li
															key={name}
															role="option"
															className="flex items-start p-2 rounded-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
															onClick={() => {
																const membersToFilter =
																	congress === "House of Representatives"
																		? houseMembers
																		: senateMembers;

																const selection = membersToFilter.find(
																	member => member.name === name
																);

																setCongressperson(selection);
																setCongresspersonDropdownOpen(false);
																setDropdownSearch("");
															}}>
															<img
																src={imageUrl}
																alt={name}
																className="w-8 rounded-sm shadow-md"
															/>

															<div className="flex flex-col items-start px-4">
																<label className="w-full text-sm cursor-pointer font-bold text-neutral-900 dark:text-neutral-300">
																	{name}
																</label>
																<label className="w-full text-xs cursor-pointer font-medium text-neutral-900 dark:text-neutral-300">
																	{congress === "House of Representatives"
																		? `${state} - ${
																				district ? district : "(at Large)"
																		  }`
																		: `${state}`}
																</label>
															</div>
														</li>
													)
												)}
											</ul>
										</div>
									)}
								</div>

								<button
									type="button"
									className="md:w-fit w-full disabled:bg-neutral-300 dark:disabled:bg-neutral-800 cursor-pointer text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-bold rounded-lg text-sm md:text-md px-6 py-2"
									onClick={analyzeCongressperson}
									disabled={feedbackLoading || !congressperson}
									aria-disabled={feedbackLoading || !congressperson}>
									Analyze
								</button>

								<div className="flex space-x-4 mt-2 md:mt-0 justify-center">
									<div className="relative inline-block">
										<button
											onClick={() => setSourceLimitDropdownOpen(o => !o)}
											className="h-12 md:h-16 cursor-pointer text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 font-semibold rounded-lg text-xs md:text-sm px-4 py-2.5 inline-flex items-center">
											<span className="whitespace-nowrap">
												{sourceLimit} sources
											</span>
											<ChevronDown size={24} className="ml-2" />
										</button>
										{sourceLimitDropdownOpen && (
											<div className="absolute top-full left-0 z-50 bg-white shadow-md dark:bg-neutral-800 rounded-lg w-max min-w-full border border-neutral-200 dark:border-neutral-700">
												<ul className="py-2 text-sm text-neutral-600 dark:text-neutral-400">
													{[10, 15, 25, 50].map(limitVal => (
														<li
															onClick={() => {
																setSourceLimit(limitVal);
																setSourceLimitDropdownOpen(false);
															}}
															className="cursor-pointer w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center">
															{limitVal} sources
														</li>
													))}
												</ul>
											</div>
										)}
									</div>
								</div>
							</div>
							<p className="w-full text-yellow-500 dark:text-yellow-300 text-xs text-center pt-4">
								⚠️ PoliticalPulse is an AI tool. Always verify information from
								multiple sources.
							</p>
						</div>
						{!feedback && !feedbackLoading && (
							<div className="h-120 w-4/5 my-2">
								<InteractiveMap
									houseMembers={houseMembers}
									senateMembers={senateMembers}
									setCongressperson={setCongressperson}
									setPossibleSenators={setPossibleSenators}
									setIsChooseSenatorModalOpen={setIsChooseSenatorModalOpen}
									congress={congress}
								/>
							</div>
						)}
						{feedbackLoading && (
							<div className="h-full w-full p-4 items-center justify-center flex flex-col">
								<div
									className="place-items-center p-8"
									role="dialog"
									aria-modal="true"
									aria-label="Loading">
									<div role="status" aria-live="polite" aria-busy="true">
										<svg
											className="inline w-24 h-24 text-neutral-200 animate-spin dark:text-neutral-600 fill-blue-600"
											viewBox="0 0 100 101"
											fill="none"
											xmlns="http://www.w3.org/2000/svg">
											<path
												d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
												fill="currentColor"
											/>
											<path
												d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
												fill="currentFill"
											/>
										</svg>
									</div>
								</div>

								<span className="pb-4 italic text-neutral-600 dark:text-neutral-400">
									Estimated time: 30-45 seconds
								</span>

								<TextCarousel
									text={[
										"Over 340 million Americans are represented by 435 congresspeople in the House of Representatives.",
										"Congressional districts are redrawn every 10 years after the U.S. Census to ensure equal population representation.",
										"Members of the House of Representatives serve two-year terms, meaning they can run for re-election every even-numbered year.",
										"To serve in the U.S. House of Representatives, you must be at least 25 years old and a U.S. citizen for at least seven years.",
										"In the event that no presidential candidate receives a majority of electoral votes, the House of Representatives is responsible for electing the president.",
									]}
									interval={5000}
								/>
							</div>
						)}
						{feedback && (
							<div
								className="flex justify-start h-full w-full p-4"
								ref={targetRef}
								id="congressPersonFeedback">
								<div className="hidden md:flex flex-col items-center text-center w-fit">
									<img
										src={congressperson.imageUrl}
										alt={congressperson.name}
										className="w-32 rounded-md shadow-md"
										data-html2canvas-ignore
									/>
									<label className="pt-2 font-bold text-neutral-900 dark:text-neutral-300">
										{congressperson.name}
									</label>
									<label className="pt-1 text-sm font-medium text-neutral-900 dark:text-neutral-300">
										{congress === "House of Representatives"
											? `${congressperson.state} - ${
													congressperson.district
														? congressperson.district
														: "(at Large)"
											  }`
											: `${congressperson.state}`}
									</label>
								</div>

								<div className="w-full px-8 space-y-8">
									<div className="flex md:hidden flex-col space-y-2">
										<button
											onClick={() => {
												setFeedback(null);
												setCongressperson(null);
											}}
											className="flex items-center gap-2 w-full cursor-pointer text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 focus:outline-none font-semibold rounded-lg text-sm px-4 py-2"
											data-html2canvas-ignore>
											<Trash size={24} className="stroke-current text-white" />
											Clear / New
										</button>
										<button
											onClick={() => setIsClustersModalOpen(true)}
											className="flex items-center gap-2 w-full cursor-pointer text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none font-semibold rounded-lg text-sm px-4 py-2"
											data-html2canvas-ignore>
											<BarChart2
												size={24}
												strokeWidth={2}
												className="stroke-current text-white"
											/>
											View Graph
										</button>
										<button
											onClick={saveAsPDF}
											className="flex items-center gap-2 w-full cursor-pointer text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none font-semibold rounded-lg text-sm px-4 py-2"
											data-html2canvas-ignore>
											<Download
												size={24}
												className="stroke-current text-white"
											/>
											Save as PDF
										</button>
									</div>
									<div>
										<div className="flex justify-between mb-1">
											<span className="text-md font-semibold text-neutral-900 dark:text-neutral-300">
												Pulse/Sentiment
											</span>
											<span className="text-md font-medium text-neutral-900 dark:text-neutral-300">
												{feedback.pulseSentiment}%
											</span>
										</div>
										<div className="w-full bg-neutral-200 rounded-full h-4 dark:bg-neutral-700">
											<div
												className={`${barColor} h-4 rounded-full`}
												style={{
													width: `${feedback.pulseSentiment}%`,
												}}></div>
										</div>
									</div>
									<div className="">
										<label className="text-md font-bold text-neutral-900 dark:text-neutral-300">
											Summary
										</label>
										<div className="text-sm font-normal text-neutral-900 dark:text-neutral-300 pt-2">
											<Markdown>{feedback.summary}</Markdown>
										</div>
									</div>
									<div className="flex gap-4">
										<div className="w-1/2">
											<label className="text-md font-bold text-neutral-900 dark:text-neutral-300">
												Strengths
											</label>
											<div className="text-sm font-normal text-neutral-900 dark:text-neutral-300 pt-2">
												<Markdown>{feedback.positives}</Markdown>
											</div>
										</div>
										<div className="w-1/2">
											<label className="text-md font-bold text-neutral-900 dark:text-neutral-300">
												Concerns
											</label>
											<div className="text-sm font-normal text-neutral-900 dark:text-neutral-300 pt-2">
												<Markdown>{feedback.negatives}</Markdown>
											</div>
										</div>
									</div>
									<div className="">
										<label className="text-md font-bold text-neutral-900 dark:text-neutral-300">
											Opportunities for Improvement
										</label>
										<div className="text-sm font-normal text-neutral-900 dark:text-neutral-300 pt-2">
											<Markdown>{feedback.improvements}</Markdown>
										</div>
									</div>
									<ul className="md:hidden space-y-2 border-neutral-200 dark:border-neutral-800 border-2 rounded-xl items-center p-4 pl-12 list-disc marker:text-neutral-400 max-h-120 overflow-y-auto">
										{feedback.article_links.map((link, i) => (
											<li key={i}>
												<a
													href={link}
													target="_blank"
													rel="noopener noreferrer"
													className="text-md font-medium text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 underline break-all"
													aria-label={`Open source ${i + 1}`}>
													Source {i + 1}
												</a>
											</li>
										))}
									</ul>
								</div>
								<div className="hidden md:flex flex-col w-1/3 xl:w-1/5 space-y-2">
									<button
										onClick={() => {
											setFeedback(null);
											setCongressperson(null);
										}}
										className="flex items-center gap-2 w-full cursor-pointer text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 focus:outline-none font-semibold rounded-lg text-sm px-4 py-2"
										data-html2canvas-ignore>
										<Trash size={24} className="stroke-current text-white" />
										Clear / New
									</button>
									<button
										onClick={() => setIsClustersModalOpen(true)}
										className="flex items-center gap-2 w-full cursor-pointer text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none font-semibold rounded-lg text-sm px-4 py-2"
										data-html2canvas-ignore>
										<BarChart2
											size={24}
											strokeWidth={2}
											className="stroke-current text-white"
										/>
										View Graph
									</button>
									<button
										onClick={saveAsPDF}
										className="flex items-center gap-2 w-full cursor-pointer text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none font-semibold rounded-lg text-sm px-4 py-2"
										data-html2canvas-ignore>
										<Download size={24} className="stroke-current text-white" />
										Save as PDF
									</button>
									<ul className="space-y-2 border-neutral-200 dark:border-neutral-800 border-2 rounded-xl items-center p-4 pl-12 list-disc marker:text-neutral-400 max-h-120 overflow-y-auto">
										{feedback.article_links.map((link, i) => (
											<li key={i}>
												<a
													href={link}
													target="_blank"
													rel="noopener noreferrer"
													className="text-md font-medium text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 underline break-all"
													aria-label={`Open source ${i + 1}`}>
													Source {i + 1}
												</a>
											</li>
										))}
									</ul>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

export default App;
