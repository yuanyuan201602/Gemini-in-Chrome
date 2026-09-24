// Chinese narration via the browser's built-in speech synthesis (works offline
// on systems that ship a local zh-CN voice). Falls back to a timed subtitle.
export class Narrator {
  constructor(subtitleEl) {
    this.el = subtitleEl;
    this.enabled = true;
    this.rate = 1;
    this.voice = null;
    this.token = 0;
    this.synth = window.speechSynthesis || null;
    if (this.synth) {
      const pick = () => {
        const voices = this.synth.getVoices();
        this.voice =
          voices.find((v) => /zh[-_]CN/i.test(v.lang) && /Xiaoxiao|Yunxi|Tingting|Huihui|Google/i.test(v.name)) ||
          voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
          voices.find((v) => /^zh/i.test(v.lang)) ||
          null;
      };
      pick();
      this.synth.onvoiceschanged = pick;
    }
  }

  estimate(text) {
    return (text.replace(/\s/g, '').length / 4.6) * 1000 / this.rate + 600;
  }

  // Resolves when the narration is finished (or was cancelled by a newer one).
  say(text) {
    this.stop();
    const token = ++this.token;
    this.el.textContent = text;
    this.el.classList.toggle('show', !!text);
    if (!text) return Promise.resolve();

    const fallback = () => new Promise((res) => setTimeout(res, this.estimate(text)));

    if (!this.enabled || !this.synth || !this.voice) {
      return fallback().then(() => token === this.token);
    }
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = this.rate;
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(token === this.token); } };
      u.onend = done;
      u.onerror = done;
      // Some engines never fire onend; cap by an estimate.
      setTimeout(done, this.estimate(text) * 1.8 + 3000);
      this.synth.speak(u);
    });
  }

  stop() {
    this.token++;
    if (this.synth) this.synth.cancel();
  }

  pause() { if (this.synth && this.synth.speaking) this.synth.pause(); }
  resume() { if (this.synth && this.synth.paused) this.synth.resume(); }
}
