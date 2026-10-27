import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchHeroes,
	fetchMaps,
	searchPlayers,
	updateOverFastData,
	loadOverFastData,
	clearOverFastData,
	BASE_URL,
	STORAGE_KEY,
	SCHEMA_VERSION,
} from '#utils/overfastApi';
import type { OverFastHero, OverFastMap, OverFastPlayerSearchResponse } from '#types';

// Mock API data

const mockHeroes: OverFastHero[] = [
	{
		key: 'ana',
		name: 'Ana',
		portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ana.png',
		role: 'support',
		subrole: 'tactician',
		gamemodes: ['quickplay', 'stadium'],
	},
	{
		key: 'tracer',
		name: 'Tracer',
		portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/tracer.png',
		role: 'damage',
		subrole: 'flanker',
		gamemodes: ['quickplay', 'stadium'],
	},
];

const mockMaps: OverFastMap[] = [
	{
		key: 'aatlis',
		name: 'Aatlis',
		screenshot: 'https://overfast-api.tekrop.fr/static/maps/aatlis.jpg',
		gamemodes: ['flashpoint'],
		uses: ['standard'],
		location: 'Morocco',
		country_code: 'MA',
	},
	{
		key: 'havana',
		name: 'Havana',
		screenshot: 'https://overfast-api.tekrop.fr/static/maps/havana.jpg',
		gamemodes: ['escort'],
		uses: ['standard'],
		location: 'Havana, Cuba',
		country_code: null,
	},
];

const mockPlayerSearchResponse: OverFastPlayerSearchResponse = {
	total: 1,
	results: [
		{
			player_id: 'Player-1234',
			name: 'Player',
			avatar: 'https://example.com/avatar.png',
			namecard: null,
			title: null,
			career_url: 'https://overfast-api.tekrop.fr/players/Player-1234',
			blizzard_id: 'Player#1234',
		},
	],
};

describe('overfastApi', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('fetchHeroes', () => {
		it('should fetch and return hero data from the API', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockHeroes),
			} as Response);

			const heroes = await fetchHeroes();

			expect(globalThis.fetch).toHaveBeenCalledWith(`${BASE_URL}/heroes`);
			expect(heroes).toEqual(mockHeroes);
		});

		it('should throw an error on non-OK response', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			} as Response);

			await expect(fetchHeroes()).rejects.toThrow(
				'Failed to fetch heroes: 500 Internal Server Error'
			);
		});

		it('should throw on network failure', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

			await expect(fetchHeroes()).rejects.toThrow('Network error');
		});
	});

	describe('fetchMaps', () => {
		it('should fetch and return map data from the API', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMaps),
			} as Response);

			const maps = await fetchMaps();

			expect(globalThis.fetch).toHaveBeenCalledWith(`${BASE_URL}/maps`);
			expect(maps).toEqual(mockMaps);
		});

		it('should throw an error on non-OK response', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			} as Response);

			await expect(fetchMaps()).rejects.toThrow('Failed to fetch maps: 404 Not Found');
		});

		it('should throw on network failure', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

			await expect(fetchMaps()).rejects.toThrow('Network error');
		});
	});

	describe('searchPlayers', () => {
		it('should fetch and return player search results', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockPlayerSearchResponse),
			} as Response);

			const result = await searchPlayers('Player');

			expect(globalThis.fetch).toHaveBeenCalledWith(`${BASE_URL}/players?name=Player`);
			expect(result.total).toBe(1);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].player_id).toBe('Player-1234');
		});

		it('should encode special characters in the player name', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ total: 0, results: [] }),
			} as Response);

			await searchPlayers('Player #1234');

			expect(globalThis.fetch).toHaveBeenCalledWith(
				`${BASE_URL}/players?name=Player+%231234`
			);
		});

		it('should pass pagination and ordering options as query params', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ total: 0, results: [] }),
			} as Response);

			await searchPlayers('Player', {
				offset: 20,
				limit: undefined,
				order_by: 'last_updated_at:desc',
			});

			// Undefined options are omitted
			expect(globalThis.fetch).toHaveBeenCalledWith(
				`${BASE_URL}/players?name=Player&offset=20&order_by=last_updated_at%3Adesc`
			);
		});

		it('should throw an error on non-OK response', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 422,
				statusText: 'Unprocessable Entity',
			} as Response);

			await expect(searchPlayers('test')).rejects.toThrow(
				'Failed to search players: 422 Unprocessable Entity'
			);
		});

		it('should throw on network failure', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

			await expect(searchPlayers('test')).rejects.toThrow('Network error');
		});
	});

	describe('updateOverFastData', () => {
		/**
		 * Helper to set up mocks for a successful updateOverFastData call
		 */
		function setupUpdateMocks() {
			// Mock fetch for heroes and maps
			vi.spyOn(globalThis, 'fetch')
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockHeroes),
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockMaps),
				} as Response);
		}

		it('should fetch heroes and maps and save to localStorage', async () => {
			setupUpdateMocks();

			const store = await updateOverFastData();

			expect(store.heroes).toHaveLength(2);
			expect(store.maps).toHaveLength(2);
			expect(store.schemaVersion).toBe(SCHEMA_VERSION);
			expect(store.updatedAt).toBeInstanceOf(Date);

			// Verify localStorage holds the same data
			expect(loadOverFastData()).toEqual(store);
		});

		it('should map hero fields correctly', async () => {
			setupUpdateMocks();

			const store = await updateOverFastData();
			const ana = store.heroes.find((h) => h.key === 'ana');

			expect(ana).toBeDefined();
			expect(ana?.name).toBe('Ana');
			expect(ana?.role).toBe('support');
			expect(ana?.subrole).toBe('tactician');
			expect(ana?.portrait).toBe(
				'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ana.png'
			);
			expect(ana?.gamemodes).toEqual(['quickplay', 'stadium']);
		});

		it('should map stored maps correctly', async () => {
			setupUpdateMocks();

			const store = await updateOverFastData();
			const aatlis = store.maps.find((m) => m.key === 'aatlis');

			expect(aatlis).toBeDefined();
			expect(aatlis?.name).toBe('Aatlis');
			expect(aatlis?.location).toBe('Morocco');
			expect(aatlis?.country_code).toBe('MA');
			expect(aatlis?.uses).toEqual(['standard']);

			const havana = store.maps.find((m) => m.key === 'havana');
			expect(havana?.country_code).toBeNull();
		});

		it('should save data with the correct schema version', async () => {
			setupUpdateMocks();

			await updateOverFastData();

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
			expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
		});

		it('should throw and log error when fetch fails', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(updateOverFastData()).rejects.toThrow('Network error');
			expect(consoleSpy).toHaveBeenCalledWith(
				'Error updating OverFast data:',
				expect.any(Error)
			);
		});

		it('should throw and log error when saving to localStorage fails', async () => {
			setupUpdateMocks();
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('QuotaExceededError');
			});
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(updateOverFastData()).rejects.toThrow('QuotaExceededError');
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('loadOverFastData', () => {
		it('should load stored data from localStorage', () => {
			const storeData = {
				schemaVersion: SCHEMA_VERSION,
				heroes: [
					{
						key: 'ana',
						name: 'Ana',
						portrait: 'https://example.com/ana.png',
						role: 'support',
						subrole: 'tactician',
						gamemodes: ['quickplay'],
					},
				],
				maps: [],
				updatedAt: new Date('2025-01-15T12:00:00Z'),
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(storeData));

			const loaded = loadOverFastData();

			expect(loaded).not.toBeNull();
			expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION);
			expect(loaded?.heroes).toHaveLength(1);
			expect(loaded?.heroes[0].key).toBe('ana');
			expect(loaded?.updatedAt).toBeInstanceOf(Date);
		});

		it('should return null when no data is stored', () => {
			const loaded = loadOverFastData();

			expect(loaded).toBeNull();
		});

		it('should return null for corrupted data', () => {
			localStorage.setItem(STORAGE_KEY, 'invalid json{{{');
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const loaded = loadOverFastData();

			expect(loaded).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(
				'Error loading OverFast data:',
				expect.any(SyntaxError)
			);
		});

		it('should return null when the stored schema version does not match', () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					schemaVersion: SCHEMA_VERSION + 1,
					heroes: [],
					maps: [],
					updatedAt: new Date(),
				})
			);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const loaded = loadOverFastData();

			expect(loaded).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();
		});

		it('should revive updatedAt as a Date object', () => {
			const dateStr = '2025-01-15T12:00:00.000Z';
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					schemaVersion: SCHEMA_VERSION,
					heroes: [],
					maps: [],
					updatedAt: dateStr,
				})
			);

			const loaded = loadOverFastData();

			expect(loaded?.updatedAt).toBeInstanceOf(Date);
			expect(loaded?.updatedAt.toISOString()).toBe(dateStr);
		});
	});

	describe('clearOverFastData', () => {
		it('should remove data from localStorage', () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ test: true }));
			expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

			clearOverFastData();

			expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		});

		it('should not throw when no data exists', () => {
			expect(() => clearOverFastData()).not.toThrow();
		});

		it('should log and not throw when localStorage is unavailable', () => {
			vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
				throw new Error('SecurityError');
			});
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			expect(() => clearOverFastData()).not.toThrow();
			expect(consoleSpy).toHaveBeenCalledWith(
				'Error clearing OverFast data:',
				expect.any(Error)
			);
		});
	});
});
