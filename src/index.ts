import {ReactiveController, state} from '@snar/lit';
import {KokoroTTS} from 'kokoro-js';

// prettier-ignore
export const availableVoices = {
	En: ['af_heart', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky', 'af_alloy', 'am_adam', 'am_michael', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_onyx', 'am_puck', 'am_santa', 'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily', 'bm_george', 'bm_lewis', 'bm_daniel', 'bm_fable'],
} as const;

export type EnVoice = (typeof availableVoices)['En'][number];
export type Language = keyof typeof availableVoices;
export type Voice = (typeof availableVoices)[Language][number];

interface KokoroVoice {
	id: Voice;
	description: string;
}

interface PlayOptions {
	voiceId?: Voice;
	speed?: number;
	volume?: number;
}

type CachedAudio = Blob | Promise<Blob>;

export class KokoroClient extends ReactiveController {
	@state() state:
		'disconnected' | 'connecting' | 'connection_error' | 'connected' =
		'disconnected';

	@state() voices: KokoroVoice[] = [];

	private tts: KokoroTTS | null = null;
	private initialization: Promise<KokoroTTS> | null = null;
	private initializationId = 0;

	private cache = new Map<string, CachedAudio>();

	private currentAudios = new Map<
		string,
		{
			audio: HTMLAudioElement;
			resolve: () => void;
		}
	>();

	private pendingPlays = new Set<string>();

	async connect({reconnect = false}: {reconnect?: boolean} = {}) {
		if (this.state === 'connected' && !reconnect) {
			return;
		}

		if (this.initialization && !reconnect) {
			await this.initialization;
			return;
		}

		const initializationId = ++this.initializationId;

		this.state = 'connecting';

		const initialization = KokoroTTS.from_pretrained(
			'onnx-community/Kokoro-82M-v1.0-ONNX',
			{
				dtype: 'q8',
				device: 'wasm',
			},
		);

		this.initialization = initialization;

		try {
			const tts = await initialization;

			if (initializationId !== this.initializationId) {
				return;
			}

			this.tts = tts;

			this.voices = availableVoices.En.map((id) => ({
				id,
				description: '',
			}));

			this.state = 'connected';
		} catch (error) {
			if (initializationId === this.initializationId) {
				this.tts = null;
				this.voices = [];
				this.state = 'connection_error';
			}

			throw error;
		} finally {
			if (this.initialization === initialization) {
				this.initialization = null;
			}
		}
	}

	disconnect() {
		++this.initializationId;
		this.initialization = null;

		this.stop();

		this.tts = null;
		this.voices = [];
		this.cache.clear();

		this.state = 'disconnected';
	}

	async getAudio(
		text: string,
		{voiceId = 'af_heart', speed = 1}: PlayOptions = {},
	): Promise<Blob> {
		if (this.state !== 'connected' || !this.tts) {
			throw new Error('Kokoro is not connected');
		}

		const key = this.getCacheKey(text, voiceId, speed);
		const cached = this.cache.get(key);

		if (cached) {
			return cached instanceof Promise ? cached : Promise.resolve(cached);
		}

		const promise = this.generateAudio(text, voiceId, speed);
		this.cache.set(key, promise);

		try {
			const audio = await promise;
			this.cache.set(key, audio);
			return audio;
		} catch (error) {
			this.cache.delete(key);
			throw error;
		}
	}

	async play(
		text: string,
		{voiceId = 'af_heart', speed = 1, volume = 1}: PlayOptions = {},
	) {
		if (this.state !== 'connected') {
			throw new Error('Kokoro is not connected');
		}

		const key = this.getCacheKey(text, voiceId, speed);

		if (this.pendingPlays.has(key)) {
			return;
		}

		const current = this.currentAudios.get(key);

		if (current) {
			current.audio.currentTime = 0;
			current.audio.volume = Math.max(0, Math.min(1, volume));
			await current.audio.play();
			return;
		}

		this.pendingPlays.add(key);

		try {
			const blob = await this.getAudio(text, {voiceId, speed});

			if (this.state !== 'connected') {
				return;
			}

			await this.playBlob(blob, key, volume);
		} finally {
			this.pendingPlays.delete(key);
		}
	}

	async togglePlay(sentence: string, options: PlayOptions = {}) {
		if (this.currentAudios.size > 0) {
			this.stop();
			return;
		}

		return this.play(sentence, options);
	}

	private async generateAudio(
		text: string,
		voiceId: Voice,
		speed: number,
	): Promise<Blob> {
		const tts = this.tts;

		if (!tts) {
			throw new Error('Kokoro is not connected');
		}

		const audio = await tts.generate(text, {
			voice: voiceId,
			speed,
		});

		return audio.toBlob();
	}

	private async playBlob(blob: Blob, key: string, volume: number) {
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);

		audio.volume = Math.max(0, Math.min(1, volume));

		this.currentAudios.set(key, {
			audio,
			resolve: () => {},
		});

		try {
			await audio.play();

			await new Promise<void>((resolve, reject) => {
				const current = this.currentAudios.get(key);

				if (current?.audio === audio) {
					current.resolve = resolve;
				}

				audio.addEventListener(
					'ended',
					() => {
						if (this.currentAudios.get(key)?.audio === audio) {
							this.currentAudios.delete(key);
						}

						URL.revokeObjectURL(url);
						resolve();
					},
					{once: true},
				);

				audio.addEventListener(
					'error',
					() => {
						if (this.currentAudios.get(key)?.audio === audio) {
							this.currentAudios.delete(key);
						}

						URL.revokeObjectURL(url);
						reject(new Error('Audio playback failed'));
					},
					{once: true},
				);
			});
		} catch (error) {
			if (this.currentAudios.get(key)?.audio === audio) {
				this.currentAudios.delete(key);
			}

			URL.revokeObjectURL(url);
			throw error;
		}
	}

	private stop(key?: string) {
		if (key) {
			const current = this.currentAudios.get(key);

			if (!current) {
				return;
			}

			current.audio.pause();
			current.audio.currentTime = 0;

			this.currentAudios.delete(key);
			current.resolve();

			return;
		}

		for (const current of this.currentAudios.values()) {
			current.audio.pause();
			current.audio.currentTime = 0;
			current.resolve();
		}

		this.currentAudios.clear();
	}

	private getCacheKey(sentence: string, voiceId: Voice, speed: number) {
		return `${voiceId}:${speed}:${sentence}`;
	}

	getRandomVoiceId<L extends Language>({
		lang,
		exclude = [],
	}: {
		lang: L;
		exclude?: (typeof availableVoices)[L][number][];
	}): (typeof availableVoices)[L][number] {
		const voices = availableVoices[lang].filter(
			(voice) => !exclude.includes(voice),
		);

		if (voices.length === 0) {
			throw new Error(`Kokoro has no available voices for ${lang}`);
		}

		return voices[Math.floor(Math.random() * voices.length)]!;
	}

	getVoiceTitleFromId(voiceId: Voice) {
		return voiceId;
	}

	getVoiceIds() {
		return this.voices.map((voice) => voice.id);
	}
}

// export const kokoro = new KokoroClient();
