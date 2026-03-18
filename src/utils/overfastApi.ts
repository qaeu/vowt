/**
 * OverFast API utilities for fetching Overwatch hero, map, and player data
 */

import type {
	OverFastHero,
	OverFastMap,
	OverFastPlayerSearchResponse,
	OverFastStore,
	StoredHero,
	StoredMap,
} from '#types';

// Constants

export const BASE_URL = 'https://overfast-api.tekrop.fr';
export const STORAGE_KEY = 'vowt_overfast_data';
export const SCHEMA_VERSION = 1;

const HASH_SIZE = 8;
const DATE_FIELD_NAMES = ['updatedAt'];

// Local functions

function _reviver(key: string, value: unknown) {
	if (DATE_FIELD_NAMES.includes(key)) {
		return new Date(value as string);
	}
	return value;
}

// Exported functions

/**
 * Fetch the list of heroes from the OverFast API
 * @returns Array of hero data
 */
export async function fetchHeroes(): Promise<OverFastHero[]> {
	const response = await fetch(`${BASE_URL}/heroes`);

	if (!response.ok) {
		throw new Error(`Failed to fetch heroes: ${response.status} ${response.statusText}`);
	}

	return response.json() as Promise<OverFastHero[]>;
}

/**
 * Fetch the list of maps from the OverFast API
 * @returns Array of map data
 */
export async function fetchMaps(): Promise<OverFastMap[]> {
	const response = await fetch(`${BASE_URL}/maps`);

	if (!response.ok) {
		throw new Error(`Failed to fetch maps: ${response.status} ${response.statusText}`);
	}

	return response.json() as Promise<OverFastMap[]>;
}

/**
 * Search for players by name via the OverFast API
 * @param name - Player name to search for
 * @returns Paginated search results
 */
export async function searchPlayers(name: string): Promise<OverFastPlayerSearchResponse> {
	const response = await fetch(`${BASE_URL}/players?name=${encodeURIComponent(name)}`);

	if (!response.ok) {
		throw new Error(`Failed to search players: ${response.status} ${response.statusText}`);
	}

	return response.json() as Promise<OverFastPlayerSearchResponse>;
}

/**
 * Load an image from a URL and compute its dHash for perceptual comparison
 * @param url - Image URL to hash
 * @returns 16-character hex hash string
 */
export async function hashPortraitFromUrl(url: string): Promise<string> {
	const img = new Image();
	img.crossOrigin = 'anonymous';

	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
		img.src = url;
	});

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return '0'.repeat(HASH_SIZE ** 2 / 4);
	}

	const hashWidth = HASH_SIZE + 1;
	const hashHeight = HASH_SIZE;

	canvas.width = hashWidth;
	canvas.height = hashHeight;

	ctx.drawImage(img, 0, 0, hashWidth, hashHeight);

	const resizedData = ctx.getImageData(0, 0, hashWidth, hashHeight);
	const pixels = resizedData.data;

	// Convert to grayscale values using luminance formula
	const grayscale: number[] = [];
	for (let i = 0; i < pixels.length; i += 4) {
		const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
		grayscale.push(gray);
	}

	// Compute difference hash (compare left pixel to right pixel)
	let hash = '';
	for (let y = 0; y < hashHeight; y++) {
		for (let x = 0; x < HASH_SIZE; x++) {
			const index = y * hashWidth + x;
			const left = grayscale[index];
			const right = grayscale[index + 1];
			hash += left > right ? '1' : '0';
		}
	}

	// Convert binary string to hex string in 4-bit chunks
	let hexHash = '';
	for (let i = 0; i < hash.length; i += 4) {
		hexHash += parseInt(hash.slice(i, i + 4), 2).toString(16);
	}

	return hexHash;
}

/**
 * Fetch heroes and maps from the OverFast API, compute portrait hashes, and persist to localStorage
 * @returns The stored OverFast data
 */
export async function updateOverFastData(): Promise<OverFastStore> {
	try {
		const [heroes, maps] = await Promise.all([fetchHeroes(), fetchMaps()]);

		const storedHeroes: StoredHero[] = await Promise.all(
			heroes.map(async (hero) => {
				const portraitHash = await hashPortraitFromUrl(hero.portrait);
				return {
					key: hero.key,
					name: hero.name,
					portrait: hero.portrait,
					portraitHash,
					role: hero.role,
					gamemodes: hero.gamemodes,
				};
			})
		);

		const storedMaps: StoredMap[] = maps.map((map) => ({
			key: map.key,
			name: map.name,
			screenshot: map.screenshot,
			gamemodes: map.gamemodes,
			location: map.location,
			country_code: map.country_code,
		}));

		const store: OverFastStore = {
			schemaVersion: SCHEMA_VERSION,
			heroes: storedHeroes,
			maps: storedMaps,
			updatedAt: new Date(),
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
		return store;
	} catch (error) {
		console.error('Error updating OverFast data:', error);
		throw error;
	}
}

/**
 * Load persisted OverFast API data from localStorage
 * @returns The stored data, or null if not found or on error
 */
export function loadOverFastData(): OverFastStore | null {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) {
			return null;
		}

		return JSON.parse(data, _reviver) as OverFastStore;
	} catch (error) {
		console.error('Error loading OverFast data:', error);
		return null;
	}
}

/**
 * Remove persisted OverFast API data from localStorage
 */
export function clearOverFastData(): void {
	localStorage.removeItem(STORAGE_KEY);
}
