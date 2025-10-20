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
    isItalic?: boolean;
}

const SCOREBOARD = {
    x: 480,
    y: 345,
};

const ROW_H = 82;
const RED_Y = 880;

const NAME_TAG = {
    x: SCOREBOARD.x,
    width: 345,
    height: 50,
    isItalic: true,
};

const EAD = {
    x: SCOREBOARD.x + NAME_TAG.width + 15,
    width: 65,
    height: NAME_TAG.height,
};

const STATLINE = {
    x: EAD.x + 3 * EAD.width + 15,
    width: 128,
    height: NAME_TAG.height,
};

const MATCH_INFO = {
    x: 1555,
    y: 765,
    width: 400,
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
        { name: 'blue_player3_dmg', ...STATLINE, y: SCOREBOARD.y + 2 * ROW_H },
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
        { name: 'blue_player4_dmg', ...STATLINE, y: SCOREBOARD.y + 3 * ROW_H },
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
        { name: 'blue_player5_dmg', ...STATLINE, y: SCOREBOARD.y + 4 * ROW_H },
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
        { name: 'red_player1_a', ...EAD, x: EAD.x + EAD.width, y: RED_Y },
        { name: 'red_player1_d', ...EAD, x: EAD.x + 2 * EAD.width, y: RED_Y },
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
export function unskewItalicText(
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
 * Converts ImageData to a PNG data URL for display
 * @param imageData - Image data to convert
 * @returns Data URL string
 */
export function imageDataToDataUrl(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
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

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );
            const data = imageData.data;

            // Convert to grayscale and enhance contrast
            for (let i = 0; i < data.length; i += 4) {
                // Grayscale conversion using luminosity method
                const gray =
                    0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                // Enhance contrast
                const contrast = 1.5; // Contrast factor
                const factor =
                    (259 * (contrast + 255)) / (255 * (259 - contrast));
                const enhancedGray = factor * (gray - 128) + 128;

                // Clamp values
                const finalValue = Math.max(0, Math.min(255, enhancedGray));

                data[i] = finalValue; // R
                data[i + 1] = finalValue; // G
                data[i + 2] = finalValue; // B
                // data[i + 3] is alpha, leave it unchanged
            }

            // Put the processed image data back
            ctx.putImageData(imageData, 0, 0);

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
 * Extracts key-value pairs from OCR text
 * @param text - Raw OCR text output
 * @returns Object containing extracted game stats
 */
export function extractGameStats(text: string): Record<string, any> {
    const stats: Record<string, any> = {
        players: [],
        matchInfo: {},
    };

    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    let currentSection = 'header';
    let columnHeaders: string[] = [];
    let teamColor: 'blue' | 'red' = 'blue';

    for (const line of lines) {
        // Check for result
        if (
            line.toUpperCase() === 'VICTORY' ||
            line.toUpperCase() === 'DEFEAT'
        ) {
            stats.matchInfo.result = line.toUpperCase();
            continue;
        }

        // Check for VS separator
        if (line.toUpperCase() === 'VS') {
            teamColor = 'red';
            continue;
        }

        // Check for SCOREBOARD header
        if (line.toUpperCase() === 'SCOREBOARD') {
            continue;
        }

        // Look for column headers (E A D DMG H MIT)
        if (
            line.match(/^[A-Z\s]+$/) &&
            line.length < 30 &&
            line.includes('E') &&
            line.includes('D')
        ) {
            columnHeaders = line.split(/\s+/);
            currentSection = 'players';
            continue;
        }

        // Look for key-value patterns in match info
        const kvMatch = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
            const value = kvMatch[2].trim();
            stats.matchInfo[key] = value;
            continue;
        }

        // Parse player data (name followed by numbers)
        if (currentSection === 'players') {
            const parts = line.split(/\s+/);
            if (parts.length >= 2 && !isNaN(parseFloat(parts[1]))) {
                const playerName = parts[0];
                const playerStats: Record<string, any> = {
                    name: playerName,
                    team: teamColor,
                };

                // Map stats to column headers
                for (
                    let i = 1;
                    i < parts.length && i <= columnHeaders.length;
                    i++
                ) {
                    const header = columnHeaders[i - 1] || `stat${i}`;
                    const value = parseFloat(parts[i]);
                    playerStats[header.toLowerCase()] = isNaN(value)
                        ? parts[i]
                        : value;
                }

                stats.players.push(playerStats);
            }
        }
    }

    return stats;
}

/**
 * Extracts a specific region from an image and preprocesses it
 * @param imageUrl - URL of the source image
 * @param region - Region to extract
 * @returns Promise resolving to preprocessed region data URL
 */
export async function preprocessRegionForOCR(
    imageUrl: string,
    region: TextRegion
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Set canvas to region size
            canvas.width = region.width;
            canvas.height = region.height;

            // Draw the specific region
            ctx.drawImage(
                img,
                region.x,
                region.y,
                region.width,
                region.height,
                0,
                0,
                region.width,
                region.height
            );

            // Get image data for the region
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Convert to grayscale and enhance contrast
            for (let i = 0; i < data.length; i += 4) {
                const gray =
                    0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const contrast = 2.0; // Higher contrast for small regions
                const factor =
                    (259 * (contrast + 255)) / (255 * (259 - contrast));
                const enhancedGray = factor * (gray - 128) + 128;
                const finalValue = Math.max(0, Math.min(255, enhancedGray));

                data[i] = finalValue;
                data[i + 1] = finalValue;
                data[i + 2] = finalValue;
            }

            // Apply italic correction if needed
            if (region.isItalic) {
                imageData = unskewItalicText(imageData);
            }

            // Put processed data back
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.putImageData(imageData, 0, 0);

            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUrl;
    });
}

/**
 * Extracts game stats from region-based OCR results
 * @param regionResults - Map of region names to OCR text
 * @returns Structured game stats
 */
export function extractGameStatsFromRegions(
    regionResults: Map<string, string>
): Record<string, any> {
    const stats: Record<string, any> = {
        players: [],
        matchInfo: {},
    };

    // Extract blue team players
    for (let i = 1; i <= 3; i++) {
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
        if (player.name) {
            stats.players.push(player);
        }
    }

    // Extract red team players
    for (let i = 1; i <= 3; i++) {
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
        if (player.name) {
            stats.players.push(player);
        }
    }

    // Extract match info
    stats.matchInfo.result =
        regionResults.get('result')?.trim().toUpperCase() || '';
    stats.matchInfo.final_score =
        regionResults.get('final_score')?.trim() || '';
    stats.matchInfo.date = regionResults.get('date')?.trim() || '';
    stats.matchInfo.game_mode = regionResults.get('game_mode')?.trim() || '';

    return stats;
}

/**
 * Draws red 1px borders around all scoreboard regions on a preprocessed image
 * @param imageUrl - URL of the preprocessed image
 * @returns Promise resolving to data URL with regions drawn
 */
export async function drawRegionsOnImage(imageUrl: string): Promise<string> {
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

            // Draw the preprocessed image
            ctx.drawImage(img, 0, 0);

            // Draw borders for all regions
            ctx.strokeStyle = '#ff0000'; // Red color
            ctx.lineWidth = 1;

            const regions = getScoreboardRegions();
            for (const region of regions) {
                ctx.strokeRect(region.x, region.y, region.width, region.height);
            }

            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUrl;
    });
}

/**
 * Draws italic regions with unskew visualization on the preprocessed image
 * Uses green overlay for regions to show which ones are being unskewed
 * @param imageUrl - URL of the preprocessed image
 * @param sourceImageUrl - URL of the source image to extract region data
 * @returns Promise resolving to data URL with unskew regions highlighted
 */
export async function drawUnskewRegionsOnImage(
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

                // Draw green borders and unskewed content for italic regions
                ctx.strokeStyle = '#4caf50'; // Green border
                ctx.lineWidth = 2;

                const regions = getScoreboardRegions();
                const italicRegions = regions.filter((r) => r.isItalic);

                // Create a temporary canvas for unskew transformation
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                if (!tempCtx) {
                    reject(new Error('Failed to get temporary canvas context'));
                    return;
                }

                for (const region of italicRegions) {
                    // Extract the region from source image
                    tempCanvas.width = region.width;
                    tempCanvas.height = region.height;

                    tempCtx.drawImage(
                        sourceImg,
                        region.x,
                        region.y,
                        region.width,
                        region.height,
                        0,
                        0,
                        region.width,
                        region.height
                    );

                    // Get and preprocess the region data
                    let regionImageData = tempCtx.getImageData(
                        0,
                        0,
                        tempCanvas.width,
                        tempCanvas.height
                    );
                    const data = regionImageData.data;

                    // Convert to grayscale and enhance contrast
                    for (let i = 0; i < data.length; i += 4) {
                        const gray =
                            0.299 * data[i] +
                            0.587 * data[i + 1] +
                            0.114 * data[i + 2];
                        const contrast = 2.0;
                        const factor =
                            (259 * (contrast + 255)) / (255 * (259 - contrast));
                        const enhancedGray = factor * (gray - 128) + 128;
                        const finalValue = Math.max(
                            0,
                            Math.min(255, enhancedGray)
                        );

                        data[i] = finalValue;
                        data[i + 1] = finalValue;
                        data[i + 2] = finalValue;
                    }

                    // Apply unskew transformation
                    regionImageData = unskewItalicText(regionImageData);

                    // Put the unskewed data back
                    tempCtx.putImageData(regionImageData, 0, 0);

                    // Clear the region on the main canvas with white background
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(
                        region.x,
                        region.y,
                        region.width,
                        region.height
                    );

                    // Draw the unskewed region onto the main canvas
                    ctx.drawImage(
                        tempCanvas,
                        0,
                        0,
                        tempCanvas.width,
                        tempCanvas.height,
                        region.x,
                        region.y,
                        region.width,
                        region.height
                    );

                    // Draw green border around the region
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
