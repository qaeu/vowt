import { createSignal, onMount, createEffect, Show, type Component } from 'solid-js';
import Tesseract from 'tesseract.js';

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
	const [showJsonStats, setShowJsonStats] = createSignal(false);
	const [showRawText, setShowRawText] = createSignal(false);

	let recordId: string;

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

	const processImage = async (imagePath?: string) => {
		const imageToProcess = (imagePath || currentImage()) as string;
		try {
			setIsProcessing(true);
			setError('');

			const imageDimensions = await new Promise<{
				width: number;
				height: number;
			}>((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve({ width: img.width, height: img.height });
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = imageToProcess;
			});

			// Step 1: Preprocess the full image
			const preprocessed = await preprocessImageForOCR(imageToProcess);

			// Preview preprocessed image with regions
			const preprocessedPreview = await drawRegionsOnImage(preprocessed, imageToProcess);
			setPreprocessedImagePreview(preprocessedPreview);

			// Step 2: Perform region-based OCR using Tesseract.js
			const ocrTextParts: string[] = [];
			const regionResults = new Map<string, string>();

			const scoreboardRegions = getActiveProfile(
				imageDimensions.width,
				imageDimensions.height
			);
			const regionCount = scoreboardRegions.length;

			if (!scoreboardRegions || regionCount === 0) {
				setError('No scoreboard regions defined in the active profile.');
				return;
			}

			const allHashSets = [...getActiveProfileHashSets(), ...DEFAULT_HASH_SETS];
			const worker = await Tesseract.createWorker('eng', 1);

			for (let i = 0; i < regionCount; i++) {
				const region = scoreboardRegions[i];
				setProgress(Math.round((i / regionCount) * 100));

				// Use image recognition for regions with imgHash, OCR for text regions
				if (region.imgHashSet && region.imgHashSet?.length > 0) {
					const hashSet = allHashSets.find((hs) => hs.id === region.imgHashSet);

					if (!hashSet) {
						console.warn(
							`Hash set '${region.imgHashSet}' not found for region '${region.name}'`
						);
						regionResults.set(region.name, '');
						continue;
					}

					const result = await recogniseRegionImage(imageToProcess, region, hashSet);

					const name = result.name;
					const confidence = result.confidence;

					ocrTextParts.push(`${region.name} (${confidence}%): ${name}`);
					regionResults.set(region.name, name);
				} else {
					const result = await recogniseRegionText(worker, preprocessed, region);

					const text = result.data.text.trim();
					const confidence = result.data.confidence;

					ocrTextParts.push(`${region.name} (${confidence}%): ${text}`);
					regionResults.set(region.name, text);
				}
			}
			await worker.terminate();

			// Combine all OCR results for display
			setRawOcrText(ocrTextParts.join('\n'));

			// Step 3: Extract game stats from region results
			const stats = extractGameStats(regionResults);
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
		worker: Tesseract.Worker,
		image: string,
		region: TextRegion
	) => {
		await worker.setParameters({
			tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
			tessedit_char_whitelist: region.charSet,
		});

		// Recognize text in this region
		const result = await worker.recognize(image, {
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
							Filtered for OCR clarity. Red boxes show scoreboard regions. Green boxes
							show scoreboard regions with transformed italic text.
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

			<Show when={extractedStats().players && extractedStats().players.length > 0}>
				<div class="stats-box">
					<h2 onClick={() => setShowJsonStats(!showJsonStats())}>
						<span>Extracted Game Stats (JSON)</span>
						<span>{showJsonStats() ? '▼' : '▶'}</span>
					</h2>
					<Show when={showJsonStats()}>
						<pre>{JSON.stringify(extractedStats(), null, 2)}</pre>
						<p class="stats-message">
							✓ Successfully parsed {Object.keys(extractedStats()).length} data fields
							from the scoreboard
						</p>
					</Show>
				</div>
			</Show>

			<Show when={rawOcrText()}>
				<div class="ocr-output-box">
					<h2 onClick={() => setShowRawText(!showRawText())}>
						<span>Raw OCR Text Output</span>
						<span>{showRawText() ? '▼' : '▶'}</span>
					</h2>
					<Show when={showRawText()}>
						<pre>{rawOcrText()}</pre>
					</Show>
				</div>
			</Show>
		</div>
	);
};

export default ScoreboardOCR;
