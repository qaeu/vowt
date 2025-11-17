import { TextRegion } from './textRegions';
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
interface RegionProfile {
    id: string;
    description: string;
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
    activeProfileId: string | null;
}

/**
 * Export format for a region profile
 */
export interface ExportedProfile {
    type: 'vowt-region-profile';
    schemaVersion: number;
    profile: RegionProfile;
}

/**
 * Generates a unique ID for a new profile
 */
function generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Loads all profiles from localStorage, initializing with defaults if empty
 */
function loadProfilesFromStorage(): ProfilesStorage {
    try {
        const data = localStorage.getItem(PROFILES_STORAGE_KEY);
        if (!data) {
            return initializeWithDefaults();
        }

        const stored: ProfilesStorage = JSON.parse(data);

        // Handle schema version for future migrations
        if (stored.schemaVersion !== PROFILE_SCHEMA_VERSION) {
            console.warn(
                `Profiles storage uses schema version ${stored.schemaVersion}, expected ${PROFILE_SCHEMA_VERSION}`
            );
        }

        // Ensure all default profiles exist; add any that are missing
        const updatedProfiles = ensureDefaultProfilesExist(stored);
        if (updatedProfiles.profiles.length > stored.profiles.length) {
            saveProfilesToStorage(updatedProfiles);
            return updatedProfiles;
        }

        return stored;
    } catch (error) {
        console.error('Error loading profiles from storage:', error);
        return initializeWithDefaults();
    }
}

/**
 * Initializes storage with default profiles
 */
function initializeWithDefaults(): ProfilesStorage {
    const storage: ProfilesStorage = {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profiles: [],
        activeProfileId: null,
    };

    return ensureDefaultProfilesExist(storage);
}

/**
 * Ensures all default profiles exist in storage; adds missing ones
 */
function ensureDefaultProfilesExist(storage: ProfilesStorage): ProfilesStorage {
    const profilesToLoad = defaultProfiles.filter(
        (item) => item.type === 'vowt-region-profile'
    );

    for (const item of profilesToLoad) {
        const profileExists = storage.profiles.some(
            (p) => p.id === item.profile.id
        );

        if (!profileExists) {
            storage.profiles.push(item.profile);
        }
    }

    return storage;
}

/**
 * Saves all profiles to localStorage
 */
function saveProfilesToStorage(storage: ProfilesStorage): void {
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
    options?: { id?: string; description?: string }
): string {
    const now = new Date().toISOString();
    const profileId = options?.id || generateProfileId();

    const storage = loadProfilesFromStorage();
    const existingIndex = storage.profiles.findIndex((p) => p.id === profileId);

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

    saveProfilesToStorage(storage);
    return profileId;
}

/**
 * Loads a profile's regions by ID
 * @param profileId - The profile ID to load
 * @returns The regions from the profile, or null if not found
 */
export function loadProfileById(profileId: string): TextRegion[] | null {
    const storage = loadProfilesFromStorage();
    const profile = storage.profiles.find((p) => p.id === profileId);
    return profile ? profile.regions : null;
}

/**
 * Lists all saved region profile IDs
 * @returns Array of profile IDs sorted by updatedAt descending
 */
export function listProfileIds(): string[] {
    const storage = loadProfilesFromStorage();

    // Sort by updatedAt descending and return only IDs
    return storage.profiles
        .sort(
            (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
        )
        .map((p) => p.id);
}

/**
 * Deletes a region profile by ID
 * @param profileId - The profile ID to delete
 * @returns True if deletion was successful, false otherwise
 */
export function deleteProfile(profileId: string): boolean {
    try {
        const storage = loadProfilesFromStorage();
        const index = storage.profiles.findIndex((p) => p.id === profileId);

        if (index === -1) {
            return false;
        }

        storage.profiles.splice(index, 1);

        // If this was the active profile, clear the selection
        if (storage.activeProfileId === profileId) {
            storage.activeProfileId = null;
        }

        saveProfilesToStorage(storage);
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
    const profile = loadProfileById(profileId);
    if (!profile) {
        console.warn(
            `Cannot set active profile: profile ${profileId} not found`
        );
        return;
    }

    const storage = loadProfilesFromStorage();
    storage.activeProfileId = profileId;
    saveProfilesToStorage(storage);
}

/**
 * Gets the ID of the currently active region profile
 * @returns The active profile ID, or null if none is set
 */
export function getActiveProfileId(): string | null {
    try {
        const storage = loadProfilesFromStorage();
        return storage.activeProfileId;
    } catch (error) {
        console.error('Error getting active profile ID:', error);
        return null;
    }
}

/**
 * Gets the currently active region profile
 * @returns The regions from the active profile, or null if none is set
 */
export function getActiveProfile(): TextRegion[] | null {
    const profileId = getActiveProfileId();
    if (!profileId) {
        return null;
    }

    return loadProfileById(profileId);
}

/**
 * Exports a region profile to JSON format
 * @param profileId - The profile ID to export
 * @returns JSON string representation of the profile, or null if not found
 */
export function exportProfile(profileId: string): string | null {
    const storage = loadProfilesFromStorage();
    const profile = storage.profiles.find((p) => p.id === profileId);
    if (!profile) {
        return null;
    }

    const exportData: ExportedProfile = {
        type: 'vowt-region-profile',
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profile,
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

        const storage = loadProfilesFromStorage();
        return storage.profiles.length;
    } catch (error) {
        console.error('Error importing profile:', error);
        return null;
    }
}
