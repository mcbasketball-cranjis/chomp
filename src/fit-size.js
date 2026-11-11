export async function fitImage({ width, height, quality, maxBytes, lossless }, encodeAt) {
  const attempt = async (w, h, q) => ({ buffer: await encodeAt(w, h, q), width: w, height: h, quality: q });
  for (let step = 0; step < 16; step++) {
    const high = await attempt(width, height, quality);
    if (!maxBytes || high.buffer.byteLength <= maxBytes) return high;
    let smallest = high;
    if (!lossless && quality > 1) {
      smallest = await attempt(width, height, 1);
      if (smallest.buffer.byteLength <= maxBytes) {
        let best = smallest, low = 2, upper = quality - 1;
        while (low <= upper) {
          const q = Math.floor((low + upper) / 2), candidate = await attempt(width, height, q);
          if (candidate.buffer.byteLength <= maxBytes) { best = candidate; low = q + 1; } else upper = q - 1;
        }
        return best;
      }
    }
    if (width === 1 && height === 1) throw new Error('This image cannot fit the selected file size. Increase the limit.');
    const scale = Math.min(.8, Math.sqrt(maxBytes / smallest.buffer.byteLength) * .85);
    width = Math.max(1, Math.floor(width * scale)); height = Math.max(1, Math.floor(height * scale));
    if (step === 14) { width = 1; height = 1; }
  }
  throw new Error('Could not meet the selected file size.');
}
