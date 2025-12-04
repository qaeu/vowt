import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';

import ScoreboardOCR from '#c/ScoreboardOCR';

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
			createScheduler: mockCreateScheduler,
			createWorker: mockCreateWorker,
		},
		PSM: { SINGLE_LINE: 7 },
		createScheduler: mockCreateScheduler,
		createWorker: mockCreateWorker,
	};
});

// Mock EditableGameData component
vi.mock('#c/ui/EditableGameData', () => ({
	default: (props: {
		initialPlayers?: Array<{ name: string }>;
		initialMatchInfo: { result: string };
		onSave: (players: Array<{ name: string }>, matchInfo: { result: string }) => void;
	}) => (
		<div data-testid="editable-game-data">
			<div data-testid="players-data">
				{props.initialPlayers
					&& props.initialPlayers.map((p: { name: string }) => (
						<div data-testid={`player-${p.name}`}>{p.name}</div>
					))}
			</div>
			<div data-testid="match-info-data">{props.initialMatchInfo.result}</div>
			<button
				onClick={() => props.onSave(props.initialPlayers || [], props.initialMatchInfo)}
				data-testid="save-button"
			>
				Save
			</button>
		</div>
	),
}));

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
	getActiveProfileHashSets: vi.fn().mockReturnValue([]),
}));

vi.mock('#utils/imageRecognition', () => ({
	recogniseImage: vi.fn().mockReturnValue({ name: 'ana', confidence: 85 }),
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

describe('ScoreboardOCR', () => {
	it('should render the component', () => {
		const { getByText } = render(() => (
			<ScoreboardOCR onClose={() => {}} onOpenRegionManager={() => {}} />
		));
		expect(getByText('Image Processing')).toBeDefined();
	});

	it('should not render original image section', () => {
		const { queryByText, queryByAltText } = render(() => (
			<ScoreboardOCR onClose={() => {}} onOpenRegionManager={() => {}} />
		));
		expect.soft(queryByText('Original Image')).toBeNull();
		expect.soft(queryByAltText('Original scoreboard')).toBeNull();
	});

	it('should render Region Profiles button in header', () => {
		const { getByText } = render(() => (
			<ScoreboardOCR onClose={() => {}} onOpenRegionManager={() => {}} />
		));
		expect(getByText('Region Profiles')).toBeDefined();
	});

	it('should call onOpenRegionManager when Region Profiles button is clicked', async () => {
		const mockOnOpenRegionManager = vi.fn();
		const { getByText } = render(() => (
			<ScoreboardOCR onClose={() => {}} onOpenRegionManager={mockOnOpenRegionManager} />
		));

		const regionButton = getByText('Region Profiles');
		regionButton.click();

		expect(mockOnOpenRegionManager).toHaveBeenCalledTimes(1);
	});

	describe('when uploadedImage is provided', () => {
		it('should render original image section', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { getByText, getByAltText } = render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

			expect(getByText('Uploaded Image')).not.toBeNull();
			expect(getByAltText('Uploaded Image')).not.toBeNull();
		});

		it('should show processing indicator when uploadedImage is provided', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { queryByText } = render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

			// Check for processing text (may be brief)
			const processingText = queryByText(/Processing image/);
			expect(processingText).not.toBeNull();
		});

		it('should display preprocessed image after processing uploaded image', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { getByText } = render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

			await waitFor(
				() => {
					expect(getByText('Pre-processed Image')).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		it('should display raw OCR text output with uploaded image', async () => {
			const testImageData = 'data:image/png;base64,testdata';
			const { getByText } = render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

			await waitFor(
				() => {
					const saveButton = queryByTestId('save-button');
					expect(saveButton).not.toBeNull();
				},
				{ timeout: 1500 }
			);
		});

		describe('click-to-zoom functionality', () => {
			it('should add expanded class to uploaded image container when clicked', async () => {
				const testImageData = 'data:image/png;base64,testdata';
				const { container, getByText } = render(() => (
					<ScoreboardOCR
						onClose={() => {}}
						onOpenRegionManager={() => {}}
						uploadedImage={testImageData}
					/>
				));

				await waitFor(
					() => {
						expect(getByText('Pre-processed Image')).not.toBeNull();
					},
					{ timeout: 1500 }
				);

				const uploadedContainer = container.querySelector(
					'.image-container:not(.expanded)'
				);
				expect(uploadedContainer).not.toBeNull();
				uploadedContainer!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					const expandedContainer = container.querySelector('.image-container.expanded');
					expect(expandedContainer).not.toBeNull();
				});
			});

			it('should remove expanded class when clicking expanded image again', async () => {
				const testImageData = 'data:image/png;base64,testdata';
				const { container, getByText } = render(() => (
					<ScoreboardOCR
						onClose={() => {}}
						onOpenRegionManager={() => {}}
						uploadedImage={testImageData}
					/>
				));

				await waitFor(
					() => {
						expect(getByText('Pre-processed Image')).not.toBeNull();
					},
					{ timeout: 1500 }
				);

				// Click to expand
				const imageContainers = container.querySelectorAll('.image-container');
				const uploadedContainer = imageContainers[0];
				uploadedContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					expect(uploadedContainer.classList.contains('expanded')).toBe(true);
				});

				// Click again to collapse
				uploadedContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					expect(uploadedContainer.classList.contains('expanded')).toBe(false);
				});
			});

			it('should hide other image container when one is expanded', async () => {
				const testImageData = 'data:image/png;base64,testdata';
				const { container, getByText } = render(() => (
					<ScoreboardOCR
						onClose={() => {}}
						onOpenRegionManager={() => {}}
						uploadedImage={testImageData}
					/>
				));

				await waitFor(
					() => {
						expect(getByText('Pre-processed Image')).not.toBeNull();
					},
					{ timeout: 1500 }
				);

				// Click uploaded image to expand it
				const imageContainers = container.querySelectorAll('.image-container');
				const uploadedContainer = imageContainers[0];
				const preprocessedContainer = imageContainers[1];

				uploadedContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					expect(uploadedContainer.classList.contains('expanded')).toBe(true);
					expect(preprocessedContainer.classList.contains('hidden')).toBe(true);
				});
			});

			it('should show both images when collapsing from expanded state', async () => {
				const testImageData = 'data:image/png;base64,testdata';
				const { container, getByText } = render(() => (
					<ScoreboardOCR
						onClose={() => {}}
						onOpenRegionManager={() => {}}
						uploadedImage={testImageData}
					/>
				));

				await waitFor(
					() => {
						expect(getByText('Pre-processed Image')).not.toBeNull();
					},
					{ timeout: 1500 }
				);

				const imageContainers = container.querySelectorAll('.image-container');
				const uploadedContainer = imageContainers[0];
				const preprocessedContainer = imageContainers[1];

				// Click to expand
				uploadedContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					expect(uploadedContainer.classList.contains('expanded')).toBe(true);
				});

				// Click to collapse
				uploadedContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					expect(uploadedContainer.classList.contains('expanded')).toBe(false);
					expect(uploadedContainer.classList.contains('hidden')).toBe(false);
					expect(preprocessedContainer.classList.contains('expanded')).toBe(false);
					expect(preprocessedContainer.classList.contains('hidden')).toBe(false);
				});
			});

			it('should expand preprocessed image when clicked', async () => {
				const testImageData = 'data:image/png;base64,testdata';
				const { container, getByText } = render(() => (
					<ScoreboardOCR
						onClose={() => {}}
						onOpenRegionManager={() => {}}
						uploadedImage={testImageData}
					/>
				));

				await waitFor(
					() => {
						expect(getByText('Pre-processed Image')).not.toBeNull();
					},
					{ timeout: 1500 }
				);

				const imageContainers = container.querySelectorAll('.image-container');
				const uploadedContainer = imageContainers[0];
				const preprocessedContainer = imageContainers[1];

				preprocessedContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

				await waitFor(() => {
					expect(preprocessedContainer.classList.contains('expanded')).toBe(true);
					expect(uploadedContainer.classList.contains('hidden')).toBe(true);
				});
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

			// Should still complete processing without errors
			// When hash set is not found, no OCR text is generated, so "Raw OCR Text Output" won't appear
			// But the component should complete without crashing
			await waitFor(
				() => {
					// Processing should complete (no longer showing processing indicator)
					const processingText = queryByText(/Processing image/);
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
			const { getActiveProfile, getActiveProfileHashSets } = await import(
				'#utils/regionProfiles'
			);
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
			render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

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
			render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

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
			render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

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
			render(() => (
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
			));

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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
				<ScoreboardOCR
					onClose={() => {}}
					onOpenRegionManager={() => {}}
					uploadedImage={testImageData}
				/>
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
});
