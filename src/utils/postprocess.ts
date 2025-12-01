/**
 * OCR post-processing utilities to extract structured game stats
 */

import type {
	PlayerStatsNumberFields,
	PlayerStats,
	GameRecord,
	RecognitionResult,
} from '#types';
import { PLAYER_STATS_NUMBER_FIELD_NAMES } from '#utils/gameStorage';

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
 * @returns Structured game stats
 */
export function extractGameStats(
	regionResults: Map<string, string>
): Pick<GameRecord, 'players' | 'matchInfo'> {
	// Extract players
	const players: GameRecord['players'] = [];
	players.push(...extractTeamPlayers('blue', regionResults));
	players.push(...extractTeamPlayers('red', regionResults));

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
		map: infoline.map,
		game_length: regionResults.get('game_length')?.split('LENGTH:')[1]?.trim() || '',
	};

	return { players, matchInfo };
}

function extractTeamPlayers(
	team: PlayerStats['team'],
	ocrResults: Map<string, string>
): PlayerStats[] {
	const teamPlayers: PlayerStats[] = [];
	for (let i = 1; i <= 5; i++) {
		const numberStats: Partial<PlayerStatsNumberFields> = {};
		for (const field of PLAYER_STATS_NUMBER_FIELD_NAMES) {
			const rawResult = ocrResults.get(`${team}_player${i}_${field}`) || '';

			numberStats[field] = rawResult.replace(/,/g, '');
		}

		const player: PlayerStats = {
			hero: ocrResults.get(`${team}_player${i}_hero`) || '',
			name: ocrResults.get(`${team}_player${i}_name`)?.trim() || '',
			team,
			...(numberStats as PlayerStatsNumberFields),
		};

		teamPlayers.push(player);
	}
	return teamPlayers;
}
