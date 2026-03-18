import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OverFastHero, OverFastMap, StoredHero, StoredMap } from '#types';
import {
	fetchHeroes,
	fetchMaps,
	fetchPortraitHash,
	fetchAndStoreHeroes,
	fetchAndStoreMaps,
	loadHeroes,
	loadMaps,
	getLastUpdated,
	clearApiData,
	_dhashFromImageData,
} from '#utils/overfastApi';

// Mock canvas context
const mockCanvasContext = {
	drawImage: vi.fn(),
	getImageData: vi.fn(() => ({
		data: new Uint8ClampedArray(9 * 8 * 4),
		width: 9,
		height: 8,
	})),
	putImageData: vi.fn(),
};

// Mock canvas element
const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => mockCanvasContext),
};

// Store original createElement
const originalCreateElement = document.createElement.bind(document);

// Sample API responses
const mockHeroesResponse: OverFastHero[] = [
	{
		key: 'ana',
		name: 'Ana',
		portrait: 'https://example.com/ana.png',
		role: 'support',
		gamemodes: ['quickplay', 'stadium'],
	},
	{
		key: 'tracer',
		name: 'Tracer',
		portrait: 'https://example.com/tracer.png',
		role: 'damage',
		gamemodes: ['quickplay', 'stadium'],
	},
	{
		key: 'reinhardt',
		name: 'Reinhardt',
		portrait: 'https://example.com/reinhardt.png',
		role: 'tank',
		gamemodes: ['quickplay'],
	},
];

const mockMapsResponse: OverFastMap[] = [
	{
		key: 'kings-row',
		name: "King's Row",
		screenshot: 'https://example.com/kings-row.jpg',
		gamemodes: ['hybrid'],
		location: 'London, England',
		country_code: 'GB',
	},
	{
		key: 'dorado',
		name: 'Dorado',
		screenshot: 'https://example.com/dorado.jpg',
		gamemodes: ['escort'],
		location: 'Dorado, Mexico',
		country_code: 'MX',
	},
];

describe('overfastApi', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearApiData();

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
		it('should fetch heroes from the API', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockHeroesResponse),
			} as Response);

			const heroes = await fetchHeroes();

			expect(heroes).toEqual(mockHeroesResponse);
			expect(fetch).toHaveBeenCalledWith('https://overfast-api.tekrop.fr/heroes');
		});

		it('should throw on non-OK response', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			} as Response);

			await expect(fetchHeroes()).rejects.toThrow(
				'Failed to fetch heroes: 500 Internal Server Error'
			);
		});

		it('should throw on network error', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

			await expect(fetchHeroes()).rejects.toThrow('Network error');
		});
	});

	describe('fetchMaps', () => {
		it('should fetch maps from the API', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMapsResponse),
			} as Response);

			const maps = await fetchMaps();

			expect(maps).toEqual(mockMapsResponse);
			expect(fetch).toHaveBeenCalledWith('https://overfast-api.tekrop.fr/maps');
		});

		it('should throw on non-OK response', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
			} as Response);

			await expect(fetchMaps()).rejects.toThrow(
				'Failed to fetch maps: 429 Too Many Requests'
			);
		});
	});

	describe('fetchPortraitHash', () => {
		it('should return null on fetch failure', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 404,
			} as Response);

			const hash = await fetchPortraitHash('https://example.com/missing.png');

			expect(hash).toBeNull();
		});

		it('should return null on network error', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

			const hash = await fetchPortraitHash('https://example.com/missing.png');

			expect(hash).toBeNull();
		});
	});

	describe('_dhashFromImageData', () => {
		it('should return a 16-character hex string for default hash size', () => {
			const width = 100;
			const height = 100;
			const data = new Uint8ClampedArray(width * height * 4).fill(128);
			const imageData = {
				data,
				width,
				height,
				colorSpace: 'srgb',
			} as ImageData;

			const hash = _dhashFromImageData(imageData);

			expect(hash).toHaveLength(16);
			expect(hash).toMatch(/^[0-9a-f]{16}$/);
		});

		it('should return consistent hash for same image data', () => {
			const width = 50;
			const height = 50;
			const data = new Uint8ClampedArray(width * height * 4).fill(200);
			const imageData1 = {
				data: new Uint8ClampedArray(data),
				width,
				height,
				colorSpace: 'srgb',
			} as ImageData;
			const imageData2 = {
				data: new Uint8ClampedArray(data),
				width,
				height,
				colorSpace: 'srgb',
			} as ImageData;

			const hash1 = _dhashFromImageData(imageData1);
			const hash2 = _dhashFromImageData(imageData2);

			expect(hash1).toBe(hash2);
		});

		it('should support custom hash sizes', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = {
				data,
				width: 100,
				height: 100,
				colorSpace: 'srgb',
			} as ImageData;

			const hash4 = _dhashFromImageData(imageData, 4);
			expect(hash4).toHaveLength(4);
			expect(hash4).toMatch(/^[0-9a-f]{4}$/);
		});

		it('should return fallback hash when canvas context unavailable', () => {
			mockCanvas.getContext.mockReturnValueOnce(null as never);

			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = {
				data,
				width: 100,
				height: 100,
				colorSpace: 'srgb',
			} as ImageData;

			const hash = _dhashFromImageData(imageData);

			expect(hash).toBe('0000000000000000');
		});
	});

	describe('fetchAndStoreHeroes', () => {
		it('should fetch heroes and store them to localStorage', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockHeroesResponse),
				blob: () =>
					Promise.resolve(new Blob([new Uint8Array(100)], { type: 'image/png' })),
			} as Response);

			// createImageBitmap doesn't exist in jsdom, define it as a mock
			globalThis.createImageBitmap = vi.fn().mockResolvedValue({
				width: 100,
				height: 100,
				close: vi.fn(),
			} as unknown as ImageBitmap);

			const heroes = await fetchAndStoreHeroes();

			expect(heroes).toHaveLength(3);
			expect(heroes[0].key).toBe('ana');
			expect(heroes[0].name).toBe('Ana');
			expect(heroes[0].role).toBe('support');
			expect(typeof heroes[0].portraitHash).toBe('string');

			// Verify data is persisted
			const loaded = loadHeroes();
			expect(loaded).toHaveLength(3);
			expect(loaded[0].key).toBe('ana');
		});

		it('should store heroes without hashing when hashPortraits is false', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockHeroesResponse),
			} as Response);

			const heroes = await fetchAndStoreHeroes(false);

			expect(heroes).toHaveLength(3);
			expect(heroes[0].portraitHash).toBeNull();
			expect(heroes[1].portraitHash).toBeNull();
			expect(heroes[2].portraitHash).toBeNull();

			// Only 1 fetch call for the heroes list (no portrait fetches)
			expect(fetch).toHaveBeenCalledTimes(1);
		});

		it('should propagate API errors', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 503,
				statusText: 'Service Unavailable',
			} as Response);

			await expect(fetchAndStoreHeroes()).rejects.toThrow(
				'Failed to fetch heroes: 503 Service Unavailable'
			);
		});
	});

	describe('fetchAndStoreMaps', () => {
		it('should fetch maps and store them to localStorage', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMapsResponse),
			} as Response);

			const maps = await fetchAndStoreMaps();

			expect(maps).toHaveLength(2);
			expect(maps[0].key).toBe('kings-row');
			expect(maps[0].name).toBe("King's Row");
			expect(maps[0].gamemodes).toEqual(['hybrid']);
			expect(maps[0].country_code).toBe('GB');
			expect(maps[1].key).toBe('dorado');

			// Verify data is persisted
			const loaded = loadMaps();
			expect(loaded).toHaveLength(2);
			expect(loaded[0].key).toBe('kings-row');
		});

		it('should propagate API errors', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			} as Response);

			await expect(fetchAndStoreMaps()).rejects.toThrow(
				'Failed to fetch maps: 500 Internal Server Error'
			);
		});
	});

	describe('loadHeroes', () => {
		it('should return empty array when no data is stored', () => {
			const heroes = loadHeroes();
			expect(heroes).toEqual([]);
		});

		it('should return stored heroes', () => {
			const testHeroes: StoredHero[] = [
				{
					key: 'mercy',
					name: 'Mercy',
					portrait: 'https://example.com/mercy.png',
					role: 'support',
					gamemodes: ['quickplay', 'stadium'],
					portraitHash: 'abcdef0123456789',
				},
			];

			localStorage.setItem(
				'vowt_overfast_data',
				JSON.stringify({
					schemaVersion: 1,
					heroes: testHeroes,
					maps: [],
					updatedAt: new Date().toISOString(),
				})
			);

			const heroes = loadHeroes();
			expect(heroes).toHaveLength(1);
			expect(heroes[0].key).toBe('mercy');
			expect(heroes[0].portraitHash).toBe('abcdef0123456789');
		});
	});

	describe('loadMaps', () => {
		it('should return empty array when no data is stored', () => {
			const maps = loadMaps();
			expect(maps).toEqual([]);
		});

		it('should return stored maps', () => {
			const testMaps: StoredMap[] = [
				{
					key: 'hanamura',
					name: 'Hanamura',
					screenshot: 'https://example.com/hanamura.jpg',
					gamemodes: ['assault'],
					location: 'Tokyo, Japan',
					country_code: 'JP',
				},
			];

			localStorage.setItem(
				'vowt_overfast_data',
				JSON.stringify({
					schemaVersion: 1,
					heroes: [],
					maps: testMaps,
					updatedAt: new Date().toISOString(),
				})
			);

			const maps = loadMaps();
			expect(maps).toHaveLength(1);
			expect(maps[0].key).toBe('hanamura');
		});
	});

	describe('getLastUpdated', () => {
		it('should return epoch when no data is stored', () => {
			const lastUpdated = getLastUpdated();
			expect(lastUpdated.getTime()).toBe(0);
		});

		it('should return the stored updatedAt timestamp', () => {
			const timestamp = new Date('2025-06-15T12:00:00Z');

			localStorage.setItem(
				'vowt_overfast_data',
				JSON.stringify({
					schemaVersion: 1,
					heroes: [],
					maps: [],
					updatedAt: timestamp.toISOString(),
				})
			);

			const lastUpdated = getLastUpdated();
			expect(lastUpdated.getTime()).toBe(timestamp.getTime());
		});
	});

	describe('clearApiData', () => {
		it('should clear stored API data', () => {
			localStorage.setItem(
				'vowt_overfast_data',
				JSON.stringify({
					schemaVersion: 1,
					heroes: mockHeroesResponse,
					maps: mockMapsResponse,
					updatedAt: new Date().toISOString(),
				})
			);

			clearApiData();

			expect(loadHeroes()).toEqual([]);
			expect(loadMaps()).toEqual([]);
		});

		it('should not throw when no data exists', () => {
			expect(() => clearApiData()).not.toThrow();
		});
	});

	describe('storage resilience', () => {
		it('should handle corrupted localStorage data gracefully', () => {
			localStorage.setItem('vowt_overfast_data', 'invalid json');

			const heroes = loadHeroes();
			expect(heroes).toEqual([]);
		});

		it('should handle schema version mismatch gracefully', () => {
			localStorage.setItem(
				'vowt_overfast_data',
				JSON.stringify({
					schemaVersion: 999,
					heroes: [{ key: 'old-hero', name: 'Old Hero' }],
					maps: [],
					updatedAt: new Date().toISOString(),
				})
			);

			const heroes = loadHeroes();
			expect(heroes).toEqual([]);
		});

		it('should preserve existing data when updating heroes only', async () => {
			// Store maps first
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMapsResponse),
			} as Response);

			await fetchAndStoreMaps();

			// Then store heroes
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockHeroesResponse),
			} as Response);

			await fetchAndStoreHeroes(false);

			// Both should be available
			expect(loadHeroes()).toHaveLength(3);
			expect(loadMaps()).toHaveLength(2);
		});

		it('should preserve existing data when updating maps only', async () => {
			// Store heroes first
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockHeroesResponse),
			} as Response);

			await fetchAndStoreHeroes(false);

			// Then store maps
			vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMapsResponse),
			} as Response);

			await fetchAndStoreMaps();

			// Both should be available
			expect(loadHeroes()).toHaveLength(3);
			expect(loadMaps()).toHaveLength(2);
		});
	});
});
