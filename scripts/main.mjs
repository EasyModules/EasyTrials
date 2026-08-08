
const MODULE_ID = "easy-trials";
const SOCKET_NAME = `module.${MODULE_ID}`;
const TEMPLATE = `modules/${MODULE_ID}/templates/challenge.hbs`;
const SETTINGS_TEMPLATE = `modules/${MODULE_ID}/templates/settings.hbs`;
const CARD_SEQUENCE_DELAY = 450;
const CARD_SEQUENCE_INTERVAL = 300;
const INTRO_TAIL = 950;
const CLOSE_FADE_DURATION = 420;
const MAX_PARTICIPANTS = 6;
const BELL_LEAD_IN = 900;
const CARD_FLIP_SOUND_OFFSET = 180;
const START_SYNC_BUFFER = 650;
const ROLLING_TIMEOUT = 30000;
const GROUP_VERDICT_SOUND_DELAY = 360;

const SOUND_EFFECTS = Object.freeze({
  openingBell: { file: "opening-bell.mp3", volume: 0.95, channel: "environment" },
  openingAmbience: { file: "intro-music.mp3", volume: 0.48, channel: "music" },
  cardArrive: { file: "card-arrive.mp3", volume: 0.80, channel: "interface" },
  cardFlip: { file: "card-flip.mp3", volume: 0.95, channel: "interface" },
  logoImpact: { file: "metal-clang.mp3", volume: 0.82, channel: "environment" },
  logoImpactBoom: { file: "forge-boom.mp3", volume: 0.35, channel: "environment" },
  gmRelease: { file: "reroll.mp3", volume: 0.95, channel: "interface" },
  success: { file: "success.ogg", volume: 0.78, channel: "interface" },
  failure: { file: "failure.ogg", volume: 0.72, channel: "interface" },
  groupSuccess: { file: "group-success.mp3", volume: 0.92, channel: "environment" },
  groupFailure: { file: "group-failure-error.mp3", volume: 0.90, channel: "interface" },
  close: { file: "close-whoosh.mp3", volume: 0.85, channel: "interface" }
});

const challenges = new Map();
const applications = new Map();
const rollingTimeouts = new Map();

const ABILITIES = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma"
};


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localize(key, data=null) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
}

function moduleAssetPath(path) {
  return `modules/${MODULE_ID}/assets/${path}`;
}

function getCoordinatorGMId(challenge) {
  const creator = game.users.get(challenge?.createdBy);
  if (creator?.isGM && creator.active) return creator.id;
  return game.users.find(user => user.isGM && user.active)?.id ?? challenge?.createdBy ?? null;
}

function isCoordinatorGM(challenge) {
  return game.user.isGM && game.user.id === getCoordinatorGMId(challenge);
}

function isAuthorizedGM(userId) {
  const user = game.users.get(userId);
  return Boolean(user?.isGM);
}

function getGroupOutcome(challenge) {
  const total = challenge.participants.length;
  const rolled = Object.keys(challenge.results ?? {}).length;
  const successes = Object.values(challenge.results ?? {}).filter(result => result?.success).length;
  const required = Math.ceil(total / 2);
  const complete = total > 0 && rolled === total;

  return {
    enabled: challenge.resolutionMode === "group",
    total,
    rolled,
    successes,
    failures: rolled - successes,
    required,
    complete,
    success: complete && successes >= required
  };
}

const FALLBACK_SKILLS = {
  acr: "Acrobatics",
  ani: "Animal Handling",
  arc: "Arcana",
  ath: "Athletics",
  dec: "Deception",
  his: "History",
  ins: "Insight",
  itm: "Intimidation",
  inv: "Investigation",
  med: "Medicine",
  nat: "Nature",
  prc: "Perception",
  prf: "Performance",
  per: "Persuasion",
  rel: "Religion",
  slt: "Sleight of Hand",
  ste: "Stealth",
  sur: "Survival"
};

function getSkillLabel(skillId) {
  const configured = CONFIG.DND5E?.skills?.[skillId];
  if (typeof configured === "string") return game.i18n.localize(configured);
  if (configured?.label) return game.i18n.localize(configured.label);
  return FALLBACK_SKILLS[skillId] ?? skillId.toUpperCase();
}

function getAbilityLabel(abilityId) {
  const configured = CONFIG.DND5E?.abilities?.[abilityId];
  if (typeof configured === "string") return game.i18n.localize(configured);
  if (configured?.label) return game.i18n.localize(configured.label);
  return ABILITIES[abilityId] ?? abilityId.toUpperCase();
}

function getTestLabel(challenge) {
  if (challenge.testType === "skill") return getSkillLabel(challenge.testKey);
  return localize("TOF.SavingThrowLabel", { ability: getAbilityLabel(challenge.testKey) });
}

function getSaveModifier(actor, abilityId) {
  const ability = actor.system.abilities?.[abilityId];
  const rollData = actor.getRollData?.() ?? {};
  const rollAbility = rollData.abilities?.[abilityId];

  // D&D 5e 5.3.x normally exposes the final saving-throw modifier here.
  const candidates = [
    ability?.save?.value,
    ability?.save,
    ability?.savingThrow,
    ability?.saveModifier,
    rollAbility?.save?.value,
    rollAbility?.save,
    rollAbility?.savingThrow
  ];

  for (const candidate of candidates) {
    if (Number.isFinite(Number(candidate))) return Number(candidate);
  }

  // Fallback: ability modifier + save proficiency.
  const abilityMod = Number(ability?.mod ?? rollAbility?.mod ?? 0);
  const proficiencyLevel = Number(
    ability?.proficient ??
    ability?.save?.proficient ??
    rollAbility?.proficient ??
    0
  );
  const proficiencyBonus = Number(
    actor.system.attributes?.prof ??
    rollData.attributes?.prof ??
    0
  );
  const saveBonus = Number(
    ability?.bonuses?.save ??
    ability?.save?.bonus ??
    rollAbility?.bonuses?.save ??
    0
  );

  return abilityMod + (proficiencyLevel * proficiencyBonus) + saveBonus;
}

function getSkillModifier(actor, skillId) {
  const rollData = actor.getRollData?.() ?? {};
  const skillData =
    rollData.skills?.[skillId] ??
    actor.system.skills?.[skillId];

  const directCandidates = [
    skillData?.total,
    skillData?.value?.total,
    skillData?.mod,
    skillData?.modifier,
    skillData?.value
  ];

  for (const candidate of directCandidates) {
    if (Number.isFinite(Number(candidate))) return Number(candidate);
  }

  const abilityId =
    skillData?.ability ??
    skillData?.abilityId ??
    skillData?.value?.ability;

  const abilityMod = Number(
    actor.system.abilities?.[abilityId]?.mod ??
    rollData.abilities?.[abilityId]?.mod ??
    0
  );

  const proficiencyLevel = Number(
    skillData?.proficient ??
    skillData?.value?.proficient ??
    0
  );

  const proficiencyBonus = Number(
    actor.system.attributes?.prof ??
    rollData.attributes?.prof ??
    0
  );

  const bonus = Number(
    skillData?.bonuses?.check ??
    skillData?.bonus ??
    skillData?.value?.bonus ??
    0
  );

  return abilityMod + (proficiencyLevel * proficiencyBonus) + bonus;
}

class DramaticSaveApplication extends Application {
  constructor(challenge, options={}) {
    super(options);
    this.challengeId = challenge.id;
    this.uiWasHidden = false;
    this.introTimer = null;
    this.signatureTimer = null;
    this.signaturePlayed = false;
    this.soundTimers = new Set();
    this.activeSounds = new Set();
    this.lastGroupImpactAt = null;
    this.bonusDrafts = new Map();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dramatic-saving-throws-window",
      title: "",
      template: TEMPLATE,
      classes: ["trials-of-fate-window"],
      width: "auto",
      height: "auto",
      resizable: true,
      minimizable: true,
      popOut: true,
      closeOnSubmit: false
    });
  }

  get challenge() {
    return challenges.get(this.challengeId);
  }

  async getData() {
    const challenge = this.challenge;
    const participants = [];

    for (const [participantIndex, participant] of challenge.participants.entries()) {
      const result = challenge.results[participant.tokenUuid];
      const isRolling = challenge.rolling?.includes(participant.tokenUuid);
      const tokenDocument = await fromUuid(participant.tokenUuid);
      const actor = tokenDocument?.actor;
      const canControl = !result && (game.user.isGM || actor?.isOwner);

      const control = challenge.controls?.[participant.tokenUuid] ?? {
        rollMode: "normal",
        bonusFormula: ""
      };
      const introComplete = Date.now() >= Number(challenge.introEndsAt ?? 0);
      const rollsUnlocked = Boolean(challenge.rollsUnlocked);
      const playerRollLocked = !game.user.isGM && !rollsUnlocked;
      const bonusFormula = String(control.bonusFormula ?? "").trim();
      const bonusInputValue = game.user.isGM && this.bonusDrafts.has(participant.tokenUuid)
        ? String(this.bonusDrafts.get(participant.tokenUuid) ?? "")
        : bonusFormula;
      const hasBonus = Boolean(bonusFormula);
      const selectedRollMode = control.rollMode ?? "normal";
      const automaticRollState = getAutomaticRollState(actor, challenge);
      const effectiveRollState = resolveCombinedRollState(selectedRollMode, automaticRollState);
      const automaticRollMode = automaticRollState.mode;
      const rollMode = effectiveRollState.mode;
      const rollModeAutomatic = selectedRollMode === "normal" && automaticRollMode !== "normal";
      const rollModeCancelled = effectiveRollState.cancelled;
      const computedModifier = challenge.testType === "skill"
        ? getSkillModifier(actor, challenge.testKey)
        : getSaveModifier(actor, challenge.testKey);
      const baseModifier = Number.isFinite(Number(computedModifier)) ? Number(computedModifier) : 0;
      const baseModifierLabel = `${baseModifier >= 0 ? "+" : ""}${baseModifier}`;

      participants.push({
        ...participant,
        rolled: Boolean(result),
        total: result?.total ?? null,
        success: Boolean(result?.success),
        failure: Boolean(result && !result.success),
        waiting: !result && !isRolling,
        rolling: isRolling,
        status: result ? (result.success ? "success" : "failure") : (isRolling ? "rolling" : "waiting"),
        statusLabel: result
          ? (result.success ? localize("TOF.Success") : localize("TOF.Failure"))
          : (isRolling ? localize("TOF.Rolling") : localize("TOF.Waiting")),
        canControl,
        buttonDisabled: !introComplete || Boolean(isRolling) || playerRollLocked,
        rollLocked: playerRollLocked,
        rollButtonLabel: playerRollLocked ? localize("TOF.RollsLocked") : localize("TOF.Roll"),
        rollButtonIcon: playerRollLocked ? "fa-lock" : "fa-dice-d20",
        entryDelay: CARD_SEQUENCE_DELAY + (participantIndex * CARD_SEQUENCE_INTERVAL),
        animateEntrance: !introComplete,
        rollMode,
        rollModeLabel:
          rollMode === "advantage" ? localize("TOF.Advantage") :
          rollMode === "disadvantage" ? localize("TOF.Disadvantage") :
          "",
        rollModeAutomatic,
        automaticLabel: rollModeAutomatic ? localize("TOF.Automatic") : "",
        normalModeLabel: automaticRollMode !== "normal"
          ? localize("TOF.AutomaticMode", { mode: automaticRollMode === "advantage" ? localize("TOF.Advantage") : localize("TOF.Disadvantage") })
          : localize("TOF.Normal"),
        bonusFormula,
        bonusInputValue,
        bonusDirty: bonusInputValue.trim() !== bonusFormula,
        hasBonus,
        baseModifier,
        baseModifierLabel,
        baseModifierNegative: baseModifier < 0,
        hasRollProfile: true,
        rollModeCancelled,
        cancellationLabel: rollModeCancelled ? localize("TOF.AdvantageDisadvantageCancel") : "",
        cardModeAdvantage: rollMode === "advantage",
        cardModeDisadvantage: rollMode === "disadvantage",
        modeNormal: selectedRollMode === "normal",
        modeAdvantage: selectedRollMode === "advantage",
        modeDisadvantage: selectedRollMode === "disadvantage"
      });
    }

    const rolledCount = Object.keys(challenge.results).length;
    const totalCount = challenge.participants.length;
    const groupOutcome = getGroupOutcome(challenge);
    const groupStatusTitle = groupOutcome.complete
      ? localize(groupOutcome.success ? "TOF.GroupCheckSuccess" : "TOF.GroupCheckFailure")
      : localize("TOF.GroupThreshold");
    const groupStatusDetail = localize("TOF.GroupRequired", {
      successes: groupOutcome.successes,
      required: groupOutcome.required
    });

    const logoHitsAt = Number(challenge.logoHitsAt ?? challenge.introEndsAt ?? 0);
    const groupVerdictAt = Number(challenge.groupVerdictAt ?? 0);
    const groupImpact = groupOutcome.complete
      && groupVerdictAt > 0
      && groupVerdictAt !== this.lastGroupImpactAt;
    if (groupImpact) this.lastGroupImpactAt = groupVerdictAt;

    return {
      abilityLabel: getTestLabel(challenge),
      resolutionMode: challenge.resolutionMode ?? "individual",
      resolutionLabel: challenge.resolutionMode === "group"
        ? localize("TOF.GroupCheck")
        : localize("TOF.IndividualTrial"),
      groupMode: challenge.resolutionMode === "group",
      groupOutcome,
      groupStatusTitle,
      groupStatusDetail,
      groupImpact,
      dc: challenge.dc,
      participants,
      rolledCount,
      totalCount,
      progress: totalCount ? Math.round((rolledCount / totalCount) * 100) : 0,
      complete: rolledCount === totalCount,
      isGM: game.user.isGM,
      rollsUnlocked: Boolean(challenge.rollsUnlocked),
      rollLockLabel: challenge.rollsUnlocked ? localize("TOF.LockAllRolls") : localize("TOF.UnlockAllRolls"),
      rollLockHint: challenge.rollsUnlocked ? localize("TOF.RollsUnlockedHint") : localize("TOF.RollsLockedHint"),
      introComplete: Date.now() >= Number(challenge.introEndsAt ?? 0),
      logoSettled: Date.now() >= logoHitsAt,
      logoPath: moduleAssetPath("trials-of-fate-logo.png")
    };
  }


  hideFoundryUI() {
    if (document.body.classList.contains("tof-immersive-ui")) return;
    document.body.classList.add("tof-immersive-ui");
    this.uiWasHidden = true;
  }

  restoreFoundryUI() {
    if (!this.uiWasHidden) return;
    document.body.classList.remove("tof-immersive-ui");
    this.uiWasHidden = false;
  }

  async close(options={}) {
    if (this._tofClosing) return;
    if (this.introTimer) { window.clearTimeout(this.introTimer); this.introTimer = null; }
    if (this.signatureTimer) { window.clearTimeout(this.signatureTimer); this.signatureTimer = null; }
    for (const timer of this.soundTimers) window.clearTimeout(timer);
    this.soundTimers.clear();
    this._tofClosing = true;

    const { broadcast = true, playSound = true, ...closeOptions } = options;

    // Broadcast first so every connected client begins the same closing beat.
    if (broadcast && game.user.isGM && this.challengeId) {
      game.socket.emit(SOCKET_NAME, {
        action: "close",
        challengeId: this.challengeId,
        gmId: game.user.id
      });
    }

    const element = this.element?.[0] ?? this.element;
    element?.querySelector?.(".tof-overlay")?.classList.add("tof-closing");
    await stopApplicationSounds(this, { fade: 90 });
    if (playSound) void playLocalSound("close");
    await new Promise(resolve => window.setTimeout(resolve, CLOSE_FADE_DURATION));

    clearChallengeRollingTimeouts(this.challengeId);
    this.restoreFoundryUI();
    applications.delete(this.challengeId);
    if (game.user.isGM || options.clearChallenge) challenges.delete(this.challengeId);
    return super.close(closeOptions);
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.hideFoundryUI();

    const logoHitsAt = Number(this.challenge.logoHitsAt ?? this.challenge.introEndsAt ?? 0);
    const logo = html[0]?.querySelector?.(".tof-signature-logo") ?? html.find(".tof-signature-logo")?.[0];
    if (logo && !this.signaturePlayed) {
      const delay = Math.max(0, logoHitsAt - Date.now());
      this.signatureTimer = window.setTimeout(() => {
        this.signatureTimer = null;
        this.signaturePlayed = true;
        logo.classList.remove("is-pending", "is-settled", "is-slammed");
        // Force a layout pass so the impact animation always starts from its hidden state,
        // even for a client that joined the sequence slightly late.
        void logo.offsetWidth;
        logo.classList.add("is-slammed");

        const stage = html[0]?.querySelector?.(".tof-stage") ?? html.find(".tof-stage")?.[0];
        stage?.classList.add("tof-logo-impact");
        const impactTimer = window.setTimeout(() => {
          this.soundTimers.delete(impactTimer);
          stage?.classList.remove("tof-logo-impact");
        }, 520);
        this.soundTimers.add(impactTimer);
        void playLocalSound("logoImpact", null, this);
        const boomTimer = window.setTimeout(() => {
          this.soundTimers.delete(boomTimer);
          void playLocalSound("logoImpactBoom", null, this);
        }, 45);
        this.soundTimers.add(boomTimer);
      }, delay);
    }

    const introEndsAt = Number(this.challenge.introEndsAt ?? 0);
    if (Date.now() < introEndsAt && !this.introTimer) {
      this.introTimer = window.setTimeout(async () => {
        this.introTimer = null;
        await this.render(false);
      }, Math.max(0, introEndsAt - Date.now()) + 50);
    }
    html.find("[data-action='close']").on("click", () => this.close());


    html.find("[data-gm-control='rollMode']").on("change", async event => {
      if (!game.user.isGM) return;
      const tokenUuid = event.currentTarget.dataset.tokenUuid;
      await updateParticipantControl(this.challengeId, tokenUuid, {
        rollMode: event.currentTarget.value
      });
    });

    const applyBonusControl = async (tokenUuid, input, button) => {
      if (!game.user.isGM || !tokenUuid || !input) return;

      let bonusFormula = "";
      try {
        bonusFormula = normalizeBonusFormula(input.value);
      } catch (error) {
        ui.notifications.error(error.message);
        input.focus();
        input.select();
        return;
      }

      if (button) button.disabled = true;
      this.bonusDrafts.delete(tokenUuid);
      await updateParticipantControl(this.challengeId, tokenUuid, { bonusFormula });
    };

    html.find("[data-gm-control='bonus']").on("input", event => {
      if (!game.user.isGM) return;
      const input = event.currentTarget;
      const tokenUuid = input.dataset.tokenUuid;
      this.bonusDrafts.set(tokenUuid, input.value);
      const row = input.closest(".tof-gm-row");
      const applyButton = row?.querySelector?.("[data-action='applyBonus']");
      const committed = String(this.challenge.controls?.[tokenUuid]?.bonusFormula ?? "").trim();
      if (applyButton) applyButton.disabled = input.value.trim() === committed;
    }).on("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const input = event.currentTarget;
      const row = input.closest(".tof-gm-row");
      const applyButton = row?.querySelector?.("[data-action='applyBonus']");
      void applyBonusControl(input.dataset.tokenUuid, input, applyButton);
    });

    html.find("[data-action='applyBonus']").on("click", async event => {
      if (!game.user.isGM) return;
      const button = event.currentTarget;
      const tokenUuid = button.dataset.tokenUuid;
      const row = button.closest(".tof-gm-row");
      const input = row?.querySelector?.("[data-gm-control='bonus']");
      await applyBonusControl(tokenUuid, input, button);
    });

    html.find("[data-action='reroll']").on("click", async event => {
      if (!game.user.isGM) return;
      const button = event.currentTarget;
      const tokenUuid = button.dataset.tokenUuid;
      button.disabled = true;
      await allowParticipantReroll(this.challengeId, tokenUuid);
    });

    html.find("[data-action='toggleRollLock']").on("click", async event => {
      if (!game.user.isGM) return;
      const button = event.currentTarget;
      button.disabled = true;
      await toggleAllRolls(this.challengeId);
    });

    html.find("[data-action='roll']").on("click", async event => {
      const button = event.currentTarget;
      if (button.disabled || Date.now() < Number(this.challenge.introEndsAt ?? 0)) return;
      button.disabled = true;

      try {
        await requestRoll(this.challengeId, button.dataset.tokenUuid);
      } catch (error) {
        console.error(`${MODULE_ID} | Saving throw failed`, error);
        ui.notifications.error(localize("TOF.RollFailed", { message: error.message }));
        button.disabled = false;
      }
    });
  }
}

function moduleAudioPath(filename) {
  return `modules/${MODULE_ID}/assets/audio/${filename}`;
}

function getModuleSetting(key, fallback) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch (_error) {
    return fallback;
  }
}

function soundEffectsEnabled() {
  return Boolean(getModuleSetting("enableSoundEffects", true));
}

function getAudioContext(channel="interface") {
  return game.audio?.[channel] ?? game.audio?.interface ?? game.audio?.context ?? null;
}

function trackApplicationSound(sound, application) {
  if (!sound || !application?.activeSounds) return sound;
  // Keep a lightweight reference until the Trial closes. This avoids depending
  // on version-specific Sound event names while still allowing the intro music
  // and any long effect to be stopped cleanly on close.
  application.activeSounds.add(sound);
  return sound;
}

async function stopApplicationSounds(application, { fade=100 }={}) {
  const sounds = [...(application?.activeSounds ?? [])];
  application?.activeSounds?.clear();

  await Promise.allSettled(sounds.map(async sound => {
    if (!sound?.playing) return;
    await sound.stop?.({ fade });
  }));
}

async function playLocalSound(soundId, volumeOverride=null, application=null) {
  if (!soundEffectsEnabled()) return false;
  const soundConfig = SOUND_EFFECTS[soundId];
  if (!soundConfig) {
    console.warn(`${MODULE_ID} | Unknown sound effect: ${soundId}`);
    return false;
  }

  const src = moduleAudioPath(soundConfig.file);
  const hasVolumeOverride = volumeOverride !== null
    && volumeOverride !== undefined
    && Number.isFinite(Number(volumeOverride));
  const volume = hasVolumeOverride ? Number(volumeOverride) : soundConfig.volume;
  const channel = soundConfig.channel ?? "interface";

  // Use Foundry's public one-shot helper first. It is the most reliable path
  // for short effects in v14, respects the selected audio channel, queues while
  // the browser awaits its first gesture, and remains local because socketOptions
  // is explicitly false. EasyTrials synchronizes the cue through its own socket.
  try {
    const AudioHelperClass = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    if (AudioHelperClass?.play) {
      const sound = AudioHelperClass.play({
        src,
        volume,
        autoplay: true,
        loop: false,
        channel
      }, false);
      trackApplicationSound(sound, application);
      return sound || true;
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | One-shot audio playback failed; trying instance fallback.`, {
      soundId, src, error
    });
  }

  try {
    if (!game.audio?.create) return false;
    const sound = game.audio.create({
      src,
      context: getAudioContext(channel),
      singleton: false,
      preload: true,
      autoplay: true,
      autoplayOptions: { volume, loop: false }
    });
    trackApplicationSound(sound, application);
    return sound;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not play sound effect`, { soundId, src, error });
    return false;
  }
}

function playCardEntranceSequence(participantCount, application=null) {
  for (let index = 0; index < participantCount; index++) {
    const cardDelay = CARD_SEQUENCE_DELAY + (index * CARD_SEQUENCE_INTERVAL);
    const arriveTimer = window.setTimeout(() => {
      application?.soundTimers?.delete(arriveTimer);
      void playLocalSound("cardArrive", null, application);
    }, cardDelay);
    const flipTimer = window.setTimeout(() => {
      application?.soundTimers?.delete(flipTimer);
      void playLocalSound("cardFlip", null, application);
    }, cardDelay + CARD_FLIP_SOUND_OFFSET);
    application?.soundTimers?.add(arriveTimer);
    application?.soundTimers?.add(flipTimer);
  }
}

async function openOrRefresh(challenge, { openingSound=false, resultSound=null, groupSound=null }={}) {
  if (!challenge.testType && challenge.ability) {
    challenge.testType = "save";
    challenge.testKey = challenge.ability;
  }
  challenges.set(challenge.id, challenge);

  let application = applications.get(challenge.id);
  if (!application) {
    application = new DramaticSaveApplication(challenge);
    applications.set(challenge.id, application);
  }

  // The judgment bell is the first beat of every new Trial. The interface only
  // appears after the bell has had room to ring.
  if (openingSound) {
    const startsAt = Number(challenge.startsAt ?? Date.now());
    if (Date.now() < startsAt) await wait(startsAt - Date.now());
    void playLocalSound("openingBell", null, application);
    const windowOpensAt = Number(challenge.windowOpensAt ?? (startsAt + BELL_LEAD_IN));
    if (Date.now() < windowOpensAt) await wait(windowOpensAt - Date.now());
  }

  await application.render(true);

  if (openingSound) {
    void playLocalSound("openingAmbience", null, application);
    playCardEntranceSequence(challenge.participants.length, application);
  }
  if (resultSound) void playLocalSound(resultSound, null, application);
  if (groupSound) {
    const groupTimer = window.setTimeout(() => {
      application.soundTimers.delete(groupTimer);
      void playLocalSound(groupSound, null, application);
    }, resultSound ? GROUP_VERDICT_SOUND_DELAY : 0);
    application.soundTimers.add(groupTimer);
  }
}


async function syncChallenge(challenge, sound=null, groupSound=null) {
  game.socket.emit(SOCKET_NAME, {
    action: "sync",
    challenge,
    sound,
    groupSound,
    gmId: getCoordinatorGMId(challenge)
  });
  await openOrRefresh(challenge, { resultSound: sound, groupSound });
}

async function updateParticipantControl(challengeId, tokenUuid, patch) {
  if (!game.user.isGM) return;
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenge.controls ??= {};
  challenge.controls[tokenUuid] ??= {
    rollMode: "normal",
    bonusFormula: ""
  };

  Object.assign(challenge.controls[tokenUuid], patch);
  await syncChallenge(challenge);
}

async function toggleAllRolls(challengeId) {
  if (!game.user.isGM) return;
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenge.rollsUnlocked = !Boolean(challenge.rollsUnlocked);
  await syncChallenge(challenge);
}

async function allowParticipantReroll(challengeId, tokenUuid) {
  if (!game.user.isGM) return;
  const challenge = challenges.get(challengeId);
  if (!challenge?.results?.[tokenUuid]) return;

  delete challenge.results[tokenUuid];
  clearRollingTimeout(challenge.id, tokenUuid);
  challenge.rolling = (challenge.rolling ?? []).filter(uuid => uuid !== tokenUuid);
  challenge.summaryPosted = false;
  challenge.summaryPosting = false;
  delete challenge.groupVerdictAt;

  await syncChallenge(challenge, "gmRelease");
}

function normalizeBonusFormula(formula) {
  const value = String(formula ?? "").trim();
  if (!value) return "";
  // Only permit dice and arithmetic characters in the GM bonus formula.
  if (!/^[0-9dDkhl+\-*/().\s]+$/.test(value)) {
    throw new Error(localize("TOF.InvalidBonus"));
  }
  return value.replace(/D/g, "d");
}

async function evaluateExtraBonus(formula, actor) {
  if (!formula) return null;
  const safeFormula = /^[+\-]/.test(formula) ? `0 ${formula}` : formula;
  const bonusRoll = new Roll(safeFormula, actor.getRollData?.() ?? {});

  // Dice terms are inherently asynchronous in current Foundry versions. evaluateSync works
  // for fixed modifiers, but throws "terms that cannot be synchronously
  // evaluated" as soon as a formula contains 1d4, 2d6, and similar terms.
  // Always use the asynchronous evaluator for GM bonus formulas.
  return bonusRoll.evaluate({ async: true });
}

function getRollDiceBreakdown(roll) {
  if (!roll) return [];
  return (roll.dice ?? []).map(die => ({
    faces: Number(die.faces ?? 0),
    results: (die.results ?? [])
      .map(result => Number(result.result))
      .filter(Number.isFinite),
    total: Number(die.total ?? 0)
  })).filter(die => die.faces > 0 && die.results.length);
}

function signedNumber(value) {
  const number = Number(value ?? 0);
  return `${number >= 0 ? "+" : ""}${number}`;
}

function formatExtraDiceBreakdown(dice=[]) {
  const groups = (dice ?? []).map(die => {
    const results = (die.results ?? []).map(Number).filter(Number.isFinite);
    if (!results.length) return "";
    return `d${Number(die.faces)} [${results.join(", ")}]`;
  }).filter(Boolean);
  return groups.join(" + ");
}

async function postFinalSummary(challenge) {
  if (!game.user.isGM || !isCoordinatorGM(challenge) || challenge.summaryPosted || challenge.summaryPosting) return;
  if (Object.keys(challenge.results ?? {}).length !== challenge.participants.length) return;
  if (!getModuleSetting("postSummaryToChat", true)) {
    challenge.summaryPosted = true;
    return;
  }

  // Set the guard before any awaited work so simultaneous result events cannot duplicate the post.
  challenge.summaryPosting = true;

  const rollRows = [];
  const passed = [];
  const failed = [];

  for (const participant of challenge.participants) {
    const result = challenge.results[participant.tokenUuid];
    if (!result) continue;

    const rolls = Array.isArray(result.d20Rolls) && result.d20Rolls.length
      ? result.d20Rolls.map(Number)
      : [Number(result.usedD20 ?? 0)];
    const usedD20 = Number(result.usedD20 ?? rolls[0] ?? 0);
    const diceText = rolls.length > 1
      ? `${rolls.join(" / ")} <small>${result.rollMode === "advantage" ? localize("TOF.Advantage") : localize("TOF.Disadvantage")}</small>`
      : `${usedD20}`;
    const systemBonus = Number(
      result.systemBonus ??
      result.baseModifier ??
      (Number(result.total) - usedD20 - Number(result.extraBonusTotal ?? 0))
    );
    const extraFormula = String(result.extraBonusFormula ?? "").trim();
    const extraTotal = Number(result.extraBonusTotal ?? 0);
    const extraDice = formatExtraDiceBreakdown(result.extraBonusDice);
    const extraLine = extraFormula
      ? `<span class="tof-roll-component tof-roll-extra"><b>${localize("TOF.SummaryExtra")}</b> ${escapeHtml(extraFormula)}${extraDice ? ` <em>${escapeHtml(extraDice)}</em>` : ""} = ${signedNumber(extraTotal)}</span>`
      : "";

    rollRows.push(`
      <div class="tof-roll-breakdown-row">
        <strong title="${escapeHtml(participant.name)}">${escapeHtml(participant.name)}</strong>
        <span class="tof-roll-detail-stack">
          <span class="tof-roll-dice"><b>d20</b> ${diceText}</span>
          <span class="tof-roll-component"><b>${localize("TOF.SummaryModifier")}</b> ${signedNumber(systemBonus)}</span>
          ${extraLine}
        </span>
        <span class="tof-roll-math"><small>${localize("TOF.SummaryTotal")}</small><b>${result.total}</b></span>
      </div>
    `);

    const row = `<li><strong>${escapeHtml(participant.name)}</strong>: ${result.total}</li>`;
    if (result.success) passed.push(row);
    else failed.push(row);
  }

  const successSection = passed.length
    ? `<div class="tof-summary-success"><h3>${localize("TOF.Success")}</h3><ul>${passed.join("")}</ul></div>`
    : `<div class="tof-summary-success"><h3>${localize("TOF.Success")}</h3><p>${localize("TOF.NoOne")}</p></div>`;
  const failureSection = failed.length
    ? `<div class="tof-summary-failure"><h3>${localize("TOF.Failure")}</h3><ul>${failed.join("")}</ul></div>`
    : `<div class="tof-summary-failure"><h3>${localize("TOF.Failure")}</h3><p>${localize("TOF.NoOne")}</p></div>`;
  const groupOutcome = getGroupOutcome(challenge);
  const groupVerdict = groupOutcome.enabled
    ? `
      <div class="tof-chat-group-verdict ${groupOutcome.success ? "success" : "failure"}">
        <strong>${localize(groupOutcome.success ? "TOF.GroupCheckSuccess" : "TOF.GroupCheckFailure")}</strong>
        <span>${localize("TOF.GroupSummary", {
          successes: groupOutcome.successes,
          total: groupOutcome.total,
          required: groupOutcome.required
        })}</span>
      </div>
    `
    : "";

  try {
    await ChatMessage.create({
      speaker: { alias: localize("TOF.Title") },
      flags: { [MODULE_ID]: { summary: true, challengeId: challenge.id } },
      content: `
        <section class="tof-chat-summary">
          <h2>${getTestLabel(challenge)} — DC ${challenge.dc}</h2>
          ${groupVerdict}
          <div class="tof-roll-breakdown">
            <h3>${localize("TOF.RollSummary")}</h3>
            ${rollRows.join("")}
          </div>
          <div class="tof-summary-grid">
            ${successSection}
            ${failureSection}
          </div>
        </section>
      `,
      whisper: []
    });

    challenge.summaryPosted = true;
    game.socket.emit(SOCKET_NAME, {
      action: "sync",
      challenge,
      gmId: getCoordinatorGMId(challenge)
    });
  } finally {
    challenge.summaryPosting = false;
  }
}

function getD20ResultData(roll) {
  const d20 = roll?.dice?.find?.(die => Number(die.faces) === 20) ?? roll?.dice?.[0];
  const results = d20?.results ?? [];
  const d20Rolls = results.map(result => Number(result.result)).filter(Number.isFinite);
  const active = results.find(result => result.active || !result.discarded);
  const usedD20 = Number(active?.result ?? d20?.total ?? d20Rolls[0] ?? 0);
  return { d20Rolls, usedD20 };
}

function inferRollMode(roll, requestedMode) {
  const options = roll?.options ?? {};
  const hasAdvantageOption = Object.hasOwn(options, "advantage");
  const hasDisadvantageOption = Object.hasOwn(options, "disadvantage");
  const advantage = Boolean(options.advantage);
  const disadvantage = Boolean(options.disadvantage);

  if (advantage && !disadvantage) return "advantage";
  if (disadvantage && !advantage) return "disadvantage";
  if (hasAdvantageOption || hasDisadvantageOption) return "normal";

  if (["advantage", "disadvantage"].includes(requestedMode)) return requestedMode;
  const { d20Rolls, usedD20 } = getD20ResultData(roll);
  if (d20Rolls.length < 2 || d20Rolls.every(value => value === usedD20)) return "normal";
  if (usedD20 === Math.max(...d20Rolls)) return "advantage";
  if (usedD20 === Math.min(...d20Rolls)) return "disadvantage";
  return "normal";
}

function getPreparedRollState(...modes) {
  const ADV_MODE = CONFIG.Dice?.D20Roll?.ADV_MODE ?? { ADVANTAGE: 1, DISADVANTAGE: -1 };
  let advantageCount = 0;
  let disadvantageCount = 0;

  for (const mode of modes) {
    if (Number(mode) === Number(ADV_MODE.ADVANTAGE)) advantageCount += 1;
    else if (Number(mode) === Number(ADV_MODE.DISADVANTAGE)) disadvantageCount += 1;
  }

  const hasAdvantage = advantageCount > 0;
  const hasDisadvantage = disadvantageCount > 0;
  const mode = hasAdvantage === hasDisadvantage
    ? "normal"
    : (hasAdvantage ? "advantage" : "disadvantage");

  return {
    advantageCount,
    disadvantageCount,
    hasAdvantage,
    hasDisadvantage,
    advantage: mode === "advantage",
    disadvantage: mode === "disadvantage",
    cancelled: hasAdvantage && hasDisadvantage,
    mode
  };
}

function resolveCombinedRollState(manualMode="normal", automaticState={}) {
  const manualAdvantage = manualMode === "advantage";
  const manualDisadvantage = manualMode === "disadvantage";
  const hasAdvantage = manualAdvantage || Boolean(automaticState.hasAdvantage ?? automaticState.advantage);
  const hasDisadvantage = manualDisadvantage || Boolean(automaticState.hasDisadvantage ?? automaticState.disadvantage);
  const mode = hasAdvantage === hasDisadvantage
    ? "normal"
    : (hasAdvantage ? "advantage" : "disadvantage");

  return {
    manualMode,
    hasAdvantage,
    hasDisadvantage,
    advantage: mode === "advantage",
    disadvantage: mode === "disadvantage",
    cancelled: hasAdvantage && hasDisadvantage,
    mode
  };
}

function getAutomaticRollState(actor, challenge) {
  if (!actor || !challenge) return getPreparedRollState();

  if (challenge.testType === "skill") {
    const skillId = challenge.testKey;
    const skillConfig = CONFIG.DND5E?.skills?.[skillId];
    const skill = actor.system.skills?.[skillId];
    const abilityId = skill?.ability ?? skillConfig?.ability;
    const ability = actor.system.abilities?.[abilityId];
    return getPreparedRollState(
      ability?.check?.roll?.mode,
      skill?.roll?.mode
    );
  }

  const ability = actor.system.abilities?.[challenge.testKey];
  return getPreparedRollState(ability?.save?.roll?.mode);
}


function getEffectiveRollState(actor, challenge, control={}) {
  return resolveCombinedRollState(
    control.rollMode ?? "normal",
    getAutomaticRollState(actor, challenge)
  );
}

function addFormulaPart(parts, formula) {
  if (formula) parts.push(`(${formula})`);
}

async function evaluateFastDnd5eRolls(rollConfig, postHook, postData, { callV2=false, emitHooks=true }={}) {
  const D20Roll = CONFIG.Dice?.D20Roll;
  if (!D20Roll?.buildConfigure) return null;

  const rolls = await D20Roll.buildConfigure(
    rollConfig,
    { configure: false },
    { create: false }
  );
  if (!rolls?.length) return null;

  // The standard system workflow awaits Roll#evaluate, which Dice So Nice and
  // other presentation modules may wrap until their animation is complete.
  // evaluateSync resolves the actual d20 immediately; the 3D dice are launched
  // separately after the EasyTrials result has already been synchronized.
  for (const roll of rolls) {
    if (!roll._evaluated) roll.evaluateSync();
  }

  if (emitHooks) {
    Hooks.callAll(postHook, rolls, postData);
    if (callV2) Hooks.callAll(`${postHook}V2`, rolls, postData);
  }
  return rolls[0] ?? null;
}

async function rollSavingThrowFast(actor, challenge, control, bonusFormula, options={}) {
  const D20Roll = CONFIG.Dice?.D20Roll;
  const abilityId = challenge.testKey;
  const ability = actor.system.abilities?.[abilityId];
  if (!D20Roll || !ability) return null;

  const rollData = actor.getRollData?.() ?? {};
  const saveProf = ability.saveProf ?? ability.save?.prof ?? ability.proficient;
  let { parts, data } = D20Roll.constructParts({
    mod: ability.mod,
    prof: saveProf?.hasProficiency ? saveProf.term : null,
    [`${abilityId}SaveBonus`]: ability.bonuses?.save,
    saveBonus: actor.system.bonuses?.abilities?.save,
    cover: abilityId === "dex" ? actor.system.attributes?.ac?.cover : null
  }, rollData);
  addFormulaPart(parts, bonusFormula);
  actor.addRollExhaustion?.(parts, data);

  const effectiveRollState = getEffectiveRollState(actor, challenge, control);
  const rollConfig = {
    ability: abilityId,
    subject: actor,
    target: challenge.dc,
    hookNames: ["SavingThrow", "d20Test"],
    halflingLucky: actor.getFlag?.("dnd5e", "halflingLucky"),
    advantage: effectiveRollState.advantage,
    disadvantage: effectiveRollState.disadvantage,
    rolls: [D20Roll.mergeConfigs({
      parts,
      data,
      options: {
        maximum: ability.save?.roll?.max,
        minimum: ability.save?.roll?.min
      }
    }, {})]
  };

  return evaluateFastDnd5eRolls(
    rollConfig,
    "dnd5e.rollSavingThrow",
    { ability: abilityId, subject: actor },
    options
  );
}

async function rollSkillFast(actor, challenge, control, bonusFormula, options={}) {
  const D20Roll = CONFIG.Dice?.D20Roll;
  const skillId = challenge.testKey;
  const skillConfig = CONFIG.DND5E?.skills?.[skillId];
  const skill = actor.system.skills?.[skillId];
  if (!D20Roll || !skillConfig || !skill) return null;

  const abilityId = skill.ability ?? skillConfig.ability;
  const ability = actor.system.abilities?.[abilityId];
  if (!ability) return null;

  const rollData = actor.getRollData?.() ?? {};
  const proficiency = skill.prof ?? skill.proficiency;
  let { parts, data } = D20Roll.constructParts({
    mod: ability.mod,
    prof: proficiency?.hasProficiency ? proficiency.term : null,
    [`${skillId}Bonus`]: skill.bonuses?.check,
    [`${abilityId}CheckBonus`]: ability.bonuses?.check,
    skillBonus: actor.system.bonuses?.abilities?.skill,
    abilityCheckBonus: actor.system.bonuses?.abilities?.check
  }, { ...rollData });
  addFormulaPart(parts, bonusFormula);
  actor.addRollExhaustion?.(parts, data);
  data.abilityId = abilityId;

  const effectiveRollState = getEffectiveRollState(actor, challenge, control);
  const rollConfig = {
    skill: skillId,
    ability: abilityId,
    subject: actor,
    target: challenge.dc,
    hookNames: ["skill", "abilityCheck", "d20Test"],
    halflingLucky: actor.getFlag?.("dnd5e", "halflingLucky"),
    reliableTalent: Number(skill.value ?? 0) >= 1 && actor.getFlag?.("dnd5e", "reliableTalent"),
    advantage: effectiveRollState.advantage,
    disadvantage: effectiveRollState.disadvantage,
    rolls: [D20Roll.mergeConfigs({
      parts,
      data,
      options: {
        maximum: Math.min(skill.roll?.max ?? Infinity, ability.check?.roll?.max ?? Infinity),
        minimum: Math.max(skill.roll?.min ?? -Infinity, ability.check?.roll?.min ?? -Infinity)
      }
    }, {})]
  };

  return evaluateFastDnd5eRolls(
    rollConfig,
    "dnd5e.rollSkill",
    { ability: abilityId, skill: skillId, subject: actor },
    { ...options, callV2: true }
  );
}

async function rollWithFastDnd5eWorkflow(actor, challenge, control, bonusFormula, options={}) {
  if (challenge.testType === "skill") {
    return rollSkillFast(actor, challenge, control, bonusFormula, options);
  }
  return rollSavingThrowFast(actor, challenge, control, bonusFormula, options);
}

async function rollInternally(actor, effectiveRollState, modifier) {
  const d20Formula =
    effectiveRollState.mode === "advantage" ? "2d20kh" :
    effectiveRollState.mode === "disadvantage" ? "2d20kl" :
    "1d20";
  return new Roll(`${d20Formula} + ${Number(modifier)}`, actor.getRollData?.() ?? {})
    .evaluate({ async: true });
}

function cloneRollForDiceAnimation(roll, actor) {
  let displayRoll = roll;
  try {
    const serialized = roll?.toJSON?.();
    if (serialized && Roll.fromJSON) {
      displayRoll = Roll.fromJSON(typeof serialized === "string" ? serialized : JSON.stringify(serialized));
    }
  } catch (error) {
    console.debug(`${MODULE_ID} | Could not clone roll for Dice So Nice; using original roll.`, error);
  }

  try {
    displayRoll.data ??= {};
    if (actor?.id) displayRoll.data.actorId = actor.id;
  } catch (_error) {
    // Some Roll subclasses expose immutable data. Dice So Nice can still use the roll.
  }
  return displayRoll;
}

function buildDiceAnimationData(roll) {
  const dice = [];
  for (const die of roll?.dice ?? []) {
    const faces = Number(die?.faces);
    if (!Number.isFinite(faces) || faces < 2) continue;
    for (const result of die.results ?? []) {
      const value = Number(result?.result);
      if (!Number.isFinite(value)) continue;
      dice.push({
        result: value,
        resultLabel: value,
        type: `d${faces}`,
        vectors: [],
        options: {
          discarded: Boolean(result?.discarded),
          active: Boolean(result?.active)
        }
      });
    }
  }
  return dice.length ? { throws: [{ dice }] } : null;
}

async function showRollAnimation(roll, actor) {
  const dice3d = game.dice3d;
  if (!dice3d) return false;

  const speaker = ChatMessage.getSpeaker?.({ actor }) ?? null;
  const displayRoll = cloneRollForDiceAnimation(roll, actor);

  if (typeof dice3d.showForRoll === "function") {
    try {
      const displayed = await dice3d.showForRoll(
        displayRoll,
        game.user,
        true,
        null,
        false,
        null,
        speaker,
        { ghost: false, secret: false }
      );
      if (displayed) return true;
    } catch (error) {
      console.warn(`${MODULE_ID} | Dice So Nice showForRoll failed; trying custom animation data.`, error);
    }
  }

  const animationData = buildDiceAnimationData(roll);
  if (animationData && typeof dice3d.show === "function") {
    try {
      return Boolean(await dice3d.show(animationData, game.user, true, null, false));
    } catch (error) {
      console.warn(`${MODULE_ID} | Dice So Nice custom animation failed.`, error);
    }
  }

  return false;
}

async function showRollAnimations(rolls, actor) {
  const validRolls = rolls.filter(roll => roll && Number.isFinite(Number(roll.total)));
  if (!validRolls.length) return false;
  if (validRolls.length === 1) return showRollAnimation(validRolls[0], actor);

  const dice3d = game.dice3d;
  const dice = validRolls.flatMap(roll => buildDiceAnimationData(roll)?.throws?.[0]?.dice ?? []);
  if (dice3d && dice.length && typeof dice3d.show === "function") {
    try {
      return Boolean(await dice3d.show({ throws: [{ dice }] }, game.user, true, null, false));
    } catch (error) {
      console.warn(`${MODULE_ID} | Combined dice animation failed; falling back to individual rolls.`, error);
    }
  }

  let displayed = false;
  for (const roll of validRolls) {
    displayed = (await showRollAnimation(roll, actor)) || displayed;
  }
  return displayed;
}

async function requestRoll(challengeId, tokenUuid) {
  const challenge = challenges.get(challengeId);
  if (!challenge) throw new Error(localize("TOF.TrialUnavailable"));
  if (challenge.results[tokenUuid]) return;

  const tokenDocument = await fromUuid(tokenUuid);
  const actor = tokenDocument?.actor;
  if (!actor) throw new Error(localize("TOF.CharacterNotFound"));
  if (!game.user.isGM && !actor.isOwner) throw new Error(localize("TOF.NoControl"));
  if (!game.user.isGM && !challenge.rollsUnlocked) throw new Error(localize("TOF.RollsLockedError"));

  const showImmediately = Boolean(
    challenge.showResultsImmediately ?? getModuleSetting("showResultsImmediately", true)
  );
  const rollingPayload = {
    action: "rolling",
    challengeId,
    tokenUuid,
    userId: game.user.id
  };

  // Instant mode intentionally skips the intermediate "rolling" socket/render.
  // The result is calculated and synchronized directly from the click.
  if (!showImmediately) {
    if (game.user.isGM) await handleAsGM(rollingPayload);
    else game.socket.emit(SOCKET_NAME, rollingPayload);
  }

  try {
    const modifier = challenge.testType === "skill"
      ? getSkillModifier(actor, challenge.testKey)
      : getSaveModifier(actor, challenge.testKey);

    const control = challenge.controls?.[tokenUuid] ?? {
      rollMode: "normal",
      bonusFormula: ""
    };

    const bonusFormula = normalizeBonusFormula(control.bonusFormula);
    const effectiveRollState = getEffectiveRollState(actor, challenge, control);
    let roll = null;

    if (showImmediately) {
      // Instant mode is deliberately internal: no Dice So Nice call, no dnd5e
      // presentation hook, and therefore no visual or timing delay before the
      // EasyTrials card reveals success or failure.
      roll = await rollInternally(actor, effectiveRollState, modifier);
    } else {
      try {
        // EasyTrials owns the single combined Dice So Nice animation. Suppressing
        // the dnd5e post-roll presentation hooks prevents the base d20 from being
        // animated once by the system and then duplicated beside the GM bonus die.
        roll = await rollWithFastDnd5eWorkflow(
          actor,
          challenge,
          control,
          "",
          { emitHooks: false }
        );
      } catch (systemRollError) {
        console.warn(`${MODULE_ID} | Fast dnd5e roll workflow failed; using internal fallback.`, systemRollError);
      }
      if (!roll) roll = await rollInternally(actor, effectiveRollState, modifier);
    }

    // The GM bonus is evaluated independently so its formula and exact result can
    // be shown in the final breakdown. In cinematic mode its dice are merged into
    // the same single Dice So Nice throw as the d20.
    const bonusRoll = await evaluateExtraBonus(bonusFormula, actor);
    const extraBonusTotal = Number(bonusRoll?.total ?? 0);
    const total = Number(roll.total) + extraBonusTotal;
    const { d20Rolls, usedD20 } = getD20ResultData(roll);
    const actualRollMode = inferRollMode(roll, effectiveRollState.mode);
    const systemBonus = Number(roll.total) - usedD20;
    const payload = {
      action: "result",
      challengeId,
      tokenUuid,
      total,
      d20Rolls,
      usedD20,
      totalBonus: total - usedD20,
      baseModifier: Number(modifier),
      systemBonus,
      extraBonusFormula: bonusFormula,
      extraBonusTotal,
      extraBonusDice: getRollDiceBreakdown(bonusRoll),
      rollMode: actualRollMode,
      userId: game.user.id
    };

    const deliverResult = () => game.user.isGM
      ? handleAsGM(payload)
      : Promise.resolve(game.socket.emit(SOCKET_NAME, payload));

    if (showImmediately) {
      await deliverResult();
    } else {
      await showRollAnimations([roll, bonusRoll], actor);
      await deliverResult();
    }
  } catch (error) {
    if (!showImmediately) {
      const cancelPayload = { action: "cancelRolling", challengeId, tokenUuid, userId: game.user.id };
      if (game.user.isGM) await handleAsGM(cancelPayload);
      else game.socket.emit(SOCKET_NAME, cancelPayload);
    }
    throw error;
  }
}

async function validateSender(userId, tokenUuid) {
  const user = game.users.get(userId);
  const tokenDocument = await fromUuid(tokenUuid);
  if (!user || !tokenDocument?.actor) return false;
  return user.isGM || tokenDocument.actor.testUserPermission(user, "OWNER");
}

function participantBelongsToChallenge(challenge, tokenUuid) {
  return challenge.participants.some(participant => participant.tokenUuid === tokenUuid);
}

function clearRollingTimeout(challengeId, tokenUuid) {
  const key = `${challengeId}:${tokenUuid}`;
  const timeout = rollingTimeouts.get(key);
  if (timeout) window.clearTimeout(timeout);
  rollingTimeouts.delete(key);
}

function clearChallengeRollingTimeouts(challengeId) {
  const prefix = `${challengeId}:`;
  for (const [key, timeout] of rollingTimeouts.entries()) {
    if (!key.startsWith(prefix)) continue;
    window.clearTimeout(timeout);
    rollingTimeouts.delete(key);
  }
}

function scheduleRollingTimeout(challenge, tokenUuid) {
  clearRollingTimeout(challenge.id, tokenUuid);
  const key = `${challenge.id}:${tokenUuid}`;
  const timeout = window.setTimeout(async () => {
    rollingTimeouts.delete(key);
    const current = challenges.get(challenge.id);
    if (!current || current.results?.[tokenUuid] || !current.rolling?.includes(tokenUuid)) return;
    current.rolling = current.rolling.filter(uuid => uuid !== tokenUuid);
    if (isCoordinatorGM(current)) await syncChallenge(current);
  }, ROLLING_TIMEOUT);
  rollingTimeouts.set(key, timeout);
}

async function handleAsGM(payload) {
  const challenge = challenges.get(payload.challengeId);
  if (!challenge || !isCoordinatorGM(challenge)) return;
  if (!participantBelongsToChallenge(challenge, payload.tokenUuid)) return;

  if (payload.action === "rolling") {
    if (!(await validateSender(payload.userId, payload.tokenUuid))) return;
    const sender = game.users.get(payload.userId);
    if (!sender?.isGM && !challenge.rollsUnlocked) return;
    if (challenge.results[payload.tokenUuid]) return;
    challenge.rolling ??= [];
    if (!challenge.rolling.includes(payload.tokenUuid)) challenge.rolling.push(payload.tokenUuid);
    scheduleRollingTimeout(challenge, payload.tokenUuid);
    await syncChallenge(challenge);
    return;
  }

  if (payload.action === "cancelRolling") {
    if (!(await validateSender(payload.userId, payload.tokenUuid))) return;
    clearRollingTimeout(challenge.id, payload.tokenUuid);
    challenge.rolling = (challenge.rolling ?? []).filter(uuid => uuid !== payload.tokenUuid);
    await syncChallenge(challenge);
    return;
  }

  if (payload.action === "result") {
    if (!(await validateSender(payload.userId, payload.tokenUuid))) return;
    const sender = game.users.get(payload.userId);
    const wasRolling = challenge.rolling?.includes(payload.tokenUuid);
    if (!sender?.isGM && !challenge.rollsUnlocked && !wasRolling) return;
    if (challenge.results[payload.tokenUuid]) return;

    const total = Number(payload.total);
    if (!Number.isFinite(total)) return;

    clearRollingTimeout(challenge.id, payload.tokenUuid);
    challenge.rolling = (challenge.rolling ?? []).filter(uuid => uuid !== payload.tokenUuid);
    const success = total >= challenge.dc;
    challenge.results[payload.tokenUuid] = {
      total,
      success,
      d20Rolls: Array.isArray(payload.d20Rolls) ? payload.d20Rolls.map(Number) : [],
      usedD20: Number(payload.usedD20 ?? 0),
      totalBonus: Number(payload.totalBonus ?? 0),
      baseModifier: Number(payload.baseModifier ?? 0),
      systemBonus: Number(payload.systemBonus ?? payload.baseModifier ?? 0),
      extraBonusFormula: String(payload.extraBonusFormula ?? ""),
      extraBonusTotal: Number(payload.extraBonusTotal ?? 0),
      extraBonusDice: Array.isArray(payload.extraBonusDice)
        ? payload.extraBonusDice.map(die => ({
            faces: Number(die.faces ?? 0),
            results: Array.isArray(die.results) ? die.results.map(Number).filter(Number.isFinite) : [],
            total: Number(die.total ?? 0)
          }))
        : [],
      rollMode: ["advantage", "disadvantage"].includes(payload.rollMode) ? payload.rollMode : "normal"
    };

    const groupOutcome = getGroupOutcome(challenge);
    let groupSound = null;
    if (groupOutcome.enabled && groupOutcome.complete && !challenge.groupVerdictAt) {
      challenge.groupVerdictAt = Date.now();
      groupSound = groupOutcome.success ? "groupSuccess" : "groupFailure";
    }

    await syncChallenge(challenge, success ? "success" : "failure", groupSound);
    await postFinalSummary(challenge);
  }
}

async function onSocket(payload) {
  if (!payload?.action) return;

  // Some socket transports echo broadcasts to the sender. The coordinator has
  // already applied these actions locally, so ignore its own GM-originated echo.
  if (["start", "sync", "close"].includes(payload.action)
      && game.user.isGM && payload.gmId === game.user.id) return;

  if (payload.action === "start") {
    if (!isAuthorizedGM(payload.gmId) || payload.challenge?.createdBy !== payload.gmId) return;
    await closeLocalTrialsExcept(payload.challenge.id);
    await openOrRefresh(payload.challenge, { openingSound: true });
    return;
  }

  if (["rolling", "cancelRolling", "result"].includes(payload.action)) {
    if (game.user.isGM) await handleAsGM(payload);
    return;
  }

  if (payload.action === "close") {
    if (!isAuthorizedGM(payload.gmId)) return;
    const application = applications.get(payload.challengeId);
    if (application) {
      await application.close({ broadcast: false, clearChallenge: true, playSound: true });
    } else {
      clearChallengeRollingTimeouts(payload.challengeId);
      challenges.delete(payload.challengeId);
    }
    return;
  }

  if (payload.action === "sync") {
    if (!isAuthorizedGM(payload.gmId)) return;
    const previous = challenges.get(payload.challenge.id);
    let resultSound = null;
    let groupSound = null;

    if (previous) {
      for (const [uuid, result] of Object.entries(payload.challenge.results ?? {})) {
        if (!previous.results?.[uuid]) {
          resultSound = result.success ? "success" : "failure";
          break;
        }
      }

      const previousGroup = getGroupOutcome(previous);
      const nextGroup = getGroupOutcome(payload.challenge);
      if (nextGroup.enabled && nextGroup.complete && !previousGroup.complete) {
        groupSound = nextGroup.success ? "groupSuccess" : "groupFailure";
      }
    }

    await openOrRefresh(payload.challenge, {
      resultSound: payload.sound ?? resultSound,
      groupSound: payload.groupSound ?? groupSound
    });
  }
}

async function closeLocalTrialsExcept(challengeId) {
  const otherIds = new Set([...challenges.keys(), ...applications.keys()]);
  otherIds.delete(challengeId);

  for (const otherId of otherIds) {
    const application = applications.get(otherId);
    if (application) {
      await application.close({ broadcast: false, playSound: false, clearChallenge: true });
    } else {
      clearChallengeRollingTimeouts(otherId);
      challenges.delete(otherId);
    }
  }
}

async function closeActiveTrials() {
  if (!game.user.isGM) return;

  const challengeIds = new Set([...challenges.keys(), ...applications.keys()]);
  for (const challengeId of challengeIds) {
    const application = applications.get(challengeId);
    if (application) {
      await application.close({ broadcast: true, playSound: false, clearChallenge: true });
      continue;
    }

    game.socket.emit(SOCKET_NAME, {
      action: "close",
      challengeId,
      gmId: game.user.id
    });
    clearChallengeRollingTimeouts(challengeId);
    challenges.delete(challengeId);
  }
}

async function startChallenge() {
  if (!game.user.isGM) {
    return ui.notifications.warn(localize("TOF.OnlyGM"));
  }

  const selected = [...canvas.tokens.controlled];
  if (!selected.length) {
    return ui.notifications.warn(localize("TOF.SelectParticipants"));
  }
  if (selected.length > MAX_PARTICIPANTS) {
    return ui.notifications.error(localize("TOF.TooManyParticipants", {
      max: MAX_PARTICIPANTS,
      count: selected.length
    }));
  }

  const skillEntries = Object.keys(CONFIG.DND5E?.skills ?? FALLBACK_SKILLS)
    .map(id => `<option value="skill:${escapeHtml(id)}">${escapeHtml(getSkillLabel(id))}</option>`)
    .join("");
  const participantPreview = selected.map(token => `
    <div class="tof-create-participant">
      <img src="${escapeHtml(token.actor.img || token.document.texture.src)}" alt="${escapeHtml(token.name)}">
      <span title="${escapeHtml(token.name)}">${escapeHtml(token.name)}</span>
    </div>
  `).join("");

  const { DialogV2 } = foundry.applications.api;
  const response = await DialogV2.wait({
    window: {
      title: localize("TOF.CreateTitle"),
      classes: ["tof-create-window"]
    },
    position: { width: 760 },
    content: `
      <div class="tof-create-trial">
        <header class="tof-create-hero">
          <img src="${moduleAssetPath("trials-of-fate-logo.png")}" alt="Trials of Fate">
          <div>
            <h2>${localize("TOF.ForgeTrial")}</h2>
            <p>${localize("TOF.ForgeTrialHint")}</p>
          </div>
        </header>

        <div class="tof-create-layout">
          <section class="tof-create-panel tof-create-check-panel">
            <div class="tof-create-panel-title"><i class="fa-solid fa-dice-d20"></i> ${localize("TOF.Challenge")}</div>

            <label class="tof-create-field">
              <span>${localize("TOF.SavingThrowOrSkill")}</span>
              <select name="test">
                <optgroup label="${localize("TOF.SavingThrows")}">
                  <option value="save:str">${escapeHtml(getTestLabel({ testType: "save", testKey: "str" }))}</option>
                  <option value="save:dex" selected>${escapeHtml(getTestLabel({ testType: "save", testKey: "dex" }))}</option>
                  <option value="save:con">${escapeHtml(getTestLabel({ testType: "save", testKey: "con" }))}</option>
                  <option value="save:int">${escapeHtml(getTestLabel({ testType: "save", testKey: "int" }))}</option>
                  <option value="save:wis">${escapeHtml(getTestLabel({ testType: "save", testKey: "wis" }))}</option>
                  <option value="save:cha">${escapeHtml(getTestLabel({ testType: "save", testKey: "cha" }))}</option>
                </optgroup>
                <optgroup label="${localize("TOF.SkillChecks")}">
                  ${skillEntries}
                </optgroup>
              </select>
            </label>

            <label class="tof-create-field tof-create-dc-field">
              <span>${localize("TOF.DifficultyClass")}</span>
              <div class="tof-create-dc-control">
                <b>DC</b>
                <input type="number" name="dc" value="15" min="1" max="50" step="1">
              </div>
            </label>
          </section>

          <section class="tof-create-panel">
            <div class="tof-create-panel-title"><i class="fa-solid fa-scale-balanced"></i> ${localize("TOF.Resolution")}</div>

            <label class="tof-resolution-option">
              <input type="radio" name="resolutionMode" value="individual" checked>
              <span class="tof-resolution-card">
                <i class="fa-solid fa-user"></i>
                <span>
                  <strong>${localize("TOF.IndividualTrial")}</strong>
                  <small>${localize("TOF.IndividualHint")}</small>
                </span>
              </span>
            </label>

            <label class="tof-resolution-option">
              <input type="radio" name="resolutionMode" value="group">
              <span class="tof-resolution-card">
                <i class="fa-solid fa-users"></i>
                <span>
                  <strong>${localize("TOF.GroupCheck")}</strong>
                  <small>${localize("TOF.GroupHint")}</small>
                </span>
              </span>
            </label>
          </section>
        </div>

        <section class="tof-create-panel tof-create-participants-panel">
          <div class="tof-create-panel-title">
            <i class="fa-solid fa-shield-halved"></i>
            ${localize("TOF.Participants")} <span>${selected.length} / ${MAX_PARTICIPANTS}</span>
          </div>
          <div class="tof-create-participant-grid">${participantPreview}</div>
        </section>
      </div>
    `,
    buttons: [
      {
        action: "launch",
        label: localize("TOF.Launch"),
        default: true,
        callback: (_event, button) => {
          const [testType, testKey] = button.form.elements.test.value.split(":");
          return {
            testType,
            testKey,
            dc: Number(button.form.elements.dc.value),
            resolutionMode: button.form.elements.resolutionMode.value
          };
        }
      },
      { action: "cancel", label: localize("TOF.Cancel") }
    ],
    rejectClose: false
  });

  if (!response) return;
  if (!["save", "skill"].includes(response.testType)) {
    return ui.notifications.error(localize("TOF.InvalidCheck"));
  }
  if (response.testType === "save" && !ABILITIES[response.testKey]) {
    return ui.notifications.error(localize("TOF.InvalidSave"));
  }
  const knownSkills = CONFIG.DND5E?.skills ?? FALLBACK_SKILLS;
  if (response.testType === "skill" && !(response.testKey in knownSkills)) {
    return ui.notifications.error(localize("TOF.InvalidSkill"));
  }
  if (!Number.isInteger(response.dc) || response.dc < 1 || response.dc > 50) {
    return ui.notifications.error(localize("TOF.InvalidDC"));
  }
  if (!["individual", "group"].includes(response.resolutionMode)) {
    return ui.notifications.error(localize("TOF.InvalidResolution"));
  }

  // EasyTrials intentionally supports one cinematic Trial at a time. Replace an
  // existing one only after the GM confirms the new dialog, so Cancel is harmless.
  await closeActiveTrials();

  const startsAt = Date.now() + START_SYNC_BUFFER;
  const windowOpensAt = startsAt + BELL_LEAD_IN;

  const challenge = {
    id: foundry.utils.randomID(),
    testType: response.testType,
    testKey: response.testKey,
    resolutionMode: response.resolutionMode,
    dc: response.dc,
    createdBy: game.user.id,
    startsAt,
    windowOpensAt,
    participants: selected.map(token => ({
      tokenUuid: token.document.uuid,
      actorUuid: token.actor.uuid,
      name: token.name,
      img: token.actor.img || token.document.texture.src
    })),
    results: {},
    rolling: [],
    summaryPosted: false,
    summaryPosting: false,
    groupVerdictAt: null,
    rollsUnlocked: !Boolean(getModuleSetting("requireGMRelease", true)),
    showResultsImmediately: Boolean(getModuleSetting("showResultsImmediately", true)),
    controls: Object.fromEntries(selected.map(token => [
      token.document.uuid,
      { rollMode: "normal", bonusFormula: "" }
    ])),
    logoHitsAt: windowOpensAt + CARD_SEQUENCE_DELAY + ((selected.length - 1) * CARD_SEQUENCE_INTERVAL) + 260,
    introEndsAt: windowOpensAt + CARD_SEQUENCE_DELAY + ((selected.length - 1) * CARD_SEQUENCE_INTERVAL) + INTRO_TAIL
  };

  // The future start timestamp gives every client time to receive the same cue.
  game.socket.emit(SOCKET_NAME, {
    action: "start",
    challenge,
    gmId: game.user.id
  });
  await openOrRefresh(challenge, { openingSound: true });
}

function applyTrialsChatBranding(message, html) {
  if (!message?.flags?.[MODULE_ID]?.summary) return;

  const initial = html instanceof HTMLElement ? html : (html?.[0] ?? html);
  const iconPath = moduleAssetPath("trials-of-fate-logo.png");

  const apply = () => {
    let root = initial;
    if (!root?.querySelector) return;
    root = root.matches?.(".chat-message") ? root : (root.closest?.(".chat-message") ?? root);
    root.classList.add("tof-branded-chat-message");

    // Replace any author portrait Foundry rendered, regardless of its version-specific class.
    const candidates = [...root.querySelectorAll(
      "img.message-avatar, img.avatar, .message-header img, .message-sender img, .message-metadata img"
    )];
    let avatar = candidates.find(image => !image.classList.contains("tof-chat-avatar"));

    if (avatar) {
      avatar.src = iconPath;
      avatar.alt = "Trials of Fate";
      avatar.classList.add("tof-chat-avatar");
      candidates.filter(image => image !== avatar).forEach(image => image.remove());
      return;
    }

    avatar = root.querySelector(".tof-chat-avatar");
    if (avatar) return;
    const header = root.querySelector(".message-header") ?? root;
    const injected = document.createElement("img");
    injected.src = iconPath;
    injected.alt = "Trials of Fate";
    injected.className = "tof-chat-avatar tof-chat-avatar-injected";
    header.prepend(injected);
  };

  apply();
  window.setTimeout(apply, 0);
}

Hooks.on("renderChatMessageHTML", applyTrialsChatBranding);
Hooks.on("renderChatMessage", applyTrialsChatBranding);

async function ensureLaunchMacro() {
  if (!game.user.isGM) return;

  const macroName = localize("TOF.Title");
  const command = "await game.easyTrials.start();";
  const img = moduleAssetPath("trials-of-fate-logo.png");

  let macro = game.macros.find(entry => entry.getFlag(MODULE_ID, "generatedMacro"));

  // Migration fallback: reuse a matching macro instead of creating a duplicate.
  if (!macro) {
    macro = game.macros.find(entry =>
      entry.name === macroName &&
      [
        "game.trialsOfFate.start();",
        "await game.trialsOfFate.start();",
        command
      ].includes(String(entry.command ?? "").trim())
    );
  }

  const data = {
    name: macroName,
    type: "script",
    scope: "global",
    command,
    img,
    flags: {
      [MODULE_ID]: { generatedMacro: true },
      "easy-modules": { owner: MODULE_ID }
    }
  };

  try {
    if (macro) {
      await macro.update(data);
    } else {
      macro = await Macro.create(data);
    }

    if (macro && game.easyModules?.claimMacro) {
      await game.easyModules.claimMacro(macro, MODULE_ID);
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to create the launch macro.`, error);
  }
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class EasyTrialsSettingsApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(foundry.utils.mergeObject({
      window: { title: localize("TOF.Settings.Title") }
    }, options));
  }

  static DEFAULT_OPTIONS = {
    id: "easy-trials-settings",
    classes: ["easy-trials-settings"],
    tag: "section",
    window: {
      title: "EasyTrials Settings",
      icon: "fas fa-dice-d20",
      resizable: true
    },
    position: {
      width: 650,
      height: "auto"
    },
    actions: {
      save: function(event, target) {
        return this._saveSettings(event, target);
      },
      reset: function() {
        return this._resetSettings();
      }
    }
  };

  static PARTS = {
    content: { template: SETTINGS_TEMPLATE }
  };

  async _prepareContext() {
    return {
      logoPath: moduleAssetPath("trials-of-fate-logo.png"),
      showResultsImmediately: Boolean(getModuleSetting("showResultsImmediately", true)),
      enableSoundEffects: Boolean(getModuleSetting("enableSoundEffects", true)),
      requireGMRelease: Boolean(getModuleSetting("requireGMRelease", true)),
      postSummaryToChat: Boolean(getModuleSetting("postSummaryToChat", true))
    };
  }

  _getForm(target) {
    return target?.closest?.("form") ?? this.element?.querySelector?.("form");
  }

  async _saveSettings(_event, target) {
    const form = this._getForm(target);
    if (!form) return;
    const data = new FormData(form);

    await Promise.all([
      game.settings.set(MODULE_ID, "showResultsImmediately", data.has("showResultsImmediately")),
      game.settings.set(MODULE_ID, "enableSoundEffects", data.has("enableSoundEffects")),
      game.settings.set(MODULE_ID, "requireGMRelease", data.has("requireGMRelease")),
      game.settings.set(MODULE_ID, "postSummaryToChat", data.has("postSummaryToChat"))
    ]);

    ui.notifications.info(localize("TOF.Settings.Saved"));
    if (data.has("enableSoundEffects")) void preloadModuleSounds();
    await this.close();
  }

  async _resetSettings() {
    await Promise.all([
      game.settings.set(MODULE_ID, "showResultsImmediately", true),
      game.settings.set(MODULE_ID, "enableSoundEffects", true),
      game.settings.set(MODULE_ID, "requireGMRelease", true),
      game.settings.set(MODULE_ID, "postSummaryToChat", true)
    ]);
    ui.notifications.info(localize("TOF.Settings.Restored"));
    await this.render({ force: true });
  }
}

function openEasyTrialsSettings() {
  return new EasyTrialsSettingsApplication().render({ force: true });
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "configuration", {
    name: "TOF.Settings.Menu.Name",
    label: "TOF.Settings.Menu.Label",
    hint: "TOF.Settings.Menu.Hint",
    icon: "fas fa-dice-d20",
    type: EasyTrialsSettingsApplication,
    restricted: true
  });

  game.settings.register(MODULE_ID, "showResultsImmediately", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "enableSoundEffects", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "requireGMRelease", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "postSummaryToChat", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

});

async function preloadModuleSounds() {
  if (!soundEffectsEnabled()) return;
  const audioHelper = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
  if (!audioHelper?.preloadSound) return;

  const sources = [...new Set(Object.values(SOUND_EFFECTS).map(sound => moduleAudioPath(sound.file)))];
  const results = await Promise.allSettled(sources.map(src => audioHelper.preloadSound(src)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(`${MODULE_ID} | Could not preload sound`, sources[index], result.reason);
    }
  });
}

Hooks.once("ready", async () => {
  game.socket.on(SOCKET_NAME, onSocket);
  void preloadModuleSounds();

  const api = {
    start: startChallenge,
    open: startChallenge,
    configure: openEasyTrialsSettings,
    settings: openEasyTrialsSettings,
    reopen: async challengeId => {
      const challenge = challenges.get(challengeId) ?? [...challenges.values()].at(-1);
      if (!challenge) return ui.notifications.warn(localize("TOF.NoTrial"));
      await openOrRefresh(challenge);
    }
  };

  game.easyTrials = api;

  // Temporary compatibility alias for macros and integrations from older builds.
  game.trialsOfFate = api;

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;

  if (game.easyModules?.register) {
    game.easyModules.register({
      id: MODULE_ID,
      moduleId: MODULE_ID,
      title: "EasyTrials",
      description: localize("TOF.HubDescription"),
      actionLabel: localize("TOF.Launch"),
      configLabel: localize("TOF.Settings.Menu.Label"),
      globalApis: ["easyTrials", "trialsOfFate"],
      onClick: startChallenge,
      onConfigure: openEasyTrialsSettings,
      order: 30
    });
  }

  await ensureLaunchMacro();
  Hooks.callAll("easyTrialsReady", api);

  console.log(`${MODULE_ID} | v1.0.1 ready. Macro: await game.easyTrials.start();`);
});
