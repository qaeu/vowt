import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@solidjs/testing-library';

import type { DrawnRegion, TextRegion } from '#types';
import type { RegionEditorOptions } from '#utils/regionEditor';

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

// Mock the canvas parts of the region editor; keep its pure helpers
vi.mock('#utils/regionEditor', async (importOriginal) => ({
	...(await importOriginal<typeof import('#utils/regionEditor')>()),
	startRegionEditor: vi.fn(),
	drawRegions: vi.fn(),
}));

type RegionCallback = (region: DrawnRegion) => void;

const PREVIEW = 'data:image/png;base64,test';

const dialogContent = () =>
	document.querySelector<HTMLElement>('[data-scope="dialog"][data-part="content"]')!;

describe('RegionProfileManager', () => {
	const mockProfiles = [
		{ id: 'profile1', description: 'Test Profile 1' },
		{ id: 'profile2', description: 'Test Profile 2' },
	];

	const storedRegions: TextRegion[] = [
		{ name: 'blue_score', x: 10, y: 10, width: 100, height: 40, charSet: '0123456789' },
		{ name: 'red_score', x: 200, y: 10, width: 100, height: 40 },
	];

	/** Mocks Image so the preview "loads" at the given size */
	const mockImageLoad = (width = 1280, height = 720) => {
		const mockImage = {
			onload: null as (() => void) | null,
			onerror: null as (() => void) | null,
			src: '',
			width,
			height,
		};
		vi.spyOn(globalThis, 'Image').mockImplementation(function () {
			setTimeout(() => mockImage.onload?.(), 0);
			return mockImage as unknown as HTMLImageElement;
		});
	};

	/** Renders with a preview and returns the editor's callbacks once it has started */
	const renderWithEditor = async () => {
		mockImageLoad();

		let onRegionComplete: RegionCallback | undefined;
		let options: RegionEditorOptions | undefined;
		vi.mocked(regionEditor.startRegionEditor).mockImplementation(
			async (_canvas, _src, callback, editorOptions) => {
				onRegionComplete = callback;
				options = editorOptions;
			}
		);

		render(() => <RegionProfileManager previewImage={PREVIEW} />);
		await vi.waitFor(() => expect(onRegionComplete).toBeDefined());

		return {
			draw: (rect: Pick<DrawnRegion, 'x' | 'y' | 'width' | 'height'>, id = 'drawn-0') =>
				onRegionComplete!({ ...rect, id, name: 'region_0', colour: '#f00' }),
			options: options!,
		};
	};

	const openTab = async (name: RegExp) => {
		const tab = screen.getByRole('tab', { name });
		fireEvent.click(tab);
		await waitFor(() => expect(tab.getAttribute('aria-selected')).toBe('true'));
	};

	const openMenu = async () => {
		fireEvent.click(screen.getByRole('button', { name: 'More profile actions' }));
		await screen.findAllByRole('menuitem');
	};

	const sidebar = () => within(screen.getByRole('complementary', { name: 'Profiles' }));

	const footer = () => document.querySelector('.unsaved-footer');

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		vi.mocked(regionProfiles.listProfiles).mockReturnValue(mockProfiles);
		vi.mocked(regionProfiles.getActiveProfile).mockReturnValue([]);
		vi.mocked(regionProfiles.getActiveProfileId).mockReturnValue(mockProfiles[1].id);
		vi.mocked(regionProfiles.getActiveProfileDetails).mockReturnValue(mockProfiles[1]);
		vi.mocked(regionProfiles.getProfile).mockReturnValue([]);
		vi.mocked(regionEditor.startRegionEditor).mockResolvedValue(undefined);
		vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([]);
		vi.mocked(regionProfiles.getProfileAlignment).mockReturnValue([]);
		vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(0);
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	describe('Rendering', () => {
		it('should render the title and subtitle', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			expect(screen.getByRole('heading', { name: 'Region profiles' })).toBeDefined();
			expect(screen.getByText(/maps where each value sits/)).toBeDefined();
		});

		it('should offer Import Profile and New Profile actions', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			expect(screen.getByRole('button', { name: 'Import Profile' })).toBeDefined();
			expect(screen.getByRole('button', { name: 'New Profile' })).toBeDefined();
		});

		it('should render the canvas', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			expect(document.querySelector('.canvas-wrapper canvas')).not.toBeNull();
		});
	});

	describe('Profiles sidebar', () => {
		it('should list saved profiles with descriptions', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			expect(sidebar().getByText('profile1')).toBeDefined();
			expect(sidebar().getByText('Test Profile 2')).toBeDefined();
		});

		it('should show "No profiles yet" when the list is empty', () => {
			vi.mocked(regionProfiles.listProfiles).mockReturnValue([]);
			render(() => <RegionProfileManager previewImage={null} />);
			expect(screen.getByText('No profiles yet')).toBeDefined();
		});

		it('should mark only the active profile with an Active badge', () => {
			render(() => <RegionProfileManager previewImage={null} />);

			const badges = sidebar().getAllByText('Active');
			expect(badges).toHaveLength(1);
			expect(badges[0].closest('button')?.textContent).toContain('profile2');
			expect(badges[0].querySelector('svg')).not.toBeNull();
		});

		it('should mark the profile being edited as pressed', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			const item = sidebar().getByRole('button', { name: /profile2/ });
			expect(item.getAttribute('aria-pressed')).toBe('true');
		});

		it('should load a profile at canvas size when clicked', async () => {
			await renderWithEditor();

			fireEvent.click(sidebar().getByRole('button', { name: /profile1/ }));

			expect(regionProfiles.getProfile).toHaveBeenCalledWith('profile1', 1280, 720);
			expect(
				sidebar()
					.getByRole('button', { name: /profile1/ })
					.getAttribute('aria-pressed')
			).toBe('true');
			expect((screen.getByLabelText('Profile ID') as HTMLInputElement).value).toBe(
				'profile1'
			);
		});
	});

	describe('Profile card', () => {
		it('should show a disabled Active button for the active profile', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			const card = within(screen.getByRole('region', { name: 'Profile details' }));
			const button = card.getByRole('button', { name: 'Active' }) as HTMLButtonElement;
			expect(button.disabled).toBe(true);
			expect(card.queryByRole('button', { name: 'Set Active' })).toBeNull();
		});

		it('should activate the profile being edited', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			fireEvent.click(sidebar().getByRole('button', { name: /profile1/ }));

			fireEvent.click(screen.getByRole('button', { name: 'Set Active' }));

			expect(regionProfiles.setActiveProfile).toHaveBeenCalledWith('profile1');
			expect(screen.queryByRole('button', { name: 'Set Active' })).toBeNull();
		});

		it('should export the profile being edited', () => {
			window.URL.createObjectURL = vi.fn(() => 'blob:mock');
			window.URL.revokeObjectURL = vi.fn();
			vi.mocked(regionProfiles.exportProfile).mockReturnValue('{"test": "data"}');
			render(() => <RegionProfileManager previewImage={null} />);

			fireEvent.click(screen.getByRole('button', { name: 'Export' }));

			expect(regionProfiles.exportProfile).toHaveBeenCalledWith('profile2');
		});

		it('should show an alert if the profile cannot be exported', async () => {
			vi.mocked(regionProfiles.exportProfile).mockReturnValue(null);
			render(() => <RegionProfileManager previewImage={null} />);

			fireEvent.click(screen.getByRole('button', { name: 'Export' }));

			expect(await screen.findByText("Couldn't export profile")).toBeDefined();
			expect(
				screen.getByText('Could not export profile. Please save it first.')
			).toBeDefined();
		});

		describe('More menu', () => {
			it('should list the profile actions', async () => {
				render(() => <RegionProfileManager previewImage={null} />);
				await openMenu();

				expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
					'Clear all regions',
					'Clear learned hashes',
					'Delete profile',
				]);
			});

			it('should disable clearing when there is nothing to clear', async () => {
				render(() => <RegionProfileManager previewImage={null} />);
				await openMenu();

				const item = (name: string) =>
					screen.getByRole('menuitem', { name }).getAttribute('aria-disabled');
				expect(item('Clear all regions')).toBe('true');
				expect(item('Clear learned hashes')).toBe('true');
			});

			it('should clear all regions', async () => {
				vi.mocked(regionProfiles.getActiveProfile).mockReturnValue(storedRegions);
				await renderWithEditor();
				await waitFor(() => screen.getByRole('tab', { name: 'Regions (2)' }));

				await openMenu();
				fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all regions' }));

				await waitFor(() => screen.getByRole('tab', { name: 'Regions (0)' }));
			});

			it('should delete the profile after confirming', async () => {
				render(() => <RegionProfileManager previewImage={null} />);
				await openMenu();
				fireEvent.click(screen.getByRole('menuitem', { name: 'Delete profile' }));

				expect(await screen.findByText("Delete profile 'profile2'?")).toBeDefined();
				fireEvent.click(
					within(dialogContent()).getByRole('button', {
						name: 'Delete Profile',
						hidden: true,
					})
				);

				expect(regionProfiles.deleteProfile).toHaveBeenCalledWith('profile2');
				expect(regionProfiles.setActiveProfile).toHaveBeenCalledWith('profile1');
			});

			it('should not delete the profile if the dialog is closed', async () => {
				render(() => <RegionProfileManager previewImage={null} />);
				await openMenu();
				fireEvent.click(screen.getByRole('menuitem', { name: 'Delete profile' }));
				await screen.findByText("Delete profile 'profile2'?");

				fireEvent.click(document.querySelector('[data-part="close-trigger"]')!);

				expect(regionProfiles.deleteProfile).not.toHaveBeenCalled();
			});
		});
	});

	describe('Tabs', () => {
		it('should show counts on each tab', () => {
			vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
				{ name: 'blue' },
			]);
			vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(3);
			render(() => <RegionProfileManager previewImage={null} />);

			expect(screen.getByRole('tab', { name: 'Regions (0)' })).toBeDefined();
			expect(screen.getByRole('tab', { name: 'Alignment groups (1)' })).toBeDefined();
			expect(screen.getByRole('tab', { name: 'Learned portraits (3)' })).toBeDefined();
		});

		it('should keep the same canvas mounted across tab switches', async () => {
			render(() => <RegionProfileManager previewImage={null} />);
			const canvas = document.querySelector('canvas');
			const card = canvas?.closest('.canvas-card');

			await openTab(/Learned portraits/);
			expect(card?.classList.contains('canvas-card--hidden')).toBe(true);
			expect(canvas?.isConnected).toBe(true);

			await openTab(/Alignment groups/);
			expect(card?.classList.contains('canvas-card--hidden')).toBe(false);

			await openTab(/Regions/);
			expect(document.querySelector('canvas')).toBe(canvas);
		});

		it('should start the editor only once across tab switches', async () => {
			await renderWithEditor();

			await openTab(/Alignment groups/);
			await openTab(/Regions/);

			expect(regionEditor.startRegionEditor).toHaveBeenCalledTimes(1);
		});

		describe('Learned portraits', () => {
			it('should show the learned hash count for the editing profile', () => {
				vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(3);
				render(() => <RegionProfileManager previewImage={null} />);

				expect(screen.getByText(/3 learned hashes/)).toBeDefined();
				expect(regionProfiles.countProfileHashes).toHaveBeenCalledWith('profile2');
			});

			it('should disable Clear Learned Hashes when there are none', async () => {
				render(() => <RegionProfileManager previewImage={null} />);
				await openTab(/Learned portraits/);

				const button = screen.getByRole('button', {
					name: 'Clear Learned Hashes',
				}) as HTMLButtonElement;
				expect(button.disabled).toBe(true);
			});

			it('should clear learned hashes after confirming', async () => {
				vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(2);
				render(() => <RegionProfileManager previewImage={null} />);
				await openTab(/Learned portraits/);

				fireEvent.click(screen.getByRole('button', { name: 'Clear Learned Hashes' }));
				vi.mocked(regionProfiles.countProfileHashes).mockReturnValue(0);
				fireEvent.click(await screen.findByRole('button', { name: 'Clear Hashes' }));

				expect(regionProfiles.clearProfileHashes).toHaveBeenCalledWith('profile2');
				await waitFor(() => expect(screen.getByText(/0 learned hashes/)).toBeDefined());
			});
		});
	});

	describe('Canvas modes', () => {
		const modeButton = (name: string) => screen.getByRole('button', { name });

		it('should start in select mode', () => {
			render(() => <RegionProfileManager previewImage={null} />);
			expect(modeButton('Select').getAttribute('aria-pressed')).toBe('true');
			expect(modeButton('Draw Region').getAttribute('aria-pressed')).toBe('false');
			expect(document.querySelector('canvas')?.dataset.mode).toBe('select');
		});

		it('should switch to draw mode and pass the mode to the editor', async () => {
			const { options } = await renderWithEditor();
			expect(options.mode?.()).toBe('select');

			fireEvent.click(modeButton('Draw Region'));

			expect(modeButton('Draw Region').getAttribute('aria-pressed')).toBe('true');
			expect(document.querySelector('canvas')?.dataset.mode).toBe('draw');
			expect(options.mode?.()).toBe('draw');
		});

		it('should switch to draw mode for an alignment anchor and back after', async () => {
			vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
				{ name: 'blue' },
			]);
			vi.mocked(regionAlignment.findAnchorOffset).mockReturnValue(null);
			const { draw, options } = await renderWithEditor();
			await openTab(/Alignment groups/);

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			expect(options.mode?.()).toBe('draw');

			draw({ x: 100, y: 50, width: 40, height: 20 });
			expect(options.mode?.()).toBe('select');
		});

		it('should return to select mode when an alignment draw is cancelled', async () => {
			vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
				{ name: 'blue' },
			]);
			const { options } = await renderWithEditor();
			await openTab(/Alignment groups/);

			fireEvent.click(screen.getByRole('button', { name: 'Draw Rows' }));
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

			expect(options.mode?.()).toBe('select');
		});

		it('should cancel an alignment draw when switching to select mode', async () => {
			vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
				{ name: 'blue' },
			]);
			await renderWithEditor();
			await openTab(/Alignment groups/);

			fireEvent.click(screen.getByRole('button', { name: 'Draw Rows' }));
			expect(screen.getByText(/set the rows for 'blue'/)).toBeDefined();

			fireEvent.click(modeButton('Select'));
			expect(screen.queryByText(/set the rows for 'blue'/)).toBeNull();
		});
	});

	describe('Region selection', () => {
		beforeEach(() => {
			vi.mocked(regionProfiles.getActiveProfile).mockReturnValue(storedRegions);
		});

		it('should give the editor the editable regions to hit-test', async () => {
			const { options } = await renderWithEditor();
			await waitFor(() => expect(options.getRegions?.()).toHaveLength(2));
			expect(options.getRegions?.().map((r) => r.name)).toEqual([
				'blue_score',
				'red_score',
			]);
		});

		it('should inspect and highlight a region selected on the canvas', async () => {
			const { options } = await renderWithEditor();
			await waitFor(() => expect(options.getRegions?.()).toHaveLength(2));

			options.onRegionSelect?.('profile2-1');

			await waitFor(() => {
				expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
					'red_score'
				);
			});
			expect(regionEditor.drawRegions).toHaveBeenLastCalledWith(
				expect.anything(),
				expect.any(Array),
				PREVIEW,
				'profile2-1'
			);
		});

		it('should switch to the Regions tab when a region is selected on the canvas', async () => {
			const { options } = await renderWithEditor();
			await openTab(/Alignment groups/);

			options.onRegionSelect?.('profile2-0');

			await waitFor(() => {
				expect(
					screen.getByRole('tab', { name: /Regions/ }).getAttribute('aria-selected')
				).toBe('true');
			});
		});

		it('should select a newly drawn region', async () => {
			const { draw } = await renderWithEditor();

			draw({ x: 10, y: 300, width: 40, height: 20 }, 'drawn-5');

			await waitFor(() => {
				expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
					'region_0'
				);
			});
			expect(screen.getByRole('tab', { name: 'Regions (3)' })).toBeDefined();
		});
	});

	describe('Unsaved changes footer', () => {
		beforeEach(() => {
			vi.mocked(regionProfiles.getActiveProfile).mockReturnValue(storedRegions);
		});

		it('should be hidden without changes', async () => {
			await renderWithEditor();
			await waitFor(() => screen.getByRole('tab', { name: 'Regions (2)' }));
			expect(footer()).toBeNull();
			expect(screen.queryByRole('button', { name: 'Save Profile' })).toBeNull();
		});

		it('should count added regions and edited fields', async () => {
			const { draw, options } = await renderWithEditor();
			await waitFor(() => expect(options.getRegions?.()).toHaveLength(2));

			draw({ x: 10, y: 300, width: 40, height: 20 });
			await waitFor(() => {
				expect(footer()?.textContent).toBe(
					'1 unsaved change to profile2DiscardSave Profile'
				);
			});

			options.onRegionSelect?.('profile2-0');
			const name = await screen.findByDisplayValue('blue_score');
			fireEvent.input(name, { target: { value: 'blue_final' } });

			expect(footer()?.textContent).toContain('2 unsaved changes to profile2');
		});

		it('should count description and alignment changes', async () => {
			await renderWithEditor();
			await waitFor(() => screen.getByRole('tab', { name: 'Regions (2)' }));

			fireEvent.input(screen.getByLabelText('Description'), {
				target: { value: 'Changed' },
			});
			expect(footer()?.textContent).toContain('1 unsaved change to profile2');

			await openTab(/Alignment groups/);
			fireEvent.input(screen.getByLabelText('New group name'), {
				target: { value: 'blue' },
			});
			fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
			expect(footer()?.textContent).toContain('2 unsaved changes to profile2');
		});

		it('should discard changes back to the saved profile', async () => {
			const { draw, options } = await renderWithEditor();
			await waitFor(() => expect(options.getRegions?.()).toHaveLength(2));

			draw({ x: 10, y: 300, width: 40, height: 20 });
			fireEvent.input(screen.getByLabelText('Description'), {
				target: { value: 'Changed' },
			});
			await waitFor(() => expect(footer()).not.toBeNull());

			fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

			expect(footer()).toBeNull();
			expect(screen.getByRole('tab', { name: 'Regions (2)' })).toBeDefined();
			expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
				'Test Profile 2'
			);
			expect(regionProfiles.saveProfile).not.toHaveBeenCalled();
		});

		it('should reset an edited field on discard', async () => {
			const { options } = await renderWithEditor();
			await waitFor(() => expect(options.getRegions?.()).toHaveLength(2));
			options.onRegionSelect?.('profile2-0');

			const name = await screen.findByDisplayValue('blue_score');
			fireEvent.input(name, { target: { value: 'blue_final' } });
			fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

			await waitFor(() => {
				expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
					'blue_score'
				);
			});
		});

		it('should save the profile and hide the footer', async () => {
			const { draw, options } = await renderWithEditor();
			await waitFor(() => expect(options.getRegions?.()).toHaveLength(2));

			draw({ x: 10, y: 300, width: 40, height: 20 });
			fireEvent.click(await screen.findByRole('button', { name: 'Save Profile' }));

			expect(regionProfiles.saveProfile).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ name: 'region_0' })]),
				expect.objectContaining({ id: 'profile2', description: 'Test Profile 2' }),
				1280,
				720
			);
			expect(footer()).toBeNull();
		});

		describe('new profile', () => {
			it('should start an empty profile with an unused ID', async () => {
				await renderWithEditor();

				fireEvent.click(screen.getByRole('button', { name: 'New Profile' }));

				expect((screen.getByLabelText('Profile ID') as HTMLInputElement).value).toBe(
					'profile-3'
				);
				expect(screen.getByRole('tab', { name: 'Regions (0)' })).toBeDefined();
				expect(footer()?.textContent).toContain('1 unsaved change to profile-3');
			});

			it('should go back to the previous profile on discard', async () => {
				await renderWithEditor();
				fireEvent.click(screen.getByRole('button', { name: 'New Profile' }));

				fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

				expect(regionProfiles.getProfile).toHaveBeenCalledWith('profile2', 1280, 720);
				expect((screen.getByLabelText('Profile ID') as HTMLInputElement).value).toBe(
					'profile2'
				);
				expect(footer()).toBeNull();
			});
		});
	});

	describe('Region Denormalisation', () => {
		it('should call getActiveProfile with image dimensions on mount', async () => {
			mockImageLoad(1920, 1080);
			render(() => <RegionProfileManager previewImage={PREVIEW} />);

			await vi.waitFor(() => {
				expect(regionProfiles.getActiveProfile).toHaveBeenCalledWith(1920, 1080);
			});
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

		const addGroup = (name: string) => {
			fireEvent.input(screen.getByLabelText('New group name'), {
				target: { value: name },
			});
			fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
		};

		/** Renders with the editor, opens the Alignment groups tab and adds a group */
		const renderWithGroup = async () => {
			const editor = await renderWithEditor();
			await openTab(/Alignment groups/);
			addGroup('blue');
			return editor;
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

		it('should load alignment groups for the active profile', () => {
			vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
				{ name: 'blue' },
			]);

			render(() => <RegionProfileManager previewImage={null} />);

			expect(screen.getByText('Alignment Groups (1)')).toBeDefined();
			expect(screen.getByText('blue')).toBeDefined();
		});

		it('should capture an anchor from a drawn rectangle at reference resolution', async () => {
			const { draw } = await renderWithGroup();

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			expect(screen.getByText(/set the anchor for 'blue'/)).toBeDefined();

			draw({ x: 100, y: 50, width: 40, height: 20 });

			await waitFor(() => {
				expect(screen.getByRole('button', { name: 'Redraw Anchor' })).toBeDefined();
			});
			expect(regionAlignment.loadReferenceGrayscale).toHaveBeenCalledWith(PREVIEW);
			expect(regionAlignment.createAnchor).toHaveBeenCalledWith(
				gray,
				{ x: 200, y: 100, width: 80, height: 40 },
				48,
				160
			);
			expect(screen.queryByText(/set the anchor for/)).toBeNull();
			expect(screen.getByRole('tab', { name: 'Regions (0)' })).toBeDefined();
		});

		it('should reject an anchor without enough detail', async () => {
			vi.mocked(regionAlignment.findAnchorOffset).mockReturnValue(null);
			const { draw } = await renderWithGroup();

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });

			expect(await screen.findByText("Couldn't set anchor")).toBeDefined();
			expect(screen.getByRole('button', { name: 'Draw Anchor' })).toBeDefined();
		});

		it('should show an error when the image cannot be read', async () => {
			vi.mocked(regionAlignment.loadReferenceGrayscale).mockRejectedValue(
				new Error('Failed to load image')
			);
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const { draw } = await renderWithGroup();

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });

			expect(
				await screen.findByText('Could not read the image to capture the anchor.')
			).toBeDefined();
		});

		it('should create row bands from a drawn rectangle', async () => {
			const { draw } = await renderWithGroup();

			fireEvent.click(screen.getByRole('button', { name: 'Draw Rows' }));
			draw({ x: 420, y: 218, width: 298, height: 210 });

			await waitFor(() => {
				expect(screen.getByText('5 rows')).toBeDefined();
			});
			expect((screen.getByLabelText('Row Height') as HTMLInputElement).value).toBe('84');
			expect((screen.getByLabelText('Y') as HTMLInputElement).value).toBe('436');
		});

		it('should add drawn rectangles as regions when not drawing alignment', async () => {
			const { draw } = await renderWithEditor();

			draw({ x: 10, y: 10, width: 40, height: 20 });

			await waitFor(() => {
				expect(screen.getByRole('tab', { name: 'Regions (1)' })).toBeDefined();
			});
			expect(regionAlignment.createAnchor).not.toHaveBeenCalled();
		});

		it('should draw alignment overlays scaled to the canvas', async () => {
			const { draw } = await renderWithGroup();

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			draw({ x: 100, y: 50, width: 40, height: 20 });

			await waitFor(() => {
				expect(regionEditor.drawRegions).toHaveBeenLastCalledWith(
					expect.anything(),
					[expect.objectContaining({ x: 100, y: 50, width: 40, height: 20 })],
					PREVIEW,
					null
				);
			});
		});

		it('should save alignment groups with the profile', async () => {
			const { draw } = await renderWithGroup();
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
				render(() => <RegionProfileManager previewImage={null} />);

				fireEvent.click(screen.getByTitle('Delete group blue'));

				expect(screen.getByText('Alignment Groups (0)')).toBeDefined();
				expect(screen.queryByText('Delete alignment group?')).toBeNull();
			});

			it('should ask before deleting a group that regions use', async () => {
				vi.mocked(regionProfiles.getActiveProfile).mockReturnValue([groupedRegion]);
				vi.mocked(regionProfiles.getActiveProfileAlignment).mockReturnValue([
					{ name: 'blue' },
				]);
				await renderWithEditor();
				await waitFor(() => expect(screen.getByText('1 regions')).toBeDefined());

				fireEvent.click(screen.getByTitle('Delete group blue'));

				expect(await screen.findByText('Delete alignment group?')).toBeDefined();
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
				fireEvent.click(await screen.findByRole('button', { name: 'Delete Group' }));

				await waitFor(() => {
					expect(screen.getByText('Alignment Groups (0)')).toBeDefined();
				});
			});
		});

		it('should load alignment groups when editing another profile', async () => {
			vi.mocked(regionProfiles.getProfileAlignment).mockReturnValue([{ name: 'red' }]);
			await renderWithEditor();

			fireEvent.click(sidebar().getByRole('button', { name: /profile1/ }));

			expect(regionProfiles.getProfileAlignment).toHaveBeenCalledWith('profile1');
			expect(screen.getByText('red')).toBeDefined();
		});
	});
});
