import sharp from 'sharp';

/**
 * True if the buffer is something sharp can decode as an image. Used to reject
 * upstream error pages (e.g. HTML) that would otherwise get cached as if they
 * were images.
 */
export async function isImage(
  buffer: Buffer | ArrayBuffer | undefined,
): Promise<boolean> {
  if (!buffer) {
    return false;
  }
  try {
    const { format } = await sharp(
      Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    ).metadata();
    return !!format;
  } catch {
    return false;
  }
}
