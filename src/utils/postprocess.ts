/**
 * OCR post-processing utilities to extract structured game stats
 */

import type {
	OverFastStore,
	PlayerStatsNumberFields,
	PlayerStats,
	GameRecord,
	RecognitionResult,
	RegionNameGroup,
} from '#types';
import { PLAYER_STATS_NUMBER_FIELD_NAMES } from '#utils/storage';
import { getHeroDisplayName, matchMapName } from '#utils/gameData';
import { correctPlayerNames } from '#utils/playerNames';

/** Region names read for the match info */
export const MATCH_INFO_REGION_NAMES = [
	'result',
	'final_score',
	'date',
	'game_mode',
	'game_length',
	'ingame_infoline',
] as const;

/** Fields read for each player, as `<team>_player<n>_<field>` regions */
export const PLAYER_REGION_FIELDS = [
	'hero',
	'name',
	...PLAYER_STATS_NUMBER_FIELD_NAMES,
] as const;

/** Every region name the stats extraction reads, grouped by player and match info */
export const REGION_NAME_GROUPS: RegionNameGroup[] = [
	...(['blue', 'red'] as const).flatMap((team) =>
		Array.from({ length: 5 }, (_, i) => ({
			label: `${team === 'blue' ? 'Blue' : 'Red'} player ${i + 1}`,
			names: PLAYER_REGION_FIELDS.map((field) => `${team}_player${i + 1}_${field}`),
		}))
	),
	{ label: 'Match info', names: [...MATCH_INFO_REGION_NAMES] },
];

/** Formatted OCR results */
interface FormattedResults {
	ocrTextParts: string[];
	regionResults: Map<string, string>;
}

/**
 * Formats recognition results into output format
 * @param allResults - Array of recognition results from OCR and image hash processing
 * @returns Object containing formatted text parts and region results map
 */
export const formatResults = (allResults: RecognitionResult[]): FormattedResults => {
	const ocrTextParts: string[] = [];
	const regionResults = new Map<string, string>();

	for (const result of allResults) {
		ocrTextParts.push(`${result.name} (${result.confidence}%): ${result.value}`);
		regionResults.set(result.name, result.value);
	}

	return { ocrTextParts, regionResults };
};

/**
 * Extracts game stats from region-based OCR results
 * @param regionResults - Map of region names to OCR text
 * @param gameData - Optional OverFast data used to normalise hero and map names
 * @param knownNames - Optional known player names; look-alike OCR errors are corrected to them
 * @returns Structured game stats
 */
export function extractGameStats(
	regionResults: Map<string, string>,
	gameData: OverFastStore | null = null,
	knownNames: string[] = []
): Pick<GameRecord, 'players' | 'matchInfo'> {
	// Extract players
	const players: GameRecord['players'] = [];
	players.push(...extractTeamPlayers('blue', regionResults, gameData));
	players.push(...extractTeamPlayers('red', regionResults, gameData));

	const correctedPlayers =
		knownNames.length ? correctPlayerNames(players, knownNames) : players;

	// Extract match info
	const finalScore = { blue: '', red: '' };
	const finalScoreRaw = regionResults.get('final_score');
	if (finalScoreRaw && finalScoreRaw.includes('VS')) {
		const finalFormatted = finalScoreRaw.trim().toUpperCase();
		const [beforeVS, afterVS] = finalFormatted.split('VS');
		[finalScore.blue, finalScore.red] = [beforeVS.split(':')[1].trim(), afterVS.trim()];
	}

	const infoline = { mode: '', map: '' };
	const ingameInfoLine = regionResults.get('ingame_infoline');
	if (ingameInfoLine && ingameInfoLine.includes('|')) {
		const infoParts = ingameInfoLine.split(/[|-]/).map((part) => part.trim());
		[infoline.mode, , infoline.map] = infoParts;
	}

	const gameMode =
		infoline.mode || regionResults.get('game_mode')?.split(':')[1]?.trim() || '';

	const matchInfo: GameRecord['matchInfo'] = {
		result: regionResults.get('result')?.trim()?.toUpperCase() || '',
		final_score: finalScore,
		date: regionResults.get('date')?.split('DATE:')[1]?.trim() || '',
		game_mode: gameMode,
		map: gameData ? matchMapName(infoline.map, gameData.maps) : infoline.map,
		game_length: regionResults.get('game_length')?.split('LENGTH:')[1]?.trim() || '',
	};

	return { players: correctedPlayers, matchInfo };
}

function extractTeamPlayers(
	team: PlayerStats['team'],
	ocrResults: Map<string, string>,
	gameData: OverFastStore | null
): PlayerStats[] {
	const teamPlayers: PlayerStats[] = [];
	for (let i = 1; i <= 5; i++) {
		const numberStats: Partial<PlayerStatsNumberFields> = {};
		for (const field of PLAYER_STATS_NUMBER_FIELD_NAMES) {
			const rawResult = ocrResults.get(`${team}_player${i}_${field}`) || '';

			numberStats[field] = rawResult.replace(/,/g, '');
		}

		const rawHero = ocrResults.get(`${team}_player${i}_hero`) || '';
		const player: PlayerStats = {
			hero: gameData ? getHeroDisplayName(rawHero, gameData.heroes) : rawHero,
			name: ocrResults.get(`${team}_player${i}_name`)?.trim() || '',
			team,
			...(numberStats as PlayerStatsNumberFields),
		};

		teamPlayers.push(player);
	}
	return teamPlayers;
}
