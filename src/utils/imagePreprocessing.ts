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

/**
 * Define all text regions on the Overwatch scoreboard
 * Based on the real scoreboard layout (2560x1440 resolution)
 */
export function getScoreboardRegions(): TextRegion[] {
  // These coordinates are based on the actual scoreboard screenshot
  // Scaled for a standard resolution
  return [
    // Blue team players (rows in table)
    { name: 'blue_player1_name', x: 280, y: 195, width: 100, height: 30, isItalic: true },
    { name: 'blue_player1_e', x: 490, y: 195, width: 40, height: 30 },
    { name: 'blue_player1_a', x: 535, y: 195, width: 40, height: 30 },
    { name: 'blue_player1_d', x: 575, y: 195, width: 40, height: 30 },
    { name: 'blue_player1_dmg', x: 620, y: 195, width: 60, height: 30 },
    { name: 'blue_player1_h', x: 710, y: 195, width: 40, height: 30 },
    { name: 'blue_player1_mit', x: 765, y: 195, width: 60, height: 30 },
    
    { name: 'blue_player2_name', x: 280, y: 243, width: 100, height: 30, isItalic: true },
    { name: 'blue_player2_e', x: 490, y: 243, width: 40, height: 30 },
    { name: 'blue_player2_a', x: 535, y: 243, width: 40, height: 30 },
    { name: 'blue_player2_d', x: 575, y: 243, width: 40, height: 30 },
    { name: 'blue_player2_dmg', x: 620, y: 243, width: 60, height: 30 },
    { name: 'blue_player2_h', x: 710, y: 243, width: 40, height: 30 },
    { name: 'blue_player2_mit', x: 765, y: 243, width: 60, height: 30 },
    
    { name: 'blue_player3_name', x: 280, y: 290, width: 100, height: 30, isItalic: true },
    { name: 'blue_player3_e', x: 490, y: 290, width: 40, height: 30 },
    { name: 'blue_player3_a', x: 535, y: 290, width: 40, height: 30 },
    { name: 'blue_player3_d', x: 575, y: 290, width: 40, height: 30 },
    { name: 'blue_player3_dmg', x: 620, y: 290, width: 60, height: 30 },
    { name: 'blue_player3_h', x: 710, y: 290, width: 40, height: 30 },
    { name: 'blue_player3_mit', x: 765, y: 290, width: 60, height: 30 },
    
    // Red team players
    { name: 'red_player1_name', x: 280, y: 505, width: 100, height: 30, isItalic: true },
    { name: 'red_player1_e', x: 490, y: 505, width: 40, height: 30 },
    { name: 'red_player1_a', x: 535, y: 505, width: 40, height: 30 },
    { name: 'red_player1_d', x: 575, y: 505, width: 40, height: 30 },
    { name: 'red_player1_dmg', x: 620, y: 505, width: 60, height: 30 },
    { name: 'red_player1_h', x: 710, y: 505, width: 40, height: 30 },
    { name: 'red_player1_mit', x: 765, y: 505, width: 60, height: 30 },
    
    { name: 'red_player2_name', x: 280, y: 553, width: 100, height: 30, isItalic: true },
    { name: 'red_player2_e', x: 490, y: 553, width: 40, height: 30 },
    { name: 'red_player2_a', x: 535, y: 553, width: 40, height: 30 },
    { name: 'red_player2_d', x: 575, y: 553, width: 40, height: 30 },
    { name: 'red_player2_dmg', x: 620, y: 553, width: 60, height: 30 },
    { name: 'red_player2_h', x: 710, y: 553, width: 40, height: 30 },
    { name: 'red_player2_mit', x: 765, y: 553, width: 60, height: 30 },
    
    { name: 'red_player3_name', x: 280, y: 600, width: 100, height: 30, isItalic: true },
    { name: 'red_player3_e', x: 490, y: 600, width: 40, height: 30 },
    { name: 'red_player3_a', x: 535, y: 600, width: 40, height: 30 },
    { name: 'red_player3_d', x: 575, y: 600, width: 40, height: 30 },
    { name: 'red_player3_dmg', x: 620, y: 600, width: 60, height: 30 },
    { name: 'red_player3_h', x: 710, y: 600, width: 40, height: 30 },
    { name: 'red_player3_mit', x: 765, y: 600, width: 60, height: 30 },
    
    // Match info (right side)
    { name: 'result', x: 890, y: 450, width: 120, height: 40, isItalic: true },
    { name: 'final_score', x: 890, y: 490, width: 150, height: 25 },
    { name: 'date', x: 890, y: 515, width: 150, height: 25 },
    { name: 'game_mode', x: 890, y: 537, width: 150, height: 25 },
  ];
}

/**
 * Applies skew correction to italic text to make it more readable
 * @param imageData - Image data to process
 * @param skewAngle - Angle in degrees to unskew (negative for italic correction)
 * @returns Processed image data
 */
function unskewItalicText(imageData: ImageData, skewAngle: number = 15): ImageData {
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
  
  return outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
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
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and enhance contrast
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale conversion using luminosity method
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Enhance contrast
        const contrast = 1.5; // Contrast factor
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const enhancedGray = factor * (gray - 128) + 128;
        
        // Clamp values
        const finalValue = Math.max(0, Math.min(255, enhancedGray));
        
        data[i] = finalValue;     // R
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
    matchInfo: {}
  };
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let currentSection = 'header';
  let columnHeaders: string[] = [];
  let teamColor: 'blue' | 'red' = 'blue';
  
  for (const line of lines) {
    // Check for result
    if (line.toUpperCase() === 'VICTORY' || line.toUpperCase() === 'DEFEAT') {
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
    if (line.match(/^[A-Z\s]+$/) && line.length < 30 && line.includes('E') && line.includes('D')) {
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
          team: teamColor
        };
        
        // Map stats to column headers
        for (let i = 1; i < parts.length && i <= columnHeaders.length; i++) {
          const header = columnHeaders[i - 1] || `stat${i}`;
          const value = parseFloat(parts[i]);
          playerStats[header.toLowerCase()] = isNaN(value) ? parts[i] : value;
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
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      );
      
      // Get image data for the region
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and enhance contrast
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrast = 2.0; // Higher contrast for small regions
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const enhancedGray = factor * (gray - 128) + 128;
        const finalValue = Math.max(0, Math.min(255, enhancedGray));
        
        data[i] = finalValue;
        data[i + 1] = finalValue;
        data[i + 2] = finalValue;
      }
      
      // Apply italic correction if needed
      if (region.isItalic) {
        imageData = unskewItalicText(imageData, 12);
      }
      
      // Put processed data back
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
    matchInfo: {}
  };
  
  // Extract blue team players
  for (let i = 1; i <= 3; i++) {
    const player: any = {
      name: regionResults.get(`blue_player${i}_name`)?.trim() || '',
      team: 'blue',
      e: parseInt(regionResults.get(`blue_player${i}_e`)?.trim() || '0'),
      a: parseInt(regionResults.get(`blue_player${i}_a`)?.trim() || '0'),
      d: parseInt(regionResults.get(`blue_player${i}_d`)?.trim() || '0'),
      dmg: parseInt(regionResults.get(`blue_player${i}_dmg`)?.replace(/,/g, '').trim() || '0'),
      h: parseInt(regionResults.get(`blue_player${i}_h`)?.trim() || '0'),
      mit: parseInt(regionResults.get(`blue_player${i}_mit`)?.replace(/,/g, '').trim() || '0'),
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
      dmg: parseInt(regionResults.get(`red_player${i}_dmg`)?.replace(/,/g, '').trim() || '0'),
      h: parseInt(regionResults.get(`red_player${i}_h`)?.trim() || '0'),
      mit: parseInt(regionResults.get(`red_player${i}_mit`)?.replace(/,/g, '').trim() || '0'),
    };
    if (player.name) {
      stats.players.push(player);
    }
  }
  
  // Extract match info
  stats.matchInfo.result = regionResults.get('result')?.trim().toUpperCase() || '';
  stats.matchInfo.final_score = regionResults.get('final_score')?.trim() || '';
  stats.matchInfo.date = regionResults.get('date')?.trim() || '';
  stats.matchInfo.game_mode = regionResults.get('game_mode')?.trim() || '';
  
  return stats;
}
