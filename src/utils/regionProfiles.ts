import type { TextRegion, ExportedProfile } from '#types';
import { normaliseRegion } from './textRegions';
import { defaultProfiles } from '#data/profiles';

/**
 * Schema version for region profiles storage.
 * Increment this when the storage format changes to enable migrations.
 */
const PROFILE_SCHEMA_VERSION = 1;

/**
 * Storage key for all region profiles list
 */
const PROFILES_STORAGE_KEY = 'vowt_region_profiles';

/**
 * Region profile definition with metadata
 */
interface ProfileDetails {
    id: string;
    description: string;
}
interface RegionProfile extends ProfileDetails {
    regions: TextRegion[];
    createdAt: string;
    updatedAt: string;
}

/**
 * Internal storage format for all profiles
 */
interface ProfilesStorage {
    schemaVersion: number;
    profiles: RegionProfile[];
    activeProfileId: string;
}

export type { ExportedProfile };

/**
 * Generates a unique ID for a new profile
 */
function _generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Loads all profiles from localStorage, initializing with defaults if empty
 */
function _loadStorage(): ProfilesStorage {
    try {
        const data = localStorage.getItem(PROFILES_STORAGE_KEY);
        if (!data) {
            return _initialiseWithDefaults();
        }

        const stored: ProfilesStorage = JSON.parse(data);

        // Handle schema version for future migrations
        if (stored.schemaVersion !== PROFILE_SCHEMA_VERSION) {
            console.warn(
                `Profiles storage uses schema version ${stored.schemaVersion}, expected ${PROFILE_SCHEMA_VERSION}`
            );
        }

        // Ensure all default profiles exist; add any that are missing
        const updatedProfiles = _ensureDefaultProfilesExist(stored);
        if (updatedProfiles.profiles.length > stored.profiles.length) {
            _saveProfiles(updatedProfiles);
            return updatedProfiles;
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
function _initialiseWithDefaults(): ProfilesStorage {
    return _ensureDefaultProfilesExist();
}

/**
 * Ensures all default profiles exist in storage; adds missing ones
 */
function _ensureDefaultProfilesExist(
    storage?: ProfilesStorage
): ProfilesStorage {
    const profilesToLoad = defaultProfiles.filter(
        (item) => item.type === 'vowt-region-profile'
    );

    const missingDefaults = [];
    for (const item of profilesToLoad) {
        if (
            !storage ||
            !storage.profiles.some((p) => p.id === item.profile.id)
        ) {
            missingDefaults.push(item.profile);
        }
    }

    return {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profiles: [...(storage?.profiles || []), ...missingDefaults],
        activeProfileId: storage?.activeProfileId || missingDefaults[0].id,
    };
}

function _loadProfile(profileId: string): RegionProfile | null {
    const storage = _loadStorage();
    const profile = storage.profiles.find((p) => p.id === profileId);
    return profile || null;
}

/**
 * Saves all profiles to localStorage
 */
function _saveProfiles(storage: ProfilesStorage): void {
    const storageData: ProfilesStorage = {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profiles: storage.profiles,
        activeProfileId: storage.activeProfileId,
    };

    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(storageData));
}

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
    const now = new Date().toISOString();
    const profileId = options?.id || _generateProfileId();

    const storage = _loadStorage();
    const existingIndex = storage.profiles.findIndex((p) => p.id === profileId);

    if (imgWidth && imgHeight) {
        regions = regions.map((region) =>
            normaliseRegion(region, imgWidth, imgHeight)
        );
    }

    const savedProfile: RegionProfile = {
        id: profileId,
        description: options?.description || '',
        regions,
        createdAt:
            existingIndex >= 0
                ? storage.profiles[existingIndex].createdAt
                : now,
        updatedAt: now,
    };

    if (existingIndex >= 0) {
        storage.profiles[existingIndex] = savedProfile;
    } else {
        storage.profiles.push(savedProfile);
    }

    _saveProfiles(storage);
    return profileId;
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
    const storage = _loadStorage();
    return storage.profiles
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
 * @returns True if deletion was successful, false otherwise
 */
export function deleteProfile(profileId: string): boolean {
    try {
        const storage = _loadStorage();
        const index = storage.profiles.findIndex((p) => p.id === profileId);

        if (index === -1) {
            return false;
        }

        storage.profiles.splice(index, 1);

        // If this was the active profile, set another profile as active
        if (storage.activeProfileId === profileId) {
            storage.activeProfileId = storage.profiles[0].id;
        }

        _saveProfiles(storage);
        return true;
    } catch (error) {
        console.error(`Error deleting profile ${profileId}:`, error);
        return false;
    }
}

/**
 * Sets the currently active region profile
 * @param profileId - The profile ID to set as active
 */
export function setActiveProfile(profileId: string): void {
    const profile = getProfile(profileId);
    if (!profile) {
        console.warn(
            `Cannot set active profile: profile ${profileId} not found`
        );
        return;
    }

    const storage = _loadStorage();
    storage.activeProfileId = profileId;
    _saveProfiles(storage);
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
    const storage = _loadStorage();
    return storage.activeProfileId;
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
    const storage = _loadStorage();
    const profile = storage.profiles.find((p) => p.id === profileId);
    if (!profile) {
        return null;
    }

    const exportData: ExportedProfile = {
        type: 'vowt-region-profile',
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profile,
        exportedAt: new Date().toISOString(),
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
        const parsed = JSON.parse(jsonData);

        if (parsed.type !== 'vowt-region-profile') {
            console.error('Invalid profile import: incorrect type');
            return null;
        }

        if (parsed.schemaVersion !== PROFILE_SCHEMA_VERSION) {
            console.warn(
                `Imported profile uses schema version ${parsed.schemaVersion}, expected ${PROFILE_SCHEMA_VERSION}`
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
