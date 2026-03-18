import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchHeroes,
	fetchMaps,
	searchPlayers,
	hashPortraitFromUrl,
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
		gamemodes: ['quickplay', 'stadium'],
	},
	{
		key: 'tracer',
		name: 'Tracer',
		portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/tracer.png',
		role: 'damage',
		gamemodes: ['quickplay', 'competitive'],
	},
];

const mockMaps: OverFastMap[] = [
	{
		key: 'aatlis',
		name: 'Aatlis',
		screenshot: 'https://overfast-api.tekrop.fr/static/maps/aatlis.jpg',
		gamemodes: ['flashpoint'],
		location: 'Morocco',
		country_code: 'MA',
	},
	{
		key: 'havana',
		name: 'Havana',
		screenshot: 'https://overfast-api.tekrop.fr/static/maps/havana.jpg',
		gamemodes: ['escort'],
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

// Mock canvas context
const mockCanvasContext = {
	drawImage: vi.fn(),
	getImageData: vi.fn(() => ({
		data: new Uint8ClampedArray(9 * 8 * 4),
		width: 9,
		height: 8,
	})),
};

// Mock canvas element
const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => mockCanvasContext),
};

// Store original createElement
const originalCreateElement = document.createElement.bind(document);

describe('overfastApi', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();

		// Mock document.createElement for canvas
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			if (tagName === 'canvas') {
				return mockCanvas as unknown as HTMLCanvasElement;
			}
			return originalCreateElement(tagName);
		});
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
			expect(heroes).toHaveLength(2);
			expect(heroes[0].key).toBe('ana');
			expect(heroes[0].role).toBe('support');
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
			expect(maps).toHaveLength(2);
			expect(maps[0].key).toBe('aatlis');
			expect(maps[1].country_code).toBeNull();
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
				`${BASE_URL}/players?name=Player%20%231234`
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

	describe('hashPortraitFromUrl', () => {
		it('should return a valid 16-character hex string', async () => {
			// Mock Image constructor to trigger onload
			const mockImage = {
				crossOrigin: '',
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};
			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				// Trigger onload asynchronously when src is set
				const proxy = new Proxy(mockImage, {
					set(target, prop, value) {
						if (prop === 'src') {
							target.src = value as string;
							// Trigger onload on next tick
							setTimeout(() => target.onload?.(), 0);
							return true;
						}
						return Reflect.set(target, prop, value);
					},
				});
				return proxy as unknown as HTMLImageElement;
			});

			const hash = await hashPortraitFromUrl('https://example.com/portrait.png');

			expect(hash).toHaveLength(16);
			expect(hash).toMatch(/^[0-9a-f]{16}$/);
		});

		it('should return fallback hash when canvas context is unavailable', async () => {
			const mockImage = {
				crossOrigin: '',
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};
			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const proxy = new Proxy(mockImage, {
					set(target, prop, value) {
						if (prop === 'src') {
							target.src = value as string;
							setTimeout(() => target.onload?.(), 0);
							return true;
						}
						return Reflect.set(target, prop, value);
					},
				});
				return proxy as unknown as HTMLImageElement;
			});

			mockCanvas.getContext.mockReturnValueOnce(null as never);

			const hash = await hashPortraitFromUrl('https://example.com/portrait.png');

			expect(hash).toBe('0000000000000000');
		});

		it('should reject when image fails to load', async () => {
			const mockImage = {
				crossOrigin: '',
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};
			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const proxy = new Proxy(mockImage, {
					set(target, prop, value) {
						if (prop === 'src') {
							target.src = value as string;
							setTimeout(() => target.onerror?.(), 0);
							return true;
						}
						return Reflect.set(target, prop, value);
					},
				});
				return proxy as unknown as HTMLImageElement;
			});

			await expect(
				hashPortraitFromUrl('https://example.com/broken.png')
			).rejects.toThrow('Failed to load image: https://example.com/broken.png');
		});

		it('should set crossOrigin to anonymous', async () => {
			let capturedCrossOrigin = '';
			const mockImage = {
				crossOrigin: '',
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};
			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const proxy = new Proxy(mockImage, {
					set(target, prop, value) {
						if (prop === 'crossOrigin') {
							capturedCrossOrigin = value as string;
						}
						if (prop === 'src') {
							target.src = value as string;
							setTimeout(() => target.onload?.(), 0);
							return true;
						}
						return Reflect.set(target, prop, value);
					},
				});
				return proxy as unknown as HTMLImageElement;
			});

			await hashPortraitFromUrl('https://example.com/portrait.png');

			expect(capturedCrossOrigin).toBe('anonymous');
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

			// Mock Image for portrait hashing
			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const mockImage = {
					crossOrigin: '',
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
				};
				const proxy = new Proxy(mockImage, {
					set(target, prop, value) {
						if (prop === 'src') {
							target.src = value as string;
							setTimeout(() => target.onload?.(), 0);
							return true;
						}
						return Reflect.set(target, prop, value);
					},
				});
				return proxy as unknown as HTMLImageElement;
			});
		}

		it('should fetch heroes and maps and save to localStorage', async () => {
			setupUpdateMocks();

			const store = await updateOverFastData();

			expect(store.heroes).toHaveLength(2);
			expect(store.maps).toHaveLength(2);
			expect(store.schemaVersion).toBe(SCHEMA_VERSION);
			expect(store.updatedAt).toBeInstanceOf(Date);

			// Verify localStorage was populated
			const stored = localStorage.getItem(STORAGE_KEY);
			expect(stored).not.toBeNull();
		});

		it('should compute portrait hashes for each hero', async () => {
			setupUpdateMocks();

			const store = await updateOverFastData();

			for (const hero of store.heroes) {
				expect(hero.portraitHash).toBeDefined();
				expect(hero.portraitHash).toHaveLength(16);
				expect(hero.portraitHash).toMatch(/^[0-9a-f]{16}$/);
			}
		});

		it('should map hero fields correctly', async () => {
			setupUpdateMocks();

			const store = await updateOverFastData();
			const ana = store.heroes.find((h) => h.key === 'ana');

			expect(ana).toBeDefined();
			expect(ana?.name).toBe('Ana');
			expect(ana?.role).toBe('support');
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
						portraitHash: 'abcdef0123456789',
						role: 'support',
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
	});
});
