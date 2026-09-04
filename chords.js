// ==================== MOTOR DE ACORDES ====================
const NOTES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function noteToIndex(letter, accidental) {
  const name = letter + (accidental || "");
  let idx = NOTES_SHARP.indexOf(name);
  if (idx === -1) idx = NOTES_FLAT.indexOf(name);
  return idx;
}
function transposeNoteName(letter, accidental, semitons, useFlats) {
  const idx = noteToIndex(letter, accidental);
  if (idx === -1) return letter + (accidental || "");
  let newIdx = (idx + semitons) % 12;
  if (newIdx < 0) newIdx += 12;
  return (useFlats ? NOTES_FLAT : NOTES_SHARP)[newIdx];
}
const CHORD_REGEX = /^([A-G])(#|b)?((?:maj|min|sus|dim|aug|add)?\d{0,2}(?:m(?!aj))?[\d\w#\+\-]*)(\/([A-G])(#|b)?)?$/;
function parseChord(token) {
  const m = token.match(CHORD_REGEX);
  if (!m) return null;
  return { root: m[1], accidental: m[2] || "", suffix: m[3] || "", bassRoot: m[5] || null, bassAccidental: m[6] || "" };
}
function transposeChord(token, semitons, useFlats) {
  const c = parseChord(token);
  if (!c) return token;
  const newRoot = transposeNoteName(c.root, c.accidental, semitons, useFlats);
  let result = newRoot + c.suffix;
  if (c.bassRoot) result += "/" + transposeNoteName(c.bassRoot, c.bassAccidental, semitons, useFlats);
  return result;
}

const OPEN_SHAPES = {
  "C": { frets: [-1,3,2,0,1,0] }, "Cm": { frets: [-1,3,5,5,4,3], base: 3, barre: true },
  "C#": { frets: [-1,4,6,6,6,4], base: 4, barre: true }, "Db": { frets: [-1,4,6,6,6,4], base: 4, barre: true },
  "D": { frets: [-1,-1,0,2,3,2] }, "Dm": { frets: [-1,-1,0,2,3,1] },
  "D#": { frets: [-1,6,8,8,8,6], base: 6, barre: true }, "Eb": { frets: [-1,6,8,8,8,6], base: 6, barre: true },
  "E": { frets: [0,2,2,1,0,0] }, "Em": { frets: [0,2,2,0,0,0] },
  "F": { frets: [1,3,3,2,1,1], barre: true }, "Fm": { frets: [1,3,3,1,1,1], barre: true },
  "F#": { frets: [2,4,4,3,2,2], barre: true }, "Gb": { frets: [2,4,4,3,2,2], barre: true },
  "G": { frets: [3,2,0,0,0,3] }, "Gm": { frets: [3,5,5,3,3,3], base: 3, barre: true },
  "G#": { frets: [4,6,6,5,4,4], base: 4, barre: true }, "Ab": { frets: [4,6,6,5,4,4], base: 4, barre: true },
  "A": { frets: [-1,0,2,2,2,0] }, "Am": { frets: [-1,0,2,2,1,0] },
  "A#": { frets: [-1,1,3,3,3,1], barre: true }, "Bb": { frets: [-1,1,3,3,3,1], barre: true },
  "B": { frets: [-1,2,4,4,4,2], barre: true }, "Bm": { frets: [-1,2,4,4,3,2], barre: true },
};
function baseChordKey(token) {
  const c = parseChord(token);
  if (!c) return null;
  const isMinor = /^m(?!aj)/.test(c.suffix);
  return c.root + c.accidental + (isMinor ? "m" : "");
}
function getShape(token) {
  const key = baseChordKey(token);
  return key ? OPEN_SHAPES[key] : null;
}

function chordDiagramSVG(chord) {
  const shape = getShape(chord);
  const stringsX = [0,1,2,3,4,5].map((i) => 10 + i * 16);
  let inner = "";
  stringsX.forEach((x) => { inner += '<line x1="' + x + '" y1="20" x2="' + x + '" y2="92" stroke="#555" stroke-width="1" />'; });
  [0,1,2,3,4].forEach((i) => { inner += '<line x1="10" y1="' + (20+i*18) + '" x2="90" y2="' + (20+i*18) + '" stroke="#555" stroke-width="' + (i===0?2.5:1) + '" />'; });
  if (shape) {
    if (shape.barre) inner += '<rect x="8" y="' + (20+0.5*18-5) + '" width="84" height="10" rx="5" fill="#8b0000" opacity="0.85" />';
    shape.frets.forEach((f, i) => {
      const x = stringsX[i];
      if (f === -1) { inner += '<text x="' + x + '" y="12" font-size="10" text-anchor="middle" fill="#e8393a">×</text>'; return; }
      if (f === 0) { inner += '<circle cx="' + x + '" cy="14" r="4" fill="none" stroke="#e8e0d0" stroke-width="1.3" />'; return; }
      const relativeFret = shape.base ? f - shape.base + 1 : f;
      const y = 20 + (relativeFret - 0.5) * 18;
      inner += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#c9a227" />';
    });
    if (shape.base) inner += '<text x="95" y="35" font-size="9" fill="#999">' + shape.base + '</text>';
  } else {
    inner += '<text x="50" y="55" font-size="10" text-anchor="middle" fill="#666">sem shape</text>';
  }
  return '<div style="text-align:center">' +
    '<div style="font-weight:700;font-size:15px;margin-bottom:4px;color:#c9a227;font-family:\'Courier New\',monospace">' + escapeHtml(chord) + '</div>' +
    '<svg width="100" height="110" viewBox="0 0 100 110">' + inner + '</svg>' +
  '</div>';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function sharpToFlatLabel(nota) {
  const idx = NOTES_SHARP.indexOf(nota);
  return idx === -1 ? nota : NOTES_FLAT[idx];
}

// ==================== SÍMBOLOS (% repetição de acorde, xN repetição de trecho) ====================
function isSimboloToken(token) {
  if (token === "%") return true;
  return /\d/.test(token) && /^[()xX\d\s]+$/.test(token);
}
