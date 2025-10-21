import {
    Component,
    createSignal,
    onMount,
    createEffect,
    Show,
    For,
} from 'solid-js';
import Tesseract from 'tesseract.js';
import {
    preprocessImageForOCR,
    extractGameStats,
    getScoreboardRegions,
    getMatchInfoRegions,
    drawRegionsOnImage,
} from '../utils/imagePreprocessing';
import {
    saveGameRecord,
    type PlayerStats,
    type MatchInfo,
    type GameRecord,
} from '../utils/gameStorage';
import './ScoreboardOCR.scss';

interface ScoreboardOCRProps {
    uploadedImage?: string | null;
}

const ScoreboardOCR: Component<ScoreboardOCRProps> = (props) => {
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [preprocessedImage, setPreprocessedImage] = createSignal<string>('');
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
    createEffect(async () => {
        const uploaded = props.uploadedImage;
        if (uploaded && uploaded !== currentImage()) {
            setCurrentImage(uploaded);
            await processImage(uploaded);
        }
    });

    const processImage = async (imagePath?: string) => {
        const imageToProcess = (imagePath || currentImage()) as string;
        try {
            setIsProcessing(true);
            setError('');
            setProgress(0);

            // Step 1: Preprocess the full image for display
            const preprocessed = await preprocessImageForOCR(imageToProcess);
            setPreprocessedImage(preprocessed);
            setProgress(20);

            // Preview preprocessed image with regions
            const preprocessedPreview = await drawRegionsOnImage(
                preprocessed,
                imageToProcess
            );
            setPreprocessedImagePreview(preprocessedPreview);
            setProgress(25);

            // Step 2: Perform region-based OCR using Tesseract.js
            let ocrTextParts: string[] = [];
            const regionResults = new Map<string, string>();

            try {
                const worker = await Tesseract.createWorker('eng', 1);

                // Get all defined regions
                const scoreboardRegions = [
                    ...getScoreboardRegions(),
                    ...getMatchInfoRegions(),
                ];
                const totalScoreBoardRegions = scoreboardRegions.length;
                for (let i = 0; i < totalScoreBoardRegions; i++) {
                    const region = scoreboardRegions[i];
                    setProgress(
                        25 + Math.round((i / totalScoreBoardRegions) * 35)
                    );

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

                    let text = result.data.text.trim();
                    const confidence = result.data.confidence;
                    ocrTextParts.push(
                        `${region.name} (${confidence}%): ${text}`
                    );
                    regionResults.set(region.name, text);
                }

                await worker.terminate();

                // Combine all OCR results for display
                setRawOcrText(ocrTextParts.join('\n'));
            } catch (ocrError) {
                throw ocrError;
            }
            setProgress(75);

            // Step 3: Extract game stats from region results
            const stats = extractGameStats(regionResults);
            setExtractedStats(stats);
            setProgress(100);

            // Set editable data (no auto-save)
            if (stats.players && stats.matchInfo) {
                setEditablePlayers(structuredClone(stats.players));
                setEditableMatchInfo({ ...stats.matchInfo });
                setHasUnsavedChanges(true);
                setSaveSuccess(false);
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
            // Clear success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000);
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
            <h1 class="scoreboard-title">Overwatch Scoreboard Tracker POC</h1>
            <div style={{ 'margin-bottom': '20px' }}>
                <button
                    onClick={triggerFileUpload}
                    disabled={isProcessing()}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#4caf50',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: isProcessing() ? 'not-allowed' : 'pointer',
                        'font-size': '14px',
                        'font-weight': 'bold',
                        'box-shadow': '0 2px 4px rgba(0,0,0,0.2)',
                    }}
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
                        <h2>Original Image</h2>
                        <img src={currentImage()} alt="Original scoreboard" />
                    </div>
                </Show>

                <Show when={preprocessedImagePreview()}>
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
                </Show>
            </div>

            <Show when={editablePlayers().length > 0}>
                <div class="editable-data-container">
                    <div class="editable-header">
                        <h2>Extracted Game Data - Review and Edit</h2>
                        <div class="action-buttons">
                            <button
                                onClick={handleSaveData}
                                disabled={!hasUnsavedChanges()}
                                class="save-button"
                            >
                                💾 Save to Records
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                disabled={!hasUnsavedChanges()}
                                class="cancel-button"
                            >
                                ↺ Reset Changes
                            </button>
                        </div>
                    </div>

                    <Show when={saveSuccess()}>
                        <div class="success-message">
                            ✓ Game record saved successfully!
                        </div>
                    </Show>

                    <Show when={hasUnsavedChanges()}>
                        <div class="unsaved-message">
                            ⚠ You have unsaved changes
                        </div>
                    </Show>

                    <div class="match-info-edit">
                        <h3>Match Information</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Result:</label>
                                <input
                                    type="text"
                                    value={editableMatchInfo().result}
                                    onInput={(e) =>
                                        updateMatchInfoField(
                                            'result',
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </div>
                            <div class="form-group">
                                <label>Score (Blue):</label>
                                <input
                                    type="text"
                                    value={editableMatchInfo().final_score.blue}
                                    onInput={(e) =>
                                        updateMatchInfoField('final_score', {
                                            ...editableMatchInfo().final_score,
                                            blue: e.currentTarget.value,
                                        })
                                    }
                                />
                            </div>
                            <div class="form-group">
                                <label>Score (Red):</label>
                                <input
                                    type="text"
                                    value={editableMatchInfo().final_score.red}
                                    onInput={(e) =>
                                        updateMatchInfoField('final_score', {
                                            ...editableMatchInfo().final_score,
                                            red: e.currentTarget.value,
                                        })
                                    }
                                />
                            </div>
                            <div class="form-group">
                                <label>Date:</label>
                                <input
                                    type="text"
                                    value={editableMatchInfo().date}
                                    onInput={(e) =>
                                        updateMatchInfoField(
                                            'date',
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </div>
                            <div class="form-group">
                                <label>Game Mode:</label>
                                <input
                                    type="text"
                                    value={editableMatchInfo().game_mode}
                                    onInput={(e) =>
                                        updateMatchInfoField(
                                            'game_mode',
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </div>
                            <div class="form-group">
                                <label>Length:</label>
                                <input
                                    type="text"
                                    value={editableMatchInfo().game_length}
                                    onInput={(e) =>
                                        updateMatchInfoField(
                                            'game_length',
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div class="players-edit">
                        <h3>Player Statistics</h3>
                        <div class="teams-container">
                            <div class="team-section">
                                <h4 class="blue-team">Blue Team</h4>
                                <div class="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>E</th>
                                                <th>A</th>
                                                <th>D</th>
                                                <th>DMG</th>
                                                <th>H</th>
                                                <th>MIT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For
                                                each={editablePlayers().filter(
                                                    (p) => p.team === 'blue'
                                                )}
                                            >
                                                {(player, index) => {
                                                    const globalIndex =
                                                        editablePlayers().indexOf(
                                                            player
                                                        );
                                                    return (
                                                        <tr>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={
                                                                        player.name
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'name',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.e
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'e',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.a
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'a',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.d
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'd',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.dmg
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'dmg',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.h
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'h',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.mit
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'mit',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                }}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="team-section">
                                <h4 class="red-team">Red Team</h4>
                                <div class="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>E</th>
                                                <th>A</th>
                                                <th>D</th>
                                                <th>DMG</th>
                                                <th>H</th>
                                                <th>MIT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For
                                                each={editablePlayers().filter(
                                                    (p) => p.team === 'red'
                                                )}
                                            >
                                                {(player, index) => {
                                                    const globalIndex =
                                                        editablePlayers().indexOf(
                                                            player
                                                        );
                                                    return (
                                                        <tr>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={
                                                                        player.name
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'name',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.e
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'e',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.a
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'a',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.d
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'd',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.dmg
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'dmg',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.h
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'h',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={
                                                                        player.mit
                                                                    }
                                                                    onInput={(
                                                                        e
                                                                    ) =>
                                                                        updatePlayerField(
                                                                            globalIndex,
                                                                            'mit',
                                                                            e
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                }}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
