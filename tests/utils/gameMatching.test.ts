import { describe, it, expect } from 'vitest';

import type { GameRecord, MatchInfo, PlayerStats } from '#types';
import { findMatchingRecord, mergeGameStats } from '#utils/gameMatching';
import type { GameStats } from '#utils/gameMatching';

const BLUE = ['QAEU', 'TRACER0', 'MERCYMAIN', 'BIGTANK', 'ZENFAN'];
const RED = ['VEQ', 'SOJOURNER', 'LUCIOLIFE', 'WINSTONED', 'GENJIDASH'];

const EMPTY_MATCH_INFO: MatchInfo = {
	result: '',
	final_score: { blue: '', red: '' },
	date: '',
	game_mode: '',
	game_length: '',
	map: '',
};

/** Players with stats that grow with `progress`, offset per player */
const makePlayers = (progress: number, names = [...BLUE, ...RED]): PlayerStats[] =>
	names.map((name, i) => ({
		name,
		team: i < 5 ? 'blue' : 'red',
		hero: '',
		e: String(progress * 2 + i),
		a: String(progress + i),
		d: String(progress + (i % 3)),
		dmg: String(progress * 1000 + i * 10),
		h: String(progress * 500 + i * 10),
		mit: String(progress * 300 + i * 10),
	}));

/** In-game Tab scoreboard: map and mode, no result */
const inGame = (progress: number, names?: string[]): GameStats => ({
	players: makePlayers(progress, names),
	matchInfo: { ...EMPTY_MATCH_INFO, game_mode: 'CONTROL', map: "King's Row" },
});

/** Post-game summary: result, score, date and mode, no map */
const postGame = (progress: number, names?: string[]): GameStats => ({
	players: makePlayers(progress, names),
	matchInfo: {
		...EMPTY_MATCH_INFO,
		result: 'VICTORY',
		final_score: { blue: '2', red: '1' },
		date: '09/15/25 - 02:49',
		game_mode: 'CONTROL',
		game_length: '12:34',
	},
});

const toRecord = (stats: GameStats, id = 'game_1'): GameRecord => ({
	id,
	...stats,
	createdAt: new Date('2025-09-15T03:00:00Z'),
	updatedAt: new Date('2025-09-15T03:00:00Z'),
});

describe('gameMatching', () => {
	describe('findMatchingRecord', () => {
		describe('different screenshots of the same game', () => {
			it('should match an in-game screenshot to the post-game record', () => {
				const record = toRecord(postGame(10));
				const match = findMatchingRecord(inGame(6), [record]);

				expect(match?.record).toBe(record);
				expect(match?.isLater).toBe(false);
			});

			it('should match a post-game screenshot to an in-game record', () => {
				const record = toRecord(inGame(6));
				const match = findMatchingRecord(postGame(10), [record]);

				expect(match?.record).toBe(record);
				expect(match?.isLater).toBe(true);
			});

			it('should match a later in-game screenshot to an earlier one', () => {
				const match = findMatchingRecord(inGame(8), [toRecord(inGame(3))]);
				expect(match?.isLater).toBe(true);
			});

			it('should match an earlier in-game screenshot to a later one', () => {
				const match = findMatchingRecord(inGame(3), [toRecord(inGame(8))]);
				expect(match?.isLater).toBe(false);
			});

			it('should treat the post-game screenshot as latest even with misread stats', () => {
				const screenshot = postGame(5);
				const match = findMatchingRecord(screenshot, [toRecord(inGame(5))]);
				expect(match?.isLater).toBe(true);
			});

			it('should pair every player by name', () => {
				const match = findMatchingRecord(inGame(3), [toRecord(postGame(9))]);
				expect(match?.pairs).toHaveLength(10);
				expect(match?.pairs.every(([a, b]) => a === b)).toBe(true);
			});

			it('should pair players regardless of their order', () => {
				const reordered = [...BLUE].reverse().concat(RED);
				const screenshot = inGame(3, reordered);
				const match = findMatchingRecord(screenshot, [toRecord(postGame(9))]);

				expect(match?.pairs).toContainEqual([0, 4]);
				expect(match?.pairs).toContainEqual([4, 0]);
			});
		});

		describe('OCR errors', () => {
			it('should match despite look-alike misreads in names', () => {
				const names = [...BLUE, ...RED].map((name) =>
					name.replace('O', '0').replace('I', '1')
				);
				expect(
					findMatchingRecord(inGame(3, names), [toRecord(postGame(9))])
				).toBeDefined();
			});

			it('should match when a few names are unreadable', () => {
				const names = [...BLUE, ...RED].map((name, i) => (i % 4 === 0 ? 'X#?' : name));
				expect(
					findMatchingRecord(inGame(3, names), [toRecord(postGame(9))])
				).toBeDefined();
			});

			it('should pair players with unreadable names by slot', () => {
				const names = [...BLUE, ...RED];
				names[2] = '';
				const match = findMatchingRecord(inGame(3, names), [toRecord(postGame(9))]);
				expect(match?.pairs).toContainEqual([2, 2]);
			});

			it('should match despite a misread stat', () => {
				const screenshot = inGame(3);
				screenshot.players[0].dmg = '999999';
				expect(findMatchingRecord(screenshot, [toRecord(postGame(9))])).toBeDefined();
			});

			it('should ignore stray characters in stats', () => {
				const screenshot = inGame(3);
				screenshot.players[0].dmg = '3,0O0';
				expect(findMatchingRecord(screenshot, [toRecord(postGame(9))])).toBeDefined();
			});
		});

		describe('different games', () => {
			it('should not match a game with only the same team', () => {
				const names = [...BLUE, 'A1', 'B2', 'C3', 'D4', 'E5'];
				expect(
					findMatchingRecord(inGame(3, names), [toRecord(postGame(9))])
				).toBeUndefined();
			});

			it('should not match the same players on swapped teams', () => {
				const names = [...RED, ...BLUE];
				expect(
					findMatchingRecord(inGame(3, names), [toRecord(postGame(9))])
				).toBeUndefined();
			});

			it('should not match the same lobby when stats move both ways', () => {
				// Half the players are further ahead than in the record, half behind
				const ahead = inGame(15).players;
				const screenshot = inGame(3);
				screenshot.players = screenshot.players.map((player, i) =>
					i % 2 === 0 ? ahead[i] : player
				);
				expect(findMatchingRecord(screenshot, [toRecord(postGame(9))])).toBeUndefined();
			});

			it('should not match a different date', () => {
				const screenshot = postGame(9);
				screenshot.matchInfo.date = '09/15/25 - 03:20';
				expect(findMatchingRecord(screenshot, [toRecord(postGame(9))])).toBeUndefined();
			});

			it('should not match a different map', () => {
				const screenshot = inGame(5);
				screenshot.matchInfo.map = 'Ilios';
				expect(findMatchingRecord(screenshot, [toRecord(inGame(3))])).toBeUndefined();
			});

			it('should not match a different game mode', () => {
				const screenshot = inGame(5);
				screenshot.matchInfo.game_mode = 'ESCORT';
				expect(findMatchingRecord(screenshot, [toRecord(postGame(9))])).toBeUndefined();
			});

			it('should not match a different result', () => {
				const screenshot = postGame(9);
				screenshot.matchInfo.result = 'DEFEAT';
				expect(findMatchingRecord(screenshot, [toRecord(postGame(9))])).toBeUndefined();
			});

			it('should not match when too few names were read', () => {
				const names = [...BLUE, ...RED].map((name, i) => (i < 5 ? name : ''));
				expect(
					findMatchingRecord(inGame(3, names), [toRecord(postGame(9))])
				).toBeUndefined();
			});

			it('should return undefined with no records', () => {
				expect(findMatchingRecord(inGame(3), [])).toBeUndefined();
			});
		});

		it('should pick the record with the most matching names', () => {
			const partial = [...BLUE, ...RED].map((name, i) => (i === 9 ? 'SOMEONE' : name));
			const weaker = toRecord(postGame(9, partial), 'weaker');
			const stronger = toRecord(postGame(9), 'stronger');

			expect(findMatchingRecord(inGame(3), [weaker, stronger])?.record.id).toBe(
				'stronger'
			);
		});
	});

	describe('mergeGameStats', () => {
		const merge = (record: GameStats, screenshot: GameStats) => {
			const match = findMatchingRecord(screenshot, [toRecord(record)]);
			if (!match) throw new Error('Expected a match');
			return mergeGameStats(record, screenshot, match);
		};

		it('should combine match info from in-game and post-game screenshots', () => {
			const merged = merge(postGame(9), inGame(3));
			expect(merged.matchInfo).toEqual({
				result: 'VICTORY',
				final_score: { blue: '2', red: '1' },
				date: '09/15/25 - 02:49',
				game_mode: 'CONTROL',
				game_length: '12:34',
				map: "King's Row",
			});
		});

		it('should take stats from a later screenshot', () => {
			const merged = merge(inGame(3), postGame(9));
			expect(merged.players).toEqual(
				postGame(9).players.map((player) => expect.objectContaining({ e: player.e }))
			);
		});

		it('should keep stats from a later record', () => {
			const merged = merge(postGame(9), inGame(3));
			expect(merged.players.map(({ dmg }) => dmg)).toEqual(
				postGame(9).players.map(({ dmg }) => dmg)
			);
		});

		it('should fill stats missing from the later read', () => {
			const record = postGame(9);
			record.players[0].mit = '';
			const merged = merge(record, inGame(3));
			expect(merged.players[0].mit).toBe(inGame(3).players[0].mit);
		});

		it("should keep the record's player names and order", () => {
			const record = inGame(3);
			record.players[1].name = 'TRACERO';
			const screenshot = postGame(9, [...BLUE].reverse().concat(RED));

			const merged = merge(record, screenshot);

			expect(merged.players.map(({ name }) => name)).toEqual(
				record.players.map(({ name }) => name)
			);
			expect(merged.players[0].e).toBe(screenshot.players[4].e);
		});

		it('should fill an empty name from the screenshot', () => {
			const record = postGame(9);
			record.players[2].name = '';
			expect(merge(record, inGame(3)).players[2].name).toBe(BLUE[2]);
		});

		it('should take the hero from the later read', () => {
			const record = inGame(3);
			record.players[0].hero = 'Reinhardt';
			const screenshot = postGame(9);
			screenshot.players[0].hero = 'Winston';

			expect(merge(record, screenshot).players[0].hero).toBe('Winston');
		});

		it('should keep the earlier hero when the later read has none', () => {
			const record = inGame(3);
			record.players[0].hero = 'Reinhardt';
			expect(merge(record, postGame(9)).players[0].hero).toBe('Reinhardt');
		});

		it('should not change its inputs', () => {
			const record = inGame(3);
			const screenshot = postGame(9);
			const [recordCopy, screenshotCopy] = [
				structuredClone(record),
				structuredClone(screenshot),
			];

			merge(record, screenshot);

			expect(record).toEqual(recordCopy);
			expect(screenshot).toEqual(screenshotCopy);
		});
	});
});
