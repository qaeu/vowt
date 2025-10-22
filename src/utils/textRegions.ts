/**
 * Text element region definition for targeted OCR
 */
export interface TextRegion {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    charSet?: string;
    isItalic?: boolean;
}

const ZERO_TO_NINE = '0123456789';
const A_TO_Z = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SYMBOLS = ': /-';
const COMMA = ',';

const SCOREBOARD: Pick<TextRegion, 'x' | 'y'> = {
    x: 480,
    y: 340,
};

const ROW_H = 82;
const RED_Y = 880;

const NAME_TAG: Omit<TextRegion, 'name' | 'y'> = {
    x: SCOREBOARD.x,
    width: 300,
    height: 60,
    charSet: A_TO_Z + ZERO_TO_NINE,
    isItalic: true,
};

const EAD: Omit<TextRegion, 'name' | 'y'> = {
    x: SCOREBOARD.x + NAME_TAG.width + 60,
    width: 67,
    height: NAME_TAG.height,
    charSet: ZERO_TO_NINE,
};

const STATLINE: Omit<TextRegion, 'name' | 'y'> = {
    x: EAD.x + 3 * EAD.width + 10,
    width: 128,
    height: NAME_TAG.height,
    charSet: ZERO_TO_NINE + COMMA,
};

const MATCH_INFO: Omit<TextRegion, 'name' | 'height'> = {
    x: 1520,
    y: 765,
    width: 400,
    charSet: A_TO_Z + ZERO_TO_NINE + SYMBOLS,
};
const INFOLINE_H = 37;

/**
 * Define all text regions on the Overwatch scoreboard
 * Coordinates are for the full 2560x1440 (1440p) scoreboard image.
 */
export function getScoreboardRegions(): TextRegion[] {
    // These coordinates are based on the actual scoreboard screenshot at 2560x1440
    return [
        // Blue team players (rows in table)
        {
            name: 'blue_player1_name',
            ...SCOREBOARD,
            ...NAME_TAG,
        },
        {
            name: 'blue_player1_e',
            y: SCOREBOARD.y,
            ...EAD,
        },
        {
            name: 'blue_player1_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: SCOREBOARD.y,
        },
        {
            name: 'blue_player1_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: SCOREBOARD.y,
        },
        { name: 'blue_player1_dmg', ...STATLINE, y: SCOREBOARD.y },
        {
            name: 'blue_player1_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: SCOREBOARD.y,
        },
        {
            name: 'blue_player1_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: SCOREBOARD.y,
        },

        {
            name: 'blue_player2_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: SCOREBOARD.y + ROW_H,
        },
        { name: 'blue_player2_e', ...EAD, y: SCOREBOARD.y + ROW_H },
        {
            name: 'blue_player2_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: SCOREBOARD.y + ROW_H,
        },
        {
            name: 'blue_player2_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: SCOREBOARD.y + ROW_H,
        },
        { name: 'blue_player2_dmg', ...STATLINE, y: SCOREBOARD.y + ROW_H },
        {
            name: 'blue_player2_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: SCOREBOARD.y + ROW_H,
        },
        {
            name: 'blue_player2_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: SCOREBOARD.y + ROW_H,
        },

        {
            name: 'blue_player3_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: SCOREBOARD.y + 2 * ROW_H,
        },
        { name: 'blue_player3_e', ...EAD, y: SCOREBOARD.y + 2 * ROW_H },
        {
            name: 'blue_player3_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: SCOREBOARD.y + 2 * ROW_H,
        },
        {
            name: 'blue_player3_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: SCOREBOARD.y + 2 * ROW_H,
        },
        {
            name: 'blue_player3_dmg',
            ...STATLINE,
            y: SCOREBOARD.y + 2 * ROW_H,
        },
        {
            name: 'blue_player3_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: SCOREBOARD.y + 2 * ROW_H,
        },
        {
            name: 'blue_player3_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: SCOREBOARD.y + 2 * ROW_H,
        },

        {
            name: 'blue_player4_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: SCOREBOARD.y + 3 * ROW_H,
        },
        { name: 'blue_player4_e', ...EAD, y: SCOREBOARD.y + 3 * ROW_H },
        {
            name: 'blue_player4_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: SCOREBOARD.y + 3 * ROW_H,
        },
        {
            name: 'blue_player4_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: SCOREBOARD.y + 3 * ROW_H,
        },
        {
            name: 'blue_player4_dmg',
            ...STATLINE,
            y: SCOREBOARD.y + 3 * ROW_H,
        },
        {
            name: 'blue_player4_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: SCOREBOARD.y + 3 * ROW_H,
        },
        {
            name: 'blue_player4_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: SCOREBOARD.y + 3 * ROW_H,
        },

        {
            name: 'blue_player5_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: SCOREBOARD.y + 4 * ROW_H,
        },
        { name: 'blue_player5_e', ...EAD, y: SCOREBOARD.y + 4 * ROW_H },
        {
            name: 'blue_player5_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: SCOREBOARD.y + 4 * ROW_H,
        },
        {
            name: 'blue_player5_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: SCOREBOARD.y + 4 * ROW_H,
        },
        {
            name: 'blue_player5_dmg',
            ...STATLINE,
            y: SCOREBOARD.y + 4 * ROW_H,
        },
        {
            name: 'blue_player5_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: SCOREBOARD.y + 4 * ROW_H,
        },
        {
            name: 'blue_player5_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: SCOREBOARD.y + 4 * ROW_H,
        },

        // Red team players
        {
            name: 'red_player1_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: RED_Y,
        },
        { name: 'red_player1_e', ...EAD, y: RED_Y },
        {
            name: 'red_player1_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: RED_Y,
        },
        {
            name: 'red_player1_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: RED_Y,
        },
        { name: 'red_player1_dmg', ...STATLINE, y: RED_Y },
        {
            name: 'red_player1_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: RED_Y,
        },
        {
            name: 'red_player1_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: RED_Y,
        },

        {
            name: 'red_player2_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: RED_Y + ROW_H,
        },
        { name: 'red_player2_e', ...EAD, y: RED_Y + ROW_H },
        {
            name: 'red_player2_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: RED_Y + ROW_H,
        },
        {
            name: 'red_player2_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: RED_Y + ROW_H,
        },
        { name: 'red_player2_dmg', ...STATLINE, y: RED_Y + ROW_H },
        {
            name: 'red_player2_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: RED_Y + ROW_H,
        },
        {
            name: 'red_player2_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: RED_Y + ROW_H,
        },

        {
            name: 'red_player3_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: RED_Y + 2 * ROW_H,
        },
        { name: 'red_player3_e', ...EAD, y: RED_Y + 2 * ROW_H },
        {
            name: 'red_player3_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: RED_Y + 2 * ROW_H,
        },
        {
            name: 'red_player3_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: RED_Y + 2 * ROW_H,
        },
        { name: 'red_player3_dmg', ...STATLINE, y: RED_Y + 2 * ROW_H },
        {
            name: 'red_player3_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: RED_Y + 2 * ROW_H,
        },
        {
            name: 'red_player3_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: RED_Y + 2 * ROW_H,
        },

        {
            name: 'red_player4_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: RED_Y + 3 * ROW_H,
        },
        { name: 'red_player4_e', ...EAD, y: RED_Y + 3 * ROW_H },
        {
            name: 'red_player4_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: RED_Y + 3 * ROW_H,
        },
        {
            name: 'red_player4_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: RED_Y + 3 * ROW_H,
        },
        { name: 'red_player4_dmg', ...STATLINE, y: RED_Y + 3 * ROW_H },
        {
            name: 'red_player4_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: RED_Y + 3 * ROW_H,
        },
        {
            name: 'red_player4_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: RED_Y + 3 * ROW_H,
        },

        {
            name: 'red_player5_name',
            ...SCOREBOARD,
            ...NAME_TAG,
            y: RED_Y + 4 * ROW_H,
        },
        { name: 'red_player5_e', ...EAD, y: RED_Y + 4 * ROW_H },
        {
            name: 'red_player5_a',
            ...EAD,
            x: EAD.x + EAD.width,
            y: RED_Y + 4 * ROW_H,
        },
        {
            name: 'red_player5_d',
            ...EAD,
            x: EAD.x + 2 * EAD.width,
            y: RED_Y + 4 * ROW_H,
        },
        { name: 'red_player5_dmg', ...STATLINE, y: RED_Y + 4 * ROW_H },
        {
            name: 'red_player5_h',
            ...STATLINE,
            x: STATLINE.x + STATLINE.width,
            y: RED_Y + 4 * ROW_H,
        },
        {
            name: 'red_player5_mit',
            ...STATLINE,
            x: STATLINE.x + 2 * STATLINE.width,
            y: RED_Y + 4 * ROW_H,
        },
    ];
}

export function getMatchInfoRegions(): TextRegion[] {
    return [
        // Match info (right side)
        {
            name: 'result',
            ...MATCH_INFO,
            height: 90,
            isItalic: true,
        },
        {
            name: 'final_score',
            ...MATCH_INFO,
            y: MATCH_INFO.y + 90,
            height: INFOLINE_H,
        },
        {
            name: 'date',
            ...MATCH_INFO,
            y: MATCH_INFO.y + 90 + INFOLINE_H,
            height: INFOLINE_H,
        },
        {
            name: 'game_mode',
            ...MATCH_INFO,
            y: MATCH_INFO.y + 90 + 2 * INFOLINE_H,
            height: INFOLINE_H,
        },
        {
            name: 'game_length',
            ...MATCH_INFO,
            y: MATCH_INFO.y + 90 + 3 * INFOLINE_H,
            height: INFOLINE_H,
        },
    ];
}
