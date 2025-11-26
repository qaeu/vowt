/**
 * Text element region definition for targeted OCR
 */

import type { TextRegion } from '#types';

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
