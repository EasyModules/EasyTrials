# EasyTrials 1.0.1 — Compatibility and Update Resilience

## Supported environment

- Foundry Virtual Tabletop v13.351 through v14
- Verified with Foundry v14 build 364
- D&D 5e system 5.3.0 or newer
- Verified with D&D 5e 5.3.3
- EasyModules Hub 1.0.7 or newer (required)
- Dice So Nice (optional)

## Integration model

EasyTrials exposes its supported runtime API through `game.easyTrials` and the module API for `easy-trials`. The legacy `game.trialsOfFate` alias remains available for backwards compatibility.

The module registers its settings through Foundry's settings API and remains configurable both through the normal Foundry Module Settings screen and through the EasyModules Hub.

The launch macro is marked with both the EasyTrials generated-macro flag and the shared `flags.easy-modules.owner = "easy-trials"` marker. When EasyModules Hub 1.0.7 or newer is active, the macro is claimed by the Hub and organized under `EASYMODULES/EasyTrials`.

## Update-sensitive areas

The main areas that should be regression-tested after Foundry or D&D 5e updates are:

- token and Actor ownership/selection behavior;
- D&D 5e save and skill modifier data paths;
- Roll evaluation and advantage/disadvantage handling;
- Foundry socket delivery between GM and players;
- Application and Handlebars rendering;
- ChatMessage rendering hooks and EasyTrials chat branding;
- Foundry Macro and Folder document creation/update behavior;
- optional Dice So Nice presentation hooks;
- audio preload/playback behavior.

## Recommended regression tests

1. Enable EasyModules Hub and EasyTrials in a clean v13.351-compatible world and a v14.364 world.
2. Confirm **Trials of Fate** is created once for the GM and reused on reload.
3. Confirm the macro receives `flags.easy-modules.owner = "easy-trials"` and is organized into `EASYMODULES/EasyTrials` when Hub 1.0.7+ is active.
4. Confirm EasyTrials can be launched both from the macro and from the Hub.
5. Confirm settings open from both the Hub and **Game Settings → Configure Settings → Module Settings**.
6. Run a saving throw with normal, advantage, disadvantage, and cancelling advantage/disadvantage states.
7. Run a skill check and verify the displayed system modifier matches the actor sheet.
8. Test a manual bonus formula such as `1d4`.
9. Test both individual and group resolution with multiple selected tokens.
10. Confirm GM release locking and unlocking behaves correctly for players.
11. Confirm final chat summaries show the d20, modifier, extra formula/dice, and total.
12. Test immediate results with Dice So Nice disabled.
13. Test 3D dice presentation with Dice So Nice enabled.
14. Confirm audio settings and individual outcome/group outcome sounds behave correctly.
15. Confirm non-GM users cannot perform GM-only actions.
16. Review the browser console for warnings, deprecated APIs, or socket errors.

## Child-module / Hub compatibility

EasyTrials requires EasyModules Hub 1.0.7 or newer. Future EasyModules Hub releases should preserve the public `register` and `claimMacro` APIs used by EasyTrials, or provide an equivalent compatibility path.
