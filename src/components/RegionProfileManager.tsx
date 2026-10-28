import type { Component } from 'solid-js';
import { createSignal, createMemo, batch, For, Show, onMount } from 'solid-js';

import type {
	TextRegion,
	DrawnRegion,
	AlertDialogOptions,
	AlignmentGroup,
	AlignmentDrawTarget,
	GrayImage,
} from '#types';
import Screen from '#c/ui/Screen';
import AlertDialog from '#c/ui/AlertDialog';
import Toaster, { toast } from '#c/ui/Toaster';
import * as Profiles from '#utils/regionProfiles';
import { startRegionEditor, drawRegions } from '#utils/regionEditor';
import EditableRegionsData from '#c/ui/EditableRegionsData';
import AlignmentGroupsEditor from '#c/ui/AlignmentGroupsEditor';
import {
	ALIGN_SCALE,
	createAnchor,
	downsample,
	findAnchorOffset,
	loadReferenceGrayscale,
} from '#utils/regionAlignment';

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

interface RegionProfileManagerProps {
	previewImage: string | null;
}

const RegionProfileManager: Component<RegionProfileManagerProps> = (props) => {
	const initialProfileList = Profiles.listProfiles();
	const { id: initialActiveProfileId, description: initialActiveProfileDesc } =
		Profiles.getActiveProfileDetails();

	const [savedRegions, setSavedRegions] = createSignal<DrawnRegion[]>([]);
	const [editingRegions, setEditingRegions] = createSignal<DrawnRegion[]>([]);
	const [profileList, setProfileList] = createSignal(initialProfileList);
	const [activeProfileId, setActiveProfileId] =
		createSignal<string>(initialActiveProfileId);
	const [editingProfileId, setEditingProfileId] = createSignal(initialActiveProfileId);
	const [editingProfileDesc, setEditingProfileDesc] = createSignal(
		initialActiveProfileDesc
	);
	const [alignment, setAlignment] = createSignal<AlignmentGroup[]>(
		Profiles.getActiveProfileAlignment()
	);
	const [drawTarget, setDrawTarget] = createSignal<AlignmentDrawTarget | null>(null);
	// Bumped when stored hashes change, since they're read from storage
	const [hashesVersion, setHashesVersion] = createSignal(0);

	const learnedHashCount = createMemo(() => {
		hashesVersion();
		return Profiles.countProfileHashes(editingProfileId());
	});

	const regionCounts = createMemo(() => {
		const counts: Record<string, number> = {};
		for (const region of editingRegions()) {
			if (region.group) counts[region.group] = (counts[region.group] ?? 0) + 1;
		}
		return counts;
	});

	let openDialog: ((options: AlertDialogOptions) => void) | null = null;
	let canvasRef: HTMLCanvasElement | undefined;
	let referenceGray: { src: string; image: GrayImage } | null = null;

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

		try {
			await startRegionEditor(canvasRef, imageSource, handleRegionComplete, [
				...drawnRegions,
				...alignmentOverlays(),
			]);
		} catch (err) {
			console.error('Region editor error:', err);
		}
	});

	const getImageSource = () => props.previewImage;

	const makeDrawnRegions = (
		textRegions: TextRegion[],
		profileId: string
	): DrawnRegion[] => {
		return textRegions.map((r, index) => ({
			...r,
			id: `${profileId}-${index}`,
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

	const redrawRegions = () => {
		if (canvasRef && getImageSource()) {
			drawRegions(
				canvasRef,
				[...editingRegions(), ...alignmentOverlays()],
				getImageSource() as string
			);
		}
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
						title: 'Anchor Error',
						description:
							'The selected area has too little detail to match. Draw the anchor around text, icons or edges.',
						actionText: 'OK',
					});
					return;
				}

				updated = { ...group, anchor };
			} catch (error) {
				console.error('Anchor capture error:', error);
				openDialog?.({
					title: 'Anchor Error',
					description: 'Could not read the image to capture the anchor.',
					actionText: 'OK',
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
		redrawRegions();
		toast(
			'Alignment Updated',
			`${target.kind === 'anchor' ? 'Anchor' : 'Rows'} set for group '${group.name}'.`
		);
	};

	const handleRegionComplete = (region: DrawnRegion) => {
		const target = drawTarget();
		if (target) {
			setDrawTarget(null);
			void applyAlignmentRect(target, region);
			return;
		}

		setEditingRegions((prev) => [...prev, region]);
		redrawRegions();
	};

	const handleClearRegions = () => {
		setEditingRegions([]);
		redrawRegions();
	};

	const handleAlignmentChange = (groups: AlignmentGroup[]) => {
		const applyChange = () => {
			setAlignment(groups);
			redrawRegions();
		};

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
			title: 'Delete Alignment Group',
			description: `${count} region${count === 1 ? ' uses' : 's use'} ${names}. They will keep their profile positions until assigned to another group. Delete anyway?`,
			actionText: 'Delete',
			onConfirm: applyChange,
		});
	};

	const handleExportProfile = () => {
		const profileId = editingProfileId();
		if (!profileId) {
			openDialog?.({
				title: 'Export Error',
				description: 'No profile selected to export',
				actionText: 'OK',
			});
			return;
		}

		const data = Profiles.exportProfile(profileId);
		if (!data) {
			openDialog?.({
				title: 'Export Error',
				description: 'Could not export profile. Please save it first.',
				actionText: 'OK',
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
								title: 'Import Error',
								description: 'Error importing profile. Please check the file format.',
								actionText: 'OK',
							});
							return;
						}
						toast('Import Success', 'Region profile imported');
						setProfileList(Profiles.listProfiles());
						setHashesVersion((v) => v + 1);
					} catch (error) {
						openDialog?.({
							title: 'Import Error',
							description: 'Error importing profile. Please check the file format.',
							actionText: 'OK',
						});
						console.error('Import error:', error);
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	};

	const handleSaveProfile = () => {
		if (!editingProfileId()) {
			openDialog?.({
				title: 'Save Error',
				description: 'Profile ID is required',
				actionText: 'OK',
			});
			return;
		}

		setSavedRegions(editingRegions());

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

		// Refresh profile list
		setProfileList(Profiles.listProfiles());

		toast('Save Success', `Profile '${editingProfileId()}' saved.`);
	};

	const handleActivateProfile = (profileId: string) => {
		activateProfile(profileId);
		toast(
			'Activate Success',
			`Profile '${profileId}' is now active for screenshot recognition.`
		);
	};

	const handleEditProfile = (profileId: string) => {
		if (!canvasRef) {
			openDialog?.({
				title: 'Edit Error',
				description: 'Canvas not ready',
				actionText: 'OK',
			});
			return;
		}

		const profileRegions = Profiles.getProfile(
			profileId,
			canvasRef.width,
			canvasRef.height
		);
		if (!profileRegions) {
			openDialog?.({
				title: 'Edit Error',
				description: `Error loading region data for profile '${profileId}'`,
				actionText: 'OK',
			});
			return;
		}

		batch(() => {
			const drawnRegions = makeDrawnRegions(profileRegions, profileId);
			setSavedRegions(drawnRegions);
			setEditingRegions(drawnRegions);
			setAlignment(Profiles.getProfileAlignment(profileId));
			setDrawTarget(null);

			const profileDetails = profileList().find((p) => p.id === profileId);
			if (profileDetails) {
				setEditingProfileId(profileDetails.id);
				setEditingProfileDesc(profileDetails.description);
			}
		});

		redrawRegions();
		toast('Edit Profile', `Now editing profile '${profileId}'.`);
	};

	const handleDeleteProfile = (profileId: string) => {
		if (activeProfileId() === profileId && profileList().length === 1) {
			openDialog?.({
				title: 'Delete Error',
				description: 'Cannot delete the last remaining profile.',
				actionText: 'OK',
			});
			return;
		}

		openDialog?.({
			title: 'Delete Profile',
			description: `Are you sure you want to delete profile '${profileId}'?`,
			onConfirm: () => {
				if (activeProfileId() === profileId) {
					// There must always be an active profile, so activate another
					activateProfile(profileList()[0].id);
				}

				if (editingProfileId() === profileId) {
					handleEditProfile(activeProfileId());
				}
				Profiles.deleteProfile(profileId);

				// Refresh profile list
				setProfileList(Profiles.listProfiles());
				toast('Delete Success', `Profile '${profileId}' deleted.`);
			},
		});
	};

	const handleClearHashes = (profileId: string) => {
		openDialog?.({
			title: 'Clear Learned Hashes',
			description: `Are you sure you want to remove all learned image hashes from profile '${profileId}'? Bundled hashes are not affected.`,
			onConfirm: () => {
				Profiles.clearProfileHashes(profileId);
				setHashesVersion((v) => v + 1);
				toast('Clear Success', `Learned hashes removed from profile '${profileId}'.`);
			},
		});
	};

	const handleRegionChange = (regions: TextRegion[]) => {
		const drawnRegions = makeDrawnRegions(regions, editingProfileId());
		setEditingRegions(drawnRegions);
		redrawRegions();
	};

	return (
		<Screen id="region-profile-manager-screen" title="Image Region Profiles">
			<div class="info-box">
				<p>
					Create and manage region profiles for different scoreboard types. Profiles are
					saved locally and can be activated for OCR processing.
				</p>
			</div>

			<div class="manager-layout">
				<div class="section">
					<h2>Saved Profiles</h2>

					<Show
						when={profileList().length > 0}
						fallback={<p class="empty-state">No profiles yet</p>}
					>
						<div class="profiles-list">
							<For each={profileList()}>
								{(profile) => (
									<div
										class={`profile-card ${editingProfileId() === profile.id ? 'active' : ''}`}
									>
										<div class="profile-header">
											<h3>{profile.id}</h3>
										</div>
										<p class="profile-description">{profile.description}</p>

										<div class="button-group">
											<button
												onClick={() => handleActivateProfile(profile.id)}
												class={`action-btn activate highlight ${activeProfileId() === profile.id ? 'active' : ''}`}
											>
												{activeProfileId() === profile.id ? '✓ Active' : 'Set Active'}
											</button>
											<button
												onClick={() => handleEditProfile(profile.id)}
												class="action-btn edit"
											>
												Edit
											</button>
											<button
												onClick={() => handleDeleteProfile(profile.id)}
												class="action-btn delete highlight"
											>
												Delete
											</button>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>

				<div class="section profile-actions">
					<h2>Profile Details</h2>

					<div>
						<label class="input-label">Profile ID</label>
						<input
							type="text"
							value={editingProfileId()}
							onInput={(e) => setEditingProfileId(e.target.value)}
							class="profile-input"
						/>

						<label class="input-label">Description</label>
						<textarea
							value={editingProfileDesc()}
							onInput={(e) => setEditingProfileDesc(e.target.value)}
							class="profile-textarea"
							placeholder="Profile description (optional)"
						/>

						<div class="button-group">
							<button onClick={handleSaveProfile} class="save-profile highlight">
								Save Profile
							</button>
						</div>

						<label class="input-label">Learned Image Hashes</label>
						<p class="learned-hashes">
							{learnedHashCount()} learned hash{learnedHashCount() === 1 ? '' : 'es'}.
							Correct a hero after recognition to teach new portraits.
						</p>
						<div class="button-group">
							<button
								onClick={() => handleClearHashes(editingProfileId())}
								class="clear-hashes highlight"
								disabled={learnedHashCount() === 0}
							>
								Clear Learned Hashes
							</button>
						</div>
					</div>
				</div>

				<div class="section">
					<h2>Region Editor</h2>
					<div class="button-group">
						<button onClick={handleExportProfile}>Export</button>
						<button onClick={handleImportProfile}>Import</button>
						<button
							onClick={handleClearRegions}
							class="clear-regions highlight"
							disabled={editingRegions().length === 0}
						>
							Clear All
						</button>
					</div>

					<div class="canvas-wrapper">
						<canvas ref={canvasRef} />
					</div>

					<EditableRegionsData
						profileId={editingProfileId()}
						currentRegions={editingRegions()}
						savedRegions={savedRegions()}
						onChange={handleRegionChange}
					/>

					<AlignmentGroupsEditor
						groups={alignment()}
						regionCounts={regionCounts()}
						drawTarget={drawTarget()}
						onChange={handleAlignmentChange}
						onRequestDraw={setDrawTarget}
						onCancelDraw={() => setDrawTarget(null)}
					/>
				</div>
			</div>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default RegionProfileManager;
