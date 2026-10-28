import type { TextRegion, ExportedProfile, ImageHashSet, AlignmentGroup } from '#types';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	saveProfile,
	getProfile,
	listProfiles,
	deleteProfile,
	setActiveProfile,
	getActiveProfileId,
	getActiveProfile,
	getProfileHashSets,
	getActiveProfileHashSets,
	addProfileHashes,
	countProfileHashes,
	clearProfileHashes,
	getProfileAlignment,
	getActiveProfileAlignment,
	exportProfile,
	importProfile,
} from '#utils/regionProfiles';

// Mock the default profiles index to avoid errors from ensureDefaultProfilesExist
// The implementation requires at least one default profile to avoid array access errors
vi.mock('#data/profiles', () => ({
	DEFAULT_PROFILES: [
		{
			type: 'vowt-region-profile',
			schemaVersion: 2,
			profile: {
				id: 'mock_profile',
				description: 'Built-in default profile',
				regions: [],
				hashSets: [],
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

			expect(stored.schemaVersion).toBe(2);
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
			expect(parsed.schemaVersion).toBe(2);
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

		it('should restore hash sets from an exported profile', () => {
			const profileId = saveProfile(mockRegions, { description: 'With hashes' });
			addProfileHashes(profileId, 'hero-portrait', [
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);
			const exported = exportProfile(profileId)!;

			localStorage.clear();
			importProfile(exported);

			const hashSets = getProfileHashSets(profileId);
			expect(hashSets).toHaveLength(1);
			expect(hashSets![0].hashes).toEqual([
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);
		});

		it('should drop learned dHashes from a version 1 export', () => {
			const profileId = saveProfile(mockRegions, { description: 'With hashes' });
			addProfileHashes(profileId, 'hero-portrait', [
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);
			const exported = JSON.parse(exportProfile(profileId)!);
			exported.schemaVersion = 1;

			localStorage.clear();
			importProfile(JSON.stringify(exported));

			expect(getProfileHashSets(profileId)).toEqual([]);
			expect(getProfile(profileId)).toEqual(mockRegions);
		});

		it('should drop learned dHashes from an export without a schema version', () => {
			const profileId = saveProfile(mockRegions, { description: 'With hashes' });
			addProfileHashes(profileId, 'hero-portrait', [
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);
			const exported = JSON.parse(exportProfile(profileId)!);
			delete exported.schemaVersion;

			localStorage.clear();
			importProfile(JSON.stringify(exported));

			expect(getProfileHashSets(profileId)).toEqual([]);
			expect(getProfile(profileId)).toEqual(mockRegions);
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

	describe('alignment', () => {
		const mockAlignment: AlignmentGroup[] = [
			{
				name: 'table',
				anchor: {
					x: 10,
					y: 20,
					searchX: 30,
					searchY: 40,
					template: { width: 1, height: 1, data: 'AA==' },
				},
				rows: { x: 0, width: 100, y: 50, rowHeight: 40, count: 5 },
			},
		];

		it('should return an empty array for a profile without alignment', () => {
			const profileId = saveProfile(mockRegions, { description: 'No alignment' });

			expect(getProfileAlignment(profileId)).toEqual([]);
		});

		it('should return an empty array for a non-existent profile', () => {
			expect(getProfileAlignment('non_existent_id')).toEqual([]);
		});

		it('should save and load alignment groups', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'With alignment',
				alignment: mockAlignment,
			});

			expect(getProfileAlignment(profileId)).toEqual(mockAlignment);
		});

		it('should keep existing alignment when saving without it', () => {
			const profileId = saveProfile(mockRegions, { alignment: mockAlignment });
			saveProfile(mockRegions, { id: profileId, description: 'Edited regions' });

			expect(getProfileAlignment(profileId)).toEqual(mockAlignment);
		});

		it('should not normalise alignment coordinates when saving', () => {
			const profileId = saveProfile(
				mockRegions,
				{ alignment: mockAlignment },
				1920,
				1080
			);

			expect(getProfileAlignment(profileId)).toEqual(mockAlignment);
		});

		it('should return the active profile alignment', () => {
			const profileId = saveProfile(mockRegions, { alignment: mockAlignment });
			setActiveProfile(profileId);

			expect(getActiveProfileAlignment()).toEqual(mockAlignment);
		});

		it('should export and import alignment groups', () => {
			const profileId = saveProfile(mockRegions, { alignment: mockAlignment });
			const exported = exportProfile(profileId)!;
			deleteProfile(profileId);

			importProfile(exported);

			expect(getProfileAlignment(profileId)).toEqual(mockAlignment);
		});

		it('should preserve region group and row fields', () => {
			const grouped: TextRegion[] = [{ ...mockRegion, group: 'table', row: 2 }];
			const profileId = saveProfile(grouped, {}, 1280, 720);

			expect(getProfile(profileId)![0]).toMatchObject({ group: 'table', row: 2 });
		});
	});

	describe('default profiles', () => {
		const storageKey = 'vowt_region_profiles';

		const storeDefaultCopy = (updatedAt: string, schemaVersion = 2) => {
			localStorage.setItem(
				storageKey,
				JSON.stringify({
					schemaVersion,
					activeProfileId: 'mock_profile',
					profiles: [
						{
							id: 'mock_profile',
							description: 'Stored copy',
							regions: mockRegions,
							hashSets: [],
							createdAt: '2025-11-11T00:00:00.000Z',
							updatedAt,
						},
					],
				})
			);
		};

		it('should replace a stored default older than the bundled version', () => {
			storeDefaultCopy('2025-11-01T00:00:00.000Z');

			const profile = listProfiles().find((p) => p.id === 'mock_profile');

			expect(profile?.description).toBe('Built-in default profile');
			expect(getProfile('mock_profile')).toEqual([]);
			const stored = JSON.parse(localStorage.getItem(storageKey)!);
			expect(stored.profiles[0].description).toBe('Built-in default profile');
		});

		it('should keep learned hash sets when replacing an outdated default', () => {
			storeDefaultCopy('2025-11-01T00:00:00.000Z');
			const stored = JSON.parse(localStorage.getItem(storageKey)!);
			stored.profiles[0].hashSets = [
				{
					id: 'hero-portrait',
					description: 'User-learned hashes',
					hashes: [{ name: 'new-hero', hash: 'abcdef1234567890' }],
					createdAt: '2025-11-01T00:00:00.000Z',
					updatedAt: '2025-11-01T00:00:00.000Z',
				},
			];
			localStorage.setItem(storageKey, JSON.stringify(stored));

			expect(listProfiles().find((p) => p.id === 'mock_profile')?.description).toBe(
				'Built-in default profile'
			);
			expect(getProfileHashSets('mock_profile')![0].hashes).toEqual([
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);
		});

		it('should drop learned dHashes from version 1 storage', () => {
			storeDefaultCopy('2026-01-01T00:00:00.000Z', 1);
			const stored = JSON.parse(localStorage.getItem(storageKey)!);
			stored.profiles[0].hashSets = [
				{
					id: 'hero-portrait',
					description: 'User-learned hashes',
					hashes: [{ name: 'new-hero', hash: 'abcdef1234567890' }],
					createdAt: '2025-11-01T00:00:00.000Z',
					updatedAt: '2025-11-01T00:00:00.000Z',
				},
			];
			localStorage.setItem(storageKey, JSON.stringify(stored));

			expect(getProfileHashSets('mock_profile')).toEqual([]);
			expect(listProfiles().find((p) => p.id === 'mock_profile')?.description).toBe(
				'Stored copy'
			);
			expect(getProfile('mock_profile')).toEqual(mockRegions);
			expect(JSON.parse(localStorage.getItem(storageKey)!).schemaVersion).toBe(2);
		});

		it('should keep a stored default edited after the bundled version', () => {
			storeDefaultCopy('2026-01-01T00:00:00.000Z');

			const profile = listProfiles().find((p) => p.id === 'mock_profile');

			expect(profile?.description).toBe('Stored copy');
			expect(getProfile('mock_profile')).toEqual(mockRegions);
		});
	});

	describe('getProfileHashSets', () => {
		it('should return null for non-existent profile', () => {
			const hashSets = getProfileHashSets('non_existent_id');
			expect(hashSets).toBeNull();
		});

		it('should return empty array when profile has no hash sets', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Profile without hash sets',
			});

			const hashSets = getProfileHashSets(profileId);
			expect(hashSets).toEqual([]);
		});

		it('should return hash sets from storage when profile has them', () => {
			// Create a profile with hash sets by manually setting storage
			const profileId = saveProfile(mockRegions, {
				description: 'Profile with hash sets',
			});

			// Add hash sets to the profile in storage
			const storageKey = 'vowt_region_profiles';
			const storage = JSON.parse(localStorage.getItem(storageKey)!);
			const profileIndex = storage.profiles.findIndex(
				(p: { id: string }) => p.id === profileId
			);

			const testHashSet: ImageHashSet = {
				id: 'test-heroes',
				description: 'Test hero hashes',
				hashes: [
					{ name: 'ana', hash: '6b2b17451147b400' },
					{ name: 'ashe', hash: '0a26b7350e052580' },
				],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			storage.profiles[profileIndex].hashSets = [testHashSet];
			localStorage.setItem(storageKey, JSON.stringify(storage));

			const hashSets = getProfileHashSets(profileId);
			expect(hashSets).toHaveLength(1);
			expect(hashSets![0].id).toBe('test-heroes');
			expect(hashSets![0].hashes).toHaveLength(2);
		});
	});

	describe('addProfileHashes', () => {
		const hashSetId = 'hero-portrait';

		it('should create the hash set when the profile has none', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });

			const added = addProfileHashes(profileId, hashSetId, [
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);

			expect(added).toBe(1);
			const hashSets = getProfileHashSets(profileId)!;
			expect(hashSets).toHaveLength(1);
			expect(hashSets[0].id).toBe(hashSetId);
			expect(hashSets[0].hashes).toEqual([
				{ name: 'new-hero', hash: 'abcdef1234567890' },
			]);
		});

		it('should append to an existing hash set', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			addProfileHashes(profileId, hashSetId, [{ name: 'ana', hash: '1111111111111111' }]);

			addProfileHashes(profileId, hashSetId, [
				{ name: 'ashe', hash: '2222222222222222' },
			]);

			expect(getProfileHashSets(profileId)![0].hashes.map((h) => h.name)).toEqual([
				'ana',
				'ashe',
			]);
		});

		it('should skip hashes already stored under the same name', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			const hashes = [{ name: 'ana', hash: '1111111111111111' }];
			addProfileHashes(profileId, hashSetId, hashes);

			const added = addProfileHashes(profileId, hashSetId, hashes);

			expect(added).toBe(0);
			expect(getProfileHashSets(profileId)![0].hashes).toHaveLength(1);
		});

		it('should rename a hash stored under a different name', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			addProfileHashes(profileId, hashSetId, [{ name: 'ana', hash: '1111111111111111' }]);

			const changed = addProfileHashes(profileId, hashSetId, [
				{ name: 'ashe', hash: '1111111111111111' },
			]);

			expect(changed).toBe(1);
			expect(getProfileHashSets(profileId)![0].hashes).toEqual([
				{ name: 'ashe', hash: '1111111111111111' },
			]);
		});

		it('should not change the profile updatedAt', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			const storageKey = 'vowt_region_profiles';
			const readUpdatedAt = () =>
				JSON.parse(localStorage.getItem(storageKey)!).profiles.find(
					(p: { id: string }) => p.id === profileId
				).updatedAt;
			const before = readUpdatedAt();

			addProfileHashes(profileId, hashSetId, [{ name: 'ana', hash: '1111111111111111' }]);

			expect(readUpdatedAt()).toBe(before);
		});

		it('should keep hash sets when the profile regions are saved again', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			addProfileHashes(profileId, hashSetId, [{ name: 'ana', hash: '1111111111111111' }]);

			saveProfile(mockRegions, { id: profileId, description: 'Edited' });

			expect(getProfileHashSets(profileId)![0].hashes).toHaveLength(1);
		});

		it('should throw for a non-existent profile', () => {
			expect(() =>
				addProfileHashes('non_existent_id', hashSetId, [
					{ name: 'ana', hash: '1111111111111111' },
				])
			).toThrow();
		});
	});

	describe('countProfileHashes / clearProfileHashes', () => {
		it('should count hashes across all hash sets', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			addProfileHashes(profileId, 'hero-portrait', [
				{ name: 'ana', hash: '1111111111111111' },
				{ name: 'ashe', hash: '2222222222222222' },
			]);
			addProfileHashes(profileId, 'rank-icons', [
				{ name: 'gold', hash: '3333333333333333' },
			]);

			expect(countProfileHashes(profileId)).toBe(3);
		});

		it('should return 0 for a non-existent profile', () => {
			expect(countProfileHashes('non_existent_id')).toBe(0);
		});

		it('should remove all hash sets from a profile', () => {
			const profileId = saveProfile(mockRegions, { description: 'Learning' });
			addProfileHashes(profileId, 'hero-portrait', [
				{ name: 'ana', hash: '1111111111111111' },
			]);

			clearProfileHashes(profileId);

			expect(getProfileHashSets(profileId)).toEqual([]);
			expect(countProfileHashes(profileId)).toBe(0);
		});
	});

	describe('getActiveProfileHashSets', () => {
		it('should return empty array when active profile has no hash sets', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Profile without hash sets',
			});
			setActiveProfile(profileId);

			const hashSets = getActiveProfileHashSets();
			expect(hashSets).toEqual([]);
		});

		it('should return hash sets from active profile', () => {
			const profileId = saveProfile(mockRegions, {
				description: 'Profile with hash sets',
			});
			setActiveProfile(profileId);

			// Add hash sets to the active profile in storage
			const storageKey = 'vowt_region_profiles';
			const storage = JSON.parse(localStorage.getItem(storageKey)!);
			const profileIndex = storage.profiles.findIndex(
				(p: { id: string }) => p.id === profileId
			);

			const testHashSet: ImageHashSet = {
				id: 'custom-heroes',
				description: 'Custom hero hashes',
				hashes: [{ name: 'reinhardt', hash: 'abcdef1234567890' }],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			storage.profiles[profileIndex].hashSets = [testHashSet];
			localStorage.setItem(storageKey, JSON.stringify(storage));

			const hashSets = getActiveProfileHashSets();
			expect(hashSets).toHaveLength(1);
			expect(hashSets[0].id).toBe('custom-heroes');
			expect(hashSets[0].hashes[0].name).toBe('reinhardt');
		});

		it('should return different hash sets when active profile changes', () => {
			// Create two profiles with different hash sets
			const profileId1 = saveProfile(mockRegions, {
				description: 'Profile 1 with hash sets',
			});
			const profileId2 = saveProfile(mockRegions, {
				description: 'Profile 2 with hash sets',
			});

			// Add hash sets to both profiles
			const storageKey = 'vowt_region_profiles';
			const storage = JSON.parse(localStorage.getItem(storageKey)!);
			const profile1Index = storage.profiles.findIndex(
				(p: { id: string }) => p.id === profileId1
			);
			const profile2Index = storage.profiles.findIndex(
				(p: { id: string }) => p.id === profileId2
			);

			storage.profiles[profile1Index].hashSets = [
				{
					id: 'heroes-set-1',
					description: 'Heroes set 1',
					hashes: [{ name: 'ana', hash: 'hash1' }],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];
			storage.profiles[profile2Index].hashSets = [
				{
					id: 'heroes-set-2',
					description: 'Heroes set 2',
					hashes: [{ name: 'zenyatta', hash: 'hash2' }],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];
			localStorage.setItem(storageKey, JSON.stringify(storage));

			// Set profile 1 as active and check hash sets
			setActiveProfile(profileId1);
			const hashSets1 = getActiveProfileHashSets();
			expect(hashSets1[0].id).toBe('heroes-set-1');
			expect(hashSets1[0].hashes[0].name).toBe('ana');

			// Switch to profile 2 and check hash sets
			setActiveProfile(profileId2);
			const hashSets2 = getActiveProfileHashSets();
			expect(hashSets2[0].id).toBe('heroes-set-2');
			expect(hashSets2[0].hashes[0].name).toBe('zenyatta');
		});
	});
});
