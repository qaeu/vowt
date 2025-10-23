import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import EditableGameData from '#c/EditableGameData';
import { PlayerStats, MatchInfo } from '#utils/gameStorage';

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
            name: 'RedPlayer1',
            team: 'red',
            e: '7',
            a: '4',
            d: '4',
            dmg: '11000',
            h: '6000',
            mit: '9000',
        },
        {
            name: 'RedPlayer2',
            team: 'red',
            e: '9',
            a: '7',
            d: '1',
            dmg: '13000',
            h: '5000',
            mit: '8000',
        },
    ];

    const mockMatchInfo: MatchInfo = {
        result: 'VICTORY',
        final_score: { blue: '3', red: '2' },
        date: '10/21/2025',
        game_mode: 'ESCORT',
        game_length: '10:30',
    };

    let onPlayerUpdateMock: ReturnType<typeof vi.fn>;
    let onMatchInfoUpdateMock: ReturnType<typeof vi.fn>;
    let onSaveMock: ReturnType<typeof vi.fn>;
    let onCancelMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onPlayerUpdateMock = vi.fn();
        onMatchInfoUpdateMock = vi.fn();
        onSaveMock = vi.fn();
        onCancelMock = vi.fn();
    });

    it('should render match information fields', () => {
        render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
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
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
            />
        ));

        expect(screen.getByText('Match Information')).toBeTruthy();
        expect(screen.getByText('Blue Team')).toBeTruthy();
        expect(screen.getByText('Red Team')).toBeTruthy();
    });

    it('should display action buttons when showActions is not false', () => {
        render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                modifiedFields={{
                    players: new Set(['0:name']),
                    matchInfo: new Set(),
                }}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
                onSave={onSaveMock}
                onCancel={onCancelMock}
            />
        ));

        expect(screen.getByText('Match Information')).toBeTruthy();
        expect(screen.getByText(/Save to Records/)).toBeTruthy();
        expect(screen.getByText(/Reset Changes/)).toBeTruthy();
    });

    it('should not display action buttons when showActions is false', () => {
        render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                showActions={false}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
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
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                justSavedFields={{
                    players: new Set(),
                    matchInfo: new Set(['result']),
                }}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
            />
        ));

        const inputs = Array.from(
            container.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        expect(resultInput.classList.contains('just-saved')).toBe(true);
    });

    it('should apply modified class when fields are modified', () => {
        const { container } = render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                modifiedFields={{
                    players: new Set(),
                    matchInfo: new Set(['result']),
                }}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
            />
        ));

        const inputs = Array.from(
            container.querySelectorAll('.match-info-edit input[type="text"]')
        );
        const resultInput = inputs[0] as HTMLInputElement;
        expect(resultInput.classList.contains('modified')).toBe(true);
    });

    it('should call onMatchInfoUpdate when match info field is edited', () => {
        const { container } = render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
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
        expect(onMatchInfoUpdateMock).toHaveBeenCalledWith('result', 'DEFEAT');
    });

    it('should call onPlayerUpdate when player field is edited', () => {
        const { container } = render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
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

        expect(onPlayerUpdateMock).toHaveBeenCalledWith(
            0,
            'name',
            'UpdatedPlayer'
        );
    });

    it('should call onSave when save button is clicked', () => {
        render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                modifiedFields={{
                    players: new Set(['0:name']),
                    matchInfo: new Set(),
                }}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
                onSave={onSaveMock}
                onCancel={onCancelMock}
            />
        ));

        const saveButton = screen.getByText(/Save to Records/);
        fireEvent.click(saveButton);
        expect(onSaveMock).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
        render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                modifiedFields={{
                    players: new Set(['0:name']),
                    matchInfo: new Set(),
                }}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
                onSave={onSaveMock}
                onCancel={onCancelMock}
            />
        ));

        const cancelButton = screen.getByText(/Reset Changes/);
        fireEvent.click(cancelButton);
        expect(onCancelMock).toHaveBeenCalled();
    });

    it('should render correct number of players for each team', () => {
        const { container } = render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
            />
        ));

        const tables = container.querySelectorAll('table');
        // We have 2 tables (one for blue, one for red)
        expect(tables.length).toBe(2);

        // Check that we have correct number of rows (excluding header)
        const blueTable = tables[0];
        const blueRows = blueTable.querySelectorAll('tbody tr');
        expect(blueRows.length).toBe(2); // 2 blue players

        const redTable = tables[1];
        const redRows = redTable.querySelectorAll('tbody tr');
        expect(redRows.length).toBe(2); // 2 red players
    });

    it('should hide action buttons when there are no modified fields', () => {
        render(() => (
            <EditableGameData
                players={mockPlayers}
                matchInfo={mockMatchInfo}
                modifiedFields={{
                    players: new Set(),
                    matchInfo: new Set(),
                }}
                onPlayerUpdate={onPlayerUpdateMock}
                onMatchInfoUpdate={onMatchInfoUpdateMock}
                onSave={onSaveMock}
                onCancel={onCancelMock}
            />
        ));

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
