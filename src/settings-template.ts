import {SELECT, SLIDER, SWITCH} from '@vdegenne/forms/FormBuilder.js';
import {html} from 'lit-html';
import {availableVoices, KokoroClient, Language} from './index.js';

/**
 * Imports you'll need:
 *
 * import '@material/web/select/filled-select.js';
 * import '@material/web/select/select-option.js';
 * import '@material/web/button/filled-tonal-button.js';
 * import '@material/web/select/select-option.js';
 * import '@material/web/list/list-item.js';
 * import '@material/web/switch/switch.js';
 * import '@material/web/progress/circular-progress.js';
 * import '@material/web/icon/icon.js'
 * import '@material/web/slider/slider.js';
 */
export function kokoroSettingsTemplate(
	kokoro: KokoroClient,
	store: any,
	lang: Language = 'En',
) {
	switch (kokoro.state) {
		case 'disconnected':
			return 'Kokoro is disconnected';
		case 'connecting':
			return html`<!-- -->
				<md-list-item>
					<md-circular-progress
						indeterminate
						slot="start"
					></md-circular-progress>
					Please wait
				</md-list-item>
				<!-- -->`;
		case 'connection_error':
			return html`<!-- -->
				<md-list-item>
					<md-icon slot="start" style="color: var(--md-sys-color-error)"
						>error</md-icon
					>
					<div slot="headline" style="color: var(--md-sys-color-error)">
						Kokoro server unreachable
					</div>
					<md-filled-tonal-button
						form=""
						slot="end"
						@click="${() => kokoro.connect()}"
						>Try again</md-filled-tonal-button
					>
				</md-list-item>
				<!-- -->`;
		case 'connected': {
			const voices = availableVoices[lang];
			const hasMultipleVoices = voices.length > 1;

			return html`<!-- -->
				${SELECT('Voice', store, `kokoro${lang}VoiceId`, voices, {
					disabled: !hasMultipleVoices || store[`kokoro${lang}Random`],
					supportingText: !hasMultipleVoices
						? 'Only one supported voice'
						: undefined,
				})}
				${
					hasMultipleVoices
						? SWITCH('Random voice', store, `kokoro${lang}Random`)
						: null
				}
				${SLIDER('Voice speed', store, `kokoro${lang}Speed`, {
					min: 0.1,
					max: 1.9,
					step: 0.1,
				})}
				<!-- -->`;
		}
	}
}
