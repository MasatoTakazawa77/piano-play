/**
 * MusicXML Parser
 * Returns { notes, bpm, timeBeats, timeBeatType, title }
 * notes: [{ note: "C4", time: <quarter-beat-from-start>, duration: <quarter-beats> }]
 */
function parseMusicXML(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XMLの解析に失敗しました');
  }

  let divisions = 1;
  let bpm = 120;
  let timeBeats = 4;
  let timeBeatType = 4;

  const titleEl = doc.querySelector('work-title, movement-title, credit-words');
  const title = titleEl ? titleEl.textContent.trim() : '';

  const notes = [];
  let cursor = 0; // cumulative quarter-note beats from start

  doc.querySelectorAll('measure').forEach(measure => {
    const divEl = measure.querySelector('divisions');
    if (divEl) divisions = parseInt(divEl.textContent);

    const beatsEl = measure.querySelector('time > beats');
    if (beatsEl) timeBeats = parseInt(beatsEl.textContent);

    const beatTypeEl = measure.querySelector('time > beat-type');
    if (beatTypeEl) timeBeatType = parseInt(beatTypeEl.textContent);

    const soundEl = measure.querySelector('sound[tempo]');
    if (soundEl) bpm = parseFloat(soundEl.getAttribute('tempo'));

    let pos = 0; // position within measure in quarter-note beats

    measure.querySelectorAll('note').forEach(noteEl => {
      const durEl = noteEl.querySelector('duration');
      const dur = durEl ? parseInt(durEl.textContent) : 0;
      const durQN = dur / divisions; // duration in quarter notes

      const isRest = !!noteEl.querySelector('rest');
      const isChord = !!noteEl.querySelector('chord');

      if (isChord && notes.length > 0) {
        // chord note: same start time as previous note
        pos -= notes[notes.length - 1].duration;
      }

      if (!isRest) {
        const pitchEl = noteEl.querySelector('pitch');
        if (pitchEl) {
          const step = pitchEl.querySelector('step').textContent.trim();
          const octave = pitchEl.querySelector('octave').textContent.trim();
          const alterEl = pitchEl.querySelector('alter');
          const alter = alterEl ? Math.round(parseFloat(alterEl.textContent)) : 0;

          let noteName = step;
          if (alter === 1) noteName += '#';
          else if (alter === -1) noteName += 'b';
          noteName += octave;

          notes.push({
            note: noteName,
            time: cursor + pos,
            duration: durQN,
          });
        }
      }

      pos += durQN;
    });

    // Advance cursor by actual measure duration in quarter notes
    const measureQN = (timeBeats / timeBeatType) * 4;
    cursor += measureQN;
  });

  return { notes, bpm, timeBeats, timeBeatType, title };
}
