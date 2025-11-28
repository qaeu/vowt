/**
 * Image recognition utilities for perceptual hashing and comparison
 */

import type { ImageHash } from '#types';
import heroPortraitHashes from '#data/hero-portrait-hashes.json';

const DEFAULT_HASH_THRESHOLD = 10;

/**
 * Recognises an image by computing its dHash and comparing against known hero hashes
 * @param imageData - Image data to compare
 * @param threshold - Maximum Hamming distance for a match (default: 10)
 * @returns The matched image ID or empty string if no match found
 */
export function recogniseImage(
	imageData: ImageData,
	threshold: number = DEFAULT_HASH_THRESHOLD
): string {
	const regionHash = dhash(imageData);

	// Find best match from hero portrait hashes
	const hashes = heroPortraitHashes.hashes as ImageHash[];
	let bestMatch = '';
	let bestDistance = Infinity;

	for (const { id, hash } of hashes) {
		const distance = hamDist(regionHash, hash);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestMatch = id;
		}
	}

	// Return match only if within threshold
	return bestDistance <= threshold ? bestMatch : '';
}

/**
 * Computes a difference hash (dHash) for an image
 * Creates a 64-bit perceptual hash based on horizontal gradient patterns
 * @param imageData - Image data to hash
 * @returns 16-character hexadecimal hash string
 */
export function dhash(imageData: ImageData): string {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return '0'.repeat(16);
	}

	// Resize to 9x8 (9 wide for 8 horizontal comparisons per row)
	const hashWidth = 9;
	const hashHeight = 8;

	canvas.width = hashWidth;
	canvas.height = hashHeight;

	// Create temporary canvas with original image
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');

	if (!tempCtx) {
		return '0'.repeat(16);
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
	for (let y = 0; y < hashHeight; y++) {
		for (let x = 0; x < hashWidth - 1; x++) {
			const leftIdx = y * hashWidth + x;
			const rightIdx = y * hashWidth + x + 1;
			// 1 if left pixel is brighter than right pixel, 0 otherwise
			hash += grayscale[leftIdx] > grayscale[rightIdx] ? '1' : '0';
		}
	}

	// Convert 64-bit binary string to 16-character hex string
	const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');

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
