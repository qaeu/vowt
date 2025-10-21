import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ScoreboardOCR from './ScoreboardOCR';

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
    default: {
        createWorker: vi.fn().mockResolvedValue({
            recognize: vi.fn().mockResolvedValue({
                data: {
                    text: 'TEST',
                    confidence: 80,
                },
            }),
            terminate: vi.fn().mockResolvedValue(undefined),
            setParameters: vi.fn().mockResolvedValue(undefined),
        }),
        PSM: { SINGLE_LINE: 'line' },
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
                name: 'Player1',
                team: 'blue',
                e: 10,
                a: 5,
                d: 2,
                dmg: 15000,
                h: 8000,
                mit: 12000,
            },
            {
                name: 'Player2',
                team: 'red',
                e: 8,
                a: 6,
                d: 3,
                dmg: 12000,
                h: 7000,
                mit: 10000,
            },
        ],
        matchInfo: {
            result: 'VICTORY',
            final_score: { blue: '3', red: '2' },
            date: '10/21/2025',
            game_mode: 'ESCORT',
            game_length: '10:30',
        },
    }),
    drawRegionsOnImage: vi
        .fn()
        .mockResolvedValue('data:image/png;base64,regionmockdata'),
    getScoreboardRegions: vi.fn().mockReturnValue([
        {
            name: 'blue_player1_name',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            charSet: 'ABC',
        },
    ]),
    getMatchInfoRegions: vi.fn().mockReturnValue([
        {
            name: 'result',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            charSet: 'ABC',
        },
    ]),
}));

// Mock gameStorage
vi.mock('../utils/gameStorage', () => ({
    saveGameRecord: vi.fn().mockReturnValue({
        id: 'test-id',
        timestamp: Date.now(),
        players: [],
        matchInfo: {},
        version: 1,
    }),
}));

describe('ScoreboardOCR - Editable Table', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should display editable table after OCR extraction', async () => {
        const uploadedImage = 'data:image/png;base64,testimage';
        const { container } = render(() => (
            <ScoreboardOCR uploadedImage={uploadedImage} />
        ));

        // Wait for OCR processing to complete
        await vi.waitFor(
            () => {
                const heading = screen.queryByText(
                    'Extracted Game Data - Review and Edit'
                );
                expect(heading).toBeTruthy();
            },
            { timeout: 5000 }
        );

        // Check that editable table is shown
        expect(
            screen.getByText('Extracted Game Data - Review and Edit')
        ).toBeTruthy();
    });

    it('should show save and cancel buttons', async () => {
        const uploadedImage = 'data:image/png;base64,testimage';
        render(() => <ScoreboardOCR uploadedImage={uploadedImage} />);

        await vi.waitFor(
            () => {
                const saveButton = screen.queryByText(/Save to Records/);
                expect(saveButton).toBeTruthy();
            },
            { timeout: 5000 }
        );

        expect(screen.getByText(/Save to Records/)).toBeTruthy();
        expect(screen.getByText(/Reset Changes/)).toBeTruthy();
    });

    it('should display match info fields', async () => {
        const uploadedImage = 'data:image/png;base64,testimage';
        render(() => <ScoreboardOCR uploadedImage={uploadedImage} />);

        await vi.waitFor(
            () => {
                const matchInfoHeading = screen.queryByText('Match Information');
                expect(matchInfoHeading).toBeTruthy();
            },
            { timeout: 5000 }
        );

        expect(screen.getByText('Match Information')).toBeTruthy();
        expect(screen.getByText('Result:')).toBeTruthy();
        expect(screen.getByText('Score (Blue):')).toBeTruthy();
        expect(screen.getByText('Score (Red):')).toBeTruthy();
        expect(screen.getByText('Date:')).toBeTruthy();
        expect(screen.getByText('Game Mode:')).toBeTruthy();
        expect(screen.getByText('Length:')).toBeTruthy();
    });

    it('should display player tables for both teams', async () => {
        const uploadedImage = 'data:image/png;base64,testimage';
        render(() => <ScoreboardOCR uploadedImage={uploadedImage} />);

        await vi.waitFor(
            () => {
                const playerStats = screen.queryByText('Player Statistics');
                expect(playerStats).toBeTruthy();
            },
            { timeout: 5000 }
        );

        expect(screen.getByText('Player Statistics')).toBeTruthy();
        expect(screen.getByText('Blue Team')).toBeTruthy();
        expect(screen.getByText('Red Team')).toBeTruthy();
    });

    it('should allow editing player name', async () => {
        const uploadedImage = 'data:image/png;base64,testimage';
        const { container } = render(() => (
            <ScoreboardOCR uploadedImage={uploadedImage} />
        ));

        await vi.waitFor(
            () => {
                const inputs = container.querySelectorAll('input[type="text"]');
                expect(inputs.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );

        // Find player name input
        const nameInputs = Array.from(
            container.querySelectorAll('input[type="text"]')
        );
        const playerNameInput = nameInputs.find(
            (input: any) => input.value === 'Player1'
        ) as HTMLInputElement;

        expect(playerNameInput).toBeTruthy();
        if (playerNameInput) {
            fireEvent.input(playerNameInput, {
                target: { value: 'UpdatedPlayer' },
            });
            expect(playerNameInput.value).toBe('UpdatedPlayer');
        }
    });

    it('should show unsaved changes message when data is edited', async () => {
        const uploadedImage = 'data:image/png;base64,testimage';
        const { container } = render(() => (
            <ScoreboardOCR uploadedImage={uploadedImage} />
        ));

        await vi.waitFor(
            () => {
                const unsavedMsg = screen.queryByText(/unsaved changes/i);
                expect(unsavedMsg).toBeTruthy();
            },
            { timeout: 5000 }
        );

        // Should show unsaved changes message initially after extraction
        expect(screen.getByText(/unsaved changes/i)).toBeTruthy();
    });
});
