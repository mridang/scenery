import { describe, expect, it } from '@jest/globals';

import {
  detectHdr,
  detectQuality,
  detectRemux,
} from '../../../src/lib/torrents/parsing';

describe('detectQuality', () => {
  it('detects 2160p, 4K and UHD as 2160p', () => {
    expect(detectQuality('Movie.2026.2160p.WEB-DL.x265')).toBe('2160p');
    expect(detectQuality('Movie 2026 4K UHD BluRay')).toBe('2160p');
    expect(detectQuality('Movie.2026.UHD.BluRay')).toBe('2160p');
  });

  it('detects 1080p / 720p / 480p', () => {
    expect(detectQuality('Some.Film.2025.1080p.BluRay.x264-GROUP')).toBe(
      '1080p',
    );
    expect(detectQuality('Some.Film.2025.720p.WEBRip')).toBe('720p');
    expect(detectQuality('Some.Film.2025.480p.DVDRip')).toBe('480p');
  });

  it('prefers the highest quality when several are present', () => {
    // 2160p is checked first regardless of position in the string.
    expect(detectQuality('Pack.1080p.and.2160p.versions')).toBe('2160p');
  });

  it('returns null when no quality token is present', () => {
    expect(detectQuality('Just A Title With No Resolution')).toBeNull();
    expect(detectQuality('')).toBeNull();
  });

  it('requires the token to be delimited by non-word boundaries', () => {
    // Embedded digits must not match — "21080p" is not 1080p.
    expect(detectQuality('weird21080pmash')).toBeNull();
    // Surrounded by separators it matches.
    expect(detectQuality('weird.1080p.mash')).toBe('1080p');
  });

  it('is case-insensitive for 4k / uhd', () => {
    expect(detectQuality('movie.4k.web')).toBe('2160p');
    expect(detectQuality('movie uhd remux')).toBe('2160p');
  });
});

describe('detectHdr', () => {
  it('detects the HDR token', () => {
    expect(detectHdr('Movie.2026.2160p.HDR.x265')).toBe(true);
  });

  it('detects Dolby Vision and the DV abbreviation', () => {
    expect(detectHdr('Movie.2026.2160p.DV.x265')).toBe(true);
    expect(detectHdr('Movie 2026 Dolby Vision')).toBe(true);
    expect(detectHdr('Movie 2026 DolbyVision')).toBe(true);
  });

  it('is false when no HDR signal is present', () => {
    expect(detectHdr('Movie.2026.1080p.x264')).toBe(false);
    expect(detectHdr('')).toBe(false);
  });

  it('does not match HDR embedded in a larger word', () => {
    expect(detectHdr('SHDRoom')).toBe(false);
  });
});

describe('detectRemux', () => {
  it('detects REMUX regardless of case', () => {
    expect(detectRemux('Movie.2026.2160p.REMUX.x265')).toBe(true);
    expect(detectRemux('Movie.2026.remux.bluray')).toBe(true);
  });

  it('is false when not a remux', () => {
    expect(detectRemux('Movie.2026.1080p.WEB-DL')).toBe(false);
    expect(detectRemux('')).toBe(false);
  });

  it('does not match REMUX embedded in a larger word', () => {
    expect(detectRemux('PREMUXED')).toBe(false);
  });
});

describe('real-world titles', () => {
  it('parses a 4K Dolby Vision remux release', () => {
    const t = 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR-FraMeSToR';
    expect(detectQuality(t)).toBe('2160p');
    expect(detectHdr(t)).toBe(true);
    expect(detectRemux(t)).toBe(true);
  });

  it('parses a plain 1080p web-dl', () => {
    const t = 'Oppenheimer.2023.1080p.WEB-DL.DDP5.1.Atmos.H.264-FLUX';
    expect(detectQuality(t)).toBe('1080p');
    expect(detectHdr(t)).toBe(false);
    expect(detectRemux(t)).toBe(false);
  });
});
