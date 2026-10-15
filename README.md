# @vdegenne/kokoro-standalone

Snar TS reactive controller using kokoro-js.  
The difference with `@vdegenne/kokoro` is that you don't need a TTS server to generate speeches,
this library uses `kokoro-js` and `transformers.js` to generate the voices directly into the browser.

Only English support for now.

## Install

```bash
npm i -D @vdegenne/kokoro-standalone
```

## Usage

```ts
import {KokoroClient} from '@vdegenne/kokoro-standalone';

const kokoro = new KokoroClient();

try {
	await kokoro.connect(); // connect to the model
	kokoro.play('Hello world.');
} catch (err) {
	console.error(`Something went wrong. (${err})`);
}
```

### Arguments

```ts
kokoro.play(
	'Hello world.', // text
	// options
	{
		voiceId: 'af_sky',
		speed: 1,
		volume: 1,
	},
);
```

### Controller

`kokoro` is a controller, you can bind it to a `LitElement` custom element.

```ts
import {KokoroClient} from '@vdegenne/kokoro-standalone';
import {LitElement, customElement} from 'lit';
import {withController} from '@snar/lit';

const kokoro = new KokoroClient();

@customElement('settings-dialog')
@withController(kokoro)
class SettingsDialog extends LitElement {
	// ...
}
```

Use this in your store

```js
@state() kokoroEnVoiceId: EnVoice = availableVoices.En[0]
@state() kokoroEnRandom = false
@state() kokoroEnSpeed = 1
```

With imports being

```js
import {availableVoices, EnVoice} from '@vdegenne/kokoro-standalone';
```
