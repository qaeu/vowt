/**
 * Empty-state prompt for Game History. Dropping files is handled globally by App;
 * this only explains the options and offers buttons.
 */

import type { Component } from 'solid-js';
import { For } from 'solid-js';
import { Upload } from 'lucide-solid';

interface DropZoneProps {
	/** Opens the file picker for screenshots */
	onChooseFiles: () => void;
	onImportClick: () => void;
}

const STEPS = [
	'Take a fullscreen scoreboard screenshot after a match.',
	'Drop it here or choose the file; VOWT reads it on your device.',
	'Check the result, fix anything unclear, and save it as a record.',
];

const DropZone: Component<DropZoneProps> = (props) => {
	return (
		<div class="drop-zone">
			<Upload size={40} class="drop-zone__icon" />
			<h2 class="drop-zone__heading">Drop scoreboard screenshots here</h2>
			<div class="drop-zone__actions">
				<button class="primary" onClick={() => props.onChooseFiles()}>
					Choose Files
				</button>
				<button onClick={() => props.onImportClick()}>Import Records</button>
			</div>
			<p class="drop-zone__privacy">
				Screenshots never leave your browser. Nothing is uploaded to a server.
			</p>
			<ol class="drop-zone__steps">
				<For each={STEPS}>{(step) => <li>{step}</li>}</For>
			</ol>
		</div>
	);
};

export default DropZone;
