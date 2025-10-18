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
    img.crossOrigin = 'anonymous';
    
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
export function extractGameStats(text: string): Record<string, string | number> {
  const stats: Record<string, string | number> = {};
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (const line of lines) {
    // Look for key-value patterns like "Player: JohnDoe" or "Eliminations: 25"
    const match = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      
      // Try to parse as number if possible
      const numValue = parseFloat(value);
      stats[key] = isNaN(numValue) ? value : numValue;
    } else if (line.toUpperCase() === 'VICTORY' || line.toUpperCase() === 'DEFEAT') {
      stats.result = line.toUpperCase();
    }
  }
  
  return stats;
}
