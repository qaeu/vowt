import { Component, createSignal, onMount, createEffect, Show } from 'solid-js';
import Tesseract from 'tesseract.js';
import { preprocessImageForOCR, drawRegionsOnImage } from '#utils/preprocess';
import { getScoreboardRegions, getMatchInfoRegions } from '#utils/textRegions';
import { extractGameStats } from '#utils/postprocess';
import {
    saveGameRecord,
    type PlayerStats,
    type MatchInfo,
    type GameRecord,
} from '#utils/gameStorage';
import EditableGameData from '#c/EditableGameData';
import '#styles/ScoreboardOCR';

interface ScoreboardOCRProps {
    uploadedImage?: string | null;
    onClose: () => void;
}

const ScoreboardOCR: Component<ScoreboardOCRProps> = (props) => {
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [preprocessedImagePreview, setPreprocessedImagePreview] =
        createSignal<string>('');
    const [rawOcrText, setRawOcrText] = createSignal<string>('');
    const [extractedStats, setExtractedStats] = createSignal<
        Pick<GameRecord, 'players' | 'matchInfo'>
    >({ players: [], matchInfo: {} as MatchInfo });
    const [error, setError] = createSignal<string>('');
    const [progress, setProgress] = createSignal<number>(0);
    const [currentImage, setCurrentImage] = createSignal<string>();
    const [showJsonStats, setShowJsonStats] = createSignal(false);
    const [showRawText, setShowRawText] = createSignal(false);

    // Editable data states
    const [editablePlayers, setEditablePlayers] = createSignal<PlayerStats[]>(
        []
    );
    const [editableMatchInfo, setEditableMatchInfo] = createSignal<MatchInfo>({
        result: '',
        final_score: { blue: '', red: '' },
        date: '',
        game_mode: '',
        game_length: '',
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);

    onMount(async () => {
        if (props.uploadedImage) {
            setCurrentImage(props.uploadedImage);
            await processImage(props.uploadedImage);
        }
    });

    // React to changes in uploadedImage prop (e.g., drag-and-drop while on OCR page)
    createEffect(() => {
        const uploaded = props.uploadedImage;
        if (uploaded && uploaded !== currentImage()) {
            setCurrentImage(uploaded);
            processImage(uploaded);
        }
    });

    const processImage = async (imagePath?: string) => {
        const imageToProcess = (imagePath || currentImage()) as string;
        try {
            setIsProcessing(true);
            setError('');
            setProgress(0);

            // Step 1: Preprocess the full image
            const preprocessed = await preprocessImageForOCR(imageToProcess);
            setProgress(20);

            // Preview preprocessed image with regions
            const preprocessedPreview = await drawRegionsOnImage(
                preprocessed,
                imageToProcess
            );
            setPreprocessedImagePreview(preprocessedPreview);
            setProgress(25);

            // Step 2: Perform region-based OCR using Tesseract.js
            const ocrTextParts: string[] = [];
            const regionResults = new Map<string, string>();

            const worker = await Tesseract.createWorker('eng', 1);

            // Get all defined regions
            const scoreboardRegions = [
                ...getScoreboardRegions(),
                ...getMatchInfoRegions(),
            ];
            const totalScoreBoardRegions = scoreboardRegions.length;
            for (let i = 0; i < totalScoreBoardRegions; i++) {
                const region = scoreboardRegions[i];
                setProgress(25 + Math.round((i / totalScoreBoardRegions) * 35));

                await worker.setParameters({
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
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

                const text = result.data.text.trim();
                const confidence = result.data.confidence;
                ocrTextParts.push(`${region.name} (${confidence}%): ${text}`);
                regionResults.set(region.name, text);
            }

            await worker.terminate();

            // Combine all OCR results for display
            setRawOcrText(ocrTextParts.join('\n'));
            setProgress(75);

            // Step 3: Extract game stats from region results
            const stats = extractGameStats(regionResults);
            setExtractedStats(stats);
            setProgress(100);

            // Set editable data
            if (stats.players && stats.matchInfo) {
                setEditablePlayers(structuredClone(stats.players));
                setEditableMatchInfo({ ...stats.matchInfo });
                saveGameRecord(editablePlayers(), editableMatchInfo());
                setHasUnsavedChanges(false);
                setSaveSuccess(true);
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

    const handleFileUpload = (event: Event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageData = e.target?.result as string;
                setCurrentImage(imageData);
                await processImage(imageData);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = handleFileUpload;
        input.click();
    };

    const handleSaveData = () => {
        try {
            saveGameRecord(editablePlayers(), editableMatchInfo());
            setHasUnsavedChanges(false);
            setSaveSuccess(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to save game record'
            );
        }
    };

    const handleCancelEdit = () => {
        // Reset to original extracted stats
        const stats = extractedStats();
        if (stats.players && stats.matchInfo) {
            setEditablePlayers(structuredClone(stats.players));
            setEditableMatchInfo({ ...stats.matchInfo });
            setHasUnsavedChanges(false);
        }
    };

    const updatePlayerField = <K extends keyof PlayerStats>(
        index: number,
        field: K,
        value: PlayerStats[K]
    ) => {
        const players = editablePlayers();
        if (players[index]) {
            setEditablePlayers((cur) => {
                cur[index] = { ...cur[index], [field]: value };
                return cur;
            });
            setHasUnsavedChanges(true);
            setSaveSuccess(false);
        }
    };

    const updateMatchInfoField = <K extends keyof MatchInfo>(
        field: K,
        value: MatchInfo[K]
    ) => {
        setEditableMatchInfo((cur) => {
            cur[field] = value;
            return cur;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    return (
        <div class="scoreboard-container">
            <div class="ocr-header">
                <h1 class="scoreboard-title">Upload Scoreboard Screenshot</h1>
                <button
                    onClick={() => {
                        props.onClose();
                    }}
                    class="close-button"
                >
                    ✕ Close
                </button>
            </div>
            <div style={{ 'margin-bottom': '20px' }}>
                <button
                    onClick={triggerFileUpload}
                    disabled={isProcessing()}
                    class="upload-button"
                >
                    📤 Upload Image
                </button>
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
                <Show when={currentImage()}>
                    <div class="image-container">
                        <h2>Uploaded Image</h2>
                        <img src={currentImage()} alt="Uploaded Image" />
                    </div>
                </Show>

                <Show when={preprocessedImagePreview()}>
                    <div class="image-container">
                        <h2>Pre-processed Image</h2>
                        <img
                            src={preprocessedImagePreview()}
                            alt="Pre-processed scoreboard with regions and unskew applied"
                        />
                        <p>
                            Filtered for OCR clarity. Red boxes show scoreboard
                            regions. Green boxes show scoreboard regions with
                            transformed italic text.
                        </p>
                    </div>
                </Show>
            </div>

            <Show when={editablePlayers().length > 0}>
                <EditableGameData
                    players={editablePlayers()}
                    matchInfo={editableMatchInfo()}
                    hasUnsavedChanges={hasUnsavedChanges()}
                    saveSuccess={saveSuccess()}
                    onPlayerUpdate={updatePlayerField}
                    onMatchInfoUpdate={updateMatchInfoField}
                    onSave={handleSaveData}
                    onCancel={handleCancelEdit}
                />
            </Show>

            <Show when={editablePlayers().length > 0}>
                <div class="stats-box">
                    <h2 onClick={() => setShowJsonStats(!showJsonStats())}>
                        <span>Extracted Game Stats (JSON)</span>
                        <span>{showJsonStats() ? '▼' : '▶'}</span>
                    </h2>
                    <Show when={showJsonStats()}>
                        <pre>{JSON.stringify(extractedStats(), null, 2)}</pre>
                        <p class="stats-message">
                            ✓ Successfully parsed{' '}
                            {Object.keys(extractedStats()).length} data fields
                            from the scoreboard
                        </p>
                    </Show>
                </div>
            </Show>

            <Show when={rawOcrText()}>
                <div class="ocr-output-box">
                    <h2 onClick={() => setShowRawText(!showRawText())}>
                        <span>Raw OCR Text Output</span>
                        <span>{showRawText() ? '▼' : '▶'}</span>
                    </h2>
                    <Show when={showRawText()}>
                        <pre>{rawOcrText()}</pre>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default ScoreboardOCR;
