import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSignal } from 'solid-js';
import { render, waitFor, screen, fireEvent } from '@solidjs/testing-library';

import ScoreboardOCR from '#c/ScoreboardOCR';

// Records saved by one test would make the next test's screenshot a duplicate
beforeEach(() => {
	localStorage.clear();
});

// Mock Image constructor for image dimension detection
beforeEach(() => {
	class MockImage {
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		src = '';
		width = 2560;
		height = 1440;

		constructor() {
			setTimeout(() => {
				if (this.onload) {
					this.onload();
				}
			}, 0);
		}
	}
	(globalThis as unknown as Record<string, typeof MockImage>).Image = MockImage;
});

// Mock tesseract.js with scheduler support
vi.mock('tesseract.js', () => {
	const mockAddJob = vi.fn().mockResolvedValue({
		data: {
			text: 'VICTORY',
			confidence: 95,
		},
	});
	const mockSchedulerTerminate = vi.fn().mockResolvedValue(undefined);
	const mockAddWorker = vi.fn();
	const mockCreateScheduler = vi.fn().mockReturnValue({
		addWorker: mockAddWorker,
		addJob: mockAddJob,
		terminate: mockSchedulerTerminate,
	});
	const mockWorker = {
		recognize: vi.fn().mockResolvedValue({
			data: {
				text: 'VICTORY',
				confidence: 95,
			},
		}),
		terminate: vi.fn().mockResolvedValue(undefined),
		setParameters: vi.fn().mockResolvedValue(undefined),
	};
	const mockCreateWorker = vi.fn().mockResolvedValue(mockWorker);

	return {
		default: {
			PSM: { SINGLE_LINE: 7 },
			OEM: { LSTM_ONLY: 1 },
			createScheduler: mockCreateScheduler,
			createWorker: mockCreateWorker,
		},
		PSM: { SINGLE_LINE: 7 },
		OEM: { LSTM_ONLY: 1 },
		createScheduler: mockCreateScheduler,
		createWorker: mockCreateWorker,
	};
});

// Mock EditableGameData component
vi.mock('#c/ui/EditableGameData', async () => {
	const { createSignal } = await import('solid-js');
	return {
		default: (props: {
			initialPlayers?: Array<{ name: string }>;
			initialMatchInfo: { result: string };
			onDirtyChange?: (dirty: boolean) => void;
			registerActions?: (actions: { save: () => void; reset: () => void }) => void;
			onSave: (players: Array<{ name: string }>, matchInfo: { result: string }) => void;
		}) => {
			const [resets, setResets] = createSignal(0);
			props.onDirtyChange?.(false);
			props.registerActions?.({
				save: () => {
					props.onSave(props.initialPlayers || [], props.initialMatchInfo);
					props.onDirtyChange?.(false);
				},
				reset: () => {
					setResets(resets() + 1);
					props.onDirtyChange?.(false);
				},
			});
			return (
				<div data-testid="editable-game-data">
					<button data-testid="make-dirty" onClick={() => props.onDirtyChange?.(true)}>
						Edit
					</button>
					<span data-testid="reset-count">{resets()}</span>
					<div data-testid="players-data">
						{props.initialPlayers
							&& props.initialPlayers.map((p: { name: string }) => (
								<div data-testid={`player-${p.name}`}>{p.name}</div>
							))}
					</div>
					<div data-testid="match-info-data">{props.initialMatchInfo.result}</div>
					<button
						onClick={() =>
							props.onSave(props.initialPlayers || [], props.initialMatchInfo)
						}
						data-testid="save-button"
					>
						Save
					</button>
				</div>
			);
		},
	};
});

// Mock the image preprocessing module
vi.mock('#utils/preprocess', () => ({
	preprocessImageForOCR: vi.fn().mockResolvedValue('data:image/png;base64,mockdata'),
	preprocessRegionsForOCR: vi.fn().mockImplementation((regionImageDataMap, regions) => {
		// Return the same map - in tests we don't need actual preprocessing
		const preprocessedMap = new Map();
		for (const region of regions) {
			const imageData = regionImageDataMap.get(region.name);
			if (imageData) {
				preprocessedMap.set(region.name, imageData);
			}
		}
		return preprocessedMap;
	}),
	drawRegionsOnImage: vi.fn().mockResolvedValue('data:image/png;base64,regionmockdata'),
	getRegionImageData: vi.fn().mockImplementation((imageSrc, regions) => {
		const map = new Map();
		for (const region of regions) {
			map.set(region.name, {
				width: region.width,
				height: region.height,
				data: new Uint8ClampedArray(region.width * region.height * 4),
			});
		}
		return Promise.resolve(map);
	}),
	getRegionDataURLs: vi.fn().mockImplementation((imageSrc, regions) => {
		const map = new Map();
		for (const region of regions) {
			map.set(region.name, `data:image/png;base64,region_${region.name}`);
		}
		return Promise.resolve(map);
	}),
	getIsolatedTextDataURLs: vi.fn().mockImplementation((_map, regions) => {
		const map = new Map();
		for (const region of regions) {
			if (region.isolateText) {
				map.set(region.name, `data:image/png;base64,isolated_${region.name}`);
			}
		}
		return map;
	}),
	getScoreboardRegions: vi
		.fn()
		.mockReturnValue([{ name: 'region_0', x: 0, y: 0, width: 100, height: 100 }]),
	getMatchInfoRegions: vi
		.fn()
		.mockReturnValue([{ name: 'region_1', x: 0, y: 0, width: 100, height: 100 }]),
	groupRegionsByCharSet: vi.fn((regions) => {
		const groups = new Map<string, typeof regions>();
		for (const region of regions) {
			const key = region.charSet || '';
			const existing = groups.get(key) || [];
			existing.push(region);
			groups.set(key, existing);
		}
		return groups;
	}),
	loadImageDimensions: vi.fn().mockResolvedValue({ width: 2560, height: 1440 }),
	partitionRegionGroups: vi.fn((charSetGroups) => {
		const entries = [...charSetGroups.entries()].map(
			([charSet, regions]: [string, unknown[]]) => ({
				charSet,
				regions,
			})
		);
		const large = entries.filter(({ regions }) => regions.length > 3);
		const small = entries.filter(({ regions }) => regions.length <= 3);
		return { largeGroups: large, smallGroups: small };
	}),
}));

vi.mock('#utils/postprocess', () => ({
	extractGameStats: vi.fn().mockReturnValue({
		players: [
			{
				name: 'VEQ',
				team: 'blue',
				e: 10,
				a: 4,
				d: 3,
				dmg: 15542,
				h: 12345,
				mit: 500,
			},
		],
		matchInfo: {
			result: 'VICTORY',
			final_score: '3VS2',
			date: '09/15/25 - 02:49',
			game_mode: 'ESCORT',
		},
	}),
	formatResults: vi.fn((allResults) => {
		const ocrTextParts: string[] = [];
		const regionResults = new Map<string, string>();
		for (const result of allResults) {
			ocrTextParts.push(`${result.name} (${result.confidence}%): ${result.value}`);
			regionResults.set(result.name, result.value);
		}
		return { ocrTextParts, regionResults };
	}),
}));

vi.mock('#utils/regionProfiles', () => ({
	getActiveProfile: vi.fn().mockReturnValue([
		{ name: 'region_0', x: 0, y: 0, width: 100, height: 100 },
		{ name: 'region_1', x: 100, y: 0, width: 100, height: 100 },
	]),
	getActiveProfileId: vi.fn().mockReturnValue('test_profile'),
	getActiveProfileHashSets: vi.fn().mockReturnValue([]),
	getActiveProfileAlignment: vi.fn().mockReturnValue([]),
	addProfileHashes: vi.fn().mockReturnValue(1),
}));

vi.mock('#utils/regionAlignment', () => ({
	alignRegionsToImage: vi
		.fn()
		.mockImplementation((_src, regions) => Promise.resolve(regions)),
}));

vi.mock('#utils/imageRecognition', () => ({
	recogniseImage: vi
		.fn()
		.mockReturnValue({ name: 'ana', confidence: 85, hash: '6b2b17451147b400' }),
	mergeHashSets: vi.fn((hashSets) => hashSets),
}));

vi.mock('#data/hashSets', () => ({
	DEFAULT_HASH_SETS: [
		{
			id: 'hero-portraits',
			description: 'Hero portrait hashes',
			hashes: [{ name: 'ana', hash: '6b2b17451147b400' }],
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	],
}));

// Mock gameStorage module
vi.mock('#utils/gameStorage', () => ({
	saveGameRecord: vi.fn().mockReturnValue('game_123'),
	updateGameRecord: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage so saved records can be stubbed per test
vi.mock('#utils/storage', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#utils/storage')>();
	return {
		...actual,
		loadGameRecords: vi.fn(actual.loadGameRecords),
		saveGameRecord: vi.fn(actual.saveGameRecord),
		updateGameRecord: vi.fn(actual.updateGameRecord),
	};
});

describe('ScoreboardOCR', () => {
	it('should render the component', () => {
		const { getByText } = render(() => <ScoreboardOCR />);
		expect(getByText('Image Processing')).toBeDefined();
	});

	it('should not render original image section', () => {
		const { queryByText, queryByAltText } = render(() => <ScoreboardOCR />);
		expect.soft(queryByText('Original Image')).toBeNull();
		expect.soft(queryByAltText('Original scoreboard')).toBeNull();
	});

	describe('when an upload batch is provided', () => {
		it('should render original image section', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { getByAltText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			expect(getByAltText('Uploaded Image')).not.toBeNull();
		});

		it('should show processing indicator when an upload batch is provided', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			// Check for processing text (may be brief)
			const processingText = queryByText(/Reading screenshot/);
			expect(processingText).not.toBeNull();
		});

		it('should display preprocessed image after processing uploaded image', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			render(() => <ScoreboardOCR uploadBatch={{ images: [testImageData] }} />);

			await waitFor(
				() => {
					expect(screen.getByRole('button', { name: 'Processed' })).toHaveProperty(
						'disabled',
						false
					);
				},
				{ timeout: 1500 }
			);
		});

		it('should display raw OCR text output with uploaded image', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { getByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					expect(getByText('Raw OCR Text Output')).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should display extracted game stats JSON with uploaded image', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { getByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					expect(getByText('Extracted Game Stats (JSON)')).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should have collapsible JSON stats section', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					const jsonHeader = queryByText(/Extracted Game Stats \(JSON\)/);
					expect(jsonHeader).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should have collapsible raw text section', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					expect(queryByText(/Raw OCR Text Output/)).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should render EditableGameData when stats are extracted', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByTestId } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					expect(queryByTestId('editable-game-data')).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should pass extracted players to EditableGameData', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByTestId } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					const playerElement = queryByTestId('player-VEQ');
					expect(playerElement).not.toBeNull();
					expect(playerElement?.textContent).toBe('VEQ');
				},
				{ timeout: 1500 }
			);
		});

		it('should pass extracted match info to EditableGameData', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByTestId } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					const matchInfoElement = queryByTestId('match-info-data');
					expect(matchInfoElement?.textContent).toBe('VICTORY');
				},
				{ timeout: 1500 }
			);
		});

		it('should call onSave handler when EditableGameData save is triggered', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByTestId } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					const saveButton = queryByTestId('save-button');
					expect(saveButton).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		const renderSingle = () =>
			render(() => (
				<ScoreboardOCR uploadBatch={{ images: ['data:image/png;base64,testdata'] }} />
			));

		describe('image viewer', () => {
			const processedButton = () =>
				screen.getByRole('button', { name: 'Processed' }) as HTMLButtonElement;
			const originalButton = () =>
				screen.getByRole('button', { name: 'Original' }) as HTMLButtonElement;

			it('should show the original image first', async () => {
				renderSingle();
				expect(screen.getByAltText('Uploaded Image')).not.toBeNull();
				expect(originalButton().getAttribute('aria-pressed')).toBe('true');
				expect(processedButton().getAttribute('aria-pressed')).toBe('false');
			});

			it('should disable the processed view until it is ready', async () => {
				renderSingle();
				expect(processedButton().disabled).toBe(true);
				await waitFor(() => expect(processedButton().disabled).toBe(false), {
					timeout: 1500,
				});
			});

			it('should switch between the original and processed images', async () => {
				renderSingle();
				await waitFor(() => expect(processedButton().disabled).toBe(false), {
					timeout: 1500,
				});

				fireEvent.click(processedButton());
				expect(processedButton().getAttribute('aria-pressed')).toBe('true');
				expect(originalButton().getAttribute('aria-pressed')).toBe('false');
				expect(screen.getByAltText(/Pre-processed scoreboard/)).not.toBeNull();
				expect(screen.queryByAltText('Uploaded Image')).toBeNull();
				expect(screen.getByRole('list', { name: 'Region colours' })).not.toBeNull();

				fireEvent.click(originalButton());
				expect(screen.getByAltText('Uploaded Image')).not.toBeNull();
				expect(screen.queryByRole('list', { name: 'Region colours' })).toBeNull();
			});

			it('should toggle the full size view', async () => {
				const { container } = renderSingle();
				const button = screen.getByRole('button', { name: 'View full size' });
				expect(container.querySelector('.image-viewer--full')).toBeNull();

				fireEvent.click(button);
				expect(container.querySelector('.image-viewer--full')).not.toBeNull();
				expect(button.getAttribute('aria-pressed')).toBe('true');

				fireEvent.click(button);
				expect(container.querySelector('.image-viewer--full')).toBeNull();
			});
		});

		describe('developer output', () => {
			it('should be collapsed by default', async () => {
				const { container } = renderSingle();
				await screen.findByText('Raw OCR Text Output', undefined, { timeout: 1500 });

				const details = container.querySelector('details.developer-output');
				expect(details).not.toBeNull();
				expect(details?.hasAttribute('open')).toBe(false);
				expect(details?.querySelector('summary')?.textContent).toBe('Developer output');
			});

			it('should hold the JSON and raw text boxes', async () => {
				const { container } = renderSingle();
				await screen.findByText('Raw OCR Text Output', undefined, { timeout: 1500 });

				const details = container.querySelector('details.developer-output');
				expect(details?.textContent).toContain('Extracted Game Stats (JSON)');
				expect(details?.textContent).toContain('Raw OCR Text Output');
			});
		});

		describe('review footer', () => {
			const waitForFooter = () =>
				screen.findByText('Saved to records', undefined, { timeout: 1500 });

			it('should show a saved status with disabled edit buttons when clean', async () => {
				renderSingle();
				await waitForFooter();

				expect(
					(screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement)
						.disabled
				).toBe(true);
				expect(
					(screen.getByRole('button', { name: /Reset Changes/ }) as HTMLButtonElement)
						.disabled
				).toBe(true);
			});

			it('should show unsaved changes when the editor becomes dirty', async () => {
				renderSingle();
				await waitForFooter();

				fireEvent.click(screen.getByTestId('make-dirty'));

				expect(screen.getByText('Unsaved changes')).not.toBeNull();
				expect(
					(screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement)
						.disabled
				).toBe(false);
			});

			it('should save through the registered editor actions', async () => {
				const { saveGameRecord, updateGameRecord } = await import('#utils/storage');
				renderSingle();
				await waitForFooter();
				const recordId = vi.mocked(saveGameRecord).mock.results.at(-1)?.value;

				fireEvent.click(screen.getByTestId('make-dirty'));
				fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

				expect(updateGameRecord).toHaveBeenCalledWith(
					recordId,
					expect.anything(),
					expect.anything()
				);
			});

			it('should reset through the registered editor actions', async () => {
				renderSingle();
				await waitForFooter();

				fireEvent.click(screen.getByTestId('make-dirty'));
				fireEvent.click(screen.getByRole('button', { name: /Reset Changes/ }));

				expect(screen.getByTestId('reset-count').textContent).toBe('1');
				expect(screen.getByText('Saved to records')).not.toBeNull();
			});

			it('should disable Next Screenshot on the last screenshot', async () => {
				renderSingle();
				await waitForFooter();
				expect(
					(screen.getByRole('button', { name: /Next Screenshot/ }) as HTMLButtonElement)
						.disabled
				).toBe(true);
			});
		});
	});

	describe('region alignment', () => {
		it('should align profile regions before extracting them', async () => {
			const { getActiveProfile, getActiveProfileAlignment } =
				await import('#utils/regionProfiles');
			const { alignRegionsToImage } = await import('#utils/regionAlignment');
			const { getRegionImageData } = await import('#utils/preprocess');

			const profileRegions = [
				{ name: 'player_name', x: 10, y: 20, width: 100, height: 30, group: 'table' },
			];
			const alignedRegions = [{ ...profileRegions[0], x: 15, y: 40 }];
			const alignment = [{ name: 'table' }];

			vi.mocked(getActiveProfile).mockReturnValue(profileRegions);
			vi.mocked(getActiveProfileAlignment).mockReturnValue(alignment);
			vi.mocked(alignRegionsToImage).mockResolvedValueOnce(alignedRegions);

			const testImageData = 'data:image/png;base64,testdata';
			render(() => <ScoreboardOCR uploadBatch={{ images: [testImageData] }} />);

			await waitFor(() => {
				expect(alignRegionsToImage).toHaveBeenCalledWith(
					testImageData,
					profileRegions,
					alignment,
					expect.any(Number),
					expect.any(Number)
				);
				expect(getRegionImageData).toHaveBeenCalledWith(testImageData, alignedRegions);
			});
		});
	});

	describe('image recognition integration', () => {
		it('should use image recognition for regions with imgHashSet', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure region with imgHashSet to trigger image recognition
			mockGetActiveProfile.mockReturnValue([
				{
					name: 'hero_portrait',
					x: 0,
					y: 0,
					width: 64,
					height: 64,
					imgHashSet: 'hero-portraits',
				},
				{ name: 'player_name', x: 100, y: 0, width: 100, height: 30, charSet: 'ABC' },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					// Raw OCR output should show image recognition result with confidence
					const rawText = queryByText(/Raw OCR Text Output/);
					expect(rawText).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should skip image recognition when hash set is not found', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure region with non-existent hash set
			mockGetActiveProfile.mockReturnValue([
				{
					name: 'hero_portrait',
					x: 0,
					y: 0,
					width: 64,
					height: 64,
					imgHashSet: 'non-existent-hash-set',
				},
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			// Should still complete processing without errors
			// When hash set is not found, no OCR text is generated, so "Raw OCR Text Output" won't appear
			// But the component should complete without crashing
			await waitFor(
				() => {
					// Processing should complete (no longer showing processing indicator)
					const processingText = queryByText(/Reading screenshot/);
					expect(processingText).toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should use OCR for regions without imgHashSet', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure region without imgHashSet (text-only)
			mockGetActiveProfile.mockReturnValue([
				{
					name: 'player_name',
					x: 100,
					y: 0,
					width: 100,
					height: 30,
					charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
				},
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					const rawText = queryByText(/Raw OCR Text Output/);
					expect(rawText).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should merge hash sets from profile and defaults', async () => {
			const { getActiveProfile, getActiveProfileHashSets } =
				await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);
			const mockGetActiveProfileHashSets = vi.mocked(getActiveProfileHashSets);

			// Configure profile with custom hash set
			mockGetActiveProfileHashSets.mockReturnValue([
				{
					id: 'custom-hashes',
					description: 'Custom hash set',
					hashes: [{ name: 'custom-hero', hash: 'abcdef1234567890' }],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			// Configure region referencing custom hash set
			mockGetActiveProfile.mockReturnValue([
				{
					name: 'hero_portrait',
					x: 0,
					y: 0,
					width: 64,
					height: 64,
					imgHashSet: 'custom-hashes',
				},
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					const rawText = queryByText(/Raw OCR Text Output/);
					expect(rawText).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});
	});

	describe('charSet-based scheduler grouping', () => {
		it('should create scheduler for charSet groups with more than 3 regions', async () => {
			const { createScheduler, createWorker } = await import('tesseract.js');
			const mockCreateScheduler = vi.mocked(createScheduler);
			const mockCreateWorker = vi.mocked(createWorker);

			mockCreateScheduler.mockClear();
			mockCreateWorker.mockClear();

			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure 4 regions with same charSet (should trigger scheduler creation)
			mockGetActiveProfile.mockReturnValue([
				{ name: 'stat_1', x: 0, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{ name: 'stat_2', x: 50, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{ name: 'stat_3', x: 100, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{ name: 'stat_4', x: 150, y: 0, width: 50, height: 30, charSet: '0123456789' },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			render(() => <ScoreboardOCR uploadBatch={{ images: [testImageData] }} />);

			await waitFor(
				() => {
					// Scheduler should be created for the group of 4 regions
					expect(mockCreateScheduler).toHaveBeenCalled();
				},
				{ timeout: 1500 }
			);
		});

		it('should use standalone workers for charSet groups with 3 or fewer regions', async () => {
			const { createScheduler, createWorker } = await import('tesseract.js');
			const mockCreateScheduler = vi.mocked(createScheduler);
			const mockCreateWorker = vi.mocked(createWorker);

			mockCreateScheduler.mockClear();
			mockCreateWorker.mockClear();

			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure 2 regions with same charSet (should use standalone worker)
			mockGetActiveProfile.mockReturnValue([
				{ name: 'stat_1', x: 0, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{ name: 'stat_2', x: 50, y: 0, width: 50, height: 30, charSet: '0123456789' },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			render(() => <ScoreboardOCR uploadBatch={{ images: [testImageData] }} />);

			await waitFor(
				() => {
					// Worker should be created (standalone, not via scheduler)
					expect(mockCreateWorker).toHaveBeenCalled();
				},
				{ timeout: 1500 }
			);
		});

		it('should set tessedit_char_whitelist when charSet is defined', async () => {
			const { createWorker } = await import('tesseract.js');
			const mockCreateWorker = vi.mocked(createWorker);

			// Get the mock worker to check setParameters calls
			const mockWorker = await mockCreateWorker();
			const mockSetParameters = vi.mocked(mockWorker.setParameters);
			mockSetParameters.mockClear();

			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure region with specific charSet
			mockGetActiveProfile.mockReturnValue([
				{ name: 'stat_1', x: 0, y: 0, width: 50, height: 30, charSet: '0123456789' },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			render(() => <ScoreboardOCR uploadBatch={{ images: [testImageData] }} />);

			await waitFor(
				() => {
					// setParameters should be called with tessedit_char_whitelist
					expect(mockSetParameters).toHaveBeenCalledWith(
						expect.objectContaining({
							tessedit_char_whitelist: '0123456789',
						})
					);
				},
				{ timeout: 1500 }
			);
		});

		it('should not set tessedit_char_whitelist when charSet is empty', async () => {
			const { createWorker } = await import('tesseract.js');
			const mockCreateWorker = vi.mocked(createWorker);

			// Get the mock worker to check setParameters calls
			const mockWorker = await mockCreateWorker();
			const mockSetParameters = vi.mocked(mockWorker.setParameters);
			mockSetParameters.mockClear();

			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure region without charSet
			mockGetActiveProfile.mockReturnValue([
				{ name: 'text_region', x: 0, y: 0, width: 100, height: 30 },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			render(() => <ScoreboardOCR uploadBatch={{ images: [testImageData] }} />);

			await waitFor(
				() => {
					// setParameters should be called without tessedit_char_whitelist
					expect(mockSetParameters).toHaveBeenCalledWith(
						expect.not.objectContaining({
							tessedit_char_whitelist: expect.any(String),
						})
					);
				},
				{ timeout: 1500 }
			);
		});

		it('should process regions with different charSets separately', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Configure regions with different charSets
			mockGetActiveProfile.mockReturnValue([
				{
					name: 'name_1',
					x: 0,
					y: 0,
					width: 100,
					height: 30,
					charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
				},
				{ name: 'stat_1', x: 100, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{ name: 'stat_2', x: 150, y: 0, width: 50, height: 30, charSet: '0123456789' },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					// Processing should complete successfully
					const rawText = queryByText(/Raw OCR Text Output/);
					expect(rawText).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should group regions without charSet under empty string key', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Mix of regions with and without charSet
			mockGetActiveProfile.mockReturnValue([
				{ name: 'text_1', x: 0, y: 0, width: 100, height: 30 },
				{ name: 'text_2', x: 100, y: 0, width: 100, height: 30, charSet: '' },
				{ name: 'text_3', x: 200, y: 0, width: 100, height: 30, charSet: undefined },
				{ name: 'stat_1', x: 300, y: 0, width: 50, height: 30, charSet: '0123456789' },
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					// Processing should complete successfully with all regions processed
					const rawText = queryByText(/Raw OCR Text Output/);
					expect(rawText).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should process mixed image hash and OCR regions correctly', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const mockGetActiveProfile = vi.mocked(getActiveProfile);

			// Mix of image hash and OCR regions
			mockGetActiveProfile.mockReturnValue([
				{
					name: 'hero_1',
					x: 0,
					y: 0,
					width: 64,
					height: 64,
					imgHashSet: 'hero-portraits',
				},
				{
					name: 'hero_2',
					x: 70,
					y: 0,
					width: 64,
					height: 64,
					imgHashSet: 'hero-portraits',
				},
				{ name: 'stat_1', x: 140, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{ name: 'stat_2', x: 200, y: 0, width: 50, height: 30, charSet: '0123456789' },
				{
					name: 'name_1',
					x: 260,
					y: 0,
					width: 100,
					height: 30,
					charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
				},
			]);

			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR uploadBatch={{ images: [testImageData] }} />
			));

			await waitFor(
				() => {
					// Processing should complete with all regions
					const rawText = queryByText(/Raw OCR Text Output/);
					expect(rawText).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});
	});

	describe('hero portrait learning', () => {
		const heroRegion = {
			name: 'blue_player1_hero',
			x: 0,
			y: 0,
			width: 64,
			height: 64,
			imgHashSet: 'hero-portraits',
		};
		const recognisedHash = '6b2b17451147b400';

		const makeStats = (hero: string) => ({
			players: [
				{
					name: 'VEQ',
					hero,
					team: 'blue',
					e: 10,
					a: 4,
					d: 3,
					dmg: 15542,
					h: 12345,
					mit: 500,
				},
			],
			matchInfo: {
				result: 'VICTORY',
				final_score: '3VS2',
				date: '09/15/25 - 02:49',
				game_mode: 'ESCORT',
			},
		});

		// Lets a dialog that would open after saving render
		const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

		const renderAndSave = async () => {
			render(() => (
				<ScoreboardOCR uploadBatch={{ images: ['data:image/png;base64,testdata'] }} />
			));
			const saveButton = await screen.findByTestId('save-button', undefined, {
				timeout: 1500,
			});
			fireEvent.click(saveButton);
		};

		beforeEach(async () => {
			const { getActiveProfile, getActiveProfileHashSets, addProfileHashes } =
				await import('#utils/regionProfiles');
			const { recogniseImage } = await import('#utils/imageRecognition');
			vi.mocked(getActiveProfile).mockReturnValue([heroRegion]);
			vi.mocked(getActiveProfileHashSets).mockReturnValue([]);
			vi.mocked(addProfileHashes).mockClear();
			vi.mocked(recogniseImage).mockReturnValue({
				name: 'ana',
				confidence: 85,
				hash: recognisedHash,
			});
		});

		afterEach(async () => {
			const { extractGameStats } = await import('#utils/postprocess');
			vi.mocked(extractGameStats).mockReturnValue(
				makeStats('') as unknown as ReturnType<typeof extractGameStats>
			);
		});

		const mockStats = async (hero: string) => {
			const { extractGameStats } = await import('#utils/postprocess');
			vi.mocked(extractGameStats).mockReturnValue(
				makeStats(hero) as unknown as ReturnType<typeof extractGameStats>
			);
		};

		it('should prompt to remember a corrected hero portrait on save', async () => {
			await mockStats('Kiriko');
			await renderAndSave();

			expect(await screen.findByText('Remember hero portraits?')).toBeDefined();
			expect(screen.getByText(/Save 1 corrected hero portrait so/)).toBeDefined();
			expect(screen.getByAltText('Kiriko')).toBeDefined();
		});

		it('should save the portrait hash to the active profile on confirm', async () => {
			const { addProfileHashes } = await import('#utils/regionProfiles');
			await mockStats('Kiriko');
			await renderAndSave();

			fireEvent.click(await screen.findByText('Remember'));

			expect(addProfileHashes).toHaveBeenCalledWith('test_profile', 'hero-portraits', [
				{ name: 'kiriko', hash: recognisedHash },
			]);
		});

		it('should not save anything when the prompt is dismissed', async () => {
			const { addProfileHashes } = await import('#utils/regionProfiles');
			await mockStats('Kiriko');
			await renderAndSave();

			await screen.findByText('Remember hero portraits?');
			fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
			expect(addProfileHashes).not.toHaveBeenCalled();
		});

		it('should not prompt when the hero matches the recognised portrait', async () => {
			await mockStats('Ana');
			await renderAndSave();
			await settle();

			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('should not prompt when the hero is left empty', async () => {
			await mockStats('');
			await renderAndSave();
			await settle();

			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('should only prompt once for the same correction', async () => {
			await mockStats('Kiriko');
			await renderAndSave();
			fireEvent.click(await screen.findByText('Remember'));
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

			fireEvent.click(screen.getByTestId('save-button'));
			await settle();

			expect(screen.queryByRole('dialog')).toBeNull();
		});
	});

	describe('name recognition accuracy', () => {
		const renderWithImage = () =>
			render(() => (
				<ScoreboardOCR uploadBatch={{ images: ['data:image/png;base64,testdata'] }} />
			));

		it('should create workers with dictionaries turned off', async () => {
			const { createWorker } = await import('tesseract.js');
			const mockCreateWorker = vi.mocked(createWorker);
			mockCreateWorker.mockClear();

			const { getActiveProfile } = await import('#utils/regionProfiles');
			vi.mocked(getActiveProfile).mockReturnValue([
				{ name: 'stat_1', x: 0, y: 0, width: 50, height: 30, charSet: '0123456789' },
			]);

			renderWithImage();

			await waitFor(() => expect(mockCreateWorker).toHaveBeenCalled(), {
				timeout: 1500,
			});
			expect(mockCreateWorker.mock.calls[0][3]).toMatchObject({
				load_system_dawg: '0',
				load_freq_dawg: '0',
			});
		});

		it('should recognise isolateText regions from the cleaned-up image', async () => {
			const { createWorker } = await import('tesseract.js');
			const mockWorker = await vi.mocked(createWorker)();
			const mockRecognize = vi.mocked(mockWorker.recognize);
			mockRecognize.mockClear();

			const { getActiveProfile } = await import('#utils/regionProfiles');
			vi.mocked(getActiveProfile).mockReturnValue([
				{ name: 'p1_name', x: 0, y: 0, width: 50, height: 30, isolateText: 'name' },
				{ name: 'p1_dmg', x: 60, y: 0, width: 50, height: 30 },
			]);

			renderWithImage();

			await waitFor(
				() => {
					expect(mockRecognize).toHaveBeenCalledWith(
						'data:image/png;base64,isolated_p1_name'
					);
				},
				{ timeout: 1500 }
			);
			expect(mockRecognize).toHaveBeenCalledWith('data:image/png;base64,region_p1_dmg');
			expect(mockRecognize).not.toHaveBeenCalledWith(
				'data:image/png;base64,region_p1_name'
			);
		});

		it('should correct names against a lexicon built from saved records', async () => {
			const { loadGameRecords } = await import('#utils/storage');
			const { extractGameStats } = await import('#utils/postprocess');
			const makeRecord = (id: string) => ({
				id,
				players: [{ name: 'Qaeu' }],
				matchInfo: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			vi.mocked(loadGameRecords).mockReturnValue([
				makeRecord('a'),
				makeRecord('b'),
			] as unknown as ReturnType<typeof loadGameRecords>);
			vi.mocked(extractGameStats).mockClear();

			renderWithImage();

			await waitFor(() => expect(extractGameStats).toHaveBeenCalled(), {
				timeout: 1500,
			});
			expect(vi.mocked(extractGameStats).mock.calls[0][2]).toEqual(['QAEU']);
		});
	});

	describe('multiple screenshots', () => {
		const images = ['data:image/png;base64,one', 'data:image/png;base64,two'];
		const statsFor = (name: string) => ({
			players: [{ name, team: 'blue', e: 1, a: 1, d: 1, dmg: 1, h: 1, mit: 1 }],
			matchInfo: { result: 'VICTORY', final_score: '3VS2', date: '', game_mode: '' },
		});

		const queueItems = () => screen.getAllByRole('button', { name: /^Screenshot \d/ });
		const waitForStatuses = (statuses: string[]) =>
			waitFor(
				() =>
					expect(queueItems().map((item) => item.getAttribute('data-status'))).toEqual(
						statuses
					),
				{ timeout: 2000 }
			);

		beforeEach(async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const { extractGameStats } = await import('#utils/postprocess');
			const { saveGameRecord, updateGameRecord } = await import('#utils/storage');
			vi.mocked(getActiveProfile).mockReturnValue([
				{ name: 'region_0', x: 0, y: 0, width: 100, height: 100 },
			]);
			vi.mocked(extractGameStats)
				.mockReturnValueOnce(statsFor('FIRST') as never)
				.mockReturnValueOnce(statsFor('SECOND') as never)
				.mockReturnValueOnce(statsFor('THIRD') as never);
			vi.mocked(saveGameRecord).mockClear();
			vi.mocked(updateGameRecord).mockClear();
		});

		afterEach(async () => {
			const { extractGameStats } = await import('#utils/postprocess');
			const { loadImageDimensions } = await import('#utils/preprocess');
			vi.mocked(extractGameStats).mockReset();
			vi.mocked(extractGameStats).mockReturnValue(statsFor('VEQ') as never);
			vi.mocked(loadImageDimensions).mockResolvedValue({ width: 2560, height: 1440 });
		});

		const renderBatch = (batch: { images: string[] } | null = { images }) =>
			render(() => <ScoreboardOCR uploadBatch={batch} />);

		it('should show the queue for a single screenshot', async () => {
			renderBatch({ images: [images[0]] });
			await screen.findByTestId('save-button', undefined, { timeout: 1500 });
			expect(screen.getByRole('list', { name: 'Uploaded screenshots' })).not.toBeNull();
			expect(queueItems()).toHaveLength(1);
		});

		describe('status labels', () => {
			const statusLabel = (item: HTMLElement) =>
				item.querySelector('.queue-item__status')?.textContent;

			it('should label queued, reading and saved screenshots', async () => {
				renderBatch();
				await waitFor(() =>
					expect(queueItems().map(statusLabel)).toEqual(['Reading\u2026', 'Waiting'])
				);
				await waitForStatuses(['done', 'done']);
				expect(queueItems().map(statusLabel)).toEqual(['Saved', 'Saved']);
			});

			it('should label a failed screenshot', async () => {
				const { loadImageDimensions } = await import('#utils/preprocess');
				vi.spyOn(console, 'error').mockImplementation(() => {});
				vi.mocked(loadImageDimensions).mockRejectedValueOnce(new Error('Bad image'));
				renderBatch();
				await waitForStatuses(['error', 'done']);
				expect(statusLabel(queueItems()[0])).toBe('Failed');
			});
		});

		it('should process every screenshot and save a record for each', async () => {
			const { saveGameRecord } = await import('#utils/storage');
			renderBatch();

			await waitForStatuses(['done', 'done']);
			expect(saveGameRecord).toHaveBeenCalledTimes(2);
			expect(
				vi.mocked(saveGameRecord).mock.calls.map(([players]) => players[0].name)
			).toEqual(['FIRST', 'SECOND']);
		});

		it('should show the last processed screenshot by default', async () => {
			renderBatch();
			await waitForStatuses(['done', 'done']);
			expect(screen.getByTestId('player-SECOND')).not.toBeNull();
			expect(queueItems()[1].getAttribute('aria-current')).toBe('true');
		});

		it('should show a finished screenshot when its thumbnail is clicked', async () => {
			renderBatch();
			await waitForStatuses(['done', 'done']);

			fireEvent.click(queueItems()[0]);

			expect(screen.getByTestId('player-FIRST')).not.toBeNull();
			expect(screen.queryByTestId('player-SECOND')).toBeNull();
			expect(screen.getByAltText('Uploaded Image').getAttribute('src')).toBe(images[0]);
		});

		it('should save edits to the selected screenshot record', async () => {
			const { saveGameRecord, updateGameRecord } = await import('#utils/storage');
			renderBatch();
			await waitForStatuses(['done', 'done']);
			const firstRecordId = vi.mocked(saveGameRecord).mock.results[0].value;

			fireEvent.click(queueItems()[0]);
			fireEvent.click(screen.getByTestId('save-button'));

			expect(updateGameRecord).toHaveBeenCalledWith(
				firstRecordId,
				expect.anything(),
				expect.anything()
			);
		});

		it('should keep processing after a screenshot fails', async () => {
			const { saveGameRecord } = await import('#utils/storage');
			const { loadImageDimensions } = await import('#utils/preprocess');
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(loadImageDimensions).mockRejectedValueOnce(new Error('Bad image'));
			renderBatch();

			await waitForStatuses(['error', 'done']);
			expect(saveGameRecord).toHaveBeenCalledOnce();

			fireEvent.click(queueItems()[0]);
			expect(screen.getByText('Bad image')).not.toBeNull();
		});

		it('should show progress for the screenshot being processed', async () => {
			renderBatch();
			expect(await screen.findByText(/Reading screenshot 1 of 2/)).not.toBeNull();
			await waitForStatuses(['done', 'done']);
		});

		it('should queue a new batch after the current one', async () => {
			const { saveGameRecord } = await import('#utils/storage');
			const [batch, setBatch] = createSignal<{ images: string[] } | null>({ images });
			render(() => <ScoreboardOCR uploadBatch={batch()} />);

			setBatch({ images: ['data:image/png;base64,three'] });

			await waitForStatuses(['done', 'done', 'done']);
			expect(saveGameRecord).toHaveBeenCalledTimes(3);
		});

		describe('duplicate screenshots', () => {
			/** Saves a record as if the screenshot had been processed before */
			const saveExistingRecord = async (image: string, name: string) => {
				const { saveGameRecord, hashScreenshot } = await import('#utils/storage');
				const { players, matchInfo } = statsFor(name);
				const id = saveGameRecord(
					players as never,
					matchInfo as never,
					(await hashScreenshot(image)) ?? undefined
				);
				vi.mocked(saveGameRecord).mockClear();
				return id;
			};

			it('should save the screenshot hash with a new record', async () => {
				const { saveGameRecord, hashScreenshot } = await import('#utils/storage');
				renderBatch({ images: [images[0]] });
				await screen.findByTestId('save-button', undefined, { timeout: 1500 });

				expect(vi.mocked(saveGameRecord).mock.calls[0][2]).toBe(
					await hashScreenshot(images[0])
				);
			});

			it('should not save a second record for a screenshot already saved', async () => {
				const { saveGameRecord } = await import('#utils/storage');
				await saveExistingRecord(images[0], 'EXISTING');
				renderBatch();

				await waitForStatuses(['duplicate', 'done']);
				expect(saveGameRecord).toHaveBeenCalledOnce();
				expect(vi.mocked(saveGameRecord).mock.calls[0][0][0].name).toBe('FIRST');
			});

			it('should label a duplicate screenshot "Already saved" in the queue', async () => {
				await saveExistingRecord(images[0], 'EXISTING');
				renderBatch();

				await waitForStatuses(['duplicate', 'done']);
				expect(queueItems()[0].querySelector('.queue-item__status')?.textContent).toBe(
					'Already saved'
				);
			});

			it('should skip recognition for a duplicate screenshot', async () => {
				const { extractGameStats } = await import('#utils/postprocess');
				const { loadImageDimensions } = await import('#utils/preprocess');
				await saveExistingRecord(images[0], 'EXISTING');
				vi.mocked(extractGameStats).mockClear();
				vi.mocked(loadImageDimensions).mockClear();
				renderBatch({ images: [images[0]] });

				await screen.findByText(/already saved/, undefined, { timeout: 1500 });
				expect(loadImageDimensions).not.toHaveBeenCalled();
				expect(extractGameStats).not.toHaveBeenCalled();
				expect(screen.getByRole('button', { name: 'Processed' })).toHaveProperty(
					'disabled',
					true
				);
			});

			it('should show the existing record for a duplicate screenshot', async () => {
				await saveExistingRecord(images[0], 'EXISTING');
				renderBatch({ images: [images[0]] });

				expect(
					await screen.findByTestId('player-EXISTING', undefined, { timeout: 1500 })
				).not.toBeNull();
				expect(screen.getByText(/instead of creating a duplicate/)).not.toBeNull();
			});

			it('should save edits to the existing record', async () => {
				const { updateGameRecord } = await import('#utils/storage');
				const existingId = await saveExistingRecord(images[0], 'EXISTING');
				renderBatch({ images: [images[0]] });

				fireEvent.click(
					await screen.findByTestId('save-button', undefined, { timeout: 1500 })
				);

				expect(updateGameRecord).toHaveBeenCalledWith(
					existingId,
					expect.anything(),
					expect.anything()
				);
			});

			it('should detect a screenshot repeated within the same batch', async () => {
				const { saveGameRecord } = await import('#utils/storage');
				renderBatch({ images: [images[0], images[0]] });

				await waitForStatuses(['done', 'duplicate']);
				expect(saveGameRecord).toHaveBeenCalledOnce();
			});

			it('should process a screenshot again after its record is deleted', async () => {
				const { saveGameRecord, deleteGameRecord } = await import('#utils/storage');
				deleteGameRecord(await saveExistingRecord(images[0], 'EXISTING'));
				renderBatch();

				await waitForStatuses(['done', 'done']);
				expect(saveGameRecord).toHaveBeenCalledTimes(2);
			});
		});

		describe('screenshots of a game that already has a record', () => {
			const BLUE = ['QAEU', 'TRACER0', 'MERCYMAIN', 'BIGTANK', 'ZENFAN'];
			const RED = ['VEQ', 'SOJOURNER', 'LUCIOLIFE', 'WINSTONED', 'GENJIDASH'];

			/** Full lobby whose stats grow with `progress`; post-game reads have a result */
			const gameStats = (progress: number, isPostGame = false) => ({
				players: [...BLUE, ...RED].map((name, i) => ({
					name,
					team: i < 5 ? 'blue' : 'red',
					hero: '',
					e: String(progress + i),
					a: String(progress + i),
					d: String(progress),
					dmg: String(progress * 1000 + i),
					h: String(progress * 500 + i),
					mit: String(progress * 300 + i),
				})),
				matchInfo: {
					result: isPostGame ? 'VICTORY' : '',
					final_score: isPostGame ? { blue: '2', red: '1' } : { blue: '', red: '' },
					date: isPostGame ? '09/15/25 - 02:49' : '',
					game_mode: 'CONTROL',
					game_length: isPostGame ? '12:34' : '',
					map: isPostGame ? '' : "King's Row",
				},
			});

			const saveExistingGame = async (stats: ReturnType<typeof gameStats>) => {
				const { saveGameRecord } = await import('#utils/storage');
				const id = saveGameRecord(stats.players as never, stats.matchInfo);
				vi.mocked(saveGameRecord).mockClear();
				return id;
			};

			const mockScreenshotStats = async (...stats: ReturnType<typeof gameStats>[]) => {
				const { extractGameStats } = await import('#utils/postprocess');
				vi.mocked(extractGameStats).mockReset();
				for (const result of stats) {
					vi.mocked(extractGameStats).mockReturnValueOnce(result as never);
				}
			};

			const savedRecords = async () => (await import('#utils/storage')).loadGameRecords();

			beforeEach(async () => {
				// Use real saved records rather than an earlier test's stub
				const { loadGameRecords } = await import('#utils/storage');
				vi.mocked(loadGameRecords).mockReset();
			});

			it('should merge an in-game screenshot into the post-game record', async () => {
				const { saveGameRecord, updateGameRecord } = await import('#utils/storage');
				const existingId = await saveExistingGame(gameStats(9, true));
				await mockScreenshotStats(gameStats(3));
				renderBatch({ images: [images[0]] });

				await screen.findByText(/same game as a record/, undefined, { timeout: 1500 });
				expect(saveGameRecord).not.toHaveBeenCalled();
				expect(updateGameRecord).toHaveBeenCalledWith(
					existingId,
					expect.anything(),
					expect.anything(),
					[expect.any(String)]
				);

				const records = await savedRecords();
				expect(records).toHaveLength(1);
				expect(records[0].matchInfo).toMatchObject({
					result: 'VICTORY',
					map: "King's Row",
				});
				expect(records[0].players[0].dmg).toBe('9000');
			});

			it('should show the merged record in the editor', async () => {
				await saveExistingGame(gameStats(3));
				await mockScreenshotStats(gameStats(9, true));
				renderBatch({ images: [images[0]] });

				await screen.findByText(/same game as a record/, undefined, { timeout: 1500 });
				expect(screen.getByTestId('match-info-data').textContent).toBe('VICTORY');
			});

			it('should merge screenshots of one game uploaded together', async () => {
				await mockScreenshotStats(gameStats(3), gameStats(9, true));
				renderBatch();

				await waitForStatuses(['done', 'merged']);
				const records = await savedRecords();
				expect(records).toHaveLength(1);
				expect(records[0].screenshotHashes).toHaveLength(2);
			});

			it('should label a merged screenshot "Merged into record" in the queue', async () => {
				await mockScreenshotStats(gameStats(3), gameStats(9, true));
				renderBatch();

				await waitForStatuses(['done', 'merged']);
				expect(queueItems()[1].querySelector('.queue-item__status')?.textContent).toBe(
					'Merged into record'
				);
			});

			it('should recognise a merged screenshot when uploaded again', async () => {
				await mockScreenshotStats(gameStats(3), gameStats(9, true));
				renderBatch({ images: [...images, images[1]] });

				await waitForStatuses(['done', 'merged', 'duplicate']);
				expect(await savedRecords()).toHaveLength(1);
			});

			it('should save a new record for a different game', async () => {
				const { saveGameRecord } = await import('#utils/storage');
				await saveExistingGame(gameStats(9, true));
				const otherGame = gameStats(9, true);
				otherGame.matchInfo.date = '09/15/25 - 03:20';
				await mockScreenshotStats(otherGame);
				renderBatch({ images: [images[0]] });

				await screen.findByTestId('save-button', undefined, { timeout: 1500 });
				expect(saveGameRecord).toHaveBeenCalledOnce();
				expect(screen.queryByText(/same game as a record/)).toBeNull();
			});

			describe('saving as a separate record', () => {
				it('should restore the existing record and save the screenshot', async () => {
					const existing = gameStats(9, true);
					const existingId = await saveExistingGame(existing);
					await mockScreenshotStats(gameStats(3));
					renderBatch({ images: [images[0]] });

					fireEvent.click(
						await screen.findByText('Save as Separate Record', undefined, {
							timeout: 1500,
						})
					);

					const records = await savedRecords();
					expect(records).toHaveLength(2);
					const restored = records.find(({ id }) => id === existingId);
					expect(restored?.matchInfo).toEqual(existing.matchInfo);
					expect(restored?.players).toEqual(existing.players);
					expect(restored?.screenshotHashes).toEqual([]);
					expect(records.find(({ id }) => id !== existingId)?.matchInfo.map).toBe(
						"King's Row"
					);
					expect(screen.queryByText(/same game as a record/)).toBeNull();
				});

				it('should save edits to the new record afterwards', async () => {
					const { updateGameRecord } = await import('#utils/storage');
					const existingId = await saveExistingGame(gameStats(9, true));
					await mockScreenshotStats(gameStats(3));
					renderBatch({ images: [images[0]] });

					fireEvent.click(
						await screen.findByText('Save as Separate Record', undefined, {
							timeout: 1500,
						})
					);
					vi.mocked(updateGameRecord).mockClear();
					fireEvent.click(screen.getByTestId('save-button'));

					expect(vi.mocked(updateGameRecord).mock.calls[0][0]).not.toBe(existingId);
				});

				it('should not be offered once the merged record is edited', async () => {
					await saveExistingGame(gameStats(9, true));
					await mockScreenshotStats(gameStats(3));
					renderBatch({ images: [images[0]] });

					await screen.findByText('Save as Separate Record', undefined, {
						timeout: 1500,
					});
					fireEvent.click(screen.getByTestId('save-button'));

					expect(screen.queryByText('Save as Separate Record')).toBeNull();
				});

				it('should refuse once another screenshot has been merged in', async () => {
					await saveExistingGame(gameStats(9, true));
					await mockScreenshotStats(gameStats(3), gameStats(5));
					renderBatch();
					await waitForStatuses(['merged', 'merged']);

					fireEvent.click(queueItems()[0]);
					fireEvent.click(screen.getByText('Save as Separate Record'));

					expect(screen.getByText(/can no longer be separated/)).not.toBeNull();
					expect(await savedRecords()).toHaveLength(1);
				});
			});
		});
	});
});
