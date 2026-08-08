Follow for more... https://www.patreon.com/EasyModules

# EasyTrials

EasyTrials turns saving throws, skill checks, and group checks into synchronized cinematic moments for the whole table in Foundry Virtual Tabletop.

The GM selects the participants and test, controls advantage, disadvantage, bonuses, and roll release, while EasyTrials keeps the results synchronized and presents the outcome through animated cards, audio, and a detailed final chat summary.

## Features

- Saving throws and skill checks for up to six selected tokens.
- Individual resolution or the D&D group-check rule: the group succeeds when at least half of its members succeed.
- Animated participant cards with visible modifiers, advantage, disadvantage, and GM-applied bonus formulas.
- Correct cancellation when advantage and disadvantage are both present.
- Optional GM release control that locks player rolls until the table is ready.
- Immediate internal results or optional 3D dice presentation through Dice So Nice.
- Separate audio and animations for cards, individual outcomes, group outcomes, rerolls, and closing.
- Detailed final chat summary showing the d20 result, system modifier, extra formula, extra dice, and total.
- English and Brazilian Portuguese localization.
- Managed launch macro integrated with the shared EasyModules macro-folder system.
- Required integration with the EasyModules Hub.

## Requirements

- Foundry Virtual Tabletop v13.351 through v14 (verified on v14.364).
- D&D 5e system 5.3.0 or newer (verified on 5.3.3).
- EasyModules Hub 1.0.7 or newer (required).

### Optional

- **Dice So Nice** adds the 3D dice animation used when immediate results are disabled.

## Installation

Paste this manifest URL into Foundry VTT's **Install Module** manifest field:

```text
https://github.com/EasyModules/EasyTrials/releases/latest/download/module.json
```

After installation, enable **EasyModules Hub** and **EasyTrials** in the world. Foundry will prompt you to install or enable the required Hub dependency when available.

For manual installation, extract the release archive so the manifest is located at:

```text
Data/modules/easy-trials/module.json
```

## Getting Started

1. Select up to six tokens on the canvas.
2. Run the automatically managed **Trials of Fate** macro or launch EasyTrials from the EasyModules Hub.
3. Choose a saving throw or skill, set the DC, and select individual or group resolution.
4. Configure advantage, disadvantage, or an extra formula such as `1d4` in the GM panel.
5. Apply any extra formula and release player rolls when the table is ready.

With EasyModules Hub 1.0.7 or newer, the launch macro is identified as an EasyTrials macro and organized under:

```text
EASYMODULES
└── EasyTrials
    └── Trials of Fate
```

Existing matching EasyTrials macros are reused and updated instead of duplicated.

## Configuration

EasyTrials settings remain available through both supported paths:

- **EasyModules Hub → EasyTrials → Configure**
- **Game Settings → Configure Settings → Module Settings → EasyTrials**

Available settings include:

- **Reveal results immediately:** rolls internally and displays the result without calling 3D dice.
- **Enable sound effects:** controls the complete EasyTrials audio profile.
- **Require GM release:** begins each Trial with player roll buttons locked.
- **Post final summary to chat:** creates or suppresses the detailed final summary.

## Public API

EasyTrials exposes its supported API through `game.easyTrials` after the `ready` hook:

```js
await game.easyTrials.start();
game.easyTrials.configure();
```

Other modules may access the same API through:

```js
game.modules.get("easy-trials")?.api
```

The legacy `game.trialsOfFate` alias remains available for compatibility with older macros and integrations.

## Compatibility

EasyTrials supports Foundry VTT v13.351 through v14 and is verified against v14.364 with D&D 5e 5.3.3. Dice So Nice support is optional and detected at runtime.

The module uses Foundry's public settings, socket, macro, document, and application APIs. Major Foundry or D&D 5e releases should be regression-tested before verified compatibility is increased.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the release checklist and compatibility notes.

## Support

Report bugs and compatibility issues through the [EasyTrials issue tracker](https://github.com/EasyModules/EasyTrials/issues). Include the Foundry VTT version, D&D 5e system version, whether Dice So Nice is enabled, and any relevant browser-console error.

## Development disclosure

EasyTrials is developed and maintained by EasyModules with AI-assisted implementation and code review. Release decisions, testing, licensing, and maintenance remain the responsibility of EasyModules.

The project is not presented as “Zero AI.”

## License and Third-Party Notices

Copyright © 2026 EasyModules. Distributed under the **EasyModules Software License — Version 1.0**. See [LICENSE](LICENSE).

Project-owned asset terms are summarized in [ASSET_LICENSE.md](ASSET_LICENSE.md). Third-party audio, SRD attribution, dependency credits, and trademark notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

EasyTrials is an independent module and is not affiliated with or endorsed by Foundry Gaming LLC, Wizards of the Coast LLC, or the Dice So Nice developers.
