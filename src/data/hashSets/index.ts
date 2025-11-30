import type { ImageHashSet, ExportedImageHashSet } from '#types';
import heroPortraits from './hero-portrait-hashes.json';

/**
 * Default image hash sets bundled with the app
 * Each hash set should have type: 'vowt-image-hashes' to be loaded
 */

const DATE_FIELD_NAMES = ['createdAt', 'updatedAt', 'exportedAt'];

function _reviver(key: string, value: unknown) {
	if (DATE_FIELD_NAMES.includes(key)) {
		return new Date(value as string);
	}
	return value;
}

function _convertExported(exportedHashSet: ExportedImageHashSet): ImageHashSet {
	const converted: ImageHashSet = JSON.parse(
		JSON.stringify(exportedHashSet.hashSet),
		_reviver
	);
	return converted;
}

const hashSets = [heroPortraits as ExportedImageHashSet];
export const DEFAULT_HASH_SETS: ImageHashSet[] = hashSets.map(_convertExported);
