import type { Component } from 'solid-js';
import { createSignal, batch, For, Show, onMount } from 'solid-js';
import { X } from 'lucide-solid';

import type { TextRegion, DrawnRegion, ScreenAction, AlertDialogOptions } from '#types';
import Screen from '#c/ui/Screen';
import AlertDialog from '#c/ui/AlertDialog';
import Toaster, { toast } from '#c/ui/Toaster';
import * as Profiles from '#utils/regionProfiles';
import { startRegionEditor, drawRegions } from '#utils/regionEditor';
import EditableRegionsData from '#c/ui/EditableRegionsData';

const REGION_COLOUR_DEFAULT = '#ff0000';
const REGION_COLOUR_ITALIC = '#4caf50';
const REGION_COLOUR_IMAGE = '#3131da';

interface RegionProfileManagerProps {
	previewImage: string | null;
	onClose: () => void;
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

	const navActions: ScreenAction[] = [
		{
			id: 'close-button',
			text: 'Close',
			class: 'highlight',
			icon: X,
			onClick: () => props.onClose(),
		},
	];

	let openDialog: ((options: AlertDialogOptions) => void) | null = null;
	let canvasRef: HTMLCanvasElement | undefined;

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

		const activeRegions = Profiles.getActiveProfile(img.width, img.height);
		const drawnRegions = makeDrawnRegions(activeRegions, editingProfileId());

		batch(() => {
			setSavedRegions(drawnRegions);
			setEditingRegions(drawnRegions);
		});

		try {
			await startRegionEditor(canvasRef, imageSource, handleRegionComplete, drawnRegions);
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

	const redrawRegions = () => {
		if (canvasRef && getImageSource()) {
			drawRegions(canvasRef, editingRegions(), getImageSource() as string);
		}
	};

	const handleRegionComplete = (region: DrawnRegion) => {
		setEditingRegions((prev) => [...prev, region]);
		redrawRegions();
	};

	const handleClearRegions = () => {
		setEditingRegions([]);
		redrawRegions();
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

	const handleRegionChange = (regions: TextRegion[]) => {
		const drawnRegions = makeDrawnRegions(regions, editingProfileId());
		setEditingRegions(drawnRegions);
		redrawRegions();
	};

	return (
		<Screen
			id="region-profile-manager-screen"
			title="Image Region Profiles"
			navActions={() => navActions}
		>
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
				</div>
			</div>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default RegionProfileManager;
