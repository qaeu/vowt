import type {
	Merge,
	TextRegion,
	AlignmentGroup,
	ProfileDetails,
	RegionProfile,
	ExportedProfile,
	ImageHash,
	ImageHashSet,
	LearnedHash,
} from '#types';
import { DEFAULT_PROFILES } from '#data/profiles';

/**
 * Reference resolution for stored coordinates (1440p)
 */
export const REFERENCE_WIDTH = 2560;
export const REFERENCE_HEIGHT = 1440;

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
const SCHEMA_VERSION = 2;
/** Schema versions before this stored dHashes, which can't be used as templates */
const FIRST_TEMPLATE_SCHEMA_VERSION = 2;
const DATE_FIELD_NAMES = ['createdAt', 'updatedAt', 'exportedAt', 'learnedAt'];

/**
 * Converts region coordinates from source image dimensions to reference resolution.
 * Used when saving profiles to ensure coordinates are stored at reference scale.
 * @param region - Region with coordinates at source image scale
 * @param sourceWidth - Source image width
 * @param sourceHeight - Source image height
 * @returns Region with coordinates at reference resolution
 */
function _normaliseRegion(
	region: TextRegion,
	sourceWidth: number,
	sourceHeight: number
): TextRegion {
	const scaleX = REFERENCE_WIDTH / sourceWidth;
	const scaleY = REFERENCE_HEIGHT / sourceHeight;

	return {
		...region,
		x: Math.round(region.x * scaleX),
		y: Math.round(region.y * scaleY),
		width: Math.round(region.width * scaleX),
		height: Math.round(region.height * scaleY),
	};
}

/**
 * Converts region coordinates from reference resolution to target image dimensions.
 * Used when loading profiles to scale coordinates to match actual image size.
 * @param region - Region with coordinates at reference resolution
 * @param targetWidth - Target image width
 * @param targetHeight - Target image height
 * @returns Region with coordinates scaled to target dimensions
 */
function _denormaliseRegion(
	region: TextRegion,
	targetWidth: number,
	targetHeight: number
): TextRegion {
	const scaleX = targetWidth / REFERENCE_WIDTH;
	const scaleY = targetHeight / REFERENCE_HEIGHT;

	return {
		...region,
		x: Math.round(region.x * scaleX),
		y: Math.round(region.y * scaleY),
		width: Math.round(region.width * scaleX),
		height: Math.round(region.height * scaleY),
	};
}

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
		if (stored.schemaVersion < FIRST_TEMPLATE_SCHEMA_VERSION) {
			const profiles = stored.profiles.map((profile) => ({ ...profile, hashSets: [] }));
			return _saveProfiles(_ensureDefaultProfilesExist(profiles), stored.activeProfileId);
		} else if (stored.schemaVersion !== SCHEMA_VERSION) {
			console.warn(
				`Profiles storage uses schema version ${stored.schemaVersion}, expected ${SCHEMA_VERSION}`
			);
		}

		// Ensure all default profiles exist and are current
		const updatedProfiles = _ensureDefaultProfilesExist(stored.profiles);
		if (updatedProfiles !== stored.profiles) {
			const newStorage = _saveProfiles(updatedProfiles, stored.activeProfileId);
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
	const converted: RegionProfile = JSON.parse(JSON.stringify(profile.profile), _reviver);
	return converted;
}

/**
 * Ensures all default profiles exist in storage; adds missing ones and replaces stored
 * copies older than the bundled version (a stored copy edited by the user is newer)
 * Replaced copies keep their stored hash sets so learned hashes survive app updates
 * @returns The input array if nothing changed, otherwise a new array
 */
function _ensureDefaultProfilesExist(
	existingProfiles?: RegionProfile[]
): RegionProfile[] {
	let profiles = existingProfiles || [];

	for (const exportedDefault of DEFAULT_PROFILES) {
		const defaultProfile = _convertExportedProfile(exportedDefault);
		const index = profiles.findIndex((p) => p.id === defaultProfile.id);

		if (index < 0) {
			profiles = [...profiles, defaultProfile];
		} else if (
			new Date(profiles[index].updatedAt).getTime() < defaultProfile.updatedAt.getTime()
		) {
			const storedHashSets = profiles[index].hashSets || [];
			const hashSets = [
				...storedHashSets,
				...(defaultProfile.hashSets || []).filter(
					(hs) => !storedHashSets.some((stored) => stored.id === hs.id)
				),
			];
			profiles = profiles.with(index, { ...defaultProfile, hashSets });
		}
	}

	return profiles;
}

function _loadProfile(profileId: string, storage?: ProfileStore): RegionProfile | null {
	storage = storage || _loadStorage();
	const profile = storage.profiles.find((p) => p.id === profileId);
	return profile || null;
}

/**
 * Saves all profiles to localStorage
 */
function _saveProfiles(profiles: RegionProfile[], activeProfileId: string): ProfileStore {
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
 * @param alignment - Optional alignment groups; existing groups are kept if omitted
 * @param hashSets - Optional image hash sets; existing sets are kept if omitted
 * @returns The profile ID
 */
export function saveProfile(
	regions: TextRegion[],
	options?: {
		id?: string;
		description?: string;
		alignment?: AlignmentGroup[];
		hashSets?: ImageHashSet[];
	},
	imgWidth?: number,
	imgHeight?: number
): string {
	const profileId = options?.id || _generateProfileId();
	const profileDesc = options?.description || '';

	try {
		const stored = _loadStorage();
		const existingIndex = stored.profiles.findIndex((p) => p.id === profileId);

		if (imgWidth && imgHeight) {
			regions = regions.map((region) => _normaliseRegion(region, imgWidth, imgHeight));
		}

		const now = new Date();
		const savedProfile: RegionProfile = {
			id: profileId,
			description: profileDesc,
			regions,
			hashSets:
				options?.hashSets
				?? (existingIndex >= 0 ? stored.profiles[existingIndex].hashSets : []),
			alignment:
				options?.alignment
				?? (existingIndex >= 0 ? stored.profiles[existingIndex].alignment : undefined),
			createdAt: existingIndex >= 0 ? stored.profiles[existingIndex].createdAt : now,
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
 * @param imgWidth - Optional target image width for denormalisation
 * @param imgHeight - Optional target image height for denormalisation
 * @returns The regions from the profile, denormalised if dimensions provided, or null if not found
 */
export function getProfile(
	profileId: string,
	imgWidth?: number,
	imgHeight?: number
): TextRegion[] | null {
	const profile = _loadProfile(profileId);
	if (!profile?.regions) return null;

	let regions = profile.regions;
	if (imgWidth && imgHeight) {
		regions = regions.map((region) => _denormaliseRegion(region, imgWidth, imgHeight));
	}

	return regions;
}

export function getProfileDetails(profileId: string): ProfileDetails | null {
	const profile = _loadProfile(profileId);
	return profile || null;
}

export function getProfileHashSets(profileId: string): ImageHashSet[] | null {
	const profile = _loadProfile(profileId);
	if (!profile) return null;
	return profile.hashSets || [];
}

/**
 * Adds learned hashes to one of a profile's hash sets, creating the set if needed
 * A hash already stored under another name is renamed, so corrections take priority
 * Added and renamed hashes are stamped with the time they were learned
 * @param profileId - The profile ID
 * @param hashSetId - The hash set ID to add to
 * @param hashes - Hashes to add
 * @returns The number of hashes added or renamed
 */
export function addProfileHashes(
	profileId: string,
	hashSetId: string,
	hashes: ImageHash[]
): number {
	const stored = _loadStorage();
	const profile = stored.profiles.find((p) => p.id === profileId);
	if (!profile) {
		throw new Error(`Profile '${profileId}' not found`);
	}

	const now = new Date();
	profile.hashSets = profile.hashSets || [];
	let hashSet = profile.hashSets.find((hs) => hs.id === hashSetId);
	if (!hashSet) {
		hashSet = {
			id: hashSetId,
			description: 'User-learned hashes',
			hashes: [],
			createdAt: now,
			updatedAt: now,
		};
		profile.hashSets.push(hashSet);
	}

	let changed = 0;
	for (const { name, hash } of hashes) {
		const existing = hashSet.hashes.find((h) => h.hash === hash);
		if (!existing) {
			hashSet.hashes.push({ name, hash, learnedAt: now });
			changed++;
		} else if (existing.name !== name) {
			existing.name = name;
			existing.learnedAt = now;
			changed++;
		}
	}

	if (changed > 0) {
		hashSet.updatedAt = now;
		_saveProfiles(stored.profiles, stored.activeProfileId);
	}
	return changed;
}

/**
 * Counts the hashes stored across a profile's hash sets
 * @param profileId - The profile ID
 * @returns Total number of stored hashes, 0 if the profile doesn't exist
 */
export function countProfileHashes(profileId: string): number {
	return (getProfileHashSets(profileId) || []).reduce(
		(total, hs) => total + hs.hashes.length,
		0
	);
}

/**
 * Lists the hashes stored across a profile's hash sets, newest first
 * Hashes without a learned time (saved before it was recorded) come last
 * @param profileId - The profile ID
 * @returns The hashes with their hash set IDs, empty if the profile doesn't exist
 */
export function listProfileHashes(profileId: string): LearnedHash[] {
	const learnedTime = (h: LearnedHash) => h.learnedAt?.getTime() ?? -Infinity;
	return (getProfileHashSets(profileId) || [])
		.flatMap((hs) => hs.hashes.map((h) => ({ ...h, hashSetId: hs.id })))
		.sort((a, b) => learnedTime(b) - learnedTime(a));
}

/**
 * Removes one hash from a profile's hash set, dropping the set if it becomes empty
 * @param profileId - The profile ID
 * @param hashSetId - The hash set ID
 * @param hash - The hash to remove
 * @returns Whether a hash was removed
 */
export function removeProfileHash(
	profileId: string,
	hashSetId: string,
	hash: string
): boolean {
	const stored = _loadStorage();
	const profile = stored.profiles.find((p) => p.id === profileId);
	const hashSet = profile?.hashSets?.find((hs) => hs.id === hashSetId);
	const index = hashSet?.hashes.findIndex((h) => h.hash === hash) ?? -1;
	if (!profile || !hashSet || index < 0) return false;

	hashSet.hashes.splice(index, 1);
	hashSet.updatedAt = new Date();
	if (hashSet.hashes.length === 0) {
		profile.hashSets = profile.hashSets.filter((hs) => hs !== hashSet);
	}
	_saveProfiles(stored.profiles, stored.activeProfileId);
	return true;
}

/**
 * Removes all hash sets from a profile
 * @param profileId - The profile ID
 */
export function clearProfileHashes(profileId: string): void {
	const stored = _loadStorage();
	const profile = stored.profiles.find((p) => p.id === profileId);
	if (!profile) return;

	profile.hashSets = [];
	_saveProfiles(stored.profiles, stored.activeProfileId);
}

/**
 * Gets a profile's alignment groups (coordinates at reference resolution)
 * @param profileId - The profile ID
 * @returns The alignment groups, or an empty array if none
 */
export function getProfileAlignment(profileId: string): AlignmentGroup[] {
	return _loadProfile(profileId)?.alignment || [];
}

/**
 * Lists all saved region profiles
 * @returns Array of profile IDs and descriptions sorted by updatedAt descending
 */
export function listProfiles(): ProfileDetails[] {
	const stored = _loadStorage();
	return stored.profiles
		.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
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
		console.warn(`Cannot set active profile: profile ${profileId} not found`);
		return;
	}

	stored.activeProfileId = profileId;
	_saveProfiles(stored.profiles, stored.activeProfileId);
}

/**
 * Gets the currently active region profile
 * @param imgWidth - Optional target image width for denormalisation
 * @param imgHeight - Optional target image height for denormalisation
 * @returns The regions from the active profile, denormalised if dimensions provided
 */
export function getActiveProfile(imgWidth?: number, imgHeight?: number): TextRegion[] {
	const profileId = getActiveProfileId();
	return getProfile(profileId, imgWidth, imgHeight) || [];
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
 * Gets the hash sets from the currently active region profile
 * @returns The hash sets from the active profile, or empty array if none
 */
export function getActiveProfileHashSets(): ImageHashSet[] {
	const profileId = getActiveProfileId();
	return getProfileHashSets(profileId)!; // Active profile should always exist
}

/**
 * Gets the alignment groups from the currently active region profile
 * @returns The alignment groups, or empty array if none
 */
export function getActiveProfileAlignment(): AlignmentGroup[] {
	return getProfileAlignment(getActiveProfileId());
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
			!importedProfile.id
			|| !importedProfile.regions
			|| !Array.isArray(importedProfile.regions)
		) {
			console.error('Invalid profile import: missing required fields');
			return null;
		}

		// Save with original ID; updates existing profile if conflict exists
		saveProfile(importedProfile.regions, {
			id: importedProfile.id,
			description: importedProfile.description,
			alignment: importedProfile.alignment,
			hashSets:
				// Exports without a schema version predate templates
				(parsed.schemaVersion ?? 1) < FIRST_TEMPLATE_SCHEMA_VERSION ?
					[]
				:	(importedProfile.hashSets ?? []),
		});

		const storage = _loadStorage();
		return storage.profiles.length;
	} catch (error) {
		console.error('Error importing profile:', error);
		return null;
	}
}
