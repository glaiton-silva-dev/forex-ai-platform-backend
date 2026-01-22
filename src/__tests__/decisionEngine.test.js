/**
 * DECISION ENGINE TESTS
 */

const DecisionEngine = require('../ai/decisionEngine');

// Mock market data
function generateMockData() {
  const data = {};
  ['5M', '15M', '1H', '4H'].forEach(tf => {
    data[tf] = [];
    for (let i = 0; i < 200; i++) {
      data[tf].push({
        timestamp: Date.now() - (200 - i) * 5 * 60 * 1000,
        open: 1.0850,
        high: 1.0860,
        low: 1.0840,
        close: 1.0850,
        volume: 1000000
      });
    }
  });
  return data;
}

describe('Decision Engine', () => {
  let decisionEngine;

  beforeAll(() => {
    decisionEngine = new DecisionEngine();
  });

  test('should initialize all engines', () => {
    expect(decisionEngine.smartMoneyEngine).toBeDefined();
    expect(decisionEngine.technicalMLEngine).toBeDefined();
    expect(decisionEngine.fundamentalEngine).toBeDefined();
    expect(decisionEngine.correlationEngine).toBeDefined();
  });

  test('should analyze market data and return signal', async () => {
    const mockData = generateMockData();
    const signal = await decisionEngine.analyze('EURUSD', mockData);

    expect(signal).toBeDefined();
    expect(signal.decision).toBeDefined();
    expect(['TRADE_APPROVED', 'NO_TRADE']).toContain(signal.decision);

    if (signal.decision === 'TRADE_APPROVED') {
      expect(signal.instrument).toBe('EURUSD');
      expect(signal.type).toBeDefined();
      expect(signal.entry_price).toBeDefined();
      expect(signal.stop_loss).toBeDefined();
      expect(signal.take_profit).toBeDefined();
      expect(signal.risk_reward).toBeGreaterThanOrEqual(3);
    }
  });

  test('should validate all 9 criteria', async () => {
    const mockData = generateMockData();
    const signal = await decisionEngine.analyze('EURUSD', mockData);

    expect(signal.validation).toBeDefined();
    expect(signal.validation).toHaveProperty('timeframe_4h_1h_alignment');
    expect(signal.validation).toHaveProperty('timeframe_15m_confirmation');
    expect(signal.validation).toHaveProperty('timeframe_5m_entry');
    expect(signal.validation).toHaveProperty('smart_money_confirmation');
    expect(signal.validation).toHaveProperty('ml_probability');
    expect(signal.validation).toHaveProperty('fundamental_not_against');
    expect(signal.validation).toHaveProperty('correlation_aligned');
    expect(signal.validation).toHaveProperty('valid_stop_loss');
    expect(signal.validation).toHaveProperty('min_risk_reward');
  });

  test('should reject trade if criteria not met', async () => {
    const mockData = generateMockData();
    const signal = await decisionEngine.analyze('EURUSD', mockData);

    if (signal.decision === 'NO_TRADE') {
      expect(signal.failed_criteria).toBeDefined();
      expect(signal.failed_criteria.length).toBeGreaterThan(0);
      expect(signal.recommendation).toBeDefined();
    }
  });
});
