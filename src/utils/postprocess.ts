/**
 * OCR post-processing utilities to extract structured game stats
 */

import {
    PLAYER_STATS_NUMBER_FIELD_NAMES,
    type PlayerStatsNumberFields,
    type PlayerStats,
    type GameRecord,
} from '#utils/gameStorage';

/**
 * Extracts game stats from region-based OCR results
 * @param regionResults - Map of region names to OCR text
 * @returns Structured game stats
 */
export function extractGameStats(
    regionResults: Map<string, string>
): Pick<GameRecord, 'players' | 'matchInfo'> {
    const players: GameRecord['players'] = [];
    players.push(...extractTeamPlayers('blue', regionResults));
    players.push(...extractTeamPlayers('red', regionResults));

    // Extract match info
    const finalRaw =
        regionResults.get('final_score')?.trim().toUpperCase() || ':?VS?';
    const [beforeVS, afterVS] = finalRaw.split('VS');

    const matchInfo: GameRecord['matchInfo'] = {
        result: regionResults.get('result')?.trim().toUpperCase() || '?',
        final_score: {
            blue: beforeVS.split(':')[1].trim(),
            red: afterVS.trim(),
        },
        date: regionResults.get('date')?.split('DATE:')[1].trim() || '?',
        game_mode: regionResults.get('game_mode')?.split(':')[1].trim() || '?',
        game_length:
            regionResults.get('game_length')?.split('LENGTH:')[1].trim() || '?',
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
            numberStats[field] =
                parseInt(
                    ocrResults.get(`${team}_player${i}_${field}`) || ''
                ).toString() || '?';
        }

        const player: PlayerStats = {
            name: ocrResults.get(`${team}_player${i}_name`)?.trim() || '?',
            team,
            ...(numberStats as PlayerStatsNumberFields),
        };

        teamPlayers.push(player);
    }
    return teamPlayers;
}
