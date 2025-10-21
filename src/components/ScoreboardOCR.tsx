import { Component, createSignal, onMount, Show } from 'solid-js';
import Tesseract from 'tesseract.js';
import {
    preprocessImageForOCR,
    extractGameStats,
    getScoreboardRegions,
    getMatchInfoRegions,
    drawRegionsOnImage,
} from '../utils/imagePreprocessing';
import { saveGameRecord } from '../utils/gameStorage';
import './ScoreboardOCR.scss';

interface GameStats {
    [key: string]: string | number;
}

const ScoreboardOCR: Component = () => {
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [preprocessedImage, setPreprocessedImage] = createSignal<string>('');
    const [preprocessedImagePreview, setPreprocessedImagePreview] =
        createSignal<string>('');
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
            const preprocessed = await preprocessImageForOCR(
                hardcodedImagePath
            );
            setPreprocessedImage(preprocessed);
            setProgress(20);

            // Preview preprocessed image with regions
            const preprocessedPreview = await drawRegionsOnImage(
                preprocessed,
                hardcodedImagePath
            );
            setPreprocessedImagePreview(preprocessedPreview);
            setProgress(25);

            // Step 2: Perform region-based OCR using Tesseract.js
            let ocrTextParts: string[] = [];
            const regionResults = new Map<string, string>();

            try {
                const worker = await Tesseract.createWorker('eng', 1);

                // Get all defined regions
                const scoreboardRegions = getScoreboardRegions();
                const totalScoreBoardRegions = scoreboardRegions.length;
                for (let i = 0; i < totalScoreBoardRegions; i++) {
                    const region = scoreboardRegions[i];
                    setProgress(
                        25 + Math.round((i / totalScoreBoardRegions) * 35)
                    );

                    await worker.setParameters({
                        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
                        tessedit_char_whitelist: region.charSet,
                    });

                    // Recognize text in this region
                    const result = await worker.recognize(preprocessed, {
                        rectangle: {
                            left: region.x,
                            top: region.y,
                            width: region.width,
                            height: region.height,
                        },
                    });
                    let text;
                    if (result.data.confidence < 6) {
                        text = '???';
                    } else {
                        text = result.data.text.trim();
                    }

                    regionResults.set(region.name, text);
                    ocrTextParts.push(`${region.name}: ${text}`);
                }

                await worker.setParameters({
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
                    tessedit_char_whitelist: '',
                });

                const matchInfoRegions = getMatchInfoRegions();
                const totalMatchInfoRegions = matchInfoRegions.length;
                for (let i = 0; i < totalMatchInfoRegions; i++) {
                    const region = matchInfoRegions[i];
                    setProgress(
                        60 + Math.round((i / totalMatchInfoRegions) * 15)
                    );

                    // Recognize text in this region
                    const result = await worker.recognize(preprocessed, {
                        rectangle: {
                            left: region.x,
                            top: region.y,
                            width: region.width,
                            height: region.height,
                        },
                    });
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
            setProgress(75);

            // Step 3: Extract game stats from region results
            const stats = extractGameStats(regionResults);
            setExtractedStats(stats);
            setProgress(100);

            // Step 4: Save to localStorage
            try {
                if (stats.players && stats.matchInfo) {
                    saveGameRecord(stats.players, stats.matchInfo);
                }
            } catch (saveError) {
                console.error('Error saving game record:', saveError);
                // Don't fail the whole process if save fails
            }
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
        <div class="scoreboard-container">
            <h1 class="scoreboard-title">Overwatch Scoreboard Tracker POC</h1>

            <div class="info-box">
                <p>
                    <strong>POC Demo:</strong> This demonstrates region-based
                    OCR with image preprocessing. Each text element is
                    recognized individually with italic text correction applied
                    where needed. Tesseract.js processes specific rectangles for
                    more accurate extraction.
                </p>
            </div>

            <Show when={error()}>
                <div class="error-box">
                    <strong>Error:</strong> {error()}
                </div>
            </Show>

            <Show when={isProcessing()}>
                <div class="progress-container">
                    <p class="progress-text">
                        Processing image... {progress()}%
                    </p>
                    <div class="progress-bar-wrapper">
                        <div
                            class="progress-bar"
                            style={{ width: `${progress()}%` }}
                        />
                    </div>
                </div>
            </Show>

            <div class="image-grid">
                <div class="image-container">
                    <h2>Original Image</h2>
                    <img src={hardcodedImagePath} alt="Original scoreboard" />
                </div>

                <div class="image-container">
                    <h2>Preprocessed (Regions + Unskew)</h2>
                    <img
                        src={preprocessedImagePreview()}
                        alt="Preprocessed scoreboard with regions and unskew applied"
                    />
                    <p>
                        Grayscale + contrast enhanced with red region boxes.
                        Green borders show italic regions with unskew
                        transformation applied.
                    </p>
                </div>
            </div>

            <Show when={Object.keys(extractedStats()).length > 0}>
                <div class="stats-box">
                    <h2>Extracted Game Stats (JSON)</h2>
                    <pre>{JSON.stringify(extractedStats(), null, 2)}</pre>
                    <p class="stats-message">
                        ✓ Successfully parsed{' '}
                        {Object.keys(extractedStats()).length} data fields from
                        the scoreboard
                    </p>
                </div>
            </Show>

            <Show when={ocrText()}>
                <div class="ocr-output-box">
                    <h2>Raw OCR Text Output</h2>
                    <pre>{ocrText()}</pre>
                </div>
            </Show>
        </div>
    );
};

export default ScoreboardOCR;
