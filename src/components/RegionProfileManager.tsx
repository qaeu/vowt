import { Component, createSignal, For, Show, onMount } from 'solid-js';
import {
    listProfiles,
    loadProfileById,
    saveProfile,
    deleteProfile,
    setActiveProfile,
    getActiveProfileId,
} from '#utils/regionProfiles';
import {
    startRegionEditor,
    drawRegions,
    type DrawnRegion,
} from '#utils/regionEditor';
import '#styles/RegionProfileManager';

interface RegionProfileManagerProps {
    previewImage: string | null;
    onClose: () => void;
}

const RegionProfileManager: Component<RegionProfileManagerProps> = (props) => {
    const profileList = listProfiles();
    const activeProfileId = getActiveProfileId();
    const { description: activeProfileDescription } = profileList.find(
        (p) => p.id === activeProfileId
    ) || {
        description: '',
    };

    const [regions, setRegions] = createSignal<DrawnRegion[]>([]);
    const [profileDetails, setProfileDetails] = createSignal(profileList);
    const [activeProfile, setActiveProfileId] = createSignal<string | null>(
        activeProfileId
    );
    const [selectedProfileId, setSelectedProfileId] = createSignal<
        string | null
    >(activeProfileId);
    const [editingProfileId, setEditingProfileId] = createSignal(
        activeProfileId || ''
    );
    const [editingProfileDesc, setEditingProfileDesc] = createSignal(
        activeProfileDescription
    );

    const getImageSource = () => props.previewImage;
    let canvasRef: HTMLCanvasElement | undefined;

    onMount(async () => {
        if (!canvasRef) return;

        let drawnRegions: DrawnRegion[] | undefined;

        // Load the active profile's regions if available
        if (activeProfileId) {
            const profileRegions = loadProfileById(activeProfileId);
            if (profileRegions) {
                drawnRegions = profileRegions.map((r) => ({
                    name: r.name,
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                    color: '#FF0000',
                }));
                setRegions(drawnRegions);
            }
        }

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

    const handleRegionComplete = (region: DrawnRegion) => {
        setRegions((prev) => [...prev, region]);

        if (canvasRef && getImageSource()) {
            drawRegions(canvasRef, regions(), getImageSource() as string);
        }
    };

    const handleClearRegions = () => {
        setRegions([]);

        if (canvasRef && getImageSource()) {
            drawRegions(canvasRef, regions(), getImageSource() as string);
        }
    };

    const handleCopyRegionsCode = () => {
        const code = regions()
            .map(
                (r, i) =>
                    `{ name: 'region_${i}', x: ${r.x}, y: ${r.y}, width: ${r.width}, height: ${r.height} },`
            )
            .join('\n');
        navigator.clipboard.writeText(code);
        alert('Regions copied to clipboard!');
    };

    const handleSaveProfile = () => {
        if (!editingProfileId()) {
            alert('Profile ID is required');
            return;
        }

        const profileRegions =
            regions().length > 0
                ? regions().map((r) => ({
                      name: r.name,
                      x: r.x,
                      y: r.y,
                      width: r.width,
                      height: r.height,
                      charSet: '0123456789',
                  }))
                : loadProfileById(selectedProfileId()!);

        if (!profileRegions || profileRegions.length === 0) {
            alert('No regions to save');
            return;
        }

        if (canvasRef) {
            saveProfile(
                profileRegions,
                {
                    id: editingProfileId(),
                    description: editingProfileDesc(),
                },
                canvasRef.width,
                canvasRef.height
            );
        }

        // Update selected profile ID to the new/modified ID and refresh profiles list
        setSelectedProfileId(editingProfileId());
        setProfileDetails(listProfiles());

        alert('Profile updated successfully!');
    };

    const handleSelectProfile = (profileId: string) => {
        setActiveProfileId(profileId);
        setActiveProfile(profileId);
    };

    const handleEditProfile = (profileId: string) => {
        setSelectedProfileId(profileId);
        const profile = profileDetails().find((p) => p.id === profileId);
        if (profile) {
            setEditingProfileId(profile.id);
            setEditingProfileDesc(profile.description);
        }

        const profileRegions = loadProfileById(profileId);
        if (!profileRegions) {
            alert('Could not load profile');
            return;
        }

        const drawnRegions = profileRegions.map((r) => ({
            name: r.name,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            color: '#FF0000',
        }));
        setRegions(drawnRegions);

        // Redraw the regions on canvas
        if (canvasRef && getImageSource()) {
            drawRegions(canvasRef, drawnRegions, getImageSource() as string);
        }
    };

    const handleDeleteProfile = (profileId: string) => {
        if (confirm('Are you sure you want to delete this profile?')) {
            deleteProfile(profileId);
            if (selectedProfileId() === profileId) {
                setSelectedProfileId(null);
            }
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
                    <strong>Instructions:</strong> Create and manage region
                    profiles for different scoreboard types. Click "Start Region
                    Editor" to draw regions, then save as a new profile or
                    update an existing one. Profiles are saved locally and can
                    be selected for OCR processing.
                    {!props.previewImage && (
                        <>
                            <br />
                            <strong>Tip:</strong> Drag and drop an image into
                            this area to use it for region editing.
                        </>
                    )}
                </p>
            </div>

            <div class="manager-layout">
                <div class="section">
                    <h2>Saved Profiles</h2>

                    <Show
                        when={profileDetails().length > 0}
                        fallback={<p class="empty-state">No profiles yet</p>}
                    >
                        <div class="profiles-list">
                            <For each={profileDetails()}>
                                {(profile) => (
                                    <div
                                        class={`profile-card ${
                                            selectedProfileId() === profile.id
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
                                                    handleSelectProfile(
                                                        profile.id
                                                    )
                                                }
                                                class={`action-btn ${
                                                    activeProfile() ===
                                                    profile.id
                                                        ? 'active'
                                                        : ''
                                                }`}
                                            >
                                                {activeProfile() === profile.id
                                                    ? '✓ Active'
                                                    : 'Select'}
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

                    <Show
                        when={selectedProfileId()}
                        fallback={
                            <p class="empty-state">
                                Select a profile to view and edit details
                            </p>
                        }
                    >
                        <div>
                            <label class="input-label">Profile ID</label>
                            <input
                                type="text"
                                value={editingProfileId()}
                                onInput={(e) =>
                                    setEditingProfileId(e.target.value)
                                }
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
                                    onClick={handleSaveProfile}
                                    class="success"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>

                <div class="section">
                    <h2>Region Editor</h2>
                    <div class="button-group">
                        <button
                            onClick={handleClearRegions}
                            disabled={regions().length === 0}
                            class="primary"
                        >
                            Clear All
                        </button>

                        <button
                            onClick={handleCopyRegionsCode}
                            disabled={regions().length === 0}
                            class="primary"
                        >
                            Copy Code
                        </button>
                    </div>

                    <div class="canvas-wrapper">
                        <canvas ref={canvasRef} />
                    </div>

                    {regions().length > 0 && (
                        <div class="regions-display">
                            <h3>Drawn Regions ({regions().length})</h3>
                            <pre>
                                {regions()
                                    .map(
                                        (r, i) =>
                                            `${i}. ${r.name} (${r.color})\n  x: ${r.x}, y: ${r.y}, width: ${r.width}, height: ${r.height}`
                                    )
                                    .join('\n\n')}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegionProfileManager;
