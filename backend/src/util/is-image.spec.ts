import sharp from 'sharp';
import { isImage } from './is-image.js';

describe('isImage', () => {
  it('accepts a real image and rejects HTML/empty', async () => {
    const png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();

    expect(await isImage(png)).toBe(true);
    expect(await isImage(Buffer.from('<html>error page</html>'))).toBe(false);
    expect(await isImage(undefined)).toBe(false);
  });
});
