import type {
    Merge,
    TextRegion,
    ProfileDetails,
    RegionProfile,
    ExportedProfile,
} from '#types';
import { DEFAULT_PROFILES } from '#data/profiles';
import { normaliseRegion } from '#utils/textRegions';

/**
 * Internal storage format for all profiles
 */
interface ProfileStore {
    schemaVersion: number;
    profiles: RegionProfile[];
    activeProfileId: string;
}

type ImportedProfile = Merge<
    ExportedProfile,
    {
        profile: RegionProfile;
    }
>;

const STORAGE_KEY = 'vowt_region_profiles';
const SCHEMA_VERSION = 1;
const DATE_FIELD_NAMES = ['createdAt', 'updatedAt', 'exportedAt'];

function _reviver(key: string, value: unknown) {
    if (DATE_FIELD_NAMES.includes(key)) {
        return new Date(value as string);
    }
    return value;
}

/**
 * Generates a unique ID for a new profile
 */
function _generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Loads all profiles from localStorage, initializing with defaults if empty
 */
function _loadStorage(): ProfileStore {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            return _initialiseWithDefaults();
        }

        const stored: ProfileStore = JSON.parse(data, _reviver);

        // Handle schema version for future migrations
        if (stored.schemaVersion !== SCHEMA_VERSION) {
            console.warn(
                `Profiles storage uses schema version ${stored.schemaVersion}, expected ${SCHEMA_VERSION}`
            );
        }

        // Ensure all default profiles exist; add any that are missing
        const updatedProfiles = _ensureDefaultProfilesExist(stored.profiles);
        if (updatedProfiles.length > stored.profiles.length) {
            const newStorage = _saveProfiles(
                updatedProfiles,
                stored.activeProfileId
            );
            return newStorage;
        }

        return stored;
    } catch (error) {
        console.error('Error loading profiles from storage:', error);
        return _initialiseWithDefaults();
    }
}

/**
 * Initialises storage with default profiles
 */
function _initialiseWithDefaults(): ProfileStore {
    return {
        schemaVersion: SCHEMA_VERSION,
        profiles: _ensureDefaultProfilesExist(),
        activeProfileId: DEFAULT_PROFILES[0].profile.id,
    };
}

function _convertExportedProfile(profile: ExportedProfile): RegionProfile {
    const converted: RegionProfile = JSON.parse(
        JSON.stringify(profile.profile),
        _reviver
    );
    return converted;
}

/**
 * Ensures all default profiles exist in storage; adds missing ones
 */
function _ensureDefaultProfilesExist(
    existingProfiles?: RegionProfile[]
): RegionProfile[] {
    existingProfiles = existingProfiles || [];
    const missingDefaults = [];

    for (const exportedDefault of DEFAULT_PROFILES) {
        if (
            !existingProfiles.some((p) => p.id === exportedDefault.profile.id)
        ) {
            const defaultProfile = _convertExportedProfile(exportedDefault);
            missingDefaults.push(defaultProfile);
        }
    }

    return [...existingProfiles, ...missingDefaults];
}

function _loadProfile(
    profileId: string,
    storage?: ProfileStore
): RegionProfile | null {
    storage = storage || _loadStorage();
    const profile = storage.profiles.find((p) => p.id === profileId);
    return profile || null;
}

/**
 * Saves all profiles to localStorage
 */
function _saveProfiles(
    profiles: RegionProfile[],
    activeProfileId: string
): ProfileStore {
    const storageData: ProfileStore = {
        schemaVersion: SCHEMA_VERSION,
        profiles: profiles,
        activeProfileId: activeProfileId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    return storageData;
}

// TODO: refactor image width/height to single object/type
/**
 * Saves a region profile to localStorage
 * @param regions - The regions to save in the profile
 * @param id - Optional profile ID; if provided, updates existing profile
 * @param description - Optional profile description
 * @returns The profile ID
 */
export function saveProfile(
    regions: TextRegion[],
    options?: { id?: string; description?: string },
    imgWidth?: number,
    imgHeight?: number
): string {
    const profileId = options?.id || _generateProfileId();
    const profileDesc = options?.description || '';

    try {
        const stored = _loadStorage();
        const existingIndex = stored.profiles.findIndex(
            (p) => p.id === profileId
        );

        if (imgWidth && imgHeight) {
            regions = regions.map((region) =>
                normaliseRegion(region, imgWidth, imgHeight)
            );
        }

        const now = new Date();
        const savedProfile: RegionProfile = {
            id: profileId,
            description: profileDesc,
            regions,
            createdAt:
                existingIndex >= 0
                    ? stored.profiles[existingIndex].createdAt
                    : now,
            updatedAt: now,
        };

        if (existingIndex >= 0) {
            stored.profiles[existingIndex] = savedProfile;
        } else {
            stored.profiles.push(savedProfile);
        }

        _saveProfiles(stored.profiles, stored.activeProfileId);
        return profileId;
    } catch (error) {
        console.error(`Error saving profile ${profileId}:`, error);
        throw error;
    }
}

/**
 * Loads a profile's regions by ID
 * @param profileId - The profile ID to load
 * @returns The regions from the profile, or null if not found
 */
export function getProfile(profileId: string): TextRegion[] | null {
    const profile = _loadProfile(profileId);
    return profile?.regions || null;
}

export function getProfileDetails(profileId: string): ProfileDetails | null {
    const profile = _loadProfile(profileId);
    return profile || null;
}

/**
 * Lists all saved region profiles
 * @returns Array of profile IDs and descriptions sorted by updatedAt descending
 */
export function listProfiles(): ProfileDetails[] {
    const stored = _loadStorage();
    return stored.profiles
        .sort(
            (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
        )
        .map((p) => ({ id: p.id, description: p.description }));
}

/**
 * Deletes a region profile by ID
 * @param profileId - The profile ID to delete
 */
export function deleteProfile(profileId: string): void {
    try {
        const stored = _loadStorage();
        const filteredProfiles = stored.profiles.filter(
            (profile) => profile.id !== profileId
        );
        let newActiveProfileId = stored.activeProfileId;

        if (filteredProfiles.length === stored.profiles.length) {
            throw `Region profile with ID "${profileId}" not found.`;
        }

        // If this was the active profile, set another profile as active
        if (stored.activeProfileId === profileId) {
            newActiveProfileId = filteredProfiles[0].id;
        }

        _saveProfiles(filteredProfiles, newActiveProfileId);
    } catch (error) {
        console.error(`Error deleting profile "${profileId}":`, error);
        throw error;
    }
}

/**
 * Sets the currently active region profile
 * @param profileId - The profile ID to set as active
 */
export function setActiveProfile(profileId: string): void {
    const stored = _loadStorage();

    // Validate profile exists
    const profile = _loadProfile(profileId, stored);
    if (!profile) {
        console.warn(
            `Cannot set active profile: profile ${profileId} not found`
        );
        return;
    }

    stored.activeProfileId = profileId;
    _saveProfiles(stored.profiles, stored.activeProfileId);
}

/**
 * Gets the currently active region profile
 * @returns The regions from the active profile
 */
export function getActiveProfile(): TextRegion[] {
    const profileId = getActiveProfileId();
    return getProfile(profileId) || [];
}

/**
 * Gets the ID of the currently active region profile
 * @returns The active profile ID
 */
export function getActiveProfileId(): string {
    const stored = _loadStorage();
    return stored.activeProfileId;
}

export function getActiveProfileDetails(): ProfileDetails {
    const profileId = getActiveProfileId();
    return getProfileDetails(profileId)!; // Active profile should always exist
}

/**
 * Exports a region profile to JSON format
 * @param profileId - The profile ID to export
 * @returns JSON string representation of the profile, or null if not found
 */
export function exportProfile(profileId: string): string | null {
    const stored = _loadStorage();
    const profile = stored.profiles.find((p) => p.id === profileId);

    if (!profile) {
        return null;
    }

    const exportData: ExportedProfile = {
        type: 'vowt-region-profile',
        schemaVersion: SCHEMA_VERSION,
        profile: profile as unknown as ExportedProfile['profile'],
        exportedAt: new Date() as unknown as string,
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Imports a region profile from JSON format
 * @param jsonData - JSON string containing the region profile
 * @returns The number of profiles stored after import, or null if import failed
 */
export function importProfile(jsonData: string): number | null {
    try {
        const parsed: ImportedProfile = JSON.parse(jsonData, _reviver);

        if (parsed.type !== 'vowt-region-profile') {
            console.error('Invalid profile import: incorrect type');
            return null;
        }

        if (parsed.schemaVersion !== SCHEMA_VERSION) {
            console.warn(
                `Imported profile uses schema version ${parsed.schemaVersion}, expected ${SCHEMA_VERSION}`
            );
        }

        const importedProfile = parsed.profile as RegionProfile;

        // Validate required fields
        if (
            !importedProfile.id ||
            !importedProfile.regions ||
            !Array.isArray(importedProfile.regions)
        ) {
            console.error('Invalid profile import: missing required fields');
            return null;
        }

        // Save with original ID; updates existing profile if conflict exists
        saveProfile(importedProfile.regions, {
            id: importedProfile.id,
            description: importedProfile.description,
        });

        const storage = _loadStorage();
        return storage.profiles.length;
    } catch (error) {
        console.error('Error importing profile:', error);
        return null;
    }
}
