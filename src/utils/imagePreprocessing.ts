/**
 * Image preprocessing utilities for OCR optimization
 */

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
