import {
	createSignal,
	onMount,
	onCleanup,
	createEffect,
	Show,
	type Component,
} from 'solid-js';
import Tesseract, { createScheduler, createWorker } from 'tesseract.js';

import type {
	PlayerStats,
	MatchInfo,
	GameRecord,
	TextRegion,
	ImageHashSet,
} from '#types';
import EditableGameData from '#c/EditableGameData';
import { preprocessImageForOCR, drawRegionsOnImage } from '#utils/preprocess';
import { recogniseImage } from '#utils/imageRecognition';
import { extractGameStats } from '#utils/postprocess';
import { saveGameRecord, updateGameRecord } from '#utils/gameStorage';
import { getActiveProfile, getActiveProfileHashSets } from '#utils/regionProfiles';
import { DEFAULT_HASH_SETS } from '#data/hashSets';
import '#styles/ScoreboardOCR';

const WORKER_COUNT = 4;

interface ScoreboardOCRProps {
	uploadedImage?: string | null;
	onClose: () => void;
	onOpenRegionManager: () => void;
}

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
	const [currentImage, setCurrentImage] = createSignal<string>();

	let recordId: string;
	let activeScheduler: Tesseract.Scheduler | null = null;
	let isProcessingCancelled = false;

	onCleanup(async () => {
		isProcessingCancelled = true;
		if (activeScheduler) {
			await activeScheduler.terminate();
			activeScheduler = null;
		}
	});

	onMount(async () => {
		if (props.uploadedImage) {
			setCurrentImage(props.uploadedImage);
			await processImage(props.uploadedImage);
		}
	});

	// React to changes in uploadedImage prop (e.g., drag-and-drop while on OCR page)
	createEffect(() => {
		const uploaded = props.uploadedImage;
		if (uploaded && uploaded !== currentImage()) {
			setCurrentImage(uploaded);
			processImage(uploaded);
		}
	});

	/** Loads an image and returns its dimensions */
	const loadImageDimensions = (imageSrc: string) => {
		return new Promise<{ width: number; height: number }>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve({ width: img.width, height: img.height });
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = imageSrc;
		});
	};

	/** Preprocesses image and updates preview state */
	const prepareImageForOCR = async (imageSrc: string) => {
		const preprocessed = await preprocessImageForOCR(imageSrc);
		const preprocessedPreview = await drawRegionsOnImage(preprocessed, imageSrc);
		setPreprocessedImagePreview(preprocessedPreview);
		return preprocessed;
	};

	/** Processes a single region using either image hash matching or OCR via scheduler */
	const processRegion = async (
		region: TextRegion,
		scheduler: Tesseract.Scheduler,
		preprocessedImage: string,
		originalImage: string,
		allHashSets: ImageHashSet[]
	): Promise<{ name: string; value: string; confidence: number }> => {
		// Use image recognition for regions with imgHash
		if (region.imgHashSet && region.imgHashSet.length > 0) {
			const hashSet = allHashSets.find((hs) => hs.id === region.imgHashSet);

			if (!hashSet) {
				console.warn(
					`Hash set '${region.imgHashSet}' not found for region '${region.name}'`
				);
				return { name: region.name, value: '', confidence: 0 };
			}

			const result = await recogniseRegionImage(originalImage, region, hashSet);
			return { name: region.name, value: result.name, confidence: result.confidence };
		}

		// Use OCR for text regions via scheduler
		const result = await scheduler.addJob('recognize', preprocessedImage, {
			rectangle: {
				left: region.x,
				top: region.y,
				width: region.width,
				height: region.height,
			},
		});
		return {
			name: region.name,
			value: result.data.text.trim(),
			confidence: result.data.confidence,
		};
	};

	/** Runs OCR on all regions using scheduler with multiple workers */
	const runRegionOCR = async (
		regions: TextRegion[],
		preprocessedImage: string,
		originalImage: string,
		allHashSets: ImageHashSet[]
	): Promise<{ ocrTextParts: string[]; regionResults: Map<string, string> } | null> => {
		if (isProcessingCancelled) return null;

		// Create scheduler and workers
		const scheduler = createScheduler();
		activeScheduler = scheduler;

		try {
			// Create workers in parallel
			const workerPromises = Array(WORKER_COUNT)
				.fill(null)
				.map(async () => {
					const worker = await createWorker('eng');
					await worker.setParameters({
						tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
					});
					scheduler.addWorker(worker);
				});
			await Promise.all(workerPromises);

			if (isProcessingCancelled) return null;

			// Process all regions in parallel using scheduler
			const regionPromises = regions.map((region, i) =>
				processRegion(region, scheduler, preprocessedImage, originalImage, allHashSets).then(
					(result) => {
						setProgress(Math.round(((i + 1) / regions.length) * 100));
						return result;
					}
				)
			);

			const results = await Promise.all(regionPromises);

			if (isProcessingCancelled) return null;

			const ocrTextParts: string[] = [];
			const regionResults = new Map<string, string>();

			for (const result of results) {
				ocrTextParts.push(`${result.name} (${result.confidence}%): ${result.value}`);
				regionResults.set(result.name, result.value);
			}

			return { ocrTextParts, regionResults };
		} finally {
			await scheduler.terminate();
			activeScheduler = null;
		}
	};

	/** Main image processing pipeline */
	const processImage = async (imagePath?: string) => {
		const imageToProcess = (imagePath || currentImage()) as string;
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
			const ocrResults = await runRegionOCR(
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
				const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
				<Show when={currentImage()}>
					<div class="image-container">
						<h2>Uploaded Image</h2>
						<img src={currentImage()} alt="Uploaded Image" />
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
