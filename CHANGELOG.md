# Changelog

## 1.0.3

- Made EasyModules Hub an optional recommended integration; EasyTrials now installs and runs from its generated macro and native settings without the Hub.
- Preserved Hub registration and macro organization when the Hub is active.
- Included the D&D 5e 6.x compatibility path developed since 1.0.1; its Foundry regression validation remains pending, so the manifest keeps 5.3.3 as the verified system version.

## Unreleased compatibility work

- Added a D&D 5e 6.0.3 compatibility path and updated Foundry metadata to v14.367; a functional regression pass is still required before increasing the verified system version.
- Updated saving throws and skill checks on D&D 5e 6.x to use the system's `D20RollModificationField.combineFields(...)` pipeline, including Applied Rules.
- Added native D&D 5e 6.x handling for automatic advantage/disadvantage, roll bonuses, minimum/maximum limits, condition roll reductions, Halfling Lucky, and Reliable Talent.
- Replaced the D&D 5e 6.x use of deprecated `addRollExhaustion()` with `addConditionRollReduction()`, while preserving the legacy 5.x roll path.
- Unified immediate and cinematic results on the same D&D 5e `D20Roll` construction so both modes follow identical game rules; immediate mode only skips Dice So Nice presentation.
- Improved roll-mode reporting by reading the D&D 5e `advantageMode` set on the evaluated roll.

## 1.0.1

- Added Foundry VTT v13.351 support while retaining verification against v14.364.
- Made EasyModules Hub 1.0.7 or newer a required dependency.
- Integrated the automatically managed **Trials of Fate** macro with the shared EasyModules macro-folder system using `flags.easy-modules.owner = "easy-trials"` and the Hub `claimMacro(...)` API when available.
- Standardized the package under **EasyModules Software License — Version 1.0** and updated project-owned asset licensing references.
- Reworked English and Brazilian Portuguese documentation to the current EasyModules README standard, including installation, dual-path configuration, public API, compatibility, support, development disclosure, and third-party notices.
- Added `COMPATIBILITY.md` with supported environments, update-sensitive integrations, and a release regression checklist.
- Preserved the existing cinematic checks, sockets, audio, Dice So Nice integration, localization, and public EasyTrials API behavior.

## 1.0.0

- Initial public release.
