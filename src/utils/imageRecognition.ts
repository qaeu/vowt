/**
 * Image recognition utilities for perceptual hashing and comparison
 */

import type { ImageHashSet } from '#types';

const DEFAULT_HASH_SIZE = 8;
const DEFAULT_THRESHOLD = 0.4;
// const BACKGROUND_RED_COLOUR = '#8a2130';
// const BACKGROUND_BLUE_COLOUR = '#166b90';

interface RecognitionResult {
	name: string;
	confidence: number;
}

/**
 * Recognises an image by computing its dHash and comparing against a set of known hashes
 * @param imageData - Image data to compare
 * @param hashSet - Set of hashes to compare against
 * @param threshold - Minimum similarity score for a match (0-1, default: 0.85)
 * @returns Object with matched image ID (or empty string if no match) and confidence (0-100)
 */
export function recogniseImage(
	imageData: ImageData,
	hashSet: ImageHashSet,
	threshold: number = DEFAULT_THRESHOLD
): RecognitionResult {
	const regionHash = dhash(imageData);
	const hashBits = DEFAULT_HASH_SIZE ** 2;

	// Find best match from provided hash set
	let bestMatch = '';
	let bestSimilarity = 0;

	for (const { name, hash } of hashSet.hashes) {
		const distance = hamDist(regionHash, hash);
		const similarity = 1 - distance / hashBits;
		if (similarity > bestSimilarity) {
			bestSimilarity = similarity;
			bestMatch = name;
		}
	}

	// Scale confidence: 50% similarity (random chance) = 0%, 100% similarity = 100%
	const confidence = Math.round(Math.max(0, bestSimilarity - 0.5) * 200);
	// Return match only if within threshold
	return {
		name: confidence >= threshold * 100 ? bestMatch : '',
		confidence,
	};
}

/**
 * Computes a difference hash (dHash) for an image
 * Creates a perceptual hash based on horizontal gradient patterns
 * @param imageData - Image data to hash
 * @param hashSize - Size of the hash grid (default: 8, produces 64-bit hash)
 * @returns Hexadecimal hash string
 */
export function dhash(
	imageData: ImageData,
	hashSize: number = DEFAULT_HASH_SIZE
): string {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return '0'.repeat(hashSize ** 2 / 4);
	}

	// Resize to (hashSize+1) x hashSize for horizontal comparisons
	const hashWidth = hashSize + 1;
	const hashHeight = hashSize;

	canvas.width = hashWidth;
	canvas.height = hashHeight;

	// Create temporary canvas with original image
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');

	if (!tempCtx) {
		return '0'.repeat(hashSize ** 2 / 4);
	}

	tempCanvas.width = imageData.width;
	tempCanvas.height = imageData.height;
	tempCtx.putImageData(imageData, 0, 0);

	// Draw resized image
	ctx.drawImage(tempCanvas, 0, 0, hashWidth, hashHeight);

	const resizedData = ctx.getImageData(0, 0, hashWidth, hashHeight);
	const pixels = resizedData.data;

	// Convert to grayscale values
	const grayscale: number[] = [];
	for (let i = 0; i < pixels.length; i += 4) {
		// Luminance formula: 0.299R + 0.587G + 0.114B
		const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
		grayscale.push(gray);
	}

	// Compute difference hash (compare left pixel to right pixel)
	let hash = '';
	for (let y = 0; y < hashSize; y++) {
		for (let x = 0; x < hashSize; x++) {
			const index = y * hashWidth + x;
			const left = grayscale[index];
			const right = grayscale[index + 1];
			// 1 if left pixel is brighter than right pixel, 0 otherwise
			hash += left > right ? '1' : '0';
		}
	}

	// Convert binary string to hex string
	// Process in 4 bit chunks to avoid 53-bit positive integer precision limit
	let hexHash = '';
	for (let i = 0; i < hash.length; i += 4) {
		hexHash += parseInt(hash.slice(i, i + 4), 2).toString(16);
	}

	return hexHash;
}

/**
 * Computes the Hamming distance between two hash strings
 * Counts the number of differing bits between two hashes
 * @param hashA - First hash string (hexadecimal)
 * @param hashB - Second hash string (hexadecimal)
 * @returns Number of differing bits (0 = identical, higher = more different)
 */
export function hamDist(hashA: string, hashB: string): number {
	if (hashA.length !== hashB.length) {
		throw new Error('Hash strings must be the same length');
	}

	let distance = 0;

	for (let i = 0; i < hashA.length; i++) {
		const a = parseInt(hashA[i], 16);
		const b = parseInt(hashB[i], 16);

		// XOR to find differing bits, then count them
		let xor = a ^ b;
		while (xor > 0) {
			distance += xor & 1;
			xor >>= 1;
		}
	}

	return distance;
}
