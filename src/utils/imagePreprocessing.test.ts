import { describe, it, expect, vi } from 'vitest';
import { extractGameStats } from './imagePreprocessing';

describe('extractGameStats', () => {
  describe('with scoreboard table format', () => {
    it('should extract player stats from scoreboard text', () => {
      const ocrText = `SCOREBOARD
E A D DMG H MIT
STARK 27 4 7 17542 0 14872
BABY 21 0 11 11603 27 1277
KAPPACAPPER 24 3 10 10362 0 794
VS
YAZIO 27 3 10 15675 670 15391
LBBO7 25 5 11 12736 0 48
TRIX 14 0 9 7869 1191 278
VICTORY
FINAL SCORE: 3 VS 2
DATE: 09/15/25 - 02:49
GAME MODE: ESCORT`;

      const result = extractGameStats(ocrText);

      expect(result).toHaveProperty('players');
      expect(result).toHaveProperty('matchInfo');
      expect(result.players).toHaveLength(6);
    });

    it('should correctly assign teams to players', () => {
      const ocrText = `SCOREBOARD
E A D DMG H MIT
STARK 27 4 7 17542 0 14872
VS
YAZIO 27 3 10 15675 670 15391`;

      const result = extractGameStats(ocrText);

      expect(result.players[0].team).toBe('blue');
      expect(result.players[1].team).toBe('red');
    });

    it('should parse player stats correctly', () => {
      const ocrText = `SCOREBOARD
E A D DMG H MIT
STARK 27 4 7 17542 0 14872`;

      const result = extractGameStats(ocrText);

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
      const ocrText = `VICTORY
FINAL SCORE: 3 VS 2
DATE: 09/15/25 - 02:49
GAME MODE: ESCORT`;

      const result = extractGameStats(ocrText);

      expect(result.matchInfo).toMatchObject({
        result: 'VICTORY',
        final_score: '3 VS 2',
        date: '09/15/25 - 02:49',
        game_mode: 'ESCORT',
      });
    });

    it('should handle DEFEAT result', () => {
      const ocrText = `DEFEAT`;

      const result = extractGameStats(ocrText);

      expect(result.matchInfo.result).toBe('DEFEAT');
    });

    it('should handle empty input', () => {
      const result = extractGameStats('');

      expect(result.players).toHaveLength(0);
      expect(result.matchInfo).toEqual({});
    });

    it('should handle malformed input gracefully', () => {
      const ocrText = `Random text
No structure
Just garbage`;

      const result = extractGameStats(ocrText);

      expect(result).toHaveProperty('players');
      expect(result).toHaveProperty('matchInfo');
      expect(result.players).toHaveLength(0);
    });
  });

  describe('with multiple teams', () => {
    it('should separate blue and red team players', () => {
      const ocrText = `E A D DMG H MIT
PLAYER1 10 5 3 5000 100 2000
PLAYER2 15 8 2 6000 200 3000
VS
PLAYER3 12 6 4 5500 150 2500
PLAYER4 18 9 1 7000 250 3500`;

      const result = extractGameStats(ocrText);

      const bluePlayers = result.players.filter((p: any) => p.team === 'blue');
      const redPlayers = result.players.filter((p: any) => p.team === 'red');

      expect(bluePlayers).toHaveLength(2);
      expect(redPlayers).toHaveLength(2);
    });
  });

  describe('column header detection', () => {
    it('should detect standard column headers', () => {
      const ocrText = `E A D DMG H MIT
PLAYER1 10 5 3 5000 100 2000`;

      const result = extractGameStats(ocrText);

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
      const ocrText = `E A D DMG H MIT
PLAYER123 10 5 3 5000 100 2000`;

      const result = extractGameStats(ocrText);

      expect(result.players[0].name).toBe('PLAYER123');
    });

    it('should skip lines that do not match player pattern', () => {
      const ocrText = `E A D DMG H MIT
INVALID LINE WITHOUT NUMBERS
VALID 10 5 3 5000 100 2000
ANOTHER INVALID`;

      const result = extractGameStats(ocrText);

      expect(result.players).toHaveLength(1);
      expect(result.players[0].name).toBe('VALID');
    });

    it('should handle key-value pairs with colons in match info', () => {
      const ocrText = `TIME: 12:45:30
SCORE: 10:5`;

      const result = extractGameStats(ocrText);

      expect(result.matchInfo.time).toBe('12:45:30');
      expect(result.matchInfo.score).toBe('10:5');
    });

    it('should ignore SCOREBOARD header', () => {
      const ocrText = `SCOREBOARD
E A D DMG H MIT`;

      const result = extractGameStats(ocrText);

      expect(result.players).toHaveLength(0);
    });
  });

  describe('numeric value parsing', () => {
    it('should parse all stats as numbers', () => {
      const ocrText = `E A D DMG H MIT
PLAYER 27 4 7 17542 0 14872`;

      const result = extractGameStats(ocrText);

      expect(typeof result.players[0].e).toBe('number');
      expect(typeof result.players[0].a).toBe('number');
      expect(typeof result.players[0].d).toBe('number');
      expect(typeof result.players[0].dmg).toBe('number');
      expect(typeof result.players[0].h).toBe('number');
      expect(typeof result.players[0].mit).toBe('number');
    });

    it('should handle zero values', () => {
      const ocrText = `E A D DMG H MIT
PLAYER 0 0 0 0 0 0`;

      const result = extractGameStats(ocrText);

      expect(result.players[0].e).toBe(0);
      expect(result.players[0].a).toBe(0);
    });
  });

  describe('case insensitivity', () => {
    it('should handle lowercase result text', () => {
      const ocrText = `victory`;

      const result = extractGameStats(ocrText);

      expect(result.matchInfo.result).toBe('VICTORY');
    });

    it('should handle mixed case result text', () => {
      const ocrText = `ViCtOrY`;

      const result = extractGameStats(ocrText);

      expect(result.matchInfo.result).toBe('VICTORY');
    });
  });

  describe('whitespace handling', () => {
    it('should handle extra whitespace between values', () => {
      const ocrText = `E A D DMG H MIT
PLAYER 10 5 3 5000 100 2000`;

      const result = extractGameStats(ocrText);

      expect(result.players).toHaveLength(1);
      expect(result.players[0].e).toBe(10);
      expect(result.players[0].a).toBe(5);
    });

    it('should trim leading and trailing whitespace', () => {
      const ocrText = `E A D DMG H MIT
PLAYER 10 5 3 5000 100 2000`;

      const result = extractGameStats(ocrText);

      expect(result.players).toHaveLength(1);
      expect(result.players[0].name).toBe('PLAYER');
    });
  });
});
