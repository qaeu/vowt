import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import Tesseract from 'tesseract.js';

import type {
	PlayerStats,
	MatchInfo,
	GameRecord,
	TextRegion,
	ImageHashSet,
	RecognitionResult,
} from '#types';
import Screen from '#c/Screen';
import EditableGameData from '#c/EditableGameData';
import {
	preprocessImageForOCR,
	preprocessRegionsForOCR,
	drawRegionsOnImage,
	groupRegionsByCharSet,
	getRegionImageData,
	getRegionDataURLs,
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
	const [expandedImage, setExpandedImage] = createSignal<
		'uploaded' | 'preprocessed' | null
	>(null);

	const screenActions = [
		{
			id: 'show-region-profiles',
			text: 'Region Profiles',
			onClick: () => props.onOpenRegionManager(),
		},
		{
			id: 'close-screen',
			text: '✕ Close',
			onClick: () => props.onClose(),
		},
	];

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
	const prepareImageForOCR = async (
		imageSrc: string,
		regions: TextRegion[],
		preprocessedRegionMap: Map<string, ImageData>
	) => {
		const preprocessed = await preprocessImageForOCR(
			imageSrc,
			regions,
			preprocessedRegionMap
		);
		const preprocessedPreview = await drawRegionsOnImage(preprocessed, regions);
		setPreprocessedImagePreview(preprocessedPreview);
		return preprocessed;
	};

	/** Processes image hash regions using image recognition */
	const processImageHashRegions = async (
		regions: TextRegion[],
		imageDataMap: Map<string, ImageData>,
		allHashSets: ImageHashSet[],
		onProgress: () => void
	): Promise<RecognitionResult[]> => {
		const results: RecognitionResult[] = [];

		for (const region of regions) {
			if (isProcessingCancelled) break;

			const hashSet = allHashSets.find((hs) => hs.id === region.imgHashSet);
			const imageData = imageDataMap.get(region.name);

			if (!hashSet) {
				console.warn(
					`Hash set '${region.imgHashSet}' not found for region '${region.name}'`
				);
				results.push({ name: region.name, value: '', confidence: 0 });
			} else if (!imageData) {
				console.warn(`ImageData not found for region '${region.name}'`);
				results.push({ name: region.name, value: '', confidence: 0 });
			} else {
				const result = recogniseImage(imageData, hashSet);
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
		dataURLMap: Map<string, string>,
		onProgress: () => void
	): Promise<RecognitionResult[]> => {
		const regionPromises = regions.map((region) => {
			const dataUrl = dataURLMap.get(region.name);
			if (!dataUrl) {
				onProgress();
				return Promise.resolve({
					name: region.name,
					value: '',
					confidence: 0,
				});
			}
			return scheduler.addJob('recognize', dataUrl).then((result) => {
				onProgress();
				return {
					name: region.name,
					value: result.data.text.trim(),
					confidence: result.data.confidence,
				};
			});
		});
		return Promise.all(regionPromises);
	};

	/** Process regions using a standalone worker, setting parameters per recognize() */
	const processRegionsWithWorker = async (
		worker: Tesseract.Worker,
		charSet: string,
		regions: TextRegion[],
		dataURLMap: Map<string, string>,
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

			const dataUrl = dataURLMap.get(region.name);
			if (!dataUrl) {
				results.push({ name: region.name, value: '', confidence: 0 });
				onProgress();
				continue;
			}

			const result = await worker.recognize(dataUrl);
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
		dataURLMap: Map<string, string>,
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
				dataURLMap,
				onProgress
			)
		);
	};

	/** Processes small region groups sequentially with a reusable worker */
	const processSmallGroups = async (
		smallGroups: { charSet: string; regions: TextRegion[] }[],
		dataURLMap: Map<string, string>,
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
				dataURLMap,
				onProgress
			);
			results.push(...groupResults);
		}

		return results;
	};

	/** Start recognition of all regions */
	const processRegions = async (
		regions: TextRegion[],
		ocrDataURLMap: Map<string, string>,
		hashImageDataMap: Map<string, ImageData>,
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

			if (isProcessingCancelled) return null;

			// Partition OCR regions by size
			const charSetGroups = groupRegionsByCharSet(ocrRegions);
			const { largeGroups, smallGroups } = partitionRegionGroups(charSetGroups);

			// Start all parallel processing
			const imageHashResultsPromise = processImageHashRegions(
				imageHashRegions,
				hashImageDataMap,
				allHashSets,
				onProgress
			);
			const schedulerResultPromises = await processLargeGroups(
				largeGroups,
				ocrDataURLMap,
				onProgress
			);
			const smallGroupResults = await processSmallGroups(
				smallGroups,
				ocrDataURLMap,
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

			const scoreboardRegions = getActiveProfile(width, height);
			if (!scoreboardRegions || scoreboardRegions.length === 0) {
				setError('No scoreboard regions defined in the active profile.');
				return;
			}

			// Partition regions by type
			const { imageHashRegions = [], ocrRegions = [] } = Object.groupBy(
				scoreboardRegions,
				({ imgHashSet }) =>
					imgHashSet && imgHashSet.length > 0 ? 'imageHashRegions' : 'ocrRegions'
			);

			const allRegionImageDataMap = await getRegionImageData(
				imageToProcess,
				scoreboardRegions
			);

			if (isProcessingCancelled) return;

			// Preprocess OCR regions
			const preprocessedRegionMap = preprocessRegionsForOCR(
				allRegionImageDataMap,
				ocrRegions
			);
			const preprocessedImage = await prepareImageForOCR(
				imageToProcess,
				scoreboardRegions,
				preprocessedRegionMap
			);

			if (isProcessingCancelled) return;

			const ocrDataURLMap = await getRegionDataURLs(preprocessedImage, ocrRegions);

			if (isProcessingCancelled) return;

			const hashImageDataMap = new Map<string, ImageData>();
			for (const region of imageHashRegions) {
				const imageData = allRegionImageDataMap.get(region.name);
				if (imageData) {
					hashImageDataMap.set(region.name, imageData);
				}
			}

			const allHashSets = [...getActiveProfileHashSets(), ...DEFAULT_HASH_SETS];
			const ocrResults = await processRegions(
				scoreboardRegions,
				ocrDataURLMap,
				hashImageDataMap,
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

	const handleSaveData = (players: PlayerStats[], matchInfo: MatchInfo) => {
		try {
			updateGameRecord(recordId, players, matchInfo);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save game record');
		}
	};

	return (
		<Screen id="scoreboard" title="Image Processing" actions={() => screenActions}>
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
					<div
						class="image-container"
						classList={{
							expanded: expandedImage() === 'uploaded',
							hidden: expandedImage() === 'preprocessed',
						}}
						onClick={() =>
							setExpandedImage(expandedImage() === 'uploaded' ? null : 'uploaded')
						}
					>
						<h2>Uploaded Image</h2>
						<img src={currentScreenshot()} alt="Uploaded Image" />
					</div>
				</Show>

				<Show when={preprocessedImagePreview()}>
					<div
						class="image-container"
						classList={{
							expanded: expandedImage() === 'preprocessed',
							hidden: expandedImage() === 'uploaded',
						}}
						onClick={() =>
							setExpandedImage(expandedImage() === 'preprocessed' ? null : 'preprocessed')
						}
					>
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
		</Screen>
	);
};

export default ScoreboardOCR;
