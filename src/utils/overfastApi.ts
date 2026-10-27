/**
 * OverFast API utilities for fetching Overwatch hero, map, and player data
 */

import type {
	OverFastHero,
	OverFastMap,
	OverFastPlayerSearchOptions,
	OverFastPlayerSearchResponse,
	OverFastStore,
	StoredHero,
} from '#types';

import { dhash } from '#utils/imageRecognition';

// Constants

export const BASE_URL = 'https://overfast-api.tekrop.fr';
export const STORAGE_KEY = 'vowt_overfast_data';
export const SCHEMA_VERSION = 1;

const DATE_FIELD_NAMES = ['updatedAt'];

// Local functions

function _reviver(key: string, value: unknown) {
	if (DATE_FIELD_NAMES.includes(key)) {
		return new Date(value as string);
	}
	return value;
}

async function _fetchJson<T>(path: string, description: string): Promise<T> {
	const response = await fetch(`${BASE_URL}${path}`);

	if (!response.ok) {
		throw new Error(
			`Failed to ${description}: ${response.status} ${response.statusText}`
		);
	}

	return response.json() as Promise<T>;
}

// Exported functions

/**
 * Fetch the list of heroes from the OverFast API
 * @returns Array of hero data
 */
export async function fetchHeroes(): Promise<OverFastHero[]> {
	return _fetchJson<OverFastHero[]>('/heroes', 'fetch heroes');
}

/**
 * Fetch the list of maps from the OverFast API
 * @returns Array of map data
 */
export async function fetchMaps(): Promise<OverFastMap[]> {
	return _fetchJson<OverFastMap[]>('/maps', 'fetch maps');
}

/**
 * Search for players by name via the OverFast API
 * @param name - Player name or BattleTag to search for
 * @param options - Optional pagination and ordering parameters
 * @returns Paginated search results
 */
export async function searchPlayers(
	name: string,
	options: OverFastPlayerSearchOptions = {}
): Promise<OverFastPlayerSearchResponse> {
	const params = new URLSearchParams({ name });
	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined) {
			params.set(key, String(value));
		}
	}

	return _fetchJson<OverFastPlayerSearchResponse>(
		`/players?${params.toString()}`,
		'search players'
	);
}

/**
 * Load an image from a URL and compute its dHash for perceptual comparison
 * Requires the image host to send CORS headers, otherwise loading or pixel access fails
 * @param url - Image URL to hash
 * @returns 16-character hex hash string
 * @throws If the image cannot be loaded, drawn, or read
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
		throw new Error('Canvas 2D context unavailable');
	}

	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	ctx.drawImage(img, 0, 0);

	return dhash(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

/**
 * Fetch heroes and maps from the OverFast API, compute portrait hashes, and persist to localStorage
 * Heroes whose portrait cannot be hashed are stored with a null portraitHash
 * @returns The stored OverFast data
 */
export async function updateOverFastData(): Promise<OverFastStore> {
	try {
		const [heroes, maps] = await Promise.all([fetchHeroes(), fetchMaps()]);

		const hashResults = await Promise.allSettled(
			heroes.map((hero) => hashPortraitFromUrl(hero.portrait))
		);

		const storedHeroes: StoredHero[] = heroes.map((hero, i) => {
			const result = hashResults[i];
			if (result.status === 'rejected') {
				console.warn(`Failed to hash portrait for ${hero.key}:`, result.reason);
			}

			return {
				key: hero.key,
				name: hero.name,
				portrait: hero.portrait,
				portraitHash: result.status === 'fulfilled' ? result.value : null,
				role: hero.role,
				subrole: hero.subrole,
				gamemodes: hero.gamemodes,
			};
		});

		const storedMaps: OverFastMap[] = maps.map((map) => ({
			key: map.key,
			name: map.name,
			screenshot: map.screenshot,
			gamemodes: map.gamemodes,
			uses: map.uses,
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
 * @returns The stored data, or null if not found, outdated, or on error
 */
export function loadOverFastData(): OverFastStore | null {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) {
			return null;
		}

		const stored: OverFastStore = JSON.parse(data, _reviver);

		// Handle schema version for future migrations
		if (stored.schemaVersion !== SCHEMA_VERSION) {
			console.error(
				`Stored OverFast data uses schema version ${stored.schemaVersion}, expected ${SCHEMA_VERSION}`
			);
			return null;
		}

		return stored;
	} catch (error) {
		console.error('Error loading OverFast data:', error);
		return null;
	}
}

/**
 * Remove persisted OverFast API data from localStorage
 */
export function clearOverFastData(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (error) {
		console.error('Error clearing OverFast data:', error);
	}
}
