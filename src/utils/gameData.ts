/**
 * Game data helpers: map OCR/hash-set names onto OverFast display names
 */

import type { OverFastHero, OverFastMap, OverFastStore } from '#types';

/** Hash-set hero names that differ from their OverFast keys */
export const HERO_KEY_ALIASES: Record<string, string> = {
	soldier: 'soldier-76',
};

/** Lowercases, strips accents and removes everything except letters and digits */
function _normaliseText(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]/g, '');
}

/** Levenshtein edit distance between two strings */
function _levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const curr = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		prev = curr;
	}
	return prev[b.length];
}

/** Converts a name to an OverFast-style key, e.g. "Junker Queen" to "junker-queen" */
function _slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Sorted, de-duplicated list of non-empty names */
function _uniqueSorted(names: string[]): string[] {
	return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolves a raw hero identifier (hash-set name or OCR text) to its display name
 * @param raw - Raw hero string
 * @param heroes - OverFast heroes
 * @returns Display name, or the raw string if no hero matches
 */
export function getHeroDisplayName(raw: string, heroes: OverFastHero[]): string {
	if (!raw) return raw;

	const lower = raw.trim().toLowerCase();
	const byKey = heroes.find((h) => h.key === lower);
	if (byKey) return byKey.name;

	const aliasKey = HERO_KEY_ALIASES[lower];
	if (aliasKey) {
		const byAlias = heroes.find((h) => h.key === aliasKey);
		if (byAlias) return byAlias.name;
	}

	const normalised = _normaliseText(raw);
	if (!normalised) return raw;
	const byName = heroes.find(
		(h) => _normaliseText(h.name) === normalised || _normaliseText(h.key) === normalised
	);
	return byName ? byName.name : raw;
}

/**
 * Resolves a hero display name (or raw identifier) to its hash-set name
 * Hash-set names are OverFast keys, except where HERO_KEY_ALIASES gives a shorter name
 * @param raw - Hero display name, OverFast key or hash-set name
 * @param heroes - OverFast heroes
 * @returns Hash-set hero name, or the input as an OverFast-style key if no hero matches
 */
export function getHeroKey(raw: string, heroes: OverFastHero[]): string {
	const displayName = getHeroDisplayName(raw, heroes);
	const hero = heroes.find((h) => h.name === displayName);
	if (!hero) return _slugify(raw);

	const alias = Object.keys(HERO_KEY_ALIASES).find(
		(name) => HERO_KEY_ALIASES[name] === hero.key
	);
	return alias ?? hero.key;
}

/**
 * Fuzzy-matches raw OCR map text to an OverFast map name
 * @param raw - Raw map string
 * @param maps - OverFast maps
 * @returns Closest map name within tolerance, or the raw string
 */
export function matchMapName(raw: string, maps: OverFastMap[]): string {
	if (!raw) return raw;

	const normalisedRaw = _normaliseText(raw);
	let best: { name: string; distance: number; limit: number } | null = null;

	for (const map of maps) {
		const normalisedName = _normaliseText(map.name);
		const distance = _levenshtein(normalisedRaw, normalisedName);
		if (!best || distance < best.distance) {
			best = {
				name: map.name,
				distance,
				limit: Math.max(1, Math.floor(normalisedName.length * 0.25)),
			};
		}
	}

	return best && best.distance <= best.limit ? best.name : raw;
}

/**
 * Gets sorted, unique hero display names
 * @param store - OverFast data store
 * @returns Hero names, empty if no store
 */
export function getHeroNames(store: OverFastStore | null): string[] {
	return store ? _uniqueSorted(store.heroes.map((h) => h.name)) : [];
}

/**
 * Gets sorted, unique map display names
 * @param store - OverFast data store
 * @returns Map names, empty if no store
 */
export function getMapNames(store: OverFastStore | null): string[] {
	return store ? _uniqueSorted(store.maps.map((m) => m.name)) : [];
}
