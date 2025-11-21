import type { TextRegion } from '#types';
import { describe, it, expect } from 'vitest';
import {
    normaliseRegion,
    getScoreboardRegions,
    getMatchInfoRegions,
    REFERENCE_WIDTH,
    REFERENCE_HEIGHT,
} from '#utils/textRegions';

describe('textRegions', () => {
    describe('normalizeRegion', () => {
        it('should not modify regions when dimensions match reference', () => {
            const region: TextRegion = {
                name: 'test_region',
                x: 100,
                y: 200,
                width: 300,
                height: 60,
            };

            const normalized = normaliseRegion(
                region,
                REFERENCE_WIDTH,
                REFERENCE_HEIGHT
            );

            expect(normalized).toEqual(region);
        });

        it('should scale down coordinates for smaller resolution (1920x1080)', () => {
            const region: TextRegion = {
                name: 'test_region',
                x: 2560,
                y: 1440,
                width: 100,
                height: 50,
            };

            const normalized = normaliseRegion(region, 1920, 1080);

            // 1920/2560 = 0.75, 1080/1440 = 0.75
            expect(normalized.x).toBe(1920); // 2560 * 0.75
            expect(normalized.y).toBe(1080); // 1440 * 0.75
            expect(normalized.width).toBe(75); // 100 * 0.75
            expect(normalized.height).toBe(38); // 50 * 0.75, rounded
        });

        it('should scale up coordinates for larger resolution (3840x2160)', () => {
            const region: TextRegion = {
                name: 'test_region',
                x: 100,
                y: 100,
                width: 200,
                height: 100,
            };

            const normalized = normaliseRegion(region, 3840, 2160);

            // 3840/2560 = 1.5, 2160/1440 = 1.5
            expect(normalized.x).toBe(150); // 100 * 1.5
            expect(normalized.y).toBe(150); // 100 * 1.5
            expect(normalized.width).toBe(300); // 200 * 1.5
            expect(normalized.height).toBe(150); // 100 * 1.5
        });

        it('should round coordinates to nearest integer', () => {
            const region: TextRegion = {
                name: 'test_region',
                x: 333,
                y: 333,
                width: 333,
                height: 333,
            };

            const normalized = normaliseRegion(region, 1000, 1000);

            // All values should be integers
            expect(Number.isInteger(normalized.x)).toBe(true);
            expect(Number.isInteger(normalized.y)).toBe(true);
            expect(Number.isInteger(normalized.width)).toBe(true);
            expect(Number.isInteger(normalized.height)).toBe(true);
        });

        it('should preserve other region properties', () => {
            const region: TextRegion = {
                name: 'test_region',
                x: 100,
                y: 200,
                width: 300,
                height: 60,
                charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                isItalic: true,
            };

            const normalized = normaliseRegion(region, 1920, 1080);

            expect(normalized.name).toBe('test_region');
            expect(normalized.charSet).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
            expect(normalized.isItalic).toBe(true);
        });
    });

    describe('getScoreboardRegions', () => {
        it('should return regions without normalization when using reference dimensions', () => {
            const regions = getScoreboardRegions(
                REFERENCE_WIDTH,
                REFERENCE_HEIGHT
            );

            expect(regions).toBeDefined();
            expect(regions.length).toBeGreaterThan(0);
            // Check that we have all expected regions (10 players * 7 stats each = 70 regions)
            expect(regions.length).toBe(70);
        });

        it('should return regions without normalization when dimensions are omitted', () => {
            const regions = getScoreboardRegions();

            expect(regions).toBeDefined();
            expect(regions.length).toBe(70);
        });

        it('should normalize regions for different resolution (1920x1080)', () => {
            const referenceRegions = getScoreboardRegions();
            const normalizedRegions = getScoreboardRegions(1920, 1080);

            expect(normalizedRegions.length).toBe(referenceRegions.length);

            // Check first region is scaled correctly
            const scaleX = 1920 / REFERENCE_WIDTH;
            const scaleY = 1080 / REFERENCE_HEIGHT;

            expect(normalizedRegions[0].x).toBe(
                Math.round(referenceRegions[0].x * scaleX)
            );
            expect(normalizedRegions[0].y).toBe(
                Math.round(referenceRegions[0].y * scaleY)
            );
            expect(normalizedRegions[0].width).toBe(
                Math.round(referenceRegions[0].width * scaleX)
            );
            expect(normalizedRegions[0].height).toBe(
                Math.round(referenceRegions[0].height * scaleY)
            );
        });

        it('should preserve region names and properties', () => {
            const regions = getScoreboardRegions(1920, 1080);

            // Check that specific regions exist with correct names
            const bluePlayer1Name = regions.find(
                (r) => r.name === 'blue_player1_name'
            );
            expect(bluePlayer1Name).toBeDefined();
            expect(bluePlayer1Name?.isItalic).toBe(true);

            const bluePlayer1E = regions.find(
                (r) => r.name === 'blue_player1_e'
            );
            expect(bluePlayer1E).toBeDefined();
            expect(bluePlayer1E?.charSet).toBe('0123456789');
        });
    });

    describe('getMatchInfoRegions', () => {
        it('should return match info regions without normalization when using reference dimensions', () => {
            const regions = getMatchInfoRegions(
                REFERENCE_WIDTH,
                REFERENCE_HEIGHT
            );

            expect(regions).toBeDefined();
            expect(regions.length).toBe(5);
        });

        it('should return match info regions without normalization when dimensions are omitted', () => {
            const regions = getMatchInfoRegions();

            expect(regions).toBeDefined();
            expect(regions.length).toBe(5);
        });

        it('should normalize match info regions for different resolution', () => {
            const referenceRegions = getMatchInfoRegions();
            const normalizedRegions = getMatchInfoRegions(1920, 1080);

            expect(normalizedRegions.length).toBe(referenceRegions.length);

            // Check first region is scaled correctly
            const scaleX = 1920 / REFERENCE_WIDTH;
            const scaleY = 1080 / REFERENCE_HEIGHT;

            expect(normalizedRegions[0].x).toBe(
                Math.round(referenceRegions[0].x * scaleX)
            );
            expect(normalizedRegions[0].y).toBe(
                Math.round(referenceRegions[0].y * scaleY)
            );
            expect(normalizedRegions[0].width).toBe(
                Math.round(referenceRegions[0].width * scaleX)
            );
            expect(normalizedRegions[0].height).toBe(
                Math.round(referenceRegions[0].height * scaleY)
            );
        });

        it('should preserve region names and properties in match info', () => {
            const regions = getMatchInfoRegions(1920, 1080);

            const regionNames = regions.map((r) => r.name);
            expect(regionNames).toContain('result');
            expect(regionNames).toContain('final_score');
            expect(regionNames).toContain('date');
            expect(regionNames).toContain('game_mode');
            expect(regionNames).toContain('game_length');

            const resultRegion = regions.find((r) => r.name === 'result');
            expect(resultRegion?.isItalic).toBe(true);
        });
    });

    describe('coordinate scaling consistency', () => {
        it('should maintain relative positions after scaling', () => {
            const referenceRegions = getScoreboardRegions();
            const normalizedRegions = getScoreboardRegions(1920, 1080);

            // Check that blue_player1_e is to the right of blue_player1_name
            const refPlayer1Name = referenceRegions.find(
                (r) => r.name === 'blue_player1_name'
            );
            const refPlayer1E = referenceRegions.find(
                (r) => r.name === 'blue_player1_e'
            );

            const normPlayer1Name = normalizedRegions.find(
                (r) => r.name === 'blue_player1_name'
            );
            const normPlayer1E = normalizedRegions.find(
                (r) => r.name === 'blue_player1_e'
            );

            // Relative positions should be maintained
            expect(refPlayer1E!.x).toBeGreaterThan(
                refPlayer1Name!.x + refPlayer1Name!.width
            );
            expect(normPlayer1E!.x).toBeGreaterThan(
                normPlayer1Name!.x + normPlayer1Name!.width
            );
        });
    });
});
