/**
 * Player — Tone.js based music player
 * Depends on Tone.js being loaded globally.
 */
class Player {
  constructor() {
    this.synth = null;
    this.part = null;
    this.notes = [];
    this.bpm = 120;
    this.volume = 80;
    this.instrument = 'piano';
    this.onNotePlay = null; // callback(noteIndex)
    this.onEnd = null;      // callback()
  }

  async init() {
    await Tone.start();
    this._buildSynth();
  }

  _buildSynth() {
    if (this.synth) {
      this.synth.dispose();
    }

    const presets = {
      piano: {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 1.2 },
      },
      marimba: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
      },
      flute: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.1, sustain: 0.8, release: 0.5 },
      },
      strings: {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.3, decay: 0.1, sustain: 0.8, release: 0.8 },
      },
    };

    const preset = presets[this.instrument] || presets.piano;
    this.synth = new Tone.PolySynth(Tone.Synth, preset).toDestination();
    this._applyVolume();
  }

  _applyVolume() {
    if (!this.synth) return;
    if (this.volume === 0) {
      this.synth.volume.value = -Infinity;
    } else {
      // 0-100 → -40dB to 0dB
      this.synth.volume.value = (this.volume / 100) * 40 - 40;
    }
  }

  load(parsedData) {
    this.notes = parsedData.notes;
    this.bpm = parsedData.bpm;
    this._buildPart();
  }

  _buildPart() {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    if (this.part) {
      this.part.dispose();
      this.part = null;
    }

    if (!this.notes.length) return;

    const spb = 60 / this.bpm; // seconds per quarter-note beat

    const events = this.notes.map((n, i) => ({
      time: n.time * spb,
      note: n.note,
      dur: Math.max(n.duration * spb * 0.85, 0.05),
      index: i,
    }));

    this.part = new Tone.Part((time, val) => {
      this.synth.triggerAttackRelease(val.note, val.dur, time);
      if (this.onNotePlay) {
        Tone.getDraw().schedule(() => this.onNotePlay(val.index), time);
      }
    }, events.map(e => [e.time, e]));

    this.part.start(0);

    // Schedule end event
    const totalDuration = this.notes.reduce((max, n) => {
      return Math.max(max, n.time + n.duration);
    }, 0) * spb;

    Tone.Transport.schedule(() => {
      if (this.onEnd) {
        Tone.getDraw().schedule(() => this.onEnd(), '+0.1');
      }
    }, totalDuration + 0.5);
  }

  play() {
    if (Tone.Transport.state === 'paused') {
      Tone.Transport.start();
    } else {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.start();
    }
  }

  pause() {
    Tone.Transport.pause();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  }

  isPlaying() {
    return Tone.Transport.state === 'started';
  }

  isPaused() {
    return Tone.Transport.state === 'paused';
  }

  setTempo(bpm) {
    const wasPlaying = this.isPlaying();
    this.bpm = bpm;
    this._buildPart();
    if (wasPlaying) {
      Tone.Transport.start();
    }
  }

  setVolume(val) {
    this.volume = val;
    this._applyVolume();
  }

  setInstrument(name) {
    this.instrument = name;
    this._buildSynth();
  }

  dispose() {
    this.stop();
    if (this.part) this.part.dispose();
    if (this.synth) this.synth.dispose();
  }
}
