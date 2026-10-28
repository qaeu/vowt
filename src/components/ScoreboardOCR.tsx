import type { Component } from 'solid-js';
import {
	createSignal,
	createMemo,
	onCleanup,
	createEffect,
	on,
	For,
	Index,
	Show,
} from 'solid-js';
import Tesseract from 'tesseract.js';
import { X } from 'lucide-solid';

import type {
	PlayerStats,
	MatchInfo,
	GameRecord,
	TextRegion,
	ImageHash,
	ImageHashSet,
	RecognitionResult,
	AlertDialogOptions,
} from '#types';
import Screen from '#c/ui/Screen';
import AlertDialog from '#c/ui/AlertDialog';
import EditableGameData from '#c/ui/EditableGameData';
import Toaster, { toast } from '#c/ui/Toaster';
import {
	preprocessImageForOCR,
	preprocessRegionsForOCR,
	drawRegionsOnImage,
	groupRegionsByCharSet,
	getRegionImageData,
	getRegionDataURLs,
	getIsolatedTextDataURLs,
	loadImageDimensions,
	partitionRegionGroups,
} from '#utils/preprocess';
import { recogniseImage, mergeHashSets } from '#utils/imageRecognition';
import { alignRegionsToImage } from '#utils/regionAlignment';
import { extractGameStats, formatResults } from '#utils/postprocess';
import { loadOverFastData } from '#utils/overfastApi';
import { getHeroKey } from '#utils/gameData';
import { saveGameRecord, updateGameRecord, loadGameRecords } from '#utils/storage';
import { buildNameLexicon } from '#utils/playerNames';
import {
	getActiveProfile,
	getActiveProfileId,
	getActiveProfileAlignment,
	getActiveProfileHashSets,
	addProfileHashes,
} from '#utils/regionProfiles';
import { DEFAULT_HASH_SETS } from '#data/hashSets';

/** Screenshots uploaded together; a new object is queued even if the images repeat */
export interface UploadBatch {
	images: string[];
}

interface ScoreboardOCRProps {
	uploadBatch?: UploadBatch | null;
	onClose: () => void;
	onOpenRegionManager: () => void;
}

/** Hash computed for an image region, kept so user corrections can be learned */
interface LearnableHash {
	hashSetId: string;
	hash: string;
	/** Hash-set name recognised for the region, or empty if unrecognised */
	recognised: string;
	preview?: string;
}

/** Hero correction that can be saved as a new portrait hash */
interface HashCorrection extends LearnableHash {
	name: string;
	displayName: string;
}

/** Uploaded screenshot and the results of processing it */
interface ScreenshotJob {
	id: string;
	image: string;
	status: 'queued' | 'processing' | 'done' | 'error';
	error?: string;
	preprocessedPreview?: string;
	rawOcrText?: string;
	stats?: Pick<GameRecord, 'players' | 'matchInfo'>;
	recordId?: string;
	/** Profile the screenshot was read with, so learned hashes go to the right place */
	learnProfileId?: string;
	learnableHashes: Map<string, LearnableHash>;
}

const WORKER_COUNT = 2;

const JOB_STATUS_LABELS: Record<ScreenshotJob['status'], string> = {
	queued: 'Queued',
	processing: 'Processing',
	done: 'Done',
	error: 'Failed',
};

/** Tesseract init-only parameters; dictionaries bias reads towards English words */
const WORKER_INIT_CONFIG: Partial<Tesseract.InitOptions> = {
	load_system_dawg: '0',
	load_freq_dawg: '0',
};

/** Creates an English LSTM worker with dictionaries turned off */
const createOCRWorker = (): Promise<Tesseract.Worker> =>
	Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {}, WORKER_INIT_CONFIG);

const ScoreboardOCR: Component<ScoreboardOCRProps> = (props) => {
	const [jobs, setJobs] = createSignal<ScreenshotJob[]>([]);
	const [selectedJobId, setSelectedJobId] = createSignal<string>();
	const [error, setError] = createSignal<string>('');
	const [progress, setProgress] = createSignal<number>(0);
	const [expandedImage, setExpandedImage] = createSignal<
		'uploaded' | 'preprocessed' | null
	>(null);

	const navActions = [
		{
			id: 'show-region-profiles',
			text: 'Region Profiles',
			onClick: () => props.onOpenRegionManager(),
		},
		{
			id: 'close-screen',
			text: 'Close',
			icon: X,
			class: 'highlight',
			onClick: () => props.onClose(),
		},
	];

	let openDialog: ((options: AlertDialogOptions) => void) | null = null;
	let nextJobId = 0;
	let isQueueRunning = false;
	/** Whether the job being processed is shown, rather than one the user picked */
	let followQueue = true;
	let activeSchedulers: Tesseract.Scheduler[] = [];
	let activeWorkers: Tesseract.Worker[] = [];
	let isProcessingCancelled = false;

	onCleanup(async () => {
		isProcessingCancelled = true;
		await terminateAllWorkersAndSchedulers();
	});

	const selectedJob = createMemo(() => jobs().find(({ id }) => id === selectedJobId()));
	const selectedStats = () => {
		const stats = selectedJob()?.stats;
		return stats && stats.players.length > 0 ? stats : undefined;
	};
	const processingIndex = () => jobs().findIndex(({ status }) => status === 'processing');
	const errorMessage = () => error() || selectedJob()?.error;

	// Queue each uploaded batch, including drag-and-drop while on the OCR page
	createEffect(
		on(
			() => props.uploadBatch,
			(batch) => {
				if (batch && batch.images.length > 0) enqueueScreenshots(batch.images);
			}
		)
	);

	/** Updates a job without mutating the jobs list */
	const updateJob = (id: string, patch: Partial<ScreenshotJob>) => {
		setJobs((current) =>
			current.map((job) => (job.id === id ? { ...job, ...patch } : job))
		);
	};

	/** Shows a job's results; picking an unfinished job follows the queue again */
	const selectJob = (job: ScreenshotJob) => {
		setSelectedJobId(job.id);
		setError('');
		followQueue = job.status === 'queued' || job.status === 'processing';
	};

	/** Adds screenshots to the queue and starts it if idle */
	const enqueueScreenshots = (images: string[]) => {
		const newJobs: ScreenshotJob[] = images.map((image) => ({
			id: `screenshot_${nextJobId++}`,
			image,
			status: 'queued',
			learnableHashes: new Map(),
		}));
		setJobs((current) => [...current, ...newJobs]);
		followQueue = true;
		if (!isQueueRunning) {
			void runQueue();
		}
	};

	/** Processes queued screenshots one at a time until none are left */
	const runQueue = async () => {
		isQueueRunning = true;
		let saved = 0;
		let failed = 0;

		try {
			let job = jobs().find(({ status }) => status === 'queued');
			while (job && !isProcessingCancelled) {
				if (followQueue) {
					setSelectedJobId(job.id);
					setError('');
				}
				if (await processScreenshot(job)) saved++;
				else failed++;
				job = jobs().find(({ status }) => status === 'queued');
			}
		} finally {
			isQueueRunning = false;
		}

		if (isProcessingCancelled) return;

		if (saved + failed > 1) {
			const plural = saved === 1 ? '' : 's';
			const failures = failed > 0 ? `, ${failed} failed` : '';
			toast('Recognition Complete', `${saved} game record${plural} saved${failures}.`);
		} else if (saved === 1) {
			toast('Recognition Success', 'New game record saved.');
		}
	};

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

	/** Preprocesses image and updates the job's preview */
	const prepareImageForOCR = async (
		jobId: string,
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
		updateJob(jobId, { preprocessedPreview });
		return preprocessed;
	};

	/** Processes image hash regions using image recognition */
	const processImageHashRegions = async (
		regions: TextRegion[],
		imageDataMap: Map<string, ImageData>,
		allHashSets: ImageHashSet[],
		learnableHashes: Map<string, LearnableHash>,
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
				learnableHashes.set(region.name, {
					hashSetId: hashSet.id,
					hash: result.hash,
					recognised: result.name,
				});
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
				const worker = await createOCRWorker();
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
		const worker = await createOCRWorker();
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
		allHashSets: ImageHashSet[],
		learnableHashes: Map<string, LearnableHash>
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
				learnableHashes,
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

	/**
	 * Main image processing pipeline; saves a game record and stores results on the job
	 * @returns Whether a game record was saved
	 */
	const processScreenshot = async (job: ScreenshotJob): Promise<boolean> => {
		const imageToProcess = job.image;
		const learnableHashes = new Map<string, LearnableHash>();
		updateJob(job.id, {
			status: 'processing',
			learnProfileId: getActiveProfileId(),
			learnableHashes,
		});
		setProgress(0);

		try {
			const { width, height } = await loadImageDimensions(imageToProcess);

			const profileRegions = getActiveProfile(width, height);
			if (!profileRegions || profileRegions.length === 0) {
				throw new Error('No scoreboard regions defined in the active profile.');
			}

			// Shift regions to follow minor layout changes in this screenshot
			const scoreboardRegions = await alignRegionsToImage(
				imageToProcess,
				profileRegions,
				getActiveProfileAlignment(),
				width,
				height
			);

			if (isProcessingCancelled) return false;

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

			if (isProcessingCancelled) return false;

			// Preprocess OCR regions
			const preprocessedRegionMap = preprocessRegionsForOCR(
				allRegionImageDataMap,
				ocrRegions
			);
			const preprocessedImage = await prepareImageForOCR(
				job.id,
				imageToProcess,
				scoreboardRegions,
				preprocessedRegionMap
			);

			if (isProcessingCancelled) return false;

			const ocrDataURLMap = await getRegionDataURLs(preprocessedImage, ocrRegions);

			// These skip the global filter, which would invert them again
			for (const [name, dataURL] of getIsolatedTextDataURLs(
				preprocessedRegionMap,
				ocrRegions
			)) {
				ocrDataURLMap.set(name, dataURL);
			}

			if (isProcessingCancelled) return false;

			const hashImageDataMap = new Map<string, ImageData>();
			for (const region of imageHashRegions) {
				const imageData = allRegionImageDataMap.get(region.name);
				if (imageData) {
					hashImageDataMap.set(region.name, imageData);
				}
			}

			// Learned profile hashes extend the bundled sets with the same ID
			const allHashSets = mergeHashSets([
				...getActiveProfileHashSets(),
				...DEFAULT_HASH_SETS,
			]);
			const ocrResults = await processRegions(
				scoreboardRegions,
				ocrDataURLMap,
				hashImageDataMap,
				allHashSets,
				learnableHashes
			);

			if (!ocrResults || isProcessingCancelled) return false;

			// Thumbnails of hash regions for the learn-hash prompt
			const hashPreviewMap = await getRegionDataURLs(imageToProcess, imageHashRegions);
			for (const [regionName, learnable] of learnableHashes) {
				learnable.preview = hashPreviewMap.get(regionName);
			}

			const stats = extractGameStats(
				ocrResults.regionResults,
				loadOverFastData(),
				buildNameLexicon(loadGameRecords())
			);
			const recordId = saveGameRecord(stats.players, stats.matchInfo);
			updateJob(job.id, {
				status: 'done',
				rawOcrText: ocrResults.ocrTextParts.join('\n'),
				stats,
				recordId,
			});
			return true;
		} catch (err) {
			updateJob(job.id, {
				status: 'error',
				error: err instanceof Error ? err.message : 'Unknown error occurred',
			});
			console.error('Processing error:', err);
			return false;
		}
	};

	const handleSaveData = (
		jobId: string,
		players: PlayerStats[],
		matchInfo: MatchInfo
	) => {
		const job = jobs().find(({ id }) => id === jobId);
		if (!job?.recordId) return;
		try {
			updateGameRecord(job.recordId, players, matchInfo);
			// Keep edits when switching between screenshots
			updateJob(jobId, { stats: { players, matchInfo } });
			toast('Save Success', 'Game record updated.');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save game record');
			return;
		}
		promptToLearnHashes(job, players);
	};

	/** Finds saved heroes that differ from the hero recognised from their portrait */
	const findHashCorrections = (
		learnableHashes: Map<string, LearnableHash>,
		players: PlayerStats[]
	): HashCorrection[] => {
		const heroes = loadOverFastData()?.heroes ?? [];
		const teamCounts: Partial<Record<PlayerStats['team'], number>> = {};
		const corrections: HashCorrection[] = [];

		// Players are ordered by team, matching the `${team}_player${n}_hero` regions
		for (const player of players) {
			const playerNumber = (teamCounts[player.team] ?? 0) + 1;
			teamCounts[player.team] = playerNumber;

			const learnable = learnableHashes.get(`${player.team}_player${playerNumber}_hero`);
			if (!learnable || !player.hero?.trim()) continue;

			const name = getHeroKey(player.hero, heroes);
			if (name && name !== getHeroKey(learnable.recognised, heroes)) {
				corrections.push({ ...learnable, name, displayName: player.hero.trim() });
				// Only prompt once per correction, whether or not it is saved
				learnable.recognised = name;
			}
		}

		return corrections;
	};

	/** Asks whether corrected hero portraits should be saved as new hashes */
	const promptToLearnHashes = (job: ScreenshotJob, players: PlayerStats[]) => {
		const corrections = findHashCorrections(job.learnableHashes, players);
		if (corrections.length === 0) return;

		const plural = corrections.length === 1 ? '' : 's';
		openDialog?.({
			title: 'Remember Hero Portraits?',
			description: `Save ${corrections.length} corrected hero portrait${plural} so they are recognised in future screenshots.`,
			content: () => (
				<ul class="learn-hash-list">
					<For each={corrections}>
						{(correction) => (
							<li class="learn-hash-item">
								<Show when={correction.preview}>
									{(preview) => <img src={preview()} alt={correction.displayName} />}
								</Show>
								<span>{correction.displayName}</span>
							</li>
						)}
					</For>
				</ul>
			),
			actionText: 'Remember',
			onConfirm: () => saveHashCorrections(job.learnProfileId ?? '', corrections),
		});
	};

	/** Saves hero corrections to the active profile's hash sets */
	const saveHashCorrections = (learnProfileId: string, corrections: HashCorrection[]) => {
		try {
			const hashesBySet = Map.groupBy(corrections, ({ hashSetId }) => hashSetId);
			let saved = 0;
			for (const [hashSetId, setCorrections] of hashesBySet) {
				const hashes: ImageHash[] = setCorrections.map(({ name, hash }) => ({
					name,
					hash,
				}));
				saved += addProfileHashes(learnProfileId, hashSetId, hashes);
			}
			const plural = saved === 1 ? '' : 's';
			toast('Portraits Saved', `${saved} hero portrait${plural} learned.`);
		} catch (err) {
			console.error('Error saving hero portrait hashes:', err);
			setError(
				'Could not save hero portraits. Check that the active region profile still exists.'
			);
		}
	};

	return (
		<Screen
			id="scoreboard-ocr-screen"
			title="Image Processing"
			navActions={() => navActions}
		>
			<Show when={errorMessage()}>
				<div class="error-box">
					<strong>Error:</strong> {errorMessage()}
				</div>
			</Show>

			<Show when={processingIndex() >= 0}>
				<div class="progress-container">
					<p class="progress-text">
						<Show when={jobs().length > 1} fallback="Processing image... ">
							Processing image {processingIndex() + 1} of {jobs().length}...{' '}
						</Show>
						{progress()}%
					</p>
					<div class="progress-bar-wrapper">
						<div class="progress-bar" style={{ width: `${progress()}%` }} />
					</div>
				</div>
			</Show>

			<Show when={jobs().length > 1}>
				<ol class="screenshot-queue" aria-label="Uploaded screenshots">
					<Index each={jobs()}>
						{(job, i) => (
							<li>
								<button
									type="button"
									class="screenshot-queue-item"
									classList={{ selected: job().id === selectedJobId() }}
									data-status={job().status}
									aria-current={job().id === selectedJobId() ? 'true' : undefined}
									title={job().error}
									onClick={() => selectJob(job())}
								>
									<img src={job().image} alt={`Screenshot ${i + 1}`} />
									<span class="screenshot-queue-status">
										{JOB_STATUS_LABELS[job().status]}
									</span>
								</button>
							</li>
						)}
					</Index>
				</ol>
			</Show>

			<div class="image-grid">
				<Show when={selectedJob()?.image}>
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
						<img src={selectedJob()?.image} alt="Uploaded Image" />
					</div>
				</Show>

				<Show when={selectedJob()?.preprocessedPreview}>
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
							src={selectedJob()?.preprocessedPreview}
							alt="Pre-processed scoreboard with regions and unskew applied"
						/>
						<p>
							Filtered for OCR clarity. Red boxes show text regions. Green boxes show
							regions with transformed italic text. Magenta boxes show regions cleaned up
							on their own (enlarged and cropped to the text). Blue boxes show image
							matching regions.
						</p>
					</div>
				</Show>
			</div>

			{/* Keyed by job so switching screenshots remounts the editor with that record */}
			<Show when={selectedStats() && selectedJobId()} keyed>
				{(jobId) => (
					<EditableGameData
						initialPlayers={selectedStats()?.players ?? []}
						initialMatchInfo={selectedStats()?.matchInfo ?? ({} as MatchInfo)}
						onSave={(players, matchInfo) => handleSaveData(jobId, players, matchInfo)}
					/>
				)}
			</Show>

			<div class="ocr-output-grid">
				<Show when={selectedStats()}>
					<div class="stats-box">
						<h2>
							<span>Extracted Game Stats (JSON)</span>
						</h2>
						<div class="scrollable-content">
							<pre>{JSON.stringify(selectedStats(), null, 2)}</pre>
						</div>
					</div>
				</Show>

				<Show when={selectedJob()?.rawOcrText}>
					<div class="ocr-output-box">
						<h2>
							<span>Raw OCR Text Output</span>
						</h2>
						<div class="scrollable-content">
							<pre>{selectedJob()?.rawOcrText}</pre>
						</div>
					</div>
				</Show>
			</div>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default ScoreboardOCR;
