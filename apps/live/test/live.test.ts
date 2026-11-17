import { describe, expect, it } from 'vitest';
import { ago, count, duration, isAddress, isSignature, percent, price, short, sol, units, usd } from '../src/lib/format';
import { href, parseRoute } from '../src/lib/route';

describe('figures', () => {
  it('never shows an unknown figure as zero', () => {
    for (const f of [usd, price, percent, count, duration, ago]) {
      expect(f(null)).toBeNull();
      expect(f(undefined)).toBeNull();
      expect(f(Number.NaN)).toBeNull();
    }
  });

  it('shows dollars, prices and shares the way a trader reads them', () => {
    expect(usd(1234)).toBe('$1.2K');
    expect(usd(5_400_000)).toBe('$5.4M');
    expect(usd(-180, false)).toBe('-$180.00');
    expect(price(0.000012345)).toBe('$0.00001235');
    expect(price(2.5)).toBe('$2.5');
    expect(percent(12.345)).toBe('12.3%');
  });

  it('converts base units exactly, without floating point', () => {
    expect(units('8799429332156695', 5, 2)).toBe('87,994,293,321.56');
    expect(units('1000000000', 9)).toBe('1');
    expect(sol('5000')).toBe('0.000005');
    expect(units(123456789012345678901234567890n, 6, 2)).toBe('123,456,789,012,345,678,901,234.56');
  });

  it('shortens addresses and tells addresses from signatures', () => {
    expect(short('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe('DezX…B263');
    expect(isAddress('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe(true);
    expect(isAddress('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')).toBe(false);
    expect(isSignature('5'.repeat(88))).toBe(true);
    expect(isSignature('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe(false);
  });

  it('says how long ago and how long', () => {
    expect(ago(0, 30_000)).toBe('30s ago');
    expect(ago(0, 5 * 60_000)).toBe('5m ago');
    expect(duration(13.6 * 3600)).toBe('13.6 h');
  });
});

describe('pages', () => {
  it('reads a page and its address from the link, and builds the link back', () => {
    expect(parseRoute('#/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toEqual({ page: 'token', param: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' });
    expect(parseRoute('#/developers')).toEqual({ page: 'developers', param: null });
    expect(parseRoute('')).toEqual({ page: 'launches', param: null });
    expect(parseRoute('#/nowhere/x')).toEqual({ page: 'launches', param: null });
    expect(href('apps', 'abc')).toBe('#/apps/abc');
  });
});
