/**
 * Region profiles screen: pick a profile, edit its regions on the preview image,
 * set up alignment groups and manage learned portrait hashes
 */

import type { Component } from 'solid-js';
import {
	createSignal,
	createMemo,
	createEffect,
	batch,
	For,
	Show,
	onMount,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Menu } from '@ark-ui/solid/menu';
import { Tabs } from '@ark-ui/solid/tabs';
import { Check, Ellipsis, MousePointer2, SquareDashed, Trash2 } from 'lucide-solid';

import type {
	TextRegion,
	DrawnRegion,
	AlertDialogOptions,
	AlignmentGroup,
	AlignmentDrawTarget,
	GrayImage,
	LearnedHash,
} from '#types';
import type { RegionEditorMode } from '#utils/regionEditor';
import Screen from '#c/ui/Screen';
import AlertDialog from '#c/ui/AlertDialog';
import Toaster, { toast } from '#c/ui/Toaster';
import RegionInspector from '#c/ui/RegionInspector';
import AlignmentGroupsEditor from '#c/ui/AlignmentGroupsEditor';
import * as Profiles from '#utils/regionProfiles';
import { startRegionEditor, drawRegions, isSameRegion } from '#utils/regionEditor';
import { templateToDataURL } from '#utils/imageRecognition';
import {
	ALIGN_SCALE,
	createAnchor,
	downsample,
	findAnchorOffset,
	loadReferenceGrayscale,
} from '#utils/regionAlignment';

interface RegionProfileManagerProps {
	previewImage: string | null;
}

type ProfileTab = 'regions' | 'alignment' | 'portraits';

type MenuAction = 'clear-regions' | 'clear-hashes' | 'delete-profile';

const REGION_COLOUR_DEFAULT = '#ff0000';
const REGION_COLOUR_ITALIC = '#4caf50';
const REGION_COLOUR_IMAGE = '#3131da';
const REGION_COLOUR_ISOLATED = '#d63cf5';
const REGION_COLOUR_ANCHOR = '#ff9800';
const REGION_COLOUR_ROWS = '#00bcd4';

/** Default anchor search range in reference pixels */
const ANCHOR_SEARCH_X = 48;
const ANCHOR_SEARCH_Y = 160;
const ROWS_COUNT_DEFAULT = 5;

const SUBTITLE =
	'A profile maps where each value sits on a scoreboard screenshot. The active profile reads new uploads.';

/** Counts groups added, removed or changed between two alignment lists */
const countAlignmentChanges = (current: AlignmentGroup[], saved: AlignmentGroup[]) => {
	const savedByName = new Map(saved.map((g) => [g.name, JSON.stringify(g)] as const));
	let count = 0;
	for (const group of current) {
		if (savedByName.get(group.name) !== JSON.stringify(group)) count++;
		savedByName.delete(group.name);
	}
	return count + savedByName.size;
};

/** Counts regions added, removed or changed between two region lists */
const countRegionChanges = (current: DrawnRegion[], saved: DrawnRegion[]) => {
	const savedById = new Map(saved.map((r) => [r.id, r] as const));
	let count = 0;
	for (const region of current) {
		const savedRegion = savedById.get(region.id);
		if (!savedRegion || !isSameRegion(region, savedRegion)) count++;
		savedById.delete(region.id);
	}
	return count + savedById.size;
};

const plural = (count: number, word: string, suffix = 's') =>
	`${count} ${word}${count === 1 ? '' : suffix}`;

const formatLearnedAt = (date: Date) =>
	date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const RegionProfileManager: Component<RegionProfileManagerProps> = (props) => {
	const initialProfileList = Profiles.listProfiles();
	const { id: initialActiveProfileId, description: initialActiveProfileDesc } =
		Profiles.getActiveProfileDetails();
	const initialAlignment = Profiles.getActiveProfileAlignment();

	const [savedRegions, setSavedRegions] = createSignal<DrawnRegion[]>([]);
	const [editingRegions, setEditingRegions] = createSignal<DrawnRegion[]>([]);
	const [profileList, setProfileList] = createSignal(initialProfileList);
	const [activeProfileId, setActiveProfileId] =
		createSignal<string>(initialActiveProfileId);
	// The stored profile the editing state started from; '' for a new profile
	const [loadedProfileId, setLoadedProfileId] = createSignal(initialActiveProfileId);
	const [editingProfileId, setEditingProfileId] = createSignal(initialActiveProfileId);
	const [editingProfileDesc, setEditingProfileDesc] = createSignal(
		initialActiveProfileDesc
	);
	const [savedAlignment, setSavedAlignment] =
		createSignal<AlignmentGroup[]>(initialAlignment);
	const [alignment, setAlignment] = createSignal<AlignmentGroup[]>(initialAlignment);
	const [drawTarget, setDrawTarget] = createSignal<AlignmentDrawTarget | null>(null);
	const [selectedRegionId, setSelectedRegionId] = createSignal<string | null>(null);
	const [canvasMode, setCanvasMode] = createSignal<RegionEditorMode>('select');
	const [activeTab, setActiveTab] = createSignal<ProfileTab>('regions');
	const [editorReady, setEditorReady] = createSignal(false);
	// Bumped when stored hashes change, since they're read from storage
	const [hashesVersion, setHashesVersion] = createSignal(0);

	const learnedHashes = createMemo(() => {
		hashesVersion();
		return Profiles.listProfileHashes(editingProfileId());
	});
	const learnedHashCount = () => learnedHashes().length;

	const regionCounts = createMemo(() => {
		const counts: Record<string, number> = {};
		for (const region of editingRegions()) {
			if (region.group) counts[region.group] = (counts[region.group] ?? 0) + 1;
		}
		return counts;
	});

	const isProfileStored = () => profileList().some((p) => p.id === editingProfileId());

	const savedProfileDesc = () =>
		profileList().find((p) => p.id === loadedProfileId())?.description ?? '';

	const unsavedChangeCount = createMemo(() => {
		let count = 0;
		if (editingProfileId() !== loadedProfileId()) count++;
		if (editingProfileDesc() !== savedProfileDesc()) count++;
		count += countRegionChanges(editingRegions(), savedRegions());
		count += countAlignmentChanges(alignment(), savedAlignment());
		return count;
	});

	let openDialog: ((options: AlertDialogOptions) => void) | null = null;
	let canvasRef: HTMLCanvasElement | undefined;
	let referenceGray: { src: string; image: GrayImage } | null = null;
	let modeBeforeAlignmentDraw: RegionEditorMode = 'select';
	// Profile to return to when discarding a new, unsaved profile
	let profileBeforeNew = initialActiveProfileId;

	onMount(async () => {
		if (!canvasRef) return;

		const imageSource = getImageSource();
		if (!imageSource) return;

		// Load image to get dimensions for denormalisation
		const img = new Image();
		img.src = imageSource;
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('Failed to load image'));
		});

		// Size the canvas now so alignment overlays scale correctly
		canvasRef.width = img.width;
		canvasRef.height = img.height;

		const activeRegions = Profiles.getActiveProfile(img.width, img.height);
		const drawnRegions = makeDrawnRegions(activeRegions, editingProfileId());

		batch(() => {
			setSavedRegions(drawnRegions);
			setEditingRegions(drawnRegions);
		});

		startRegionEditor(canvasRef, imageSource, handleRegionComplete, {
			initialRegions: [...drawnRegions, ...alignmentOverlays()],
			mode: canvasMode,
			getRegions: editingRegions,
			onRegionSelect: handleCanvasSelect,
		}).catch((err) => console.error('Region editor error:', err));

		setEditorReady(true);
	});

	// Redraw the canvas whenever regions, overlays or the selection change
	createEffect(() => {
		const regions = [...editingRegions(), ...alignmentOverlays()];
		const selectedId = selectedRegionId();
		const imageSource = getImageSource();
		if (!editorReady() || !canvasRef || !imageSource) return;

		drawRegions(canvasRef, regions, imageSource, selectedId);
	});

	const getImageSource = () => props.previewImage;

	const makeDrawnRegions = (
		textRegions: (TextRegion & Partial<Pick<DrawnRegion, 'id'>>)[],
		profileId: string
	): DrawnRegion[] => {
		return textRegions.map((r, index) => ({
			...r,
			// Keep existing IDs so edits and selection survive deletions
			id: r.id ?? `${profileId}-${index}`,
			colour:
				r.imgHashSet && r.imgHashSet.length > 0 ? REGION_COLOUR_IMAGE
				: r.isolateText ? REGION_COLOUR_ISOLATED
				: r.isItalic ? REGION_COLOUR_ITALIC
				: REGION_COLOUR_DEFAULT,
		}));
	};

	const makeTextRegions = (drawnRegions: DrawnRegion[]): TextRegion[] => {
		return drawnRegions.map((r) => ({
			...r,
			id: undefined,
			colour: undefined,
		}));
	};

	const activateProfile = (profileId: string) => {
		setActiveProfileId(profileId);
		Profiles.setActiveProfile(profileId);
	};

	/** Scale factors from reference resolution to the canvas image */
	const getCanvasScale = () => ({
		x: (canvasRef?.width || Profiles.REFERENCE_WIDTH) / Profiles.REFERENCE_WIDTH,
		y: (canvasRef?.height || Profiles.REFERENCE_HEIGHT) / Profiles.REFERENCE_HEIGHT,
	});

	/** Outlines of alignment anchors and row bands, scaled to the canvas image */
	const alignmentOverlays = (): DrawnRegion[] => {
		const scale = getCanvasScale();
		const toCanvas = (
			name: string,
			colour: string,
			x: number,
			y: number,
			width: number,
			height: number
		): DrawnRegion => ({
			id: `alignment-${name}`,
			name,
			colour,
			x: Math.round(x * scale.x),
			y: Math.round(y * scale.y),
			width: Math.round(width * scale.x),
			height: Math.round(height * scale.y),
		});

		return alignment().flatMap((group) => {
			const overlays: DrawnRegion[] = [];
			const { anchor, rows } = group;

			if (anchor) {
				overlays.push(
					toCanvas(
						`${group.name}-anchor`,
						REGION_COLOUR_ANCHOR,
						anchor.x,
						anchor.y,
						anchor.template.width * ALIGN_SCALE,
						anchor.template.height * ALIGN_SCALE
					)
				);
			}

			if (rows) {
				for (let r = 0; r < rows.count; r++) {
					overlays.push(
						toCanvas(
							`${group.name}-row${r}`,
							REGION_COLOUR_ROWS,
							rows.x,
							rows.y + r * rows.rowHeight,
							rows.width,
							rows.rowHeight
						)
					);
				}
			}

			return overlays;
		});
	};

	/** Loads the preview image at reference resolution, reusing the last result */
	const getReferenceGray = async (src: string): Promise<GrayImage> => {
		if (referenceGray?.src !== src) {
			referenceGray = { src, image: await loadReferenceGrayscale(src) };
		}
		return referenceGray.image;
	};

	/** Turns a rectangle drawn on the canvas into an anchor or row bands for a group */
	const applyAlignmentRect = async (target: AlignmentDrawTarget, region: DrawnRegion) => {
		const imageSource = getImageSource();
		const group = alignment().find((g) => g.name === target.group);
		if (!imageSource || !group) return;

		const scale = getCanvasScale();
		const rect = {
			x: Math.round(region.x / scale.x),
			y: Math.round(region.y / scale.y),
			width: Math.round(region.width / scale.x),
			height: Math.round(region.height / scale.y),
		};

		let updated: AlignmentGroup;

		if (target.kind === 'anchor') {
			try {
				const gray = await getReferenceGray(imageSource);
				const anchor = createAnchor(
					gray,
					rect,
					group.anchor?.searchX ?? ANCHOR_SEARCH_X,
					group.anchor?.searchY ?? ANCHOR_SEARCH_Y
				);

				// An anchor must at least find itself; flat areas have nothing to match
				if (!findAnchorOffset(downsample(gray, ALIGN_SCALE), anchor)) {
					openDialog?.({
						title: "Couldn't set anchor",
						description:
							'The selected area has too little detail to match. Draw the anchor around text, icons or edges.',
						actionText: 'Close',
					});
					return;
				}

				updated = { ...group, anchor };
			} catch (error) {
				console.error('Anchor capture error:', error);
				openDialog?.({
					title: "Couldn't set anchor",
					description: 'Could not read the image to capture the anchor.',
					actionText: 'Close',
				});
				return;
			}
		} else {
			const count = group.rows?.count ?? ROWS_COUNT_DEFAULT;
			updated = {
				...group,
				rows: {
					x: rect.x,
					width: rect.width,
					y: rect.y,
					rowHeight: Math.max(1, Math.round(rect.height / count)),
					count,
				},
			};
		}

		setAlignment((prev) => prev.map((g) => (g.name === group.name ? updated : g)));
		toast(
			'Alignment updated',
			`${target.kind === 'anchor' ? 'Anchor' : 'Rows'} set for group '${group.name}'.`
		);
	};

	const handleCanvasModeChange = (mode: RegionEditorMode) => {
		// Leaving draw mode abandons any pending anchor or rows rectangle
		if (mode === 'select') setDrawTarget(null);
		setCanvasMode(mode);
	};

	const handleRequestAlignmentDraw = (target: AlignmentDrawTarget) => {
		if (!drawTarget()) modeBeforeAlignmentDraw = canvasMode();
		batch(() => {
			setDrawTarget(target);
			setCanvasMode('draw');
		});
	};

	const endAlignmentDraw = () => {
		batch(() => {
			setDrawTarget(null);
			setCanvasMode(modeBeforeAlignmentDraw);
		});
	};

	const handleCanvasSelect = (id: string | null) => {
		batch(() => {
			setSelectedRegionId(id);
			if (id) setActiveTab('regions');
		});
	};

	const handleRegionComplete = (region: DrawnRegion) => {
		const target = drawTarget();
		if (target) {
			endAlignmentDraw();
			void applyAlignmentRect(target, region);
			return;
		}

		batch(() => {
			setEditingRegions((prev) => [...prev, region]);
			setSelectedRegionId(region.id);
		});
	};

	const handleClearRegions = () => {
		batch(() => {
			setEditingRegions([]);
			setSelectedRegionId(null);
		});
	};

	const handleRegionChange = (regions: DrawnRegion[]) => {
		setEditingRegions(makeDrawnRegions(regions, editingProfileId()));
	};

	const handleAlignmentChange = (groups: AlignmentGroup[]) => {
		const applyChange = () => setAlignment(groups);

		// Regions keep their group name, so warn before orphaning them
		const counts = regionCounts();
		const orphaned = alignment().filter(
			(g) => !groups.some((kept) => kept.name === g.name) && counts[g.name]
		);
		if (orphaned.length === 0) {
			applyChange();
			return;
		}

		const count = orphaned.reduce((total, g) => total + counts[g.name], 0);
		const names = orphaned.map((g) => `'${g.name}'`).join(', ');
		openDialog?.({
			title: 'Delete alignment group?',
			description: `${count} region${count === 1 ? ' uses' : 's use'} ${names}. They will keep their profile positions until assigned to another group. Delete anyway?`,
			actionText: 'Delete Group',
			tone: 'danger',
			onConfirm: applyChange,
		});
	};

	const handleExportProfile = () => {
		const profileId = editingProfileId();
		if (!profileId) {
			openDialog?.({
				title: "Couldn't export profile",
				description: 'No profile selected to export',
				actionText: 'Close',
			});
			return;
		}

		const data = Profiles.exportProfile(profileId);
		if (!data) {
			openDialog?.({
				title: "Couldn't export profile",
				description: 'Could not export profile. Please save it first.',
				actionText: 'Close',
			});
			return;
		}

		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vowt-profile-${profileId}-${new Date().toISOString().replace(/:/g, '-')}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleImportProfile = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json,application/json';
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (event) => {
					try {
						const data = event.target?.result as string;
						const profileCount = Profiles.importProfile(data);
						if (profileCount === null) {
							openDialog?.({
								title: "Couldn't import profile",
								description: 'Error importing profile. Please check the file format.',
								actionText: 'Close',
							});
							return;
						}
						toast('Profile imported', 'Region profile imported');
						setProfileList(Profiles.listProfiles());
						setHashesVersion((v) => v + 1);
					} catch (error) {
						openDialog?.({
							title: "Couldn't import profile",
							description: 'Error importing profile. Please check the file format.',
							actionText: 'Close',
						});
						console.error('Import error:', error);
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	};

	/** Starts an empty, unsaved profile with an unused ID */
	const handleNewProfile = () => {
		const ids = new Set(profileList().map((p) => p.id));
		let n = profileList().length + 1;
		while (ids.has(`profile-${n}`)) n++;

		if (loadedProfileId()) profileBeforeNew = loadedProfileId();

		batch(() => {
			setLoadedProfileId('');
			setEditingProfileId(`profile-${n}`);
			setEditingProfileDesc('');
			setSavedRegions([]);
			setEditingRegions([]);
			setSavedAlignment([]);
			setAlignment([]);
			setSelectedRegionId(null);
			setDrawTarget(null);
			setActiveTab('regions');
		});
	};

	const handleSaveProfile = () => {
		if (!editingProfileId()) {
			openDialog?.({
				title: "Couldn't save profile",
				description: 'Profile ID is required',
				actionText: 'Close',
			});
			return;
		}

		if (canvasRef) {
			Profiles.saveProfile(
				makeTextRegions(editingRegions()),
				{
					id: editingProfileId(),
					description: editingProfileDesc(),
					alignment: alignment(),
				},
				canvasRef.width,
				canvasRef.height
			);
		}

		batch(() => {
			setSavedRegions(editingRegions());
			setSavedAlignment(alignment());
			setLoadedProfileId(editingProfileId());
			setProfileList(Profiles.listProfiles());
		});

		toast('Profile saved', `Profile '${editingProfileId()}' saved.`);
	};

	/** Puts the editing state back to the last saved version of the profile */
	const handleDiscardChanges = () => {
		if (!loadedProfileId()) {
			loadProfile(profileBeforeNew);
			return;
		}

		batch(() => {
			setEditingProfileId(loadedProfileId());
			setEditingProfileDesc(savedProfileDesc());
			setEditingRegions(savedRegions());
			setAlignment(savedAlignment());
			setDrawTarget(null);
			if (!savedRegions().some((r) => r.id === selectedRegionId())) {
				setSelectedRegionId(null);
			}
		});
	};

	const handleActivateProfile = (profileId: string) => {
		activateProfile(profileId);
		toast(
			'Profile activated',
			`Profile '${profileId}' is now active for screenshot recognition.`
		);
	};

	/** Loads a stored profile into the editor; returns false if it couldn't be read */
	const loadProfile = (profileId: string): boolean => {
		if (!canvasRef) {
			openDialog?.({
				title: "Couldn't edit profile",
				description: 'Canvas not ready',
				actionText: 'Close',
			});
			return false;
		}

		const profileRegions = Profiles.getProfile(
			profileId,
			canvasRef.width,
			canvasRef.height
		);
		if (!profileRegions) {
			openDialog?.({
				title: "Couldn't edit profile",
				description: `Error loading region data for profile '${profileId}'`,
				actionText: 'Close',
			});
			return false;
		}

		batch(() => {
			const drawnRegions = makeDrawnRegions(profileRegions, profileId);
			const profileAlignment = Profiles.getProfileAlignment(profileId);
			setSavedRegions(drawnRegions);
			setEditingRegions(drawnRegions);
			setSavedAlignment(profileAlignment);
			setAlignment(profileAlignment);
			setDrawTarget(null);
			setSelectedRegionId(null);
			setLoadedProfileId(profileId);

			const profileDetails = profileList().find((p) => p.id === profileId);
			setEditingProfileId(profileId);
			setEditingProfileDesc(profileDetails?.description ?? '');
		});

		return true;
	};

	const handleEditProfile = (profileId: string) => {
		if (loadProfile(profileId)) {
			toast('Editing profile', `Now editing profile '${profileId}'.`);
		}
	};

	const handleDeleteProfile = (profileId: string) => {
		if (activeProfileId() === profileId && profileList().length === 1) {
			openDialog?.({
				title: "Couldn't delete profile",
				description: 'Cannot delete the last remaining profile.',
				actionText: 'Close',
			});
			return;
		}

		openDialog?.({
			title: `Delete profile '${profileId}'?`,
			description:
				'The profile and its regions will be permanently removed from this browser.',
			actionText: 'Delete Profile',
			tone: 'danger',
			onConfirm: () => {
				if (activeProfileId() === profileId) {
					// There must always be an active profile, so activate another
					const next = profileList().find((p) => p.id !== profileId);
					if (next) activateProfile(next.id);
				}

				Profiles.deleteProfile(profileId);
				setProfileList(Profiles.listProfiles());

				if (editingProfileId() === profileId) {
					handleEditProfile(activeProfileId());
				}

				toast('Profile deleted', `Profile '${profileId}' deleted.`);
			},
		});
	};

	const handleClearHashes = (profileId: string) => {
		openDialog?.({
			title: 'Clear learned hashes?',
			description: `Are you sure you want to remove all learned image hashes from profile '${profileId}'? Bundled hashes are not affected.`,
			actionText: 'Clear Hashes',
			tone: 'danger',
			onConfirm: () => {
				Profiles.clearProfileHashes(profileId);
				setHashesVersion((v) => v + 1);
				toast(
					'Learned hashes cleared',
					`Learned hashes removed from profile '${profileId}'.`
				);
			},
		});
	};

	const handleRemoveHash = (profileId: string, learned: LearnedHash) => {
		if (!Profiles.removeProfileHash(profileId, learned.hashSetId, learned.hash)) return;
		setHashesVersion((v) => v + 1);
		toast('Learned hash deleted', `Portrait hash for '${learned.name}' removed.`);
	};

	const handleMenuSelect = (action: MenuAction) => {
		switch (action) {
			case 'clear-regions':
				handleClearRegions();
				break;
			case 'clear-hashes':
				handleClearHashes(editingProfileId());
				break;
			case 'delete-profile':
				handleDeleteProfile(editingProfileId());
				break;
		}
	};

	const canvasHint = () => {
		const target = drawTarget();
		if (target) {
			return `Drawing ${target.kind === 'anchor' ? 'the anchor' : 'rows'} for '${target.group}'.`;
		}
		return canvasMode() === 'draw' ?
				'Drag on the image to draw a new region.'
			:	'Click a region on the image to inspect it.';
	};

	return (
		<Screen
			id="region-profile-manager-screen"
			title="Region profiles"
			subtitle={SUBTITLE}
			screenActions={() => [
				{ id: 'import-profile', text: 'Import Profile', onClick: handleImportProfile },
				{ id: 'new-profile', text: 'New Profile', onClick: handleNewProfile },
			]}
		>
			<div class="manager-layout">
				<aside class="profiles-sidebar" aria-label="Profiles">
					<h2 class="profiles-sidebar__title">Profiles</h2>
					<Show
						when={profileList().length > 0}
						fallback={<p class="empty-state">No profiles yet</p>}
					>
						<ul class="profiles-sidebar__list">
							<For each={profileList()}>
								{(profile) => (
									<li>
										<button
											class="profile-item"
											aria-pressed={editingProfileId() === profile.id}
											onClick={() => handleEditProfile(profile.id)}
										>
											<span class="profile-item__heading">
												<span class="profile-item__id">{profile.id}</span>
												<Show when={activeProfileId() === profile.id}>
													<span class="profile-item__badge">
														<Check size={12} />
														Active
													</span>
												</Show>
											</span>
											<Show when={profile.description}>
												<span class="profile-item__description">
													{profile.description}
												</span>
											</Show>
										</button>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</aside>

				<div class="profile-editor">
					<section class="profile-card" aria-label="Profile details">
						<div class="profile-card__fields">
							<div class="profile-card__field">
								<label for="profile-id-input">Profile ID</label>
								<input
									id="profile-id-input"
									type="text"
									value={editingProfileId()}
									onInput={(e) => setEditingProfileId(e.currentTarget.value)}
									class="profile-input"
								/>
							</div>
							<div class="profile-card__field profile-card__field--wide">
								<label for="profile-desc-input">Description</label>
								<textarea
									id="profile-desc-input"
									value={editingProfileDesc()}
									onInput={(e) => setEditingProfileDesc(e.currentTarget.value)}
									class="profile-textarea"
									placeholder="Profile description (optional)"
								/>
							</div>
						</div>

						<div class="profile-card__actions">
							<Show
								when={activeProfileId() === editingProfileId()}
								fallback={
									<button
										onClick={() => handleActivateProfile(editingProfileId())}
										disabled={!isProfileStored()}
									>
										Set Active
									</button>
								}
							>
								<button class="profile-card__active" disabled>
									<Check size={14} />
									Active
								</button>
							</Show>
							<button onClick={handleExportProfile}>Export</button>

							<Menu.Root
								onSelect={(details) => handleMenuSelect(details.value as MenuAction)}
							>
								<Menu.Trigger
									class="profile-card__more"
									aria-label="More profile actions"
								>
									<Ellipsis size={16} />
								</Menu.Trigger>
								<Portal>
									<Menu.Positioner>
										<Menu.Content class="profile-menu">
											<Menu.Item
												value="clear-regions"
												disabled={editingRegions().length === 0}
											>
												Clear all regions
											</Menu.Item>
											<Menu.Item value="clear-hashes" disabled={learnedHashCount() === 0}>
												Clear learned hashes
											</Menu.Item>
											<Menu.Separator />
											<Menu.Item
												value="delete-profile"
												class="profile-menu__item--danger"
												disabled={!isProfileStored()}
											>
												Delete profile
											</Menu.Item>
										</Menu.Content>
									</Menu.Positioner>
								</Portal>
							</Menu.Root>
						</div>
					</section>

					<Tabs.Root
						class="profile-tabs"
						value={activeTab()}
						onValueChange={(details) => setActiveTab(details.value as ProfileTab)}
						lazyMount={false}
						unmountOnExit={false}
					>
						<Tabs.List class="profile-tabs__list">
							<Tabs.Trigger value="regions">
								Regions ({editingRegions().length})
							</Tabs.Trigger>
							<Tabs.Trigger value="alignment">
								Alignment groups ({alignment().length})
							</Tabs.Trigger>
							<Tabs.Trigger value="portraits">
								Learned portraits ({learnedHashCount()})
							</Tabs.Trigger>
						</Tabs.List>

						{/* Kept outside the tab panels so the canvas and its editor stay mounted */}
						<div
							class="canvas-card"
							classList={{ 'canvas-card--hidden': activeTab() === 'portraits' }}
						>
							<div class="canvas-card__toolbar">
								<div class="canvas-card__modes" role="group" aria-label="Canvas mode">
									<button
										aria-pressed={canvasMode() === 'select'}
										onClick={() => handleCanvasModeChange('select')}
									>
										<MousePointer2 size={14} />
										Select
									</button>
									<button
										aria-pressed={canvasMode() === 'draw'}
										onClick={() => handleCanvasModeChange('draw')}
									>
										<SquareDashed size={14} />
										Draw Region
									</button>
								</div>
								<span class="canvas-card__hint">{canvasHint()}</span>
							</div>

							<div class="canvas-wrapper">
								<canvas ref={canvasRef} data-mode={canvasMode()} />
							</div>
						</div>

						<Tabs.Content value="regions" class="profile-tabs__panel">
							<RegionInspector
								profileId={editingProfileId()}
								currentRegions={editingRegions()}
								savedRegions={savedRegions()}
								selectedId={selectedRegionId()}
								groupNames={alignment().map((g) => g.name)}
								onSelect={setSelectedRegionId}
								onChange={handleRegionChange}
							/>
						</Tabs.Content>

						<Tabs.Content value="alignment" class="profile-tabs__panel">
							<AlignmentGroupsEditor
								groups={alignment()}
								regionCounts={regionCounts()}
								drawTarget={drawTarget()}
								onChange={handleAlignmentChange}
								onRequestDraw={handleRequestAlignmentDraw}
								onCancelDraw={endAlignmentDraw}
							/>
						</Tabs.Content>

						<Tabs.Content value="portraits" class="profile-tabs__panel">
							<div class="learned-portraits">
								<p class="learned-portraits__count">
									{plural(learnedHashCount(), 'learned hash', 'es')}.
								</p>
								<p class="learned-portraits__help">
									When you correct a hero after recognition, the portrait is learned for
									this profile so it's recognised next time. Bundled hashes are not
									affected by clearing.
								</p>
								<button
									class="danger"
									onClick={() => handleClearHashes(editingProfileId())}
									disabled={learnedHashCount() === 0}
								>
									Clear Learned Hashes
								</button>

								<Show when={learnedHashCount() > 0}>
									<ul class="learned-portraits__list" aria-label="Learned hashes">
										<For each={learnedHashes()}>
											{(learned) => {
												const preview = templateToDataURL(learned.hash);
												return (
													<li class="learned-hash">
														<Show
															when={preview}
															fallback={<span class="learned-hash__preview" />}
														>
															{(src) => (
																<img class="learned-hash__preview" src={src()} alt="" />
															)}
														</Show>
														<div class="learned-hash__details">
															<span class="learned-hash__name">{learned.name}</span>
															<span class="learned-hash__meta">
																<Show
																	when={learned.learnedAt}
																	fallback="Learned date unknown"
																>
																	{(learnedAt) => (
																		<time datetime={learnedAt().toISOString()}>
																			{formatLearnedAt(learnedAt())}
																		</time>
																	)}
																</Show>
																{' · '}
																{learned.hashSetId}
															</span>
														</div>
														<button
															class="learned-hash__delete"
															aria-label={`Delete learned hash for ${learned.name}`}
															title="Delete"
															onClick={() =>
																handleRemoveHash(editingProfileId(), learned)
															}
														>
															<Trash2 size={16} />
														</button>
													</li>
												);
											}}
										</For>
									</ul>
								</Show>
							</div>
						</Tabs.Content>
					</Tabs.Root>
				</div>
			</div>

			<Show when={unsavedChangeCount() > 0}>
				<div class="unsaved-footer" role="status">
					<span class="unsaved-footer__text">
						{plural(unsavedChangeCount(), 'unsaved change')} to{' '}
						<strong>{editingProfileId() || 'this profile'}</strong>
					</span>
					<div class="unsaved-footer__actions">
						<button onClick={handleDiscardChanges}>Discard</button>
						<button class="primary" onClick={handleSaveProfile}>
							Save Profile
						</button>
					</div>
				</div>
			</Show>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default RegionProfileManager;
