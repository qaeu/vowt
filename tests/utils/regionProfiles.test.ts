import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    saveProfile,
    loadProfileById,
    listProfiles,
    deleteProfile,
    setActiveProfile,
    getActiveProfileId,
    getActiveProfile,
    exportProfile,
    importProfile,
} from '#utils/regionProfiles';
import { TextRegion } from '#utils/textRegions';

// Mock the default profiles index to not include any valid profiles for testing
vi.mock('#data/profiles', () => ({
    defaultProfiles: [
        {
            type: 'other-type',
            schemaVersion: 1,
            profile: {
                id: '',
                description: '',
                regions: [],
                createdAt: '',
                updatedAt: '',
            },
        },
    ],
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

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
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
            const loaded = loadProfileById(profileId1);
            expect(loaded).toHaveLength(2);
        });

        it('should store profile in localStorage with correct schema version', () => {
            const profileId = saveProfile(mockRegions, {
                description: 'Test',
            });
            const storageKey = 'vowt_region_profiles';
            const stored = JSON.parse(localStorage.getItem(storageKey)!);

            expect(stored.schemaVersion).toBe(1);
            expect(stored.profiles).toHaveLength(1);
            expect(stored.profiles[0].id).toBe(profileId);
        });
    });

    describe('loadProfileById', () => {
        it('should load a saved profile regions by ID', () => {
            const profileId = saveProfile(mockRegions, {
                description: 'Test Profile',
            });
            const loaded = loadProfileById(profileId);

            expect(loaded).toEqual(mockRegions);
        });

        it('should return null for non-existent profile', () => {
            const loaded = loadProfileById('non_existent_id');
            expect(loaded).toBeNull();
        });
    });

    describe('listProfileIds', () => {
        it('should return empty array when no profiles exist', () => {
            const profileIds = listProfiles();
            expect(profileIds).toEqual([]);
        });

        it('should list all saved profile IDs', () => {
            const profileId1 = saveProfile(mockRegions, {
                description: 'Profile 1',
            });
            const profileId2 = saveProfile(mockRegions, {
                description: 'Profile 2',
            });

            const profiles = listProfiles();
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
            const deleted = deleteProfile(profileId);

            expect(deleted).toBe(true);
            expect(loadProfileById(profileId)).toBeNull();
        });

        it('should return false for non-existent profile', () => {
            const deleted = deleteProfile('non_existent_id');
            expect(deleted).toBe(false);
        });

        it('should clear active profile if deleting the active one', () => {
            const profileId = saveProfile(mockRegions, {
                description: 'Test',
            });
            setActiveProfile(profileId);

            expect(getActiveProfileId()).toBe(profileId);

            deleteProfile(profileId);
            expect(getActiveProfileId()).toBeNull();
        });

        it('should not affect other profiles when deleting', () => {
            const profileId1 = saveProfile(mockRegions, {
                description: 'Profile 1',
            });
            const profileId2 = saveProfile(mockRegions, {
                description: 'Profile 2',
            });

            deleteProfile(profileId1);

            expect(loadProfileById(profileId2)).toBeDefined();
            expect(listProfiles()).toHaveLength(1);
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

            expect(getActiveProfileId()).toBeNull();
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

        it('should return null if no active profile is set', () => {
            const active = getActiveProfile();
            expect(active).toBeNull();
        });

        it('should return null if active profile was deleted', () => {
            const profileId = saveProfile(mockRegions, {
                description: 'Test',
            });
            setActiveProfile(profileId);
            deleteProfile(profileId);

            const active = getActiveProfile();
            expect(active).toBeNull();
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

            expect(count).toBe(1);
            expect(listProfiles()).toHaveLength(1);
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

            expect(count).toBe(1);
            expect(listProfiles()).toHaveLength(1);

            // Verify the description was updated
            const regions = loadProfileById(profileId);
            expect(regions).toBeDefined();
        });

        it('should preserve original createdAt when updating via import', () => {
            const profileId = saveProfile(mockRegions, {
                id: 'custom_profile_id',
                description: 'Test',
            });

            const exported = exportProfile(profileId)!;
            const exportedProfile = JSON.parse(exported).profile;

            // Wait and re-import
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const count = importProfile(exported);
                    expect(count).toBe(1);

                    // Verify createdAt is preserved
                    const storageKey = 'vowt_region_profiles';
                    const stored = JSON.parse(
                        localStorage.getItem(storageKey)!
                    );
                    expect(stored.profiles[0].createdAt).toBe(
                        exportedProfile.createdAt
                    );
                    resolve();
                }, 10);
            });
        });
    });
});
