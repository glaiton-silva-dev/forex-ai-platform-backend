/**
 * ==========================================
 * BACKTEST ENGINE
 * ==========================================
 * Simula trading com dados históricos
 * Calcula métricas de performance
 */

const decisionEngine = require('../ai/decisionEngine');
const reinforcementLearning = require('../ai/reinforcementLearning');

class BacktestEngine {
  constructor() {
    this.trades = [];
    this.equity = [];
    this.initialBalance = 10000;
    this.currentBalance = this.initialBalance;
    this.riskPerTrade = 0.02; // 2% por trade
  }

  /**
   * Executa backtest em dados históricos
   */
  async runBacktest(marketData, pair) {
    console.log(`\n📊 Iniciando backtest para ${pair}...`);

    this.trades = [];
    this.equity = [{ timestamp: Date.now(), balance: this.initialBalance }];
    this.currentBalance = this.initialBalance;

    const candles4H = marketData['4H'];
    const candles1H = marketData['1H'];
    const candles15M = marketData['15M'];
    const candles5M = marketData['5M'];

    // Simula walk-forward (percorre candles do passado para o futuro)
    const totalCandles = candles5M.length;
    let processedSignals = 0;

    for (let i = 200; i < totalCandles - 50; i += 10) {
      // Pega janela de dados até o ponto atual
      const data = {
        '4H': candles4H.slice(Math.max(0, i / 48 - 200), i / 48),
        '1H': candles1H.slice(Math.max(0, i / 12 - 200), i / 12),
        '15M': candles15M.slice(Math.max(0, i / 3 - 200), i / 3),
        '5M': candles5M.slice(Math.max(0, i - 300), i)
      };

      // Analisa com decision engine
      const signal = await decisionEngine.makeDecision(data, pair);

      if (signal.decision === 'TRADE_APPROVED') {
        processedSignals++;

        // Simula execução e resultado
        const tradeResult = this.simulateTrade(signal, candles5M, i);

        // Registra trade
        this.trades.push(tradeResult);

        // Atualiza balance
        this.currentBalance += tradeResult.profitLoss;

        // Registra equity
        this.equity.push({
          timestamp: tradeResult.exitTimestamp,
          balance: this.currentBalance
        });

        // Feedback para Reinforcement Learning
        await reinforcementLearning.recordTrade({
          tradeId: `BT_${Date.now()}_${Math.random()}`,
          instrument: signal.instrument,
          type: signal.type,
          entryPrice: tradeResult.entryPrice,
          exitPrice: tradeResult.exitPrice,
          stopLoss: signal.stop_loss,
          takeProfit: signal.take_profit,
          result: tradeResult.result,
          profitLoss: tradeResult.profitLoss,
          riskReward: signal.risk_reward,
          timeframe: signal.timeframe
        });
      }
    }

    // Calcula métricas
    const metrics = this.calculateMetrics();

    console.log(`✅ Backtest concluído: ${this.trades.length} trades executados`);

    return {
      success: true,
      pair,
      trades: this.trades,
      equity: this.equity,
      metrics,
      processedSignals
    };
  }

  /**
   * Simula uma trade e calcula resultado
   */
  simulateTrade(signal, candles, currentIndex) {
    const entryPrice = signal.entry_price;
    const stopLoss = signal.stop_loss;
    const takeProfit = signal.take_profit;
    const isBuy = signal.type === 'BUY';

    // Calcula position size baseado em risco
    const riskAmount = this.currentBalance * this.riskPerTrade;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const positionSize = riskAmount / stopDistance;

    // Simula próximos N candles para ver se hit SL ou TP
    let exitPrice = null;
    let exitTimestamp = null;
    let result = 'BREAKEVEN';

    for (let j = currentIndex + 1; j < Math.min(currentIndex + 50, candles.length); j++) {
      const candle = candles[j];

      if (isBuy) {
        // Verifica SL
        if (candle.low <= stopLoss) {
          exitPrice = stopLoss;
          exitTimestamp = candle.timestamp;
          result = 'LOSS';
          break;
        }
        // Verifica TP
        if (candle.high >= takeProfit) {
          exitPrice = takeProfit;
          exitTimestamp = candle.timestamp;
          result = 'WIN';
          break;
        }
      } else {
        // SELL
        if (candle.high >= stopLoss) {
          exitPrice = stopLoss;
          exitTimestamp = candle.timestamp;
          result = 'LOSS';
          break;
        }
        if (candle.low <= takeProfit) {
          exitPrice = takeProfit;
          exitTimestamp = candle.timestamp;
          result = 'WIN';
          break;
        }
      }
    }

    // Se não hit nada, fecha no mercado
    if (!exitPrice) {
      exitPrice = candles[Math.min(currentIndex + 50, candles.length - 1)].close;
      exitTimestamp = candles[Math.min(currentIndex + 50, candles.length - 1)].timestamp;
      result = 'BREAKEVEN';
    }

    // Calcula P&L
    const priceDiff = isBuy ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    const profitLoss = priceDiff * positionSize;

    return {
      entryTimestamp: candles[currentIndex].timestamp,
      exitTimestamp,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      type: signal.type,
      result,
      profitLoss,
      profitLossPercent: (profitLoss / this.currentBalance) * 100,
      positionSize
    };
  }

  /**
   * Calcula métricas de performance
   */
  calculateMetrics() {
    if (this.trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      };
    }

    const wins = this.trades.filter(t => t.result === 'WIN');
    const losses = this.trades.filter(t => t.result === 'LOSS');

    const totalWinAmount = wins.reduce((sum, t) => sum + t.profitLoss, 0);
    const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + t.profitLoss, 0));

    const winRate = (wins.length / this.trades.length) * 100;
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount;

    const totalReturn = ((this.currentBalance - this.initialBalance) / this.initialBalance) * 100;

    // Drawdown
    let peak = this.initialBalance;
    let maxDrawdown = 0;

    this.equity.forEach(e => {
      if (e.balance > peak) peak = e.balance;
      const drawdown = ((peak - e.balance) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Sharpe Ratio (simplificado)
    const returns = this.trades.map(t => t.profitLossPercent);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      totalTrades: this.trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: winRate.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      finalBalance: this.currentBalance.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      avgWin: wins.length > 0 ? (totalWinAmount / wins.length).toFixed(2) : 0,
      avgLoss: losses.length > 0 ? (totalLossAmount / losses.length).toFixed(2) : 0
    };
  }

  /**
   * Reseta o backtest
   */
  reset() {
    this.trades = [];
    this.equity = [];
    this.currentBalance = this.initialBalance;
  }
}

module.exports = new BacktestEngine();
