/**
 * Image preprocessing utilities for OCR optimization
 */

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

const SCOREBOARD: Pick<TextRegion, 'x' | 'y'> = {
    x: 500,
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
    x: SCOREBOARD.x + NAME_TAG.width + 40,
    width: 67,
    height: NAME_TAG.height,
    charSet: ZERO_TO_NINE,
};

const STATLINE: Omit<TextRegion, 'name' | 'y'> = {
    x: EAD.x + 3 * EAD.width + 10,
    width: 128,
    height: NAME_TAG.height,
    charSet: ZERO_TO_NINE,
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

/**
 * Applies skew correction to italic text to make it more readable
 * @param imageData - Image data to process
 * @param skewAngle - Angle in degrees to unskew (negative for italic correction)
 * @returns Processed image data
 */
function unskewItalicText(
    imageData: ImageData,
    skewAngle: number = -14
): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return imageData;
    }

    canvas.width = imageData.width;
    canvas.height = imageData.height;

    // Put the image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Create a new canvas for the transformed image
    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d');

    if (!outputCtx) {
        return imageData;
    }

    outputCanvas.width = imageData.width;
    outputCanvas.height = imageData.height;

    // Fill background with gray before transformation
    outputCtx.fillStyle = '#444444';
    outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    // Apply skew transformation to counteract italic
    const angleRad = (skewAngle * Math.PI) / 180;
    outputCtx.transform(1, 0, -Math.tan(angleRad), 1, 0, 0);
    outputCtx.drawImage(canvas, 0, 0);

    return outputCtx.getImageData(
        0,
        0,
        outputCanvas.width,
        outputCanvas.height
    );
}

/**
 * Converts an image to grayscale and enhances contrast for better OCR results
 * @param imageUrl - URL of the image to preprocess
 * @returns Promise resolving to a data URL of the preprocessed image
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(img, 0, 0);

            const regions = [
                ...getScoreboardRegions(),
                ...getMatchInfoRegions(),
            ];
            for (const region of regions) {
                // Extract region image data
                const regionImageData = ctx.getImageData(
                    region.x,
                    region.y,
                    region.width,
                    region.height
                );
                const imageData = preprocessRegionForOCR(
                    regionImageData,
                    region
                );
                ctx.putImageData(imageData, region.x, region.y);
            }

            ctx.filter =
                'brightness(70%) contrast(300%) grayscale(100%) invert(100%)';
            ctx.drawImage(canvas, 0, 0);

            // Convert to data URL
            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUrl;
    });
}

/**
 * Preprocesses a specific region of the image for OCR
 * @param imageData - Region image data
 * @param region - Region definition
 * @returns Promise resolving to preprocessed region data URL
 */
function preprocessRegionForOCR(
    imageData: ImageData,
    region: TextRegion
): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx || !region.isItalic) {
        return imageData;
    }

    // Set canvas to region size
    canvas.width = region.width;
    canvas.height = region.height;

    // Put the image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Apply italic correction if needed
    if (region.isItalic) {
        imageData = unskewItalicText(imageData);
        ctx.putImageData(imageData, 0, 0);
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Extracts game stats from region-based OCR results
 * @param regionResults - Map of region names to OCR text
 * @returns Structured game stats
 */
export function extractGameStats(
    regionResults: Map<string, string>
): Record<string, any> {
    const stats: Record<string, any> = {
        players: [],
        matchInfo: {},
    };

    // Extract blue team players
    for (let i = 1; i <= 5; i++) {
        const player: any = {
            name: regionResults.get(`blue_player${i}_name`)?.trim() || '',
            team: 'blue',
            e: parseInt(regionResults.get(`blue_player${i}_e`)?.trim() || '0'),
            a: parseInt(regionResults.get(`blue_player${i}_a`)?.trim() || '0'),
            d: parseInt(regionResults.get(`blue_player${i}_d`)?.trim() || '0'),
            dmg: parseInt(
                regionResults
                    .get(`blue_player${i}_dmg`)
                    ?.replace(/,/g, '')
                    .trim() || '0'
            ),
            h: parseInt(regionResults.get(`blue_player${i}_h`)?.trim() || '0'),
            mit: parseInt(
                regionResults
                    .get(`blue_player${i}_mit`)
                    ?.replace(/,/g, '')
                    .trim() || '0'
            ),
        };

        stats.players.push(player);
    }

    // Extract red team players
    for (let i = 1; i <= 5; i++) {
        const player: any = {
            name: regionResults.get(`red_player${i}_name`)?.trim() || '',
            team: 'red',
            e: parseInt(regionResults.get(`red_player${i}_e`)?.trim() || '0'),
            a: parseInt(regionResults.get(`red_player${i}_a`)?.trim() || '0'),
            d: parseInt(regionResults.get(`red_player${i}_d`)?.trim() || '0'),
            dmg: parseInt(
                regionResults
                    .get(`red_player${i}_dmg`)
                    ?.replace(/,/g, '')
                    .trim() || '0'
            ),
            h: parseInt(regionResults.get(`red_player${i}_h`)?.trim() || '0'),
            mit: parseInt(
                regionResults
                    .get(`red_player${i}_mit`)
                    ?.replace(/,/g, '')
                    .trim() || '0'
            ),
        };

        stats.players.push(player);
    }

    // Extract match info
    const finalRaw =
        regionResults.get('final_score')?.trim().toUpperCase() || ':?VS?';
    const [beforeVS, afterVS] = finalRaw.split('VS');

    stats.matchInfo.result =
        regionResults.get('result')?.trim().toUpperCase() || '';
    stats.matchInfo.final_score = {
        blue: beforeVS.split(':')[1].trim(),
        red: afterVS.trim(),
    };
    stats.matchInfo.date =
        regionResults.get('date')?.split('DATE:')[1].trim() || '';
    stats.matchInfo.game_mode =
        regionResults.get('game_mode')?.split(':')[1].trim() || '';
    stats.matchInfo.game_length =
        regionResults.get('game_length')?.split('LENGTH:')[1].trim() || '';

    return stats;
}

/**
 * Draws italic regions with unskew visualization on the preprocessed image
 * Uses green overlay for regions to show which ones are being unskewed
 * @param imageUrl - URL of the preprocessed image
 * @param sourceImageUrl - URL of the source image to extract region data
 * @returns Promise resolving to data URL with unskew regions highlighted
 */
export async function drawRegionsOnImage(
    imageUrl: string,
    sourceImageUrl: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const sourceImg = new Image();

            sourceImg.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                canvas.width = img.width;
                canvas.height = img.height;

                // Draw the preprocessed image with regions
                ctx.drawImage(img, 0, 0);

                ctx.lineWidth = 1;

                const regions = [
                    ...getScoreboardRegions(),
                    ...getMatchInfoRegions(),
                ];
                for (const region of regions) {
                    if (region.isItalic) {
                        ctx.strokeStyle = '#4caf50';
                    } else {
                        ctx.strokeStyle = '#ff0000';
                    }
                    ctx.strokeRect(
                        region.x,
                        region.y,
                        region.width,
                        region.height
                    );
                }

                resolve(canvas.toDataURL('image/png'));
            };

            sourceImg.onerror = () => {
                reject(new Error('Failed to load source image'));
            };

            sourceImg.src = sourceImageUrl;
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUrl;
    });
}
