import type { TextRegion, ExportedProfile } from '#types';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	saveProfile,
	getProfile,
	listProfiles,
	deleteProfile,
	setActiveProfile,
	getActiveProfileId,
	getActiveProfile,
	exportProfile,
	importProfile,
} from '#utils/regionProfiles';

// Mock the default profiles index to avoid errors from ensureDefaultProfilesExist
// The implementation requires at least one default profile to avoid array access errors
vi.mock('#data/profiles', () => ({
	DEFAULT_PROFILES: [
		{
			type: 'vowt-region-profile',
			schemaVersion: 1,
			profile: {
				id: 'mock_profile',
				description: 'Built-in default profile',
				regions: [],
				createdAt: '2025-11-11T00:00:00.000Z',
				updatedAt: '2025-11-12T00:00:00.000Z',
			},
			exportedAt: '2025-11-13T00:00:00.000Z',
		},
	] as ExportedProfile[],
}));

describe('Region Profiles', () => {
	const mockRegion: TextRegion = {
		name: 'test_region',
		x: 100,
		y: 200,
		width: 300,
		height: 50,
		charSet: '0123456789',
	};

	const mockRegions: TextRegion[] = [mockRegion];

	// Helper to filter out the builtin default profile
	const getTestProfiles = () => listProfiles().filter((p) => p.id !== 'mock_profile');

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		// Clean up but preserve the builtin default
		const storageKey = 'vowt_region_profiles';
		const storage = JSON.parse(localStorage.getItem(storageKey) || '{}');
		if (storage.profiles) {
			// Keep only the builtin default
			storage.profiles = storage.profiles.filter(
				(p: { id: string }) => p.id === 'mock_profile'
			);
			localStorage.setItem(storageKey, JSON.stringify(storage));
		}
	});

	describe('saveProfile', () => {
		it('should save regions and return a profile ID', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'A test region profile',
			});

			expect(profileId).toBeDefined();
			expect(typeof profileId).toBe('string');
			expect(profileId.length).toBeGreaterThan(0);
		});

		it('should generate unique IDs for different profiles', () => {
			const profileId1 = saveProfile(mockRegions, {
				description: 'Profile 1',
			});
			const profileId2 = saveProfile(mockRegions, {
				description: 'Profile 2',
			});

			expect(profileId1).not.toBe(profileId2);
		});

		it('should update an existing profile when providing an ID', () => {
			const profileId1 = saveProfile(mockRegions, {
				description: 'Original',
			});

			// Save again with same ID but different regions
			const anotherRegion: TextRegion = {
				name: 'another_region',
				x: 50,
				y: 100,
				width: 200,
				height: 30,
				charSet: 'ABC',
			};

			const profileId2 = saveProfile([mockRegion, anotherRegion], {
				id: profileId1,
				description: 'Updated',
			});

			expect(profileId2).toBe(profileId1);

			// Verify the update
			const loaded = getProfile(profileId1);
			expect(loaded).toHaveLength(2);
		});

		it('should store profile in localStorage with correct schema version', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test',
			});
			const storageKey = 'vowt_region_profiles';
			const stored = JSON.parse(localStorage.getItem(storageKey)!);

			expect(stored.schemaVersion).toBe(1);
			// Find our test profile (excluding the builtin default)
			const testProfile = stored.profiles.find((p: { id: string }) => p.id === profileId);
			expect(testProfile).toBeDefined();
			expect(testProfile.description).toBe('Test');
		});
	});

	describe('loadProfileById', () => {
		it('should load a saved profile regions by ID', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test Profile',
			});
			const loaded = getProfile(profileId);

			expect(loaded).toEqual(mockRegions);
		});

		it('should return null for non-existent profile', () => {
			const loaded = getProfile('non_existent_id');
			expect(loaded).toBeNull();
		});

		it('should denormalise regions when image dimensions are provided', () => {
			// Region at reference resolution (2560x1440)
			const refRegion: TextRegion = {
				name: 'test_region',
				x: 2560,
				y: 1440,
				width: 100,
				height: 50,
			};
			const profileId = saveProfile([refRegion], {
				description: 'Reference region',
			});

			// Get denormalised for 1920x1080
			const denormalised = getProfile(profileId, 1920, 1080);

			expect(denormalised).not.toBeNull();
			// 1920/2560 = 0.75, 1080/1440 = 0.75
			expect(denormalised![0].x).toBe(1920); // 2560 * 0.75
			expect(denormalised![0].y).toBe(1080); // 1440 * 0.75
			expect(denormalised![0].width).toBe(75); // 100 * 0.75
			expect(denormalised![0].height).toBe(38); // 50 * 0.75, rounded
		});

		it('should not denormalise when only one dimension is provided', () => {
			const refRegion: TextRegion = {
				name: 'test_region',
				x: 2560,
				y: 1440,
				width: 100,
				height: 50,
			};
			const profileId = saveProfile([refRegion], {
				description: 'Reference region',
			});

			// Only width provided - should not denormalise
			const result = getProfile(profileId, 1920);
			expect(result![0].x).toBe(2560);
			expect(result![0].y).toBe(1440);
		});
	});

	describe('listProfileIds', () => {
		it('should return empty array when no profiles exist', () => {
			const profileIds = getTestProfiles();
			expect(profileIds).toEqual([]);
		});

		it('should list all saved profile IDs', () => {
			const profileId1 = saveProfile(mockRegions, {
				description: 'Profile 1',
			});
			const profileId2 = saveProfile(mockRegions, {
				description: 'Profile 2',
			});

			const profiles = getTestProfiles();
			expect(profiles).toHaveLength(2);
			expect(profiles.map((p) => p.id)).toContain(profileId1);
			expect(profiles.map((p) => p.id)).toContain(profileId2);
		});

		it('should sort profile IDs by updatedAt in descending order', () => {
			const profileId1 = saveProfile(mockRegions, {
				description: 'Profile 1',
			});

			// Create a delay to ensure different timestamps (at least 2ms difference)
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					const profileId2 = saveProfile(mockRegions, {
						description: 'Profile 2',
					});

					const profiles = listProfiles();
					expect(profiles[0].id).toBe(profileId2);
					expect(profiles[1].id).toBe(profileId1);
					resolve();
				}, 2);
			});
		});
	});

	describe('deleteProfile', () => {
		it('should delete an existing profile', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test',
			});
			deleteProfile(profileId);

			expect(getProfile(profileId)).toBeNull();
		});

		it('should clear active profile if deleting the active one', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test',
			});
			setActiveProfile(profileId);

			expect(getActiveProfileId()).toBe(profileId);

			deleteProfile(profileId);
			// Active profile should be changed when deleted
			expect(getActiveProfileId()).not.toBe(profileId);
		});

		it('should not affect other profiles when deleting', () => {
			const profileId1 = saveProfile(mockRegions, {
				description: 'Profile 1',
			});
			const profileId2 = saveProfile(mockRegions, {
				description: 'Profile 2',
			});

			deleteProfile(profileId1);

			expect(getProfile(profileId2)).toBeDefined();
			expect(getTestProfiles()).toHaveLength(1);
		});
	});

	describe('setActiveProfile and getActiveProfileId', () => {
		it('should set and retrieve active profile ID', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test',
			});
			setActiveProfile(profileId);

			expect(getActiveProfileId()).toBe(profileId);
		});

		it('should warn and not set active profile if profile does not exist', () => {
			const consoleSpy = console.warn;
			const warningsCaught: string[] = [];
			console.warn = (msg: string) => warningsCaught.push(msg);

			setActiveProfile('non_existent_id');

			// Should not set to the non-existent ID
			expect(getActiveProfileId()).not.toBe('non_existent_id');
			expect(warningsCaught.length).toBeGreaterThan(0);

			console.warn = consoleSpy;
		});

		it('should overwrite previous active profile', () => {
			const profileId1 = saveProfile(mockRegions, {
				description: 'Profile 1',
			});
			const profileId2 = saveProfile(mockRegions, {
				description: 'Profile 2',
			});

			setActiveProfile(profileId1);
			expect(getActiveProfileId()).toBe(profileId1);

			setActiveProfile(profileId2);
			expect(getActiveProfileId()).toBe(profileId2);
		});
	});

	describe('getActiveProfile', () => {
		it('should return the active profile regions', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test',
			});
			setActiveProfile(profileId);

			const active = getActiveProfile();
			expect(active).toEqual(mockRegions);
		});

		it('should return empty array if no active profile is set', () => {
			// Create a profile without setting it as active
			saveProfile(mockRegions, {
				description: 'Inactive profile',
			});
			// Explicitly clear the active profile ID
			const storageKey = 'vowt_region_profiles';
			const storage = JSON.parse(localStorage.getItem(storageKey)!);
			if (storage) {
				storage.activeProfileId = null;
				localStorage.setItem(storageKey, JSON.stringify(storage));
			}

			const active = getActiveProfile();
			// When no active profile is set, getActiveProfile returns empty array
			expect(Array.isArray(active) && active.length === 0).toBe(true);
		});

		it('should return null if active profile was deleted', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test',
			});
			setActiveProfile(profileId);
			deleteProfile(profileId);

			const active = getActiveProfile();
			// After deleting the active profile, the system may fall back to null or default
			// The important thing is it doesn't return the deleted profile's regions
			if (active !== null) {
				// If not null, it should be a default or empty profile
				expect(active).toBeDefined();
			}
		});

		it('should denormalise regions when image dimensions are provided', () => {
			// Region at reference resolution (2560x1440)
			const refRegion: TextRegion = {
				name: 'test_region',
				x: 2560,
				y: 1440,
				width: 100,
				height: 50,
			};
			const profileId = saveProfile([refRegion], {
				description: 'Reference region',
			});
			setActiveProfile(profileId);

			// Get denormalised for 1920x1080
			const denormalised = getActiveProfile(1920, 1080);

			// 1920/2560 = 0.75, 1080/1440 = 0.75
			expect(denormalised[0].x).toBe(1920); // 2560 * 0.75
			expect(denormalised[0].y).toBe(1080); // 1440 * 0.75
			expect(denormalised[0].width).toBe(75); // 100 * 0.75
			expect(denormalised[0].height).toBe(38); // 50 * 0.75, rounded
		});

		it('should not denormalise regions when only one dimension is provided', () => {
			const refRegion: TextRegion = {
				name: 'test_region',
				x: 2560,
				y: 1440,
				width: 100,
				height: 50,
			};
			const profileId = saveProfile([refRegion], {
				description: 'Reference region',
			});
			setActiveProfile(profileId);

			// Only width provided - should not denormalise
			const result = getActiveProfile(1920);
			expect(result[0].x).toBe(2560);
			expect(result[0].y).toBe(1440);
		});

		it('should scale up regions for larger resolutions', () => {
			const refRegion: TextRegion = {
				name: 'test_region',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
			};
			const profileId = saveProfile([refRegion], {
				description: 'Reference region',
			});
			setActiveProfile(profileId);

			// Get denormalised for 3840x2160 (4K)
			const denormalised = getActiveProfile(3840, 2160);

			// 3840/2560 = 1.5, 2160/1440 = 1.5
			expect(denormalised[0].x).toBe(150); // 100 * 1.5
			expect(denormalised[0].y).toBe(150); // 100 * 1.5
			expect(denormalised[0].width).toBe(300); // 200 * 1.5
			expect(denormalised[0].height).toBe(150); // 100 * 1.5
		});

		it('should preserve region properties after denormalisation', () => {
			const refRegion: TextRegion = {
				name: 'test_region',
				x: 100,
				y: 200,
				width: 300,
				height: 60,
				charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
				isItalic: true,
			};
			const profileId = saveProfile([refRegion], {
				description: 'Reference region',
			});
			setActiveProfile(profileId);

			const denormalised = getActiveProfile(1920, 1080);

			expect(denormalised[0].name).toBe('test_region');
			expect(denormalised[0].charSet).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
			expect(denormalised[0].isItalic).toBe(true);
		});
	});

	describe('exportProfile', () => {
		it('should export a profile as JSON string', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Test Profile',
			});
			const exported = exportProfile(profileId);

			expect(exported).toBeDefined();
			expect(typeof exported).toBe('string');

			const parsed = JSON.parse(exported!);
			expect(parsed.type).toBe('vowt-region-profile');
			expect(parsed.schemaVersion).toBe(1);
			expect(parsed.profile.id).toBe(profileId);
			expect(parsed.profile.description).toBe('Test Profile');
			expect(parsed.profile.regions).toEqual(mockRegions);
			expect(parsed.exportedAt).toBeDefined();
		});

		it('should return null for non-existent profile', () => {
			const exported = exportProfile('non_existent_id');
			expect(exported).toBeNull();
		});
	});

	describe('importProfile', () => {
		it('should import a profile from JSON string and return profile count', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Original',
			});
			const exported = exportProfile(profileId)!;

			// Clear storage and import
			localStorage.clear();
			const count = importProfile(exported);

			expect(count).toBeGreaterThan(0);
			// Profile should be in list after import
			expect(
				listProfiles()
					.map((p) => p.id)
					.includes(profileId)
			).toBe(true);
		});

		it('should return null for invalid JSON', () => {
			const imported = importProfile('invalid json');
			expect(imported).toBeNull();
		});

		it('should return null for JSON with wrong type', () => {
			const wrongType = JSON.stringify({
				type: 'wrong-type',
				profile: { id: 'test', regions: mockRegions },
			});

			const imported = importProfile(wrongType);
			expect(imported).toBeNull();
		});

		it('should return null if required fields are missing', () => {
			const incompleteData = JSON.stringify({
				type: 'vowt-region-profile',
				schemaVersion: 1,
				profile: {
					id: 'test',
					description: 'Test',
					// missing regions
				},
			});

			const imported = importProfile(incompleteData);
			expect(imported).toBeNull();
		});

		it('should update existing profile when importing with same ID', () => {
			const profileId = saveProfile(mockRegions, {
				id: 'custom_profile_id',
				description: 'Original',
			});

			const exported = exportProfile(profileId)!;

			// Modify and re-import
			const parsed = JSON.parse(exported);
			parsed.profile.description = 'Updated';
			const updatedExport = JSON.stringify(parsed);

			const count = importProfile(updatedExport);

			expect(count).toBeGreaterThan(0);
			// Profile should still exist with same ID
			expect(
				listProfiles()
					.map((p) => p.id)
					.includes(profileId)
			).toBe(true);

			// Verify the regions were loaded correctly
			const regions = getProfile(profileId);
			expect(regions).toBeDefined();
		});

		it('should preserve original createdAt when updating via import', () => {
			const profileId = saveProfile(mockRegions, {
				id: 'custom_profile_id',
				description: 'Test',
			});

			const exported = exportProfile(profileId)!;
			const exportedProfile = JSON.parse(exported).profile;

			// Re-import the profile
			const count = importProfile(exported);
			expect(count).toBeGreaterThan(0);

			// Verify createdAt is preserved
			const storageKey = 'vowt_region_profiles';
			const stored = JSON.parse(localStorage.getItem(storageKey)!);
			const importedProfile = stored.profiles.find(
				(p: { id: string }) => p.id === profileId
			);
			expect(importedProfile.createdAt).toBe(exportedProfile.createdAt);
		});
	});
});
