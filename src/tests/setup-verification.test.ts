describe('Vitest Setup', () => {
  it('should have vitest globals available', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support describe and it', () => {
    const result = 'vitest';
    expect(result).toBe('vitest');
  });
});
