/**
 * OverFast API client for fetching Overwatch hero and map data
 * @see https://overfast-api.tekrop.fr
 */

import type {
	OverFastHero,
	OverFastMap,
	OverFastStore,
	StoredHero,
	StoredMap,
} from '#types';

const API_BASE_URL = 'https://overfast-api.tekrop.fr';
const HEROES_ENDPOINT = '/heroes';
const MAPS_ENDPOINT = '/maps';

const STORAGE_KEY = 'vowt_overfast_data';
const SCHEMA_VERSION = 1;

const DEFAULT_HASH_SIZE = 8;

const DATE_FIELD_NAMES = ['updatedAt'];

// Storage

function _reviver(key: string, value: unknown) {
	if (DATE_FIELD_NAMES.includes(key)) {
		return new Date(value as string);
	}
	return value;
}

function _loadStore(): OverFastStore {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) {
			return _emptyStore();
		}

		const stored: OverFastStore = JSON.parse(data, _reviver);

		if (stored.schemaVersion !== SCHEMA_VERSION) {
			console.error(
				`Stored OverFast data uses schema version ${stored.schemaVersion}, expected ${SCHEMA_VERSION}`
			);
			return _emptyStore();
		}

		return stored;
	} catch (error) {
		console.error('Error loading OverFast data:', error);
		return _emptyStore();
	}
}

function _saveStore(store: OverFastStore): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function _emptyStore(): OverFastStore {
	return {
		schemaVersion: SCHEMA_VERSION,
		heroes: [],
		maps: [],
		updatedAt: new Date(0),
	};
}

// API fetching

/**
 * Fetch the hero list from the OverFast API
 * @returns Array of hero data from the API
 */
export async function fetchHeroes(): Promise<OverFastHero[]> {
	const response = await fetch(`${API_BASE_URL}${HEROES_ENDPOINT}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch heroes: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch the map list from the OverFast API
 * @returns Array of map data from the API
 */
export async function fetchMaps(): Promise<OverFastMap[]> {
	const response = await fetch(`${API_BASE_URL}${MAPS_ENDPOINT}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch maps: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch a hero portrait image and compute its dHash
 * @param portraitUrl - URL of the hero portrait image
 * @returns Hexadecimal dHash string, or null if hashing fails
 */
export async function fetchPortraitHash(portraitUrl: string): Promise<string | null> {
	try {
		const response = await fetch(portraitUrl);
		if (!response.ok) {
			return null;
		}

		const blob = await response.blob();
		const bitmap = await createImageBitmap(blob);

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			return null;
		}

		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		ctx.drawImage(bitmap, 0, 0);

		const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		return _dhashFromImageData(imageData);
	} catch (error) {
		console.error(`Error hashing portrait from ${portraitUrl}:`, error);
		return null;
	}
}

/**
 * Compute a dHash from ImageData (self-contained for portrait hashing)
 * Uses the same algorithm as imageRecognition.ts dhash()
 * @param imageData - Raw image pixel data
 * @param hashSize - Size of the hash grid (default: 8, produces 64-bit hash)
 * @returns Hexadecimal hash string
 */
export function _dhashFromImageData(
	imageData: ImageData,
	hashSize: number = DEFAULT_HASH_SIZE
): string {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return '0'.repeat(hashSize ** 2 / 4);
	}

	const hashWidth = hashSize + 1;
	const hashHeight = hashSize;

	canvas.width = hashWidth;
	canvas.height = hashHeight;

	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');

	if (!tempCtx) {
		return '0'.repeat(hashSize ** 2 / 4);
	}

	tempCanvas.width = imageData.width;
	tempCanvas.height = imageData.height;
	tempCtx.putImageData(imageData, 0, 0);

	ctx.drawImage(tempCanvas, 0, 0, hashWidth, hashHeight);

	const resizedData = ctx.getImageData(0, 0, hashWidth, hashHeight);
	const pixels = resizedData.data;

	const grayscale: number[] = [];
	for (let i = 0; i < pixels.length; i += 4) {
		const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
		grayscale.push(gray);
	}

	let hash = '';
	for (let y = 0; y < hashSize; y++) {
		for (let x = 0; x < hashSize; x++) {
			const index = y * hashWidth + x;
			const left = grayscale[index];
			const right = grayscale[index + 1];
			hash += left > right ? '1' : '0';
		}
	}

	let hexHash = '';
	for (let i = 0; i < hash.length; i += 4) {
		hexHash += parseInt(hash.slice(i, i + 4), 2).toString(16);
	}

	return hexHash;
}

// Data management

/**
 * Fetch heroes from the API and store to localStorage
 * Optionally hashes hero portraits for image matching
 * @param hashPortraits - Whether to fetch and hash hero portrait images (default: true)
 * @returns The stored hero list
 */
export async function fetchAndStoreHeroes(hashPortraits: boolean = true): Promise<StoredHero[]> {
	const apiHeroes = await fetchHeroes();

	const storedHeroes: StoredHero[] = [];

	for (const hero of apiHeroes) {
		let portraitHash: string | null = null;

		if (hashPortraits && hero.portrait) {
			portraitHash = await fetchPortraitHash(hero.portrait);
		}

		storedHeroes.push({
			key: hero.key,
			name: hero.name,
			portrait: hero.portrait,
			role: hero.role,
			gamemodes: hero.gamemodes,
			portraitHash,
		});
	}

	const store = _loadStore();
	store.heroes = storedHeroes;
	store.updatedAt = new Date();
	_saveStore(store);

	return storedHeroes;
}

/**
 * Fetch maps from the API and store to localStorage
 * @returns The stored map list
 */
export async function fetchAndStoreMaps(): Promise<StoredMap[]> {
	const apiMaps = await fetchMaps();

	const storedMaps: StoredMap[] = apiMaps.map((map) => ({
		key: map.key,
		name: map.name,
		screenshot: map.screenshot,
		gamemodes: map.gamemodes,
		location: map.location,
		country_code: map.country_code,
	}));

	const store = _loadStore();
	store.maps = storedMaps;
	store.updatedAt = new Date();
	_saveStore(store);

	return storedMaps;
}

/**
 * Load stored hero data from localStorage
 * @returns Array of stored heroes, or empty array if none stored
 */
export function loadHeroes(): StoredHero[] {
	return _loadStore().heroes;
}

/**
 * Load stored map data from localStorage
 * @returns Array of stored maps, or empty array if none stored
 */
export function loadMaps(): StoredMap[] {
	return _loadStore().maps;
}

/**
 * Get the timestamp of the last OverFast data update
 * @returns Date of last update, or epoch if never updated
 */
export function getLastUpdated(): Date {
	return _loadStore().updatedAt;
}

/**
 * Clear all stored OverFast API data from localStorage
 */
export function clearApiData(): void {
	localStorage.removeItem(STORAGE_KEY);
}
