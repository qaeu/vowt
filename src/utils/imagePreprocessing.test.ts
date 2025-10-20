import { describe, it, expect, vi } from 'vitest';
import { extractGameStats } from './imagePreprocessing';

const MOCK_REGION_RESULTS = new Map<string, string>([
    ['blue_player1_name', 'STARK'],
    ['blue_player1_e', '27'],
    ['blue_player1_a', '4'],
    ['blue_player1_d', '7'],
    ['blue_player1_dmg', '17542'],
    ['blue_player1_h', '0'],
    ['blue_player1_mit', '14872'],
    ['blue_player2_name', 'BABY'],
    ['blue_player2_e', '21'],
    ['blue_player2_a', '0'],
    ['blue_player2_d', '11'],
    ['blue_player2_dmg', '11603'],
    ['blue_player2_h', '27'],
    ['blue_player2_mit', '1277'],
    ['blue_player3_name', 'KAPPACAPPER'],
    ['blue_player3_e', '24'],
    ['blue_player3_a', '3'],
    ['blue_player3_d', '10'],
    ['blue_player3_dmg', '10362'],
    ['blue_player3_h', '0'],
    ['blue_player3_mit', '794'],
    ['red_player1_name', 'YAZIO'],
    ['red_player1_e', '27'],
    ['red_player1_a', '3'],
    ['red_player1_d', '10'],
    ['red_player1_dmg', '15675'],
    ['red_player1_h', '670'],
    ['red_player1_mit', '15391'],
    ['red_player2_name', 'LBBO7'],
    ['red_player2_e', '25'],
    ['red_player2_a', '5'],
    ['red_player2_d', '11'],
    ['red_player2_dmg', '12736'],
    ['red_player2_h', '0'],
    ['red_player2_mit', '48'],
    ['red_player3_name', 'TRIX'],
    ['red_player3_e', '14'],
    ['red_player3_a', '0'],
    ['red_player3_d', '9'],
    ['red_player3_dmg', '7869'],
    ['red_player3_h', '1191'],
    ['red_player3_mit', '278'],
    ['result', 'VICTORY'],
    ['final_score', 'SCORE: 3VS2'],
    ['date', 'DATE: 09/15/25 - 02:49'],
    ['game_mode', 'GAME_MODE: ESCORT'],
]);

describe('extractGameStats', () => {
    describe('with scoreboard table format', () => {
        it('should extract player stats from region results', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            expect(result).toHaveProperty('players');
            expect(result).toHaveProperty('matchInfo');
            expect(result.players).toHaveLength(6);
        });

        it('should correctly assign teams to players', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            expect(result.players[0].team).toBe('blue');
            expect(result.players[5].team).toBe('red');
        });

        it('should parse player stats correctly', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            expect(result.players[0]).toMatchObject({
                name: 'STARK',
                team: 'blue',
                e: 27,
                a: 4,
                d: 7,
                dmg: 17542,
                h: 0,
                mit: 14872,
            });
        });

        it('should extract match information', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            expect(result.matchInfo.result).toBe('VICTORY');
            expect(result.matchInfo.final_score).toEqual({
                blue: '3',
                red: '2',
            });
            expect(result.matchInfo.date).toBe('09/15/25 - 02:49');
            expect(result.matchInfo.game_mode).toBe('ESCORT');
        });

        it('should handle DEFEAT result', () => {
            const regionResults = new Map<string, string>([
                ['result', 'DEFEAT'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.matchInfo.result).toBe('DEFEAT');
        });

        it('should handle empty input', () => {
            const regionResults = new Map<string, string>();

            const result = extractGameStats(regionResults);

            expect(result.players).toHaveLength(0);
            // matchInfo has default empty result and final_score values
            expect(result.matchInfo.result).toBe('');
        });

        it('should handle malformed input gracefully', () => {
            const regionResults = new Map<string, string>();

            const result = extractGameStats(regionResults);

            expect(result).toHaveProperty('players');
            expect(result).toHaveProperty('matchInfo');
            expect(result.players).toHaveLength(0);
        });
    });

    describe('with multiple teams', () => {
        it('should separate blue and red team players', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            const bluePlayers = result.players.filter(
                (p: any) => p.team === 'blue'
            );
            const redPlayers = result.players.filter(
                (p: any) => p.team === 'red'
            );

            expect(bluePlayers).toHaveLength(3);
            expect(redPlayers).toHaveLength(3);
        });
    });

    describe('column header detection', () => {
        it('should detect standard column headers', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            expect(result.players[0]).toHaveProperty('e');
            expect(result.players[0]).toHaveProperty('a');
            expect(result.players[0]).toHaveProperty('d');
            expect(result.players[0]).toHaveProperty('dmg');
            expect(result.players[0]).toHaveProperty('h');
            expect(result.players[0]).toHaveProperty('mit');
        });
    });

    describe('edge cases', () => {
        it('should handle player names with numbers', () => {
            const regionResults = new Map<string, string>([
                ['blue_player1_name', 'PLAYER123'],
                ['blue_player1_e', '10'],
                ['blue_player1_a', '5'],
                ['blue_player1_d', '3'],
                ['blue_player1_dmg', '5000'],
                ['blue_player1_h', '100'],
                ['blue_player1_mit', '2000'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.players[0].name).toBe('PLAYER123');
        });

        it('should skip lines that do not match player pattern', () => {
            const regionResults = new Map<string, string>([
                ['blue_player1_name', 'VALID'],
                ['blue_player1_e', '10'],
                ['blue_player1_a', '5'],
                ['blue_player1_d', '3'],
                ['blue_player1_dmg', '5000'],
                ['blue_player1_h', '100'],
                ['blue_player1_mit', '2000'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.players).toHaveLength(1);
            expect(result.players[0].name).toBe('VALID');
        });

        it('should handle key-value pairs with colons in match info', () => {
            const regionResults = new Map<string, string>([
                ['date', 'DATE: 12/15/30'],
                ['final_score', 'SCORE: 3VS5'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.matchInfo.date).toBe('12/15/30');
            expect(result.matchInfo.final_score).toEqual({
                blue: '3',
                red: '5',
            });
        });
    });

    describe('numeric value parsing', () => {
        it('should parse all stats as numbers', () => {
            const result = extractGameStats(MOCK_REGION_RESULTS);

            expect(typeof result.players[0].e).toBe('number');
            expect(typeof result.players[0].a).toBe('number');
            expect(typeof result.players[0].d).toBe('number');
            expect(typeof result.players[0].dmg).toBe('number');
            expect(typeof result.players[0].h).toBe('number');
            expect(typeof result.players[0].mit).toBe('number');
        });

        it('should handle zero values', () => {
            const regionResults = new Map<string, string>([
                ['blue_player1_name', 'PLAYER'],
                ['blue_player1_e', '0'],
                ['blue_player1_a', '0'],
                ['blue_player1_d', '0'],
                ['blue_player1_dmg', '0'],
                ['blue_player1_h', '0'],
                ['blue_player1_mit', '0'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.players[0].e).toBe(0);
            expect(result.players[0].a).toBe(0);
        });
    });

    describe('case insensitivity', () => {
        it('should handle lowercase result text', () => {
            const regionResults = new Map<string, string>([
                ['result', 'victory'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.matchInfo.result).toBe('VICTORY');
        });

        it('should handle mixed case result text', () => {
            const regionResults = new Map<string, string>([
                ['result', 'ViCtOrY'],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.matchInfo.result).toBe('VICTORY');
        });
    });

    describe('whitespace handling', () => {
        it('should trim leading and trailing whitespace', () => {
            const regionResults = new Map<string, string>([
                ['blue_player1_name', ' PLAYER '],
            ]);

            const result = extractGameStats(regionResults);

            expect(result.players).toHaveLength(1);
            expect(result.players[0].name).toBe('PLAYER');
        });
    });
});
