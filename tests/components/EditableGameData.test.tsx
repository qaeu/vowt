import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import type { PlayerStats, MatchInfo } from '#types';
import EditableGameData from '#c/EditableGameData';

describe('EditableGameData', () => {
    const mockPlayers: PlayerStats[] = [
        {
            name: 'BluePlayer1',
            team: 'blue',
            e: '10',
            a: '5',
            d: '2',
            dmg: '15000',
            h: '8000',
            mit: '12000',
        },
        {
            name: 'BluePlayer2',
            team: 'blue',
            e: '8',
            a: '6',
            d: '3',
            dmg: '12000',
            h: '7000',
            mit: '10000',
        },
        {
            name: 'Player2',
            team: 'blue',
            e: '12',
            a: '3',
            d: '8',
            dmg: '18000',
            h: '6000',
            mit: '9000',
            hero: 'Reinhardt',
        },
        {
            name: 'Player3',
            team: 'red',
            e: '5',
            a: '9',
            d: '1',
            dmg: '8000',
            h: '4000',
            mit: '5000',
            hero: 'Widowmaker',
        },
    ];

    const mockMatchInfo: MatchInfo = {
        result: 'VICTORY',
        final_score: { blue: '3', red: '2' },
        date: '10/21/2025',
        game_mode: 'ESCORT',
        game_length: '10:30',
        map: 'Lijiang Tower',
    };

    let onSaveMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onSaveMock = vi.fn();
    });

    it('should render match information fields', () => {
        render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        expect(screen.getByText('Match Information')).toBeTruthy();
        expect(screen.getByText('Result:')).toBeTruthy();
        expect(screen.getByText('Score (Blue):')).toBeTruthy();
        expect(screen.getByText('Score (Red):')).toBeTruthy();
        expect(screen.getByText('Date:')).toBeTruthy();
        expect(screen.getByText('Game Mode:')).toBeTruthy();
        expect(screen.getByText('Length:')).toBeTruthy();
    });

    it('should render player statistics for both teams', () => {
        render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        expect(screen.getByText('Match Information')).toBeTruthy();
        expect(screen.getByText('Blue Team')).toBeTruthy();
        expect(screen.getByText('Red Team')).toBeTruthy();
    });

    it('should display action buttons when showActions is not false', () => {
        const { container } = render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                showActions={true}
                onSave={onSaveMock}
            />
        ));

        // Edit a field to trigger the appearance of action buttons
        const inputs = Array.from(
            container.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        fireEvent.input(resultInput, { target: { value: 'DEFEAT' } });

        expect(screen.getByText('Match Information')).toBeTruthy();
        expect(screen.getByText(/Save to Records/)).toBeTruthy();
        expect(screen.getByText(/Reset Changes/)).toBeTruthy();
    });

    it('should not display action buttons when showActions is false', () => {
        render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                showActions={false}
                onSave={onSaveMock}
            />
        ));

        expect(
            screen.queryByText('Extracted Game Data - Review and Edit')
        ).toBeNull();
        expect(screen.queryByText(/Save to Records/)).toBeNull();
        expect(screen.queryByText(/Reset Changes/)).toBeNull();
    });

    it('should apply just-saved class when fields are just saved', () => {
        const { container } = render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        // Find and edit the result input
        const inputs = Array.from(
            container.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        fireEvent.input(resultInput, { target: { value: 'DEFEAT' } });

        // Click save button
        const saveButton = screen.getByText(/Save to Records/);
        fireEvent.click(saveButton);

        // After save, the onSaveMock should be called with the updated data
        expect(onSaveMock).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({ result: 'DEFEAT' })
        );
    });

    it('should apply modified class when fields are modified', () => {
        const { container } = render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        // Find and edit the result input to trigger modified state
        const inputs = Array.from(
            container.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        fireEvent.input(resultInput, { target: { value: 'DEFEAT' } });

        // The input should now have the modified class
        expect(resultInput.classList.contains('modified')).toBe(true);
    });

    it('should update match info field when edited', () => {
        const { container } = render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        // Find the result input in the match info section
        const inputs = Array.from(
            container.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        expect(resultInput).toBeTruthy();
        expect(resultInput.value).toBe('VICTORY');

        fireEvent.input(resultInput, { target: { value: 'DEFEAT' } });

        // Click save to verify onSave is called with the updated value
        const saveButton = screen.getByText(/Save to Records/);
        fireEvent.click(saveButton);

        expect(onSaveMock).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({ result: 'DEFEAT' })
        );
    });

    it('should update player field when edited', () => {
        const { container } = render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        const nameInputs: HTMLInputElement[] = Array.from(
            container.querySelectorAll('input[type="text"]')
        );
        const bluePlayer1Input = nameInputs.find(
            (input) => input.value === 'BluePlayer1'
        ) as HTMLInputElement;

        expect(bluePlayer1Input).toBeTruthy();
        fireEvent.input(bluePlayer1Input, {
            target: { value: 'UpdatedPlayer' },
        });

        // Click save to verify onSave is called with the updated player
        const saveButton = screen.getByText(/Save to Records/);
        fireEvent.click(saveButton);

        expect(onSaveMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ name: 'UpdatedPlayer' }),
            ]),
            expect.any(Object)
        );
    });

    it('should call onSave when save button is clicked', () => {
        render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        // First, edit a field to make the save button appear
        const inputs = Array.from(
            document.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        fireEvent.input(resultInput, { target: { value: 'DEFEAT' } });

        const saveButton = screen.getByText(/Save to Records/);
        fireEvent.click(saveButton);
        expect(onSaveMock).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({ result: 'DEFEAT' })
        );
    });

    it('should reset changes when cancel button is clicked', () => {
        render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        // First, edit a field to make the cancel button appear
        const inputs = Array.from(
            document.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        fireEvent.input(resultInput, { target: { value: 'DEFEAT' } });

        const cancelButton = screen.getByText(/Reset Changes/);
        fireEvent.click(cancelButton);

        // After reset, the input should revert to its original value
        expect(resultInput.value).toBe('VICTORY');
    });

    it('should render correct number of players for each team', () => {
        const { container } = render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        const tables = container.querySelectorAll('table');
        // We have 2 tables (one for blue, one for red)
        expect(tables.length).toBe(2);

        // Check that we have correct number of rows (excluding header)
        const blueTable = tables[0];
        const blueRows = blueTable.querySelectorAll('tbody tr');
        expect(blueRows.length).toBe(3); // 3 blue players

        const redTable = tables[1];
        const redRows = redTable.querySelectorAll('tbody tr');
        expect(redRows.length).toBe(1); // 1 red player
    });

    it('should hide action buttons when there are no modified fields', () => {
        render(() => (
            <EditableGameData
                initialPlayers={mockPlayers}
                initialMatchInfo={mockMatchInfo}
                onSave={onSaveMock}
            />
        ));

        // Initially, there should be no unsaved changes, so buttons should not appear
        const saveButton = screen.queryByText(
            /Save to Records/
        ) as HTMLButtonElement;
        const cancelButton = screen.queryByText(
            /Reset Changes/
        ) as HTMLButtonElement;

        expect.soft(saveButton).toBeNull();
        expect.soft(cancelButton).toBeNull();
    });
});
