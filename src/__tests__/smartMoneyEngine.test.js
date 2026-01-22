/**
 * SMART MONEY ENGINE TESTS
 */

const SmartMoneyEngine = require('../ai/smartMoneyEngine');

// Mock data
const mockCandles = [];
for (let i = 0; i < 300; i++) {
  mockCandles.push({
    timestamp: Date.now() - (300 - i) * 5 * 60 * 1000,
    open: 1.0850 + Math.random() * 0.001,
    high: 1.0860 + Math.random() * 0.001,
    low: 1.0840 + Math.random() * 0.001,
    close: 1.0850 + Math.random() * 0.001,
    volume: 1000000 + Math.random() * 500000
  });
}

describe('Smart Money Engine', () => {
  let engine;

  beforeAll(() => {
    engine = new SmartMoneyEngine();
  });

  test('should identify swing highs and lows', () => {
    const swings = engine.identifySwingPoints(mockCandles, 5);
    expect(swings).toBeDefined();
    expect(swings.highs).toBeInstanceOf(Array);
    expect(swings.lows).toBeInstanceOf(Array);
  });

  test('should detect liquidity zones', () => {
    const liquidity = engine.detectLiquidity(mockCandles);
    expect(liquidity).toBeDefined();
    expect(liquidity.liquidityAbove).toBeInstanceOf(Array);
    expect(liquidity.liquidityBelow).toBeInstanceOf(Array);
  });

  test('should detect order blocks', () => {
    const orderBlocks = engine.detectOrderBlocks(mockCandles);
    expect(orderBlocks).toBeDefined();
    expect(orderBlocks).toBeInstanceOf(Array);
  });

  test('should detect FVG (Fair Value Gaps)', () => {
    const fvgs = engine.detectFVG(mockCandles);
    expect(fvgs).toBeDefined();
    expect(fvgs).toBeInstanceOf(Array);
  });

  test('should calculate premium and discount zones', () => {
    const zones = engine.calculatePremiumDiscountZones(mockCandles);
    expect(zones).toBeDefined();
    expect(zones.premium).toBeDefined();
    expect(zones.discount).toBeDefined();
    expect(zones.equilibrium).toBeDefined();
  });

  test('should determine market trend', () => {
    const trend = engine.determineTrend(mockCandles);
    expect(trend).toBeDefined();
    expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(trend);
  });

  test('should analyze complete market structure', () => {
    const analysis = engine.analyzeStructure(mockCandles, '5M');
    expect(analysis).toBeDefined();
    expect(analysis.timeframe).toBe('5M');
    expect(analysis.liquidity).toBeDefined();
    expect(analysis.orderBlocks).toBeDefined();
    expect(analysis.trend).toBeDefined();
  });
});
