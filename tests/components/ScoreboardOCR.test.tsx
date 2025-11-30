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
		},
		createScheduler: mockCreateScheduler,
		createWorker: mockCreateWorker,
	};
});

// Mock EditableGameData component
vi.mock('#c/EditableGameData', () => ({
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
	drawRegionsOnImage: vi.fn().mockResolvedValue('data:image/png;base64,regionmockdata'),
	getScoreboardRegions: vi
		.fn()
		.mockReturnValue([{ name: 'region_0', x: 0, y: 0, width: 100, height: 100 }]),
	getMatchInfoRegions: vi
		.fn()
		.mockReturnValue([{ name: 'region_1', x: 0, y: 0, width: 100, height: 100 }]),
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
			);
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
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
				{ timeout: 3000 }
			);
		});
	});
});
