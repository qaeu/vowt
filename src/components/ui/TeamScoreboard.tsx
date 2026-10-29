/**
 * Read-only Blue and Red scoreboard tables for a game record
 */

import type { Component } from 'solid-js';
import { For } from 'solid-js';

import type { PlayerStats } from '#types';
import { PLAYER_STATS_NUMBER_FIELD_NAMES } from '#utils/storage';

interface TeamScoreboardProps {
	players: PlayerStats[];
}

interface TeamInfo {
	team: PlayerStats['team'];
	label: string;
}

const TEAMS: TeamInfo[] = [
	{ team: 'blue', label: 'Blue team' },
	{ team: 'red', label: 'Red team' },
];

const STAT_HEADINGS: Record<(typeof PLAYER_STATS_NUMBER_FIELD_NAMES)[number], string> = {
	e: 'E',
	a: 'A',
	d: 'D',
	dmg: 'DMG',
	h: 'H',
	mit: 'MIT',
};

const TeamScoreboard: Component<TeamScoreboardProps> = (props) => {
	return (
		<div class="team-scoreboard">
			<For each={TEAMS}>
				{(info) => (
					<table class={`team-scoreboard__table team-scoreboard__table--${info.team}`}>
						<caption class="team-scoreboard__caption">{info.label}</caption>
						<thead>
							<tr>
								<th scope="col">Player</th>
								<th scope="col">Hero</th>
								<For each={PLAYER_STATS_NUMBER_FIELD_NAMES}>
									{(field) => (
										<th scope="col" class="team-scoreboard__stat">
											{STAT_HEADINGS[field]}
										</th>
									)}
								</For>
							</tr>
						</thead>
						<tbody>
							<For each={props.players.filter((p) => p.team === info.team)}>
								{(player) => (
									<tr>
										<th scope="row" class="team-scoreboard__player">
											{player.name}
										</th>
										<td>{player.hero || '-'}</td>
										<For each={PLAYER_STATS_NUMBER_FIELD_NAMES}>
											{(field) => <td class="team-scoreboard__stat">{player[field]}</td>}
										</For>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				)}
			</For>
		</div>
	);
};

export default TeamScoreboard;
