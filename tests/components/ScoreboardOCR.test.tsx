import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import ScoreboardOCR from '#c/ScoreboardOCR';

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
vi.mock('#utils/preprocess', () => ({
    preprocessImageForOCR: vi
        .fn()
        .mockResolvedValue('data:image/png;base64,mockdata'),
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

vi.mock('#utils/postprocess', () => ({
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
}));

describe('ScoreboardOCR', () => {
    it('should render the component', () => {
        const { getByText } = render(() => <ScoreboardOCR />);
        expect(getByText('Upload Scoreboard Screenshot')).toBeDefined();
    });

    it('should render upload button', () => {
        const { getByText } = render(() => <ScoreboardOCR />);

        const uploadButton = getByText(/Upload Image/);
        expect(uploadButton).toBeDefined();
    });

    it('should not render original image section', () => {
        const { queryByText, queryByAltText } = render(() => <ScoreboardOCR />);
        expect.soft(queryByText('Original Image')).toBeNull();
        expect.soft(queryByAltText('Original scoreboard')).toBeNull();
    });

    describe('when uploadedImage is provided', () => {
        it('should render original image section', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { getByText, getByAltText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            expect(getByText('Uploaded Image')).not.toBeNull();
            expect(getByAltText('Uploaded Image')).not.toBeNull();
        });

        it('should show processing indicator when uploadedImage is provided', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { queryByText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            // Check for processing text (may be brief)
            const processingText = queryByText(/Processing image/);
            expect(processingText).not.toBeNull();
        });

        it('should display preprocessed image after processing uploaded image', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { getByText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            await waitFor(
                () => {
                    expect(getByText('Pre-processed Image')).not.toBeNull();
                },
                { timeout: 3000 }
            );
        });

        it('should display raw OCR text output with uploaded image', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { getByText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            await waitFor(
                () => {
                    expect(getByText('Raw OCR Text Output')).not.toBeNull();
                },
                { timeout: 3000 }
            );
        });

        it('should display extracted game stats JSON with uploaded image', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { getByText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            await waitFor(
                () => {
                    expect(
                        getByText('Extracted Game Stats (JSON)')
                    ).not.toBeNull();
                },
                { timeout: 3000 }
            );
        });

        it('should have collapsible JSON stats section', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { queryByText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            await waitFor(
                () => {
                    const jsonHeader = queryByText(
                        /Extracted Game Stats \(JSON\)/
                    );
                    expect(jsonHeader).not.toBeNull();
                },
                { timeout: 3000 }
            );
        });

        it('should have collapsible raw text section', async () => {
            const testImageData = 'data:image/png;base64,testdata';
            const { queryByText } = render(() => (
                <ScoreboardOCR uploadedImage={testImageData} />
            ));

            await waitFor(
                () => {
                    expect(queryByText(/Raw OCR Text Output/)).not.toBeNull();
                },
                { timeout: 3000 }
            );
        });
    });
});
