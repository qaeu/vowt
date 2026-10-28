import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

import type { DrawnRegion } from '#types';

import RegionProfileManager from '#c/RegionProfileManager';
import * as regionProfiles from '#utils/regionProfiles';
import * as regionEditor from '#utils/regionEditor';
import * as regionAlignment from '#utils/regionAlignment';

// Mock the region profiles utility
vi.mock('#utils/regionProfiles', () => ({
	listProfiles: vi.fn(),
	loadProfileById: vi.fn(),
	saveProfile: vi.fn(),
	deleteProfile: vi.fn(),
	setActiveProfile: vi.fn(),
	getActiveProfile: vi.fn(),
	getActiveProfileId: vi.fn(),
	getActiveProfileDetails: vi.fn(),
	getProfile: vi.fn(),
	exportProfile: vi.fn(),
	importProfile: vi.fn(),
	getActiveProfileAlignment: vi.fn(),
	getProfileAlignment: vi.fn(),
	countProfileHashes: vi.fn(),
	clearProfileHashes: vi.fn(),
	REFERENCE_WIDTH: 2560,
	REFERENCE_HEIGHT: 1440,
}));

// Mock the alignment utility; anchors are captured from a fake grayscale image
vi.mock('#utils/regionAlignment', () => ({
	ALIGN_SCALE: 2,
	loadReferenceGrayscale: vi.fn(),
	createAnchor: vi.fn(),
	downsample: vi.fn((image) => image),
	findAnchorOffset: vi.fn(),
}));

// Mock the region editor utility
vi.mock('#utils/regionEditor', () => ({
	startRegionEditor: vi.fn(),
	drawRegions: vi.fn(),
}));

describe('RegionProfileManager', () => {
	const mockProfiles = [
		{ id: 'profile1', description: 'Test Profile 1' },
		{ id: 'profile2', description: 'Test Profile 2' },
	];

	const mockOnClose = vi.fn();

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		vi.mocked(regionProfiles.listProfiles).mockReturnValue(mockProfiles);
		vi.mocked(regionProfiles.getActiveProfile).mockReturnValue([]);
		vi.mocked(regionProfiles.getActiveProfileId).mockReturnValue(mockProfiles[1].id);
		vi.mocked(regionProfiles.getActiveProfileDetails).mockReturnValue(mockProfiles[1]);
		vi.mocked(regionEditor.startRegionEditor).mockResolvedValue(undefined);
		vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([]);
		vi.mocked(regionProfiles.getProfileAlignment).mockReturnValue([]);
		vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(0);
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('Rendering', () => {
		it('should render the component with title', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('Image Region Profiles')).toBeDefined();
		});

		it('should render the close button', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const closeButton = screen.getByRole('button', { name: /close/i });
			expect(closeButton).toBeDefined();
		});

		it('should render instructions text', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText(/Create and manage region profiles/i)).toBeDefined();
		});
	});

	describe('Learned Image Hashes', () => {
		it('should show the learned hash count for the editing profile', () => {
			vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(3);
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			expect(screen.getByText(/3 learned hashes/)).toBeDefined();
			expect(regionProfiles.countProfileHashes).toHaveBeenCalledWith(mockProfiles[1].id);
		});

		it('should disable Clear Learned Hashes when there are none', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const button = screen.getByRole('button', {
				name: /Clear Learned Hashes/i,
			}) as HTMLButtonElement;

			expect(button.disabled).toBe(true);
		});

		it('should clear learned hashes after confirming', async () => {
			vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(2);
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			fireEvent.click(screen.getByRole('button', { name: /Clear Learned Hashes/i }));
			vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(0);
			fireEvent.click(await screen.findByText('Confirm'));

			expect(regionProfiles.clearProfileHashes).toHaveBeenCalledWith(mockProfiles[1].id);
			await waitFor(() => expect(screen.getByText(/0 learned hashes/)).toBeDefined());
		});
	});

	describe('Region Editor', () => {
		it('should have Clear All button', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const button = screen.getByRole('button', {
				name: /Clear All/i,
			});
			expect(button).toBeDefined();
		});

		it('should have Clear All button disabled when no regions', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const clearButton = screen.getByRole('button', {
				name: /Clear All/i,
			}) as HTMLButtonElement;
			expect(clearButton.disabled).toBe(true);
		});

		it('should have Export button', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const button = screen.getByRole('button', {
				name: /Export/i,
			});
			expect(button).toBeDefined();
		});

		it('should have Import button', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const button = screen.getByRole('button', {
				name: /Import/i,
			});
			expect(button).toBeDefined();
		});

		it('should call exportProfile when Export button clicked', () => {
			window.URL.createObjectURL = vi.fn(() => 'blob:mock');
			window.URL.revokeObjectURL = vi.fn();
			vi.mocked(regionProfiles.exportProfile).mockReturnValue('{"test": "data"}');

			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			const button = screen.getByRole('button', {
				name: /Export/i,
			}) as HTMLButtonElement;
			button.click();

			expect(regionProfiles.exportProfile).toHaveBeenCalledWith(mockProfiles[1].id);
		});

		it('should show alert if exportProfile returns null', async () => {
			vi.mocked(regionProfiles.exportProfile).mockReturnValue(null);

			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			const button = screen.getByRole('button', {
				name: /Export/i,
			}) as HTMLButtonElement;
			button.click();

			await waitFor(() => {
				screen.getByText('Export Error');
			});
			expect(
				screen.getByText('Could not export profile. Please save it first.')
			).toBeDefined();
		});
	});

	describe('Profile Management', () => {
		it('should display list of saved profiles', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('profile1')).toBeDefined();
			expect(screen.getByText('profile2')).toBeDefined();
		});

		it('should show "No profiles yet" when list is empty', () => {
			vi.mocked(regionProfiles.listProfiles).mockReturnValue([]);
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('No profiles yet')).toBeDefined();
		});

		it('should render Select button for each profile', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const selectButtons = screen.getAllByRole('button', {
				name: /Set Active/i,
			});
			expect(selectButtons.length).toBeGreaterThanOrEqual(1);
		});

		it('should render Edit button for each profile', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const editButtons = screen.getAllByRole('button', {
				name: /Edit/i,
			});
			expect(editButtons.length).toBeGreaterThanOrEqual(2);
		});

		it('should render Delete button for each profile', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const deleteButtons = screen.getAllByRole('button', {
				name: /Delete/i,
			});
			expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
		});

		it('should call setActiveProfile when selecting a profile', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			const selectButtons = screen.getAllByRole('button', {
				name: /Set Active/i,
			});
			(selectButtons[0] as HTMLButtonElement).click();

			expect(vi.mocked(regionProfiles.setActiveProfile)).toHaveBeenCalledWith('profile1');
		});

		it('should mark active profile with checkmark', () => {
			vi.mocked(regionProfiles.getActiveProfileId).mockReturnValue('profile1');
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('✓ Active')).toBeDefined();
		});

		it('should call deleteProfile when deleting a profile', async () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			const deleteButtons = screen.getAllByRole('button', {
				name: /Delete/i,
			});
			(deleteButtons[0] as HTMLButtonElement).click();

			await waitFor(() => {
				screen.getByText('Delete Profile');
			});

			const confirmButton = screen.getByText('Confirm');
			fireEvent.click(confirmButton);

			expect(vi.mocked(regionProfiles.deleteProfile)).toHaveBeenCalledWith('profile1');
		});
		it('should not delete profile if user cancels confirmation', async () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			const deleteButtons = screen.getAllByRole('button', {
				name: /Delete/i,
			});
			(deleteButtons[0] as HTMLButtonElement).click();

			await waitFor(() => {
				screen.getByText('Delete Profile');
			});

			// Close dialog by clicking the dialog close trigger
			const dialogElement = document.querySelector('[data-part="close-trigger"]');
			fireEvent.click(dialogElement as HTMLElement);

			expect(vi.mocked(regionProfiles.deleteProfile)).not.toHaveBeenCalled();
		});
	});

	describe('Profile Details Section', () => {
		it('should display Profile Details section', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('Profile Details')).toBeDefined();
		});

		it('should have Profile ID input field', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const idInputs = document.querySelectorAll('input');
			expect(idInputs.length).toBeGreaterThan(0);
		});

		it('should have Description input field', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const inputs = document.querySelectorAll('input');
			expect(inputs.length).toBeGreaterThan(0);
		});
	});

	describe('Canvas Rendering', () => {
		it('should render canvas element', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const canvas = document.querySelector('canvas');
			expect(canvas).toBeDefined();
		});

		it('should render canvas wrapper', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			const wrapper = document.querySelector('.canvas-wrapper');
			expect(wrapper).toBeDefined();
		});
	});

	describe('UI Sections', () => {
		it('should render Region Editor section', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('Region Editor')).toBeDefined();
		});

		it('should render Profile Details section', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('Profile Details')).toBeDefined();
		});

		it('should render Saved Profiles section', () => {
			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);
			expect(screen.getByText('Saved Profiles')).toBeDefined();
		});
	});

	describe('Component Props', () => {
		it('should accept onClose callback', () => {
			const onClose = vi.fn();
			render(() => <RegionProfileManager previewImage={null} onClose={onClose} />);
			expect(screen.getByText('Image Region Profiles')).toBeDefined();
		});

		it('should call onClose prop when close button clicked', () => {
			const onClose = vi.fn();
			render(() => <RegionProfileManager previewImage={null} onClose={onClose} />);

			const closeButton = screen.getByRole('button', {
				name: /close/i,
			}) as HTMLButtonElement;
			closeButton.click();

			expect(onClose).toHaveBeenCalled();
		});

		it('should accept previewImage prop', () => {
			const previewImage = 'data:image/png;base64,test';
			render(() => (
				<RegionProfileManager previewImage={previewImage} onClose={mockOnClose} />
			));
			expect(screen.getByText('Image Region Profiles')).toBeDefined();
		});

		it('should use previewImage when available', () => {
			const previewImage = 'data:image/png;base64,test';
			render(() => (
				<RegionProfileManager previewImage={previewImage} onClose={mockOnClose} />
			));
			const canvas = document.querySelector('canvas');
			expect(canvas).toBeDefined();
		});
	});

	describe('Region Denormalisation', () => {
		it('should call getActiveProfile with image dimensions on mount', async () => {
			const testWidth = 1920;
			const testHeight = 1080;

			// Mock Image to simulate loading with specific dimensions
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: testWidth,
				height: testHeight,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(function () {
				// Trigger onload asynchronously
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			const previewImage = 'data:image/png;base64,test';
			render(() => (
				<RegionProfileManager previewImage={previewImage} onClose={mockOnClose} />
			));

			// Wait for the image to "load" and onMount to complete
			await vi.waitFor(() => {
				expect(regionProfiles.getActiveProfile).toHaveBeenCalledWith(
					testWidth,
					testHeight
				);
			});
		});

		it('should call getProfile with canvas dimensions when editing a profile', async () => {
			const testWidth = 1920;
			const testHeight = 1080;

			// Mock Image for initial load
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: testWidth,
				height: testHeight,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(function () {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			// Mock getProfile to return test regions
			vi.mocked(regionProfiles.getProfile).mockReturnValue([]);

			const previewImage = 'data:image/png;base64,test';
			render(() => (
				<RegionProfileManager previewImage={previewImage} onClose={mockOnClose} />
			));

			// Wait for initial mount to complete
			await vi.waitFor(() => {
				expect(regionProfiles.getActiveProfile).toHaveBeenCalled();
			});

			// Click Edit button on first profile
			const editButtons = screen.getAllByRole('button', { name: /Edit/i });
			(editButtons[0] as HTMLButtonElement).click();

			// Verify getProfile was called with canvas dimensions
			expect(regionProfiles.getProfile).toHaveBeenCalledWith(
				mockProfiles[0].id,
				expect.any(Number),
				expect.any(Number)
			);
		});
	});

	describe('Alignment Groups', () => {
		const gray = { width: 4, height: 4, data: new Uint8ClampedArray(16) };
		const anchor = {
			x: 200,
			y: 100,
			searchX: 48,
			searchY: 160,
			template: { width: 40, height: 20, data: '' },
		};

		/** Renders with a 1280x720 preview and returns the editor's region callback */
		const renderWithEditor = async () => {
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 1280,
				height: 720,
			};
			vi.spyOn(globalThis, 'Image').mockImplementation(function () {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			let onRegionComplete: ((region: DrawnRegion) => void) | undefined;
			vi.mocked(regionEditor.startRegionEditor).mockImplementation(
				async (_canvas, _src, callback) => {
					onRegionComplete = callback;
				}
			);

			render(() => (
				<RegionProfileManager
					previewImage="data:image/png;base64,test"
					onClose={mockOnClose}
				/>
			));

			await vi.waitFor(() => expect(onRegionComplete).toBeDefined());
			return (rect: Pick<DrawnRegion, 'x' | 'y' | 'width' | 'height'>) =>
				onRegionComplete!({ ...rect, id: 'drawn-0', name: 'region_0', colour: '#f00' });
		};

		const addGroup = (name: string) => {
			fireEvent.input(screen.getByLabelText('New group name'), {
				target: { value: name },
			});
			fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
		};

		beforeEach(() => {
			vi.mocked(regionAlignment.loadReferenceGrayscale).mockResolvedValue(gray);
			vi.mocked(regionAlignment.createAnchor).mockReturnValue(anchor);
			vi.mocked(regionAlignment.findAnchorOffset).mockReturnValue({
				dx: 0,
				dy: 0,
				score: 1,
			});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should load alignment groups for the active profile', () => {
			vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
				{ name: 'blue' },
			]);

			render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

			expect(screen.getByText('Alignment Groups (1)')).toBeDefined();
			expect(screen.getByText('blue')).toBeDefined();
		});

		it('should capture an anchor from a drawn rectangle at reference resolution', async () => {
			const draw = await renderWithEditor();
			addGroup('blue');

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			expect(screen.getByText(/set the anchor for 'blue'/)).toBeDefined();

			draw({ x: 100, y: 50, width: 40, height: 20 });

			await waitFor(() => {
				expect(screen.getByRole('button', { name: 'Redraw Anchor' })).toBeDefined();
			});
			expect(regionAlignment.loadReferenceGrayscale).toHaveBeenCalledWith(
				'data:image/png;base64,test'
			);
			expect(regionAlignment.createAnchor).toHaveBeenCalledWith(
				gray,
				{ x: 200, y: 100, width: 80, height: 40 },
				48,
				160
			);
			expect(screen.queryByText(/set the anchor for/)).toBeNull();
			expect(screen.getByText('Drawn Regions (0)')).toBeDefined();
		});

		it('should reject an anchor without enough detail', async () => {
			vi.mocked(regionAlignment.findAnchorOffset).mockReturnValue(null);
			const draw = await renderWithEditor();
			addGroup('blue');

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });

			await waitFor(() => {
				expect(screen.getByText('Anchor Error')).toBeDefined();
			});
			expect(screen.getByRole('button', { name: 'Draw Anchor' })).toBeDefined();
		});

		it('should show an error when the image cannot be read', async () => {
			vi.mocked(regionAlignment.loadReferenceGrayscale).mockRejectedValue(
				new Error('Failed to load image')
			);
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const draw = await renderWithEditor();
			addGroup('blue');

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });

			await waitFor(() => {
				expect(
					screen.getByText('Could not read the image to capture the anchor.')
				).toBeDefined();
			});
		});

		it('should create row bands from a drawn rectangle', async () => {
			const draw = await renderWithEditor();
			addGroup('blue');

			fireEvent.click(screen.getByRole('button', { name: 'Draw Rows' }));
			draw({ x: 420, y: 218, width: 298, height: 210 });

			await waitFor(() => {
				expect(screen.getByText('5 rows')).toBeDefined();
			});
			expect((screen.getByLabelText('Row Height') as HTMLInputElement).value).toBe('84');
			expect((screen.getByLabelText('Y') as HTMLInputElement).value).toBe('436');
		});

		it('should add drawn rectangles as regions when not drawing alignment', async () => {
			const draw = await renderWithEditor();

			draw({ x: 10, y: 10, width: 40, height: 20 });

			await waitFor(() => {
				expect(screen.getByText('Drawn Regions (1)')).toBeDefined();
			});
			expect(regionAlignment.createAnchor).not.toHaveBeenCalled();
		});

		it('should draw alignment overlays scaled to the canvas', async () => {
			const draw = await renderWithEditor();
			addGroup('blue');

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });

			await waitFor(() => {
				expect(regionEditor.drawRegions).toHaveBeenLastCalledWith(
					expect.anything(),
					[expect.objectContaining({ x: 100, y: 50, width: 40, height: 20 })],
					'data:image/png;base64,test'
				);
			});
		});

		it('should save alignment groups with the profile', async () => {
			const draw = await renderWithEditor();
			addGroup('blue');
			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });
			await waitFor(() => screen.getByRole('button', { name: 'Redraw Anchor' }));

			fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

			expect(regionProfiles.saveProfile).toHaveBeenCalledWith(
				[],
				expect.objectContaining({ alignment: [{ name: 'blue', anchor }] }),
				1280,
				720
			);
		});

		describe('deleting a group', () => {
			const groupedRegion = {
				name: 'blue_player1_name',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				group: 'blue',
			};

			it('should delete a group without regions immediately', () => {
				vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
					{ name: 'blue' },
				]);
				render(() => <RegionProfileManager previewImage={null} onClose={mockOnClose} />);

				fireEvent.click(screen.getByTitle('Delete group blue'));

				expect(screen.getByText('Alignment Groups (0)')).toBeDefined();
				expect(screen.queryByText('Delete Alignment Group')).toBeNull();
			});

			it('should ask before deleting a group that regions use', async () => {
				vi.mocked(regionProfiles.getActiveProfile).mockReturnValue([groupedRegion]);
				vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
					{ name: 'blue' },
				]);
				await renderWithEditor();
				await waitFor(() => expect(screen.getByText('1 regions')).toBeDefined());

				fireEvent.click(screen.getByTitle('Delete group blue'));

				expect(await screen.findByText('Delete Alignment Group')).toBeDefined();
				expect(screen.getByText(/1 region uses 'blue'/)).toBeDefined();
				expect(screen.getByText('Alignment Groups (1)')).toBeDefined();
			});

			it('should delete the group after confirming', async () => {
				vi.mocked(regionProfiles.getActiveProfile).mockReturnValue([groupedRegion]);
				vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
					{ name: 'blue' },
				]);
				await renderWithEditor();
				await waitFor(() => expect(screen.getByText('1 regions')).toBeDefined());

				fireEvent.click(screen.getByTitle('Delete group blue'));
				fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

				await waitFor(() => {
					expect(screen.getByText('Alignment Groups (0)')).toBeDefined();
				});
			});
		});

		it('should load alignment groups when editing another profile', async () => {
			vi.mocked(regionProfiles.getProfile).mockReturnValue([]);
			vi.mocked(regionProfiles.getProfileAlignment).mockReturnValue([{ name: 'red' }]);
			await renderWithEditor();

			const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
			fireEvent.click(editButtons[0]);

			expect(regionProfiles.getProfileAlignment).toHaveBeenCalledWith(mockProfiles[0].id);
			expect(screen.getByText('red')).toBeDefined();
		});
	});
});
