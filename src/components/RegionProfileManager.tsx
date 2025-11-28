import { createSignal, batch, For, Show, onMount, type Component } from 'solid-js';

import type { TextRegion, DrawnRegion } from '#types';
import * as Profiles from '#utils/regionProfiles';
import { startRegionEditor, drawRegions } from '#utils/regionEditor';
import EditableRegionsData from '#c/EditableRegionsData';
import '#styles/RegionProfileManager';

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

	const getImageSource = () => props.previewImage;
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

	const makeDrawnRegions = (
		textRegions: TextRegion[],
		profileId: string
	): DrawnRegion[] => {
		return textRegions.map((r, index) => ({
			...r,
			id: `${profileId}-${index}`,
			colour:
				r.imgHash && r.imgHash.length > 0 ? REGION_COLOUR_IMAGE
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
			alert('No profile selected to export');
			return;
		}

		const data = Profiles.exportProfile(profileId);
		if (!data) {
			alert('Could not export profile. Please save it first.');
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
							alert('Error importing profile. Please check the file format.');
							return;
						}
						alert('Profile imported successfully!');
						setProfileList(Profiles.listProfiles());
					} catch (error) {
						alert('Error importing profile. Please check the file format.');
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
			alert('Profile ID is required');
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

		alert('Profile saved successfully!');
	};

	const handleActivateProfile = (profileId: string) => {
		activateProfile(profileId);
	};

	const handleEditProfile = (profileId: string) => {
		// Get profile regions denormalised to canvas dimensions
		if (!canvasRef) {
			alert('Canvas not ready');
			return;
		}

		const profileRegions = Profiles.getProfile(
			profileId,
			canvasRef.width,
			canvasRef.height
		);
		if (!profileRegions) {
			alert('Could not load profile');
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
	};

	const handleDeleteProfile = (profileId: string) => {
		if (activeProfileId() === profileId && profileList().length === 1) {
			alert('Cannot delete the last remaining profile.');
			return;
		}

		if (confirm('Are you sure you want to delete this profile?')) {
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
		}
	};

	const handleRegionChange = (regions: TextRegion[]) => {
		const drawnRegions = makeDrawnRegions(regions, editingProfileId());
		setEditingRegions(drawnRegions);
		redrawRegions();
	};

	return (
		<div class="region-profile-manager-container">
			<header>
				<h1>Image Region Profiles</h1>
				<button
					onClick={() => {
						props.onClose();
					}}
					class="close-button"
				>
					✕ Close
				</button>
			</header>

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
												class={`action-btn ${activeProfileId() === profile.id ? 'active' : ''}`}
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
												class="action-btn delete"
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
							<button onClick={handleSaveProfile} class="success">
								Save Profile
							</button>
						</div>
					</div>
				</div>

				<div class="section">
					<h2>Region Editor</h2>
					<div class="button-group">
						<button
							onClick={handleClearRegions}
							disabled={editingRegions().length === 0}
							class="primary"
						>
							Clear All
						</button>

						<button onClick={handleExportProfile} class="primary">
							Export
						</button>

						<button onClick={handleImportProfile} class="primary">
							Import
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
		</div>
	);
};

export default RegionProfileManager;
