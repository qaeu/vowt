import {
	createSignal,
	onMount,
	onCleanup,
	createEffect,
	Show,
	type Component,
} from 'solid-js';
import Tesseract from 'tesseract.js';

import type {
	PlayerStats,
	MatchInfo,
	GameRecord,
	TextRegion,
	ImageHashSet,
	RecognitionResult,
} from '#types';
import EditableGameData from '#c/EditableGameData';
import {
	preprocessImageForOCR,
	drawRegionsOnImage,
	groupRegionsByCharSet,
	loadImageDimensions,
	partitionRegionGroups,
} from '#utils/preprocess';
import { recogniseImage } from '#utils/imageRecognition';
import { extractGameStats, formatResults } from '#utils/postprocess';
import { saveGameRecord, updateGameRecord } from '#utils/gameStorage';
import { getActiveProfile, getActiveProfileHashSets } from '#utils/regionProfiles';
import { DEFAULT_HASH_SETS } from '#data/hashSets';
import '#styles/ScoreboardOCR';

interface ScoreboardOCRProps {
	uploadedImage?: string | null;
	onClose: () => void;
	onOpenRegionManager: () => void;
}

const WORKER_COUNT = 2;

const ScoreboardOCR: Component<ScoreboardOCRProps> = (props) => {
	const [isProcessing, setIsProcessing] = createSignal(false);
	const [preprocessedImagePreview, setPreprocessedImagePreview] =
		createSignal<string>('');
	const [rawOcrText, setRawOcrText] = createSignal<string>('');
	const [extractedStats, setExtractedStats] = createSignal<
		Pick<GameRecord, 'players' | 'matchInfo'>
	>({ players: [], matchInfo: {} as MatchInfo });
	const [error, setError] = createSignal<string>('');
	const [progress, setProgress] = createSignal<number>(0);
	const [currentScreenshot, setCurrentScreenshot] = createSignal<string>();

	let recordId: string;
	let activeSchedulers: Tesseract.Scheduler[] = [];
	let activeWorkers: Tesseract.Worker[] = [];
	let isProcessingCancelled = false;

	onCleanup(async () => {
		isProcessingCancelled = true;
		await terminateAllWorkersAndSchedulers();
	});

	onMount(async () => {
		if (props.uploadedImage) {
			setCurrentScreenshot(props.uploadedImage);
			await processScreenshot(props.uploadedImage);
		}
	});

	// React to changes in uploadedImage prop (e.g., drag-and-drop while on OCR page)
	createEffect(() => {
		const uploaded = props.uploadedImage;
		if (uploaded && uploaded !== currentScreenshot()) {
			setCurrentScreenshot(uploaded);
			processScreenshot(uploaded);
		}
	});

	/** Terminates all active schedulers and standalone workers */
	const terminateAllWorkersAndSchedulers = async () => {
		const terminatePromises: Promise<unknown>[] = [];
		for (const scheduler of activeSchedulers) {
			terminatePromises.push(scheduler.terminate());
		}
		for (const worker of activeWorkers) {
			terminatePromises.push(worker.terminate());
		}
		await Promise.all(terminatePromises);
		activeSchedulers = [];
		activeWorkers = [];
	};

	/** Preprocesses image and updates preview state */
	const prepareImageForOCR = async (imageSrc: string) => {
		const preprocessed = await preprocessImageForOCR(imageSrc);
		const preprocessedPreview = await drawRegionsOnImage(preprocessed, imageSrc);
		setPreprocessedImagePreview(preprocessedPreview);
		return preprocessed;
	};

	/** Processes image hash regions using image recognition */
	const processImageHashRegions = async (
		regions: TextRegion[],
		originalImage: string,
		allHashSets: ImageHashSet[],
		onProgress: () => void
	): Promise<RecognitionResult[]> => {
		const results: RecognitionResult[] = [];

		for (const region of regions) {
			if (isProcessingCancelled) break;

			const hashSet = allHashSets.find((hs) => hs.id === region.imgHashSet);

			if (!hashSet) {
				console.warn(
					`Hash set '${region.imgHashSet}' not found for region '${region.name}'`
				);
				results.push({ name: region.name, value: '', confidence: 0 });
			} else {
				const result = await recogniseRegionImage(originalImage, region, hashSet);
				results.push({
					name: region.name,
					value: result.name,
					confidence: result.confidence,
				});
			}
			onProgress();
		}

		return results;
	};

	/** Creates a scheduler with workers configured for a specific charSet */
	const createSchedulerForCharSet = async (
		charSet: string
	): Promise<Tesseract.Scheduler> => {
		const scheduler = Tesseract.createScheduler();
		activeSchedulers.push(scheduler);

		const workerPromises = Array(WORKER_COUNT)
			.fill(null)
			.map(async () => {
				const worker = await Tesseract.createWorker('eng');
				const params: Partial<Tesseract.WorkerParams> = {
					tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
				};
				if (charSet) {
					params.tessedit_char_whitelist = charSet;
				}
				await worker.setParameters(params);
				scheduler.addWorker(worker);
			});
		await Promise.all(workerPromises);

		return scheduler;
	};

	/** Creates a standalone worker for processing small groups */
	const createStandaloneWorker = async (): Promise<Tesseract.Worker> => {
		const worker = await Tesseract.createWorker('eng');
		activeWorkers.push(worker);
		return worker;
	};

	/** Process regions using a scheduler */
	const processRegionsWithScheduler = async (
		scheduler: Tesseract.Scheduler,
		regions: TextRegion[],
		preprocessedImage: string,
		onProgress: () => void
	): Promise<RecognitionResult[]> => {
		const regionPromises = regions.map((region) =>
			recogniseRegionText(scheduler, preprocessedImage, region).then((result) => {
				onProgress();
				return {
					name: region.name,
					value: result.data.text.trim(),
					confidence: result.data.confidence,
				};
			})
		);
		return Promise.all(regionPromises);
	};

	/** Process regions using a standalone worker, setting parameters per recognize() */
	const processRegionsWithWorker = async (
		worker: Tesseract.Worker,
		charSet: string,
		regions: TextRegion[],
		preprocessedImage: string,
		onProgress: () => void
	): Promise<RecognitionResult[]> => {
		const results: RecognitionResult[] = [];

		// Set parameters for this charSet group
		const params: Partial<Tesseract.WorkerParams> = {
			tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
		};
		if (charSet) {
			params.tessedit_char_whitelist = charSet;
		}
		await worker.setParameters(params);

		for (const region of regions) {
			if (isProcessingCancelled) break;

			const result = await worker.recognize(preprocessedImage, {
				rectangle: {
					left: region.x,
					top: region.y,
					width: region.width,
					height: region.height,
				},
			});
			results.push({
				name: region.name,
				value: result.data.text.trim(),
				confidence: result.data.confidence,
			});
			onProgress();
		}

		return results;
	};

	/** Processes large region groups using schedulers */
	const processLargeGroups = async (
		largeGroups: { charSet: string; regions: TextRegion[] }[],
		preprocessedImage: string,
		onProgress: () => void
	) => {
		const schedulerPromises = largeGroups.map(({ charSet }) =>
			createSchedulerForCharSet(charSet)
		);
		const schedulers = await Promise.all(schedulerPromises);

		if (isProcessingCancelled) return [];

		return schedulers.map((scheduler, i) =>
			processRegionsWithScheduler(
				scheduler,
				largeGroups[i].regions,
				preprocessedImage,
				onProgress
			)
		);
	};

	/** Processes small region groups sequentially with a reusable worker */
	const processSmallGroups = async (
		smallGroups: { charSet: string; regions: TextRegion[] }[],
		preprocessedImage: string,
		onProgress: () => void
	) => {
		const results: RecognitionResult[] = [];

		if (smallGroups.length === 0 || isProcessingCancelled) return results;

		const standaloneWorker = await createStandaloneWorker();
		for (const { charSet, regions: groupRegions } of smallGroups) {
			if (isProcessingCancelled) break;
			const groupResults = await processRegionsWithWorker(
				standaloneWorker,
				charSet,
				groupRegions,
				preprocessedImage,
				onProgress
			);
			results.push(...groupResults);
		}

		return results;
	};

	/** Start recognition of all regions */
	const processRegions = async (
		regions: TextRegion[],
		preprocessedImage: string,
		originalImage: string,
		allHashSets: ImageHashSet[]
	): Promise<{ ocrTextParts: string[]; regionResults: Map<string, string> } | null> => {
		if (isProcessingCancelled) return null;

		try {
			const { imageHashRegions = [], ocrRegions = [] } = Object.groupBy(
				regions,
				({ imgHashSet }) =>
					imgHashSet && imgHashSet.length > 0 ? 'imageHashRegions' : 'ocrRegions'
			);

			// Setup progress tracking
			let completedJobs = 0;
			const onProgress = () => {
				completedJobs++;
				setProgress(Math.round((completedJobs / regions.length) * 100));
			};

			// Partition OCR regions by size
			const charSetGroups = groupRegionsByCharSet(ocrRegions);
			const { largeGroups, smallGroups } = partitionRegionGroups(charSetGroups);

			// Start all parallel processing
			const imageHashResultsPromise = processImageHashRegions(
				imageHashRegions,
				originalImage,
				allHashSets,
				onProgress
			);
			const schedulerResultPromises = await processLargeGroups(
				largeGroups,
				preprocessedImage,
				onProgress
			);
			const smallGroupResults = await processSmallGroups(
				smallGroups,
				preprocessedImage,
				onProgress
			);

			// Await parallel results
			const [imageHashResults, ...schedulerResults] = await Promise.all([
				imageHashResultsPromise,
				...schedulerResultPromises,
			]);

			if (isProcessingCancelled) return null;

			const allResults = [
				...imageHashResults,
				...schedulerResults.flat(),
				...smallGroupResults,
			];

			return formatResults(allResults);
		} finally {
			await terminateAllWorkersAndSchedulers();
		}
	};

	/** Main image processing pipeline */
	const processScreenshot = async (imagePath?: string) => {
		const imageToProcess = (imagePath || currentScreenshot()) as string;
		isProcessingCancelled = false;

		try {
			setIsProcessing(true);
			setError('');

			const { width, height } = await loadImageDimensions(imageToProcess);
			const preprocessed = await prepareImageForOCR(imageToProcess);

			const scoreboardRegions = getActiveProfile(width, height);
			if (!scoreboardRegions || scoreboardRegions.length === 0) {
				setError('No scoreboard regions defined in the active profile.');
				return;
			}

			const allHashSets = [...getActiveProfileHashSets(), ...DEFAULT_HASH_SETS];
			const ocrResults = await processRegions(
				scoreboardRegions,
				preprocessed,
				imageToProcess,
				allHashSets
			);

			if (!ocrResults || isProcessingCancelled) return;

			setRawOcrText(ocrResults.ocrTextParts.join('\n'));

			const stats = extractGameStats(ocrResults.regionResults);
			setExtractedStats(stats);
			recordId = saveGameRecord(stats.players, stats.matchInfo);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error occurred');
			console.error('Processing error:', err);
		} finally {
			setIsProcessing(false);
		}
	};

	const recogniseRegionText = async (
		scheduler: Tesseract.Scheduler,
		image: string,
		region: TextRegion
	) => {
		// Recognize text in this region
		const result = await scheduler.addJob('recognize', image, {
			rectangle: {
				left: region.x,
				top: region.y,
				width: region.width,
				height: region.height,
			},
		});

		return result;
	};

	/**
	 * Recognises an image region by extracting it and comparing against known hashes
	 * @param image - Source image URL (not preprocessed)
	 * @param region - Region definition with imgHash property
	 * @param hashSet - Set of hashes to compare against
	 * @param threshold - Minimum similarity score for a match (0-1)
	 * @returns Promise resolving to the matched image ID or empty string if no match
	 */
	const recogniseRegionImage = async (
		image: string,
		region: TextRegion,
		hashSet: ImageHashSet,
		threshold?: number
	): Promise<{ name: string; confidence: number }> => {
		return new Promise((resolve) => {
			const img = new Image();

			img.onload = () => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');

				if (!ctx) {
					resolve({ name: '', confidence: 0 });
					return;
				}

				canvas.width = region.width;
				canvas.height = region.height;

				ctx.drawImage(
					img,
					region.x,
					region.y,
					region.width,
					region.height,
					0,
					0,
					region.width,
					region.height
				);

				const imageData = ctx.getImageData(0, 0, region.width, region.height);
				resolve(recogniseImage(imageData, hashSet, threshold));
			};

			img.onerror = () => resolve({ name: '', confidence: 0 });
			img.src = image;
		});
	};

	const handleSaveData = (players: PlayerStats[], matchInfo: MatchInfo) => {
		try {
			updateGameRecord(recordId, players, matchInfo);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save game record');
		}
	};

	return (
		<div class="scoreboard-container">
			<header>
				<h1>Image Processing</h1>

				<div class="header-buttons">
					<button
						onClick={() => {
							props.onOpenRegionManager();
						}}
						class="region-button"
					>
						Region Profiles
					</button>
					<button
						onClick={() => {
							props.onClose();
						}}
						class="close-button"
					>
						✕ Close
					</button>
				</div>
			</header>

			<Show when={error()}>
				<div class="error-box">
					<strong>Error:</strong> {error()}
				</div>
			</Show>

			<Show when={isProcessing()}>
				<div class="progress-container">
					<p class="progress-text">Processing image... {progress()}%</p>
					<div class="progress-bar-wrapper">
						<div class="progress-bar" style={{ width: `${progress()}%` }} />
					</div>
				</div>
			</Show>

			<div class="image-grid">
				<Show when={currentScreenshot()}>
					<div class="image-container">
						<h2>Uploaded Image</h2>
						<img src={currentScreenshot()} alt="Uploaded Image" />
					</div>
				</Show>

				<Show when={preprocessedImagePreview()}>
					<div class="image-container">
						<h2>Pre-processed Image</h2>
						<img
							src={preprocessedImagePreview()}
							alt="Pre-processed scoreboard with regions and unskew applied"
						/>
						<p>
							Filtered for OCR clarity. Red boxes show text regions. Green boxes show
							regions with transformed italic text. Blue boxes show image matching
							regions.
						</p>
					</div>
				</Show>
			</div>

			<Show when={extractedStats().players && extractedStats().players.length > 0}>
				<EditableGameData
					initialPlayers={extractedStats().players || []}
					initialMatchInfo={
						extractedStats().matchInfo || {
							result: '',
							final_score: { blue: '', red: '' },
							date: '',
							game_mode: '',
							game_length: '',
						}
					}
					onSave={handleSaveData}
				/>
			</Show>

			<div class="ocr-output-grid">
				<Show when={extractedStats().players && extractedStats().players.length > 0}>
					<div class="stats-box">
						<h2>
							<span>Extracted Game Stats (JSON)</span>
						</h2>
						<div class="scrollable-content">
							<pre>{JSON.stringify(extractedStats(), null, 2)}</pre>
						</div>
					</div>
				</Show>

				<Show when={rawOcrText()}>
					<div class="ocr-output-box">
						<h2>
							<span>Raw OCR Text Output</span>
						</h2>
						<div class="scrollable-content">
							<pre>{rawOcrText()}</pre>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};

export default ScoreboardOCR;
