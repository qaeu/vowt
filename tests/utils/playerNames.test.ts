import { describe, it, expect } from 'vitest';
import {
	CONFUSABLE_COST,
	buildNameLexicon,
	confusionDistance,
	correctPlayerNames,
	isSameName,
	matchPlayerName,
} from '#utils/playerNames';
import type { GameRecord, PlayerStats } from '#types';

const makePlayer = (name: string, team: PlayerStats['team'] = 'blue'): PlayerStats => ({
	name,
	team,
	e: '0',
	a: '0',
	d: '0',
	dmg: '0',
	h: '0',
	mit: '0',
});

const makeRecord = (id: string, names: string[]): GameRecord =>
	({ id, players: names.map((n) => makePlayer(n)) }) as unknown as GameRecord;

describe('buildNameLexicon', () => {
	it('keeps names found in at least 2 records', () => {
		const records = [makeRecord('1', ['ALPHA', 'BETA']), makeRecord('2', ['ALPHA'])];
		expect(buildNameLexicon(records)).toEqual(['ALPHA']);
	});

	it('respects a custom threshold', () => {
		const records = [makeRecord('1', ['ALPHA', 'BETA']), makeRecord('2', ['ALPHA'])];
		expect(buildNameLexicon(records, 1).sort()).toEqual(['ALPHA', 'BETA']);
		expect(buildNameLexicon(records, 3)).toEqual([]);
	});

	it('counts a name once per record', () => {
		expect(buildNameLexicon([makeRecord('1', ['ALPHA', 'alpha', 'ALPHA'])])).toEqual([]);
	});

	it('normalises case and whitespace', () => {
		const records = [makeRecord('1', [' alpha ']), makeRecord('2', ['ALPHA'])];
		expect(buildNameLexicon(records)).toEqual(['ALPHA']);
	});

	it('skips empty names', () => {
		const records = [makeRecord('1', ['', '  ']), makeRecord('2', ['', ' '])];
		expect(buildNameLexicon(records)).toEqual([]);
	});

	it('returns an empty lexicon for no records', () => {
		expect(buildNameLexicon([])).toEqual([]);
	});
});

describe('confusionDistance', () => {
	it('is 0 for identical strings', () => {
		expect(confusionDistance('ABC', 'ABC')).toBe(0);
	});

	it('charges the reduced cost for look-alike substitutions', () => {
		expect(confusionDistance('PLAYER0NE', 'PLAYERONE')).toBe(CONFUSABLE_COST);
		expect(confusionDistance('S', '5')).toBe(CONFUSABLE_COST);
	});

	it('charges 1 for ordinary substitutions', () => {
		expect(confusionDistance('ABC', 'ABX')).toBe(1);
		expect(confusionDistance('O', 'S')).toBe(1);
	});

	it('charges 1 for insertions and deletions', () => {
		expect(confusionDistance('ABC', 'ABCD')).toBe(1);
		expect(confusionDistance('ABCD', 'ABC')).toBe(1);
		expect(confusionDistance('', 'ABC')).toBe(3);
	});
});

describe('isSameName', () => {
	it('matches names that differ only in case and spacing', () => {
		expect(isSameName(' qaeu ', 'QAEU')).toBe(true);
	});

	it('matches names with a look-alike misread', () => {
		expect(isSameName('TRACER0', 'TRACERO')).toBe(true);
	});

	it('does not match different names', () => {
		expect(isSameName('ALPHA', 'BRAVO')).toBe(false);
	});

	it('does not match empty names', () => {
		expect(isSameName('', '')).toBe(false);
		expect(isSameName('ALPHA', ' ')).toBe(false);
	});
});

describe('matchPlayerName', () => {
	const lexicon = ['PLAYERONE', 'STARK'];

	it('accepts a close look-alike match', () => {
		expect(matchPlayerName('PLAYER0NE', lexicon)).toBe('PLAYERONE');
	});

	it('is case-insensitive', () => {
		expect(matchPlayerName('player0ne', lexicon)).toBe('PLAYERONE');
	});

	it('rejects distant names', () => {
		expect(matchPlayerName('KAPPA', lexicon)).toBe('KAPPA');
	});

	it('rejects ambiguous matches', () => {
		expect(matchPlayerName('AB0', ['ABO', 'ABD'])).toBe('AB0');
	});

	it('returns exact matches unchanged', () => {
		expect(matchPlayerName('stark', lexicon)).toBe('stark');
	});

	it('returns trimmed raw for empty input or lexicon', () => {
		expect(matchPlayerName('  ', lexicon)).toBe('');
		expect(matchPlayerName(' X0 ', [])).toBe('X0');
	});
});

describe('correctPlayerNames', () => {
	it('corrects names against the lexicon', () => {
		const result = correctPlayerNames([makePlayer('PLAYER0NE')], ['PLAYERONE']);
		expect(result[0].name).toBe('PLAYERONE');
	});

	it('does not assign one name to two players', () => {
		const players = [makePlayer('PLAYER0NE'), makePlayer('PLAYERQNE', 'red')];
		const result = correctPlayerNames(players, ['PLAYERONE']);
		expect(result[0].name).toBe('PLAYERONE');
		expect(result[1].name).toBe('PLAYERQNE');
	});

	it('excludes names another player already reads exactly', () => {
		const players = [makePlayer('PLAYER0NE'), makePlayer('PLAYERONE', 'red')];
		const result = correctPlayerNames(players, ['PLAYERONE']);
		expect(result.map((p) => p.name)).toEqual(['PLAYER0NE', 'PLAYERONE']);
	});

	it('does not mutate inputs', () => {
		const players = [makePlayer('PLAYER0NE')];
		const lexicon = ['PLAYERONE'];
		const result = correctPlayerNames(players, lexicon);
		expect(result).not.toBe(players);
		expect(result[0]).not.toBe(players[0]);
		expect(players[0].name).toBe('PLAYER0NE');
		expect(lexicon).toEqual(['PLAYERONE']);
	});

	it('handles empty inputs', () => {
		expect(correctPlayerNames([], ['A'])).toEqual([]);
		expect(correctPlayerNames([makePlayer('')], ['A'])[0].name).toBe('');
	});
});
