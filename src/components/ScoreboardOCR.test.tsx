import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import ScoreboardOCR from './ScoreboardOCR';

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
    default: {
        createWorker: vi.fn().mockResolvedValue({
            recognize: vi.fn().mockResolvedValue({
                data: {
                    text: 'VICTORY',
                },
            }),
            terminate: vi.fn().mockResolvedValue(undefined),
            setParameters: vi.fn().mockResolvedValue(undefined),
        }),
        PSM: { SINGLE_WORD: 'word' },
    },
}));

// Mock the image preprocessing module
vi.mock('../utils/imagePreprocessing', () => ({
    preprocessImageForOCR: vi
        .fn()
        .mockResolvedValue('data:image/png;base64,mockdata'),
    extractGameStats: vi.fn().mockReturnValue({
        players: [
            {
                name: 'VEQ',
                team: 'blue',
                e: 10,
                a: 4,
                d: 3,
                dmg: 15542,
                h: 12345,
                mit: 500,
            },
        ],
        matchInfo: {
            result: 'VICTORY',
            final_score: '3VS2',
            date: '09/15/25 - 02:49',
            game_mode: 'ESCORT',
        },
    }),
    drawRegionsOnImage: vi
        .fn()
        .mockResolvedValue('data:image/png;base64,regionmockdata'),
    getScoreboardRegions: vi
        .fn()
        .mockReturnValue([
            { name: 'region_0', x: 0, y: 0, width: 100, height: 100 },
        ]),
    getMatchInfoRegions: vi
        .fn()
        .mockReturnValue([
            { name: 'region_1', x: 0, y: 0, width: 100, height: 100 },
        ]),
}));

describe('ScoreboardOCR', () => {
    it('should render the component', () => {
        render(() => <ScoreboardOCR />);
        expect(
            screen.getByText('Overwatch Scoreboard Tracker POC')
        ).toBeDefined();
    });

    it('should display POC demo message', () => {
        render(() => <ScoreboardOCR />);
        expect(screen.getByText(/POC Demo:/)).toBeDefined();
        expect(screen.getByText(/region-based OCR/)).toBeDefined();
    });

    it('should render original image section', () => {
        render(() => <ScoreboardOCR />);
        expect(screen.getByText('Original Image')).toBeDefined();
        expect(screen.getByAltText('Original scoreboard')).toBeDefined();
    });

    it('should show processing indicator initially', async () => {
        render(() => <ScoreboardOCR />);

        // Check for processing text (may be brief)
        const processingText = screen.queryByText(/Processing image/);
        expect(processingText).toBeDefined();
    });

    it('should display preprocessed image after processing', async () => {
        render(() => <ScoreboardOCR />);

        await waitFor(
            () => {
                expect(
                    screen.getByText('Preprocessed (Regions + Unskew)')
                ).toBeDefined();
            },
            { timeout: 3000 }
        );
    });

    it('should display raw OCR text output', async () => {
        render(() => <ScoreboardOCR />);

        await waitFor(
            () => {
                expect(screen.getByText('Raw OCR Text Output')).toBeDefined();
            },
            { timeout: 3000 }
        );
    });

    it('should display extracted game stats JSON', async () => {
        render(() => <ScoreboardOCR />);

        await waitFor(
            () => {
                expect(
                    screen.getByText('Extracted Game Stats (JSON)')
                ).toBeDefined();
            },
            { timeout: 3000 }
        );
    });

    it('should display success message with count', async () => {
        render(() => <ScoreboardOCR />);

        await waitFor(
            () => {
                const successText = screen.queryByText(
                    /Successfully parsed .* data fields/
                );
                expect(successText).toBeDefined();
            },
            { timeout: 3000 }
        );
    });

    it('should have correct image sources', () => {
        render(() => <ScoreboardOCR />);

        const originalImage = screen.getByAltText(
            'Original scoreboard'
        ) as HTMLImageElement;
        expect(originalImage.src).toContain('/scoreboard.png');
    });

    it('should render upload button', () => {
        render(() => <ScoreboardOCR />);

        const uploadButton = screen.getByText(/Upload Image/);
        expect(uploadButton).toBeDefined();
    });

    it('should accept uploadedImage prop', async () => {
        const testImageData = 'data:image/png;base64,testdata';
        render(() => <ScoreboardOCR uploadedImage={testImageData} />);

        await waitFor(
            () => {
                const originalImage = screen.getByAltText(
                    'Original scoreboard'
                ) as HTMLImageElement;
                expect(originalImage.src).toBe(testImageData);
            },
            { timeout: 3000 }
        );
    });

    it('should use default image when no uploadedImage prop is provided', () => {
        render(() => <ScoreboardOCR uploadedImage={null} />);

        const originalImage = screen.getByAltText(
            'Original scoreboard'
        ) as HTMLImageElement;
        expect(originalImage.src).toContain('/scoreboard.png');
    });

    it('should have collapsible JSON stats section', async () => {
        render(() => <ScoreboardOCR />);

        await waitFor(
            () => {
                const jsonHeader = screen.queryByText(/Extracted Game Stats \(JSON\)/);
                expect(jsonHeader).toBeDefined();
            },
            { timeout: 3000 }
        );
    });

    it('should have collapsible raw text section', async () => {
        render(() => <ScoreboardOCR />);

        await waitFor(
            () => {
                const rawTextHeader = screen.queryByText(/Raw OCR Text Output/);
                expect(rawTextHeader).toBeDefined();
            },
            { timeout: 3000 }
        );
    });
});
