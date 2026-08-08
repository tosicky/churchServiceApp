import { describe, it, expect } from 'vitest';
import { formatRemaining } from './time';

describe('formatRemaining', () => {
  it('should format zero seconds', () => {
    expect(formatRemaining(0)).toBe('00:00');
  });

  it('should format seconds only', () => {
    expect(formatRemaining(45)).toBe('00:45');
  });

  it('should format minutes and seconds', () => {
    expect(formatRemaining(125)).toBe('02:05');
  });

  it('should format minutes with leading zeros', () => {
    expect(formatRemaining(60)).toBe('01:00');
  });

  it('should format seconds with leading zeros', () => {
    expect(formatRemaining(3)).toBe('00:03');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatRemaining(3661)).toBe('1:01:01');
  });

  it('should format multiple hours', () => {
    expect(formatRemaining(7325)).toBe('2:02:05');
  });

  it('should format negative seconds with - prefix (overtime)', () => {
    expect(formatRemaining(-60)).toBe('-01:00');
  });

  it('should format negative seconds (seconds only)', () => {
    expect(formatRemaining(-15)).toBe('-00:15');
  });

  it('should format negative large values', () => {
    expect(formatRemaining(-300)).toBe('-05:00');
  });

  it('should handle large overtime values', () => {
    expect(formatRemaining(-3661)).toBe('-1:01:01');
  });
});
