export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}
export function minecraftText(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let style = { bold: false, italic: false, underline: false, strike: false };
  const pieces = text.split(/(§.)/g);
  for (const p of pieces) {
    if (p.startsWith("§") && p.length === 2) {
      const c = p[1].toLowerCase();
      if (c === "l") style = { ...style, bold: true };
      else if (c === "o") style = { ...style, italic: true };
      else if (c === "n") style = { ...style, underline: true };
      else if (c === "m") style = { ...style, strike: true };
      else if (c === "r" || /[0-9a-f]/.test(c))
        style = { bold: false, italic: false, underline: false, strike: false };
    } else if (p) runs.push({ text: p, ...style });
  }
  return runs;
}
