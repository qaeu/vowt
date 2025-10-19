import { Component, createSignal, onMount, Show } from 'solid-js';
import Tesseract from 'tesseract.js';
import {
    preprocessImageForOCR,
    preprocessRegionForOCR,
    extractGameStats,
    extractGameStatsFromRegions,
    getScoreboardRegions,
} from '../utils/imagePreprocessing';

interface GameStats {
    [key: string]: string | number;
}

const ScoreboardOCR: Component = () => {
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [preprocessedImage, setPreprocessedImage] = createSignal<string>('');
    const [ocrText, setOcrText] = createSignal<string>('');
    const [extractedStats, setExtractedStats] = createSignal<GameStats>({});
    const [error, setError] = createSignal<string>('');
    const [progress, setProgress] = createSignal<number>(0);

    const hardcodedImagePath = '/scoreboard.png';

    onMount(async () => {
        await processImage();
    });

    const processImage = async () => {
        try {
            setIsProcessing(true);
            setError('');
            setProgress(0);

            // Step 1: Preprocess the full image for display
            setProgress(10);
            const preprocessed = await preprocessImageForOCR(
                hardcodedImagePath
            );
            setPreprocessedImage(preprocessed);
            setProgress(20);

            // Step 2: Perform region-based OCR using Tesseract.js
            let ocrTextParts: string[] = [];
            const regionResults = new Map<string, string>();

            try {
                const worker = await Tesseract.createWorker('eng', 3, {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setProgress(20 + Math.round(m.progress * 50));
                        }
                    },
                });

                // Get all defined regions
                const regions = getScoreboardRegions();
                const totalRegions = regions.length;

                // Process each region individually
                for (let i = 0; i < regions.length; i++) {
                    const region = regions[i];
                    setProgress(20 + Math.round((i / totalRegions) * 50));

                    // Preprocess this specific region
                    const regionImage = await preprocessRegionForOCR(
                        hardcodedImagePath,
                        region
                    );

                    // Recognize text in this region
                    const result = await worker.recognize(regionImage);
                    const text = result.data.text.trim();

                    regionResults.set(region.name, text);
                    ocrTextParts.push(`${region.name}: ${text}`);
                }

                await worker.terminate();

                // Combine all OCR results for display
                setOcrText(ocrTextParts.join('\n'));
            } catch (ocrError) {
                throw ocrError;
            }

            setProgress(70);

            // Step 3: Extract game stats from region results
            const stats = extractGameStatsFromRegions(regionResults);
            setExtractedStats(stats);
            setProgress(100);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Unknown error occurred'
            );
            console.error('Processing error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div
            style={{
                padding: '20px',
                'font-family': 'Arial, sans-serif',
                'max-width': '1400px',
                margin: '0 auto',
            }}
        >
            <h1 style={{ color: '#1976d2' }}>
                Overwatch Scoreboard Tracker POC
            </h1>

            <div
                style={{
                    padding: '15px',
                    'background-color': '#e3f2fd',
                    'border-left': '4px solid #1976d2',
                    'margin-bottom': '20px',
                    'border-radius': '4px',
                }}
            >
                <p style={{ margin: '0', 'font-size': '14px' }}>
                    <strong>POC Demo:</strong> This demonstrates region-based
                    OCR with image preprocessing. Each text element is
                    recognized individually with italic text correction applied
                    where needed. Tesseract.js processes specific rectangles for
                    more accurate extraction.
                </p>
            </div>

            <Show when={error()}>
                <div
                    style={{
                        padding: '15px',
                        'background-color': '#ffebee',
                        color: '#c62828',
                        'border-radius': '4px',
                        'margin-bottom': '20px',
                        'border-left': '4px solid #c62828',
                    }}
                >
                    <strong>Error:</strong> {error()}
                </div>
            </Show>

            <Show when={isProcessing()}>
                <div style={{ 'margin-bottom': '30px' }}>
                    <p style={{ 'font-weight': 'bold', color: '#1976d2' }}>
                        Processing image... {progress()}%
                    </p>
                    <div
                        style={{
                            width: '100%',
                            height: '24px',
                            'background-color': '#e0e0e0',
                            'border-radius': '12px',
                            overflow: 'hidden',
                            'box-shadow': 'inset 0 1px 3px rgba(0,0,0,0.2)',
                        }}
                    >
                        <div
                            style={{
                                width: `${progress()}%`,
                                height: '100%',
                                background:
                                    'linear-gradient(90deg, #1976d2, #42a5f5)',
                                transition: 'width 0.3s ease',
                                'box-shadow':
                                    '0 0 10px rgba(66, 165, 245, 0.5)',
                            }}
                        />
                    </div>
                </div>
            </Show>

            <div
                style={{
                    display: 'grid',
                    'grid-template-columns': '1fr 1fr',
                    gap: '30px',
                    'margin-bottom': '30px',
                }}
            >
                <div
                    style={{
                        padding: '20px',
                        'background-color': '#f5f5f5',
                        'border-radius': '8px',
                        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                >
                    <h2 style={{ 'margin-top': '0', color: '#424242' }}>
                        Original Image
                    </h2>
                    <img
                        src={hardcodedImagePath}
                        alt="Original scoreboard"
                        style={{
                            'max-width': '100%',
                            border: '2px solid #ddd',
                            'border-radius': '4px',
                            display: 'block',
                        }}
                    />
                </div>

                <Show when={preprocessedImage()}>
                    <div
                        style={{
                            padding: '20px',
                            'background-color': '#f5f5f5',
                            'border-radius': '8px',
                            'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                    >
                        <h2 style={{ 'margin-top': '0', color: '#424242' }}>
                            Preprocessed (Grayscale + Contrast)
                        </h2>
                        <img
                            src={preprocessedImage()}
                            alt="Preprocessed scoreboard"
                            style={{
                                'max-width': '100%',
                                border: '2px solid #ddd',
                                'border-radius': '4px',
                                display: 'block',
                            }}
                        />
                        <p
                            style={{
                                'font-size': '13px',
                                color: '#666',
                                'margin-top': '10px',
                            }}
                        >
                            Image converted to grayscale and contrast enhanced
                            for better OCR accuracy
                        </p>
                    </div>
                </Show>
            </div>

            <Show when={ocrText()}>
                <div
                    style={{
                        'margin-bottom': '30px',
                        padding: '20px',
                        'background-color': '#f5f5f5',
                        'border-radius': '8px',
                        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                >
                    <h2 style={{ 'margin-top': '0', color: '#424242' }}>
                        Raw OCR Text Output
                    </h2>
                    <pre
                        style={{
                            'background-color': '#fff',
                            padding: '15px',
                            'border-radius': '4px',
                            'white-space': 'pre-wrap',
                            'word-wrap': 'break-word',
                            border: '1px solid #ddd',
                            'font-family': 'monospace',
                            'font-size': '14px',
                            'line-height': '1.5',
                        }}
                    >
                        {ocrText()}
                    </pre>
                </div>
            </Show>

            <Show when={Object.keys(extractedStats()).length > 0}>
                <div
                    style={{
                        padding: '20px',
                        'background-color': '#e8f5e9',
                        'border-radius': '8px',
                        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                >
                    <h2 style={{ 'margin-top': '0', color: '#2e7d32' }}>
                        Extracted Game Stats (JSON)
                    </h2>
                    <pre
                        style={{
                            'background-color': '#fff',
                            padding: '20px',
                            'border-radius': '4px',
                            'font-size': '16px',
                            'white-space': 'pre-wrap',
                            'word-wrap': 'break-word',
                            border: '1px solid #a5d6a7',
                            'font-family': 'monospace',
                            'line-height': '1.6',
                        }}
                    >
                        {JSON.stringify(extractedStats(), null, 2)}
                    </pre>
                    <p
                        style={{
                            'font-size': '13px',
                            color: '#2e7d32',
                            'margin-top': '15px',
                            'margin-bottom': '0',
                        }}
                    >
                        ✓ Successfully parsed{' '}
                        {Object.keys(extractedStats()).length} data fields from
                        the scoreboard
                    </p>
                </div>
            </Show>
        </div>
    );
};

export default ScoreboardOCR;
