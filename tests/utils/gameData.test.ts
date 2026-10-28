import { describe, it, expect } from 'vitest';
import {
	HERO_KEY_ALIASES,
	getHeroDisplayName,
	getHeroKey,
	matchMapName,
	getHeroNames,
	getMapNames,
} from '#utils/gameData';
import type { OverFastHero, OverFastMap, OverFastStore } from '#types';

const hero = (key: string, name: string): OverFastHero => ({
	key,
	name,
	portrait: '',
	role: 'damage',
	subrole: '',
	gamemodes: [],
});

const map = (key: string, name: string): OverFastMap => ({
	key,
	name,
	screenshot: '',
	gamemodes: [],
	uses: [],
	location: '',
	country_code: null,
});

const HEROES = [
	hero('ana', 'Ana'),
	hero('soldier-76', 'Soldier: 76'),
	hero('dva', 'D.Va'),
	hero('lucio', 'Lúcio'),
];
const MAPS = [map('kings-row', "King's Row"), map('hanamura', 'Hanamura')];
const STORE: OverFastStore = {
	schemaVersion: 1,
	heroes: [...HEROES, hero('ana-2', 'Ana')],
	maps: [...MAPS, map('x', 'Hanamura')],
	updatedAt: new Date('2025-01-01'),
};

describe('gameData', () => {
	describe('getHeroDisplayName', () => {
		it('resolves an exact key', () => {
			expect(getHeroDisplayName('ana', HEROES)).toBe('Ana');
			expect(getHeroDisplayName('dva', HEROES)).toBe('D.Va');
		});

		it('resolves aliases', () => {
			expect(HERO_KEY_ALIASES.soldier).toBe('soldier-76');
			expect(getHeroDisplayName('soldier', HEROES)).toBe('Soldier: 76');
		});

		it('falls back to normalised name comparison', () => {
			expect(getHeroDisplayName('Lucio', HEROES)).toBe('Lúcio');
			expect(getHeroDisplayName('D.VA', HEROES)).toBe('D.Va');
		});

		it('passes through unknown and empty values', () => {
			expect(getHeroDisplayName('nobody', HEROES)).toBe('nobody');
			expect(getHeroDisplayName('', HEROES)).toBe('');
		});
	});

	describe('getHeroKey', () => {
		it('resolves display names and keys to the key', () => {
			expect(getHeroKey('Ana', HEROES)).toBe('ana');
			expect(getHeroKey('D.Va', HEROES)).toBe('dva');
			expect(getHeroKey('lucio', HEROES)).toBe('lucio');
		});

		it('uses the alias as the hash-set name', () => {
			expect(getHeroKey('Soldier: 76', HEROES)).toBe('soldier');
			expect(getHeroKey('soldier', HEROES)).toBe('soldier');
		});

		it('falls back to an OverFast-style key for unknown heroes', () => {
			expect(getHeroKey('Brand New Hero', HEROES)).toBe('brand-new-hero');
			expect(getHeroKey('Ana', [])).toBe('ana');
			expect(getHeroKey('Lúcio', [])).toBe('lucio');
		});

		it('returns an empty string for empty input', () => {
			expect(getHeroKey('', HEROES)).toBe('');
			expect(getHeroKey('  ', HEROES)).toBe('');
		});
	});

	describe('matchMapName', () => {
		it('matches exactly', () => {
			expect(matchMapName("King's Row", MAPS)).toBe("King's Row");
		});

		it('tolerates OCR noise', () => {
			expect(matchMapName('KINGS R0W', MAPS)).toBe("King's Row");
		});

		it('rejects matches above the threshold', () => {
			expect(matchMapName('Totally Different', MAPS)).toBe('Totally Different');
		});

		it('returns raw when there are no maps', () => {
			expect(matchMapName('Hanamura', [])).toBe('Hanamura');
		});

		it('keeps empty strings empty', () => {
			expect(matchMapName('', MAPS)).toBe('');
		});
	});

	describe('getHeroNames / getMapNames', () => {
		it('returns empty arrays for a null store', () => {
			expect(getHeroNames(null)).toEqual([]);
			expect(getMapNames(null)).toEqual([]);
		});

		it('returns sorted, de-duplicated names', () => {
			expect(getHeroNames(STORE)).toEqual(['Ana', 'D.Va', 'Lúcio', 'Soldier: 76']);
			expect(getMapNames(STORE)).toEqual(['Hanamura', "King's Row"]);
		});
	});
});
