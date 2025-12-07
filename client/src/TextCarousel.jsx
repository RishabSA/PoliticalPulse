import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "react-feather";

const TextCarousel = ({ text = [], interval = 5000 }) => {
	const scrollerRef = useRef(null);
	const [idx, setIdx] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		const element = scrollerRef.current;
		if (!element) return;

		const onScroll = () => {
			const i = Math.round(element.scrollLeft / element.clientWidth);
			setIdx(i);
		};

		element.addEventListener("scroll", onScroll, { passive: true });
		return () => element.removeEventListener("scroll", onScroll);
	}, []);

	const goTo = i => {
		const element = scrollerRef.current;
		if (!element || text.length === 0) return;

		const count = text.length;
		const target = ((i % count) + count) % count;
		element.scrollTo({
			left: target * element.clientWidth,
			behavior: "smooth",
		});
	};

	const prev = () => goTo(idx - 1);
	const next = () => goTo(idx + 1);

	useEffect(() => {
		const el = scrollerRef.current;
		if (!el || text.length <= 1 || paused) return;
		const id = setInterval(next, interval);

		return () => clearInterval(id);
	}, [text.length, paused, interval, idx]);

	if (!text || text.length === 0) return null;

	return (
		<div className="flex flex-col items-center justify-center">
			<div
				className="shadow-md relative w-3/4 rounded-2xl overflow-hidden bg-white/60 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
				onFocus={() => setPaused(true)}
				onBlur={() => setPaused(false)}>
				<div
					ref={scrollerRef}
					role="region"
					aria-roledescription="carousel"
					aria-label="Highlights"
					tabIndex={0}
					className="overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar">
					<div className="flex">
						{text.map((content, i) => (
							<div
								key={i}
								className="flex-none w-full snap-center px-6 py-8 md:px-10 md:py-12"
								aria-hidden={i !== idx}>
								<p className="text-center text-neutral-800 dark:text-neutral-100 text-lg md:text-xl leading-relaxed font-medium">
									{content}
								</p>
							</div>
						))}
					</div>
				</div>

				<div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
					<button
						type="button"
						onClick={prev}
						aria-label="Previous"
						className="pointer-events-auto grid place-items-center h-10 w-10 rounded-full bg-white/80 dark:bg-neutral-900/70 shadow hover:scale-105 transition cursor-pointer">
						<ChevronLeft className="text-neutral-700 dark:text-neutral-200" />
					</button>
					<button
						type="button"
						onClick={next}
						aria-label="Next"
						className="pointer-events-auto grid place-items-center h-10 w-10 rounded-full bg-white/80 dark:bg-neutral-900/70 shadow hover:scale-105 transition cursor-pointer">
						<ChevronRight className="text-neutral-700 dark:text-neutral-200" />
					</button>
				</div>
			</div>

			<div className="mt-4 flex gap-2">
				{text.map((content, i) => (
					<button
						key={i}
						aria-label={`Go to slide ${i + 1}`}
						onClick={() => goTo(i)}
						className={`h-2.5 w-2.5 rounded-full transition ${
							i === idx
								? "bg-blue-600 dark:bg-blue-500"
								: "bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500"
						}`}
					/>
				))}
			</div>
		</div>
	);
};

export default TextCarousel;
