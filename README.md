Follow for more... https://www.patreon.com/EasyModules

# EasyTrials

EasyTrials turns saving throws, skill checks, and group checks into a synchronized cinematic moment for the whole table in Foundry Virtual Tabletop.

## Features

- Saving throws and skill checks for up to six selected tokens.
- Individual resolution or the D&D group-check rule: the group succeeds when at least half of its members succeed.
- Animated participant cards with visible modifiers, advantage, disadvantage, and GM-applied bonus formulas.
- Correct cancellation when advantage and disadvantage are both present.
- Optional GM release control that locks player rolls until the table is ready.
- Immediate internal results or an optional 3D dice presentation through Dice So Nice.
- Separate audio and animations for cards, individual outcomes, group outcomes, rerolls, and closing.
- Detailed final chat summary showing the d20 result, system modifier, extra formula, extra dice, and total.
- English and Brazilian Portuguese localization.
- Optional integration with the EasyModules Hub.

## Requirements

- Foundry Virtual Tabletop 14.
- D&D 5e system 5.3.0 or newer.

No external Foundry module is required.

### Optional

- **Dice So Nice** adds the 3D dice animation used when immediate results are disabled.
- **EasyModules Hub** provides a shared launcher and configuration entry for the EasyModules suite.

## Installation

### Manifest URL

Paste this URL into Foundry's **Install Module** dialog:

```text
https://github.com/EasyModules/EasyTrials/releases/latest/download/module.json
```

### Manual installation

Extract the release archive so the manifest is located at:

```text
Data/modules/easy-trials/module.json
```

Then enable **EasyTrials** in the world's module management screen.

## Usage

1. Select up to six tokens on the canvas.
2. Run the automatically created **Trials of Fate** macro.
3. Choose a saving throw or skill, set the DC, and select individual or group resolution.
4. Configure advantage, disadvantage, or an extra formula such as `1d4` in the GM panel.
5. Apply any extra formula and release player rolls when the table is ready.

The public API is also available through:

```js
await game.easyTrials.start();
game.easyTrials.configure();
```

Other modules can access the same API through:

```js
game.modules.get("easy-trials")?.api
```

## Settings

Open **Configure Settings → Module Settings → EasyTrials**.

- **Reveal results immediately:** rolls internally and displays the result without calling 3D dice.
- **Enable sound effects:** controls the complete EasyTrials audio profile.
- **Require GM release:** begins each Trial with player roll buttons locked.
- **Post final summary to chat:** creates or suppresses the detailed final summary.

## Compatibility notes

EasyTrials is designed for Foundry VTT 14 and D&D 5e 5.3.x. Dice So Nice support is optional and detected at runtime.

## License and credits

- Source code and original documentation: MIT License. See [`LICENSE`](LICENSE).
- EasyModules brand and project assets: see [`ASSET_LICENSE.md`](ASSET_LICENSE.md).
- Third-party audio and SRD notices: see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Development disclosure

EasyTrials was developed with AI-assisted coding and design tools under the direction, testing, review, and maintenance of EasyModules. The package is not presented as “Zero AI.”

## Author

**EasyModules**  
https://github.com/EasyModules

## Support and bug reports

https://github.com/EasyModules/EasyTrials/issues
