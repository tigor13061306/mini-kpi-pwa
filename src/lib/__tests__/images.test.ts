import { describe, expect, test } from '@jest/globals';
import { compressImage } from '../images';

describe('compressImage', () => {
  test('returns original blob when createImageBitmap is unavailable', async () => {
    const blob = new Blob(['data'], { type: 'image/jpeg' });
    const result = await compressImage(blob);
    expect(result).toBe(blob);
  });
});
