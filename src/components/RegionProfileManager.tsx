import { createSignal, For, Show, onMount, type Component } from 'solid-js';

import type { TextRegion, DrawnRegion } from '#types';
import * as Profiles from '#utils/regionProfiles';
import { startRegionEditor, drawRegions } from '#utils/regionEditor';
import EditableRegionsData from '#c/EditableRegionsData';
import '#styles/RegionProfileManager';

interface RegionProfileManagerProps {
    previewImage: string | null;
    onClose: () => void;
}

const RegionProfileManager: Component<RegionProfileManagerProps> = (props) => {
    const initialProfileList = Profiles.listProfiles();
    const {
        id: initialActiveProfileId,
        description: initialActiveProfileDesc,
    } = Profiles.getActiveProfileDetails();

    const [editingRegions, setEditingRegions] = createSignal<DrawnRegion[]>([]);
    const [profileList, setProfileList] = createSignal(initialProfileList);
    const [activeProfileId, setActiveProfileId] = createSignal<string>(
        initialActiveProfileId
    );
    const [editingProfileId, setEditingProfileId] = createSignal(
        initialActiveProfileId
    );
    const [editingProfileDesc, setEditingProfileDesc] = createSignal(
        initialActiveProfileDesc
    );

    const getImageSource = () => props.previewImage;
    let canvasRef: HTMLCanvasElement | undefined;

    onMount(async () => {
        if (!canvasRef) return;

        const activeRegions = Profiles.getActiveProfile();
        const drawnRegions = makeDrawnRegions(activeRegions);
        setEditingRegions(drawnRegions);

        try {
            await startRegionEditor(
                canvasRef,
                getImageSource(),
                handleRegionComplete,
                drawnRegions
            );
        } catch (err) {
            console.error('Region editor error:', err);
        }
    });

    const makeDrawnRegions = (textRegions: TextRegion[]) => {
        return textRegions.map((r) => ({
            ...r,
            color: r.isItalic ? '#4caf50' : '#ff0000',
        }));
    };

    const getTextRegions = (): TextRegion[] => {
        return editingRegions();
    };

    const activateProfile = (profileId: string) => {
        setActiveProfileId(profileId);
        Profiles.setActiveProfile(profileId);
    };

    const handleRegionComplete = (region: DrawnRegion) => {
        setEditingRegions((prev) => [...prev, region]);

        if (canvasRef && getImageSource()) {
            drawRegions(
                canvasRef,
                editingRegions(),
                getImageSource() as string
            );
        }
    };

    const handleClearRegions = () => {
        setEditingRegions([]);

        if (canvasRef && getImageSource()) {
            drawRegions(
                canvasRef,
                editingRegions(),
                getImageSource() as string
            );
        }
    };

    const handleCopyRegionsCode = () => {
        const code = JSON.stringify(editingRegions());
        navigator.clipboard.writeText(code);
        alert('Regions copied to clipboard!');
    };

    const handleSaveProfileDetails = () => {
        if (!editingProfileId()) {
            alert('Profile ID is required');
            return;
        }

        // Get the current saved regions from storage to avoid saving unsaved table edits
        const currentProfile = Profiles.getProfile(editingProfileId());
        if (!currentProfile) {
            alert('Could not load current profile regions');
            return;
        }

        if (canvasRef) {
            Profiles.saveProfile(
                currentProfile,
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

        alert('Profile details saved successfully!');
    };

    const handleSaveRegions = (regions: TextRegion[]) => {
        // Convert TextRegion to DrawnRegion with color
        const drawnRegions = makeDrawnRegions(regions);
        setEditingRegions(drawnRegions);

        // Save only regions, keep current profile details
        if (canvasRef) {
            Profiles.saveProfile(
                regions,
                {
                    id: editingProfileId(),
                    description: editingProfileDesc(),
                },
                canvasRef.width,
                canvasRef.height
            );
        }

        // Update the canvas display
        if (canvasRef && getImageSource()) {
            drawRegions(canvasRef, drawnRegions, getImageSource() as string);
        }

        // Refresh profile list
        setProfileList(Profiles.listProfiles());
    };

    const handleActivateProfile = (profileId: string) => {
        activateProfile(profileId);
    };

    const handleEditProfile = (profileId: string) => {
        const profileDetails = profileList().find((p) => p.id === profileId);
        if (profileDetails) {
            setEditingProfileId(profileDetails.id);
            setEditingProfileDesc(profileDetails.description);
        }

        const profileRegions = Profiles.getProfile(profileId);
        if (!profileRegions) {
            alert('Could not load profile');
            return;
        }

        const drawnRegions = makeDrawnRegions(profileRegions);
        setEditingRegions(drawnRegions);

        // Redraw the regions on canvas
        if (canvasRef && getImageSource()) {
            drawRegions(canvasRef, drawnRegions, getImageSource()!); // TODO: review non-null assertion
        }
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

    return (
        <div class="region-profile-manager-container">
            <div class="ocr-header">
                <h1>Region Profile Manager</h1>
                <button
                    onClick={() => {
                        props.onClose();
                    }}
                    class="close-button"
                >
                    ✕ Close
                </button>
            </div>

            <div class="info-box">
                <p>
                    Create and manage region profiles for different scoreboard
                    types. Profiles are saved locally and can be activated for
                    OCR processing.
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
                                        class={`profile-card ${
                                            editingProfileId() === profile.id
                                                ? 'active'
                                                : ''
                                        }`}
                                    >
                                        <div class="profile-header">
                                            <h3>{profile.id}</h3>
                                        </div>
                                        <p class="profile-description">
                                            {profile.description}
                                        </p>

                                        <div class="profile-actions-buttons">
                                            <button
                                                onClick={() =>
                                                    handleActivateProfile(
                                                        profile.id
                                                    )
                                                }
                                                class={`action-btn ${
                                                    activeProfileId() ===
                                                    profile.id
                                                        ? 'active'
                                                        : ''
                                                }`}
                                            >
                                                {activeProfileId() ===
                                                profile.id
                                                    ? '✓ Active'
                                                    : 'Set Active'}
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleEditProfile(
                                                        profile.id
                                                    )
                                                }
                                                class="action-btn edit"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDeleteProfile(
                                                        profile.id
                                                    )
                                                }
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
                            onInput={(e) =>
                                setEditingProfileDesc(e.target.value)
                            }
                            class="profile-textarea"
                            placeholder="Profile description (optional)"
                        />

                        <div class="button-group">
                            <button
                                onClick={handleSaveProfileDetails}
                                class="success"
                            >
                                Save Profile Details
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

                        <button
                            onClick={handleCopyRegionsCode}
                            disabled={editingRegions().length === 0}
                            class="primary"
                        >
                            Copy Code
                        </button>
                    </div>

                    <div class="canvas-wrapper">
                        <canvas ref={canvasRef} />
                    </div>

                    <EditableRegionsData
                        initialRegions={getTextRegions()}
                        onSave={handleSaveRegions}
                    />
                </div>
            </div>
        </div>
    );
};

export default RegionProfileManager;
