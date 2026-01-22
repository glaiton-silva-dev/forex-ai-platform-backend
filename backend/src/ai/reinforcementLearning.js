/**
 * ========================================
 * REINFORCEMENT LEARNING ENGINE - Motor de Auto-Aprendizado
 * ========================================
 *
 * Implementa feedback loop contínuo:
 * - Registra TODAS as operações
 * - Classifica resultado (WIN/LOSS/BE)
 * - Calcula taxa de acerto por timeframe
 * - Ajusta pesos dos modelos dinamicamente
 * - Reforça padrões vencedores
 * - Penaliza padrões perdedores
 *
 * Utiliza técnicas de Reinforcement Learning para otimização contínua
 */

const fs = require('fs').promises;
const path = require('path');

class ReinforcementLearningEngine {
  constructor() {
    this.historyFile = path.join(__dirname, '../database/trade_history.json');
    this.modelWeightsFile = path.join(__dirname, '../database/model_weights.json');

    // Pesos iniciais dos modelos
    this.modelWeights = {
      randomForest: 0.30,
      gradientBoosting: 0.35,
      lstm: 0.35
    };

    // Pesos por timeframe
    this.timeframeWeights = {
      '5M': 1.0,
      '15M': 1.0,
      '1H': 1.0,
      '4H': 1.0
    };

    // Pesos por tipo de padrão Smart Money
    this.patternWeights = {
      'BULLISH_SWEEP': 1.0,
      'BEARISH_SWEEP': 1.0,
      'BULLISH_OB': 1.0,
      'BEARISH_OB': 1.0,
      'BULLISH_BOS': 1.0,
      'BEARISH_BOS': 1.0,
      'BULLISH_CHOCH': 1.0,
      'BEARISH_CHOCH': 1.0
    };

    // Estatísticas globais
    this.globalStats = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      avgRR: 0,
      profitFactor: 0,
      lastUpdated: null
    };

    // Learning rate (taxa de aprendizado)
    this.learningRate = 0.05; // 5% de ajuste por iteração

    this.initialized = false;
  }

  /**
   * Inicializa o sistema de aprendizado
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Carrega histórico de trades
      await this.loadTradeHistory();

      // Carrega pesos salvos
      await this.loadModelWeights();

      // Recalcula estatísticas
      await this.recalculateStats();

      this.initialized = true;
      console.log('✓ Reinforcement Learning Engine inicializado');
    } catch (error) {
      console.error('Erro ao inicializar RL Engine:', error.message);
      // Continua com valores padrão
      this.initialized = true;
    }
  }

  /**
   * Registra uma nova operação
   */
  async registerTrade(trade) {
    await this.initialize();

    const tradeRecord = {
      id: this.generateTradeId(),
      timestamp: new Date(),
      pair: trade.pair,
      direction: trade.direction,
      entry: trade.entry,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      riskReward: trade.riskReward,
      timeframe: trade.timeframe || '5M',
      smartMoneyPatterns: trade.smartMoneyPatterns || [],
      mlProbability: trade.mlProbability || 0,
      fundamentalBias: trade.fundamentalBias || 'NEUTRAL',
      result: 'OPEN', // WIN, LOSS, BREAKEVEN, OPEN
      pips: null,
      profit: null,
      closedAt: null,
      exitPrice: null
    };

    // Salva no histórico
    await this.saveTradeToHistory(tradeRecord);

    return tradeRecord;
  }

  /**
   * Atualiza resultado de uma operação
   */
  async updateTradeResult(tradeId, result, exitPrice, profit) {
    await this.initialize();

    const history = await this.loadTradeHistory();
    const trade = history.find(t => t.id === tradeId);

    if (!trade) {
      throw new Error(`Trade ${tradeId} não encontrado`);
    }

    trade.result = result; // WIN, LOSS, BREAKEVEN
    trade.exitPrice = exitPrice;
    trade.profit = profit;
    trade.closedAt = new Date();

    // Calcula pips
    trade.pips = this.calculatePips(trade.entry, exitPrice, trade.direction);

    // Salva histórico atualizado
    await this.saveTradeHistory(history);

    // Aprende com o resultado
    await this.learnFromTrade(trade);

    // Recalcula estatísticas
    await this.recalculateStats();

    console.log(`\n✓ Trade ${tradeId} atualizado: ${result}`);
    console.log(`  Profit: ${profit > 0 ? '+' : ''}${profit.toFixed(2)} | Pips: ${trade.pips.toFixed(1)}\n`);

    return trade;
  }

  /**
   * Aprende com o resultado de um trade (CORE DO REINFORCEMENT LEARNING)
   */
  async learnFromTrade(trade) {
    if (trade.result === 'OPEN') return;

    const isWin = trade.result === 'WIN';
    const reward = isWin ? 1 : -1;

    // ====================================
    // 1. AJUSTA PESOS DE TIMEFRAME
    // ====================================
    if (trade.timeframe && this.timeframeWeights[trade.timeframe] !== undefined) {
      const currentWeight = this.timeframeWeights[trade.timeframe];

      // Reforça timeframe vencedor, penaliza perdedor
      const adjustment = reward * this.learningRate;
      const newWeight = Math.max(0.5, Math.min(1.5, currentWeight + adjustment));

      this.timeframeWeights[trade.timeframe] = newWeight;

      console.log(`  [RL] Timeframe ${trade.timeframe}: ${currentWeight.toFixed(3)} → ${newWeight.toFixed(3)}`);
    }

    // ====================================
    // 2. AJUSTA PESOS DE PADRÕES SMART MONEY
    // ====================================
    if (trade.smartMoneyPatterns && trade.smartMoneyPatterns.length > 0) {
      for (const pattern of trade.smartMoneyPatterns) {
        if (this.patternWeights[pattern] !== undefined) {
          const currentWeight = this.patternWeights[pattern];
          const adjustment = reward * this.learningRate;
          const newWeight = Math.max(0.5, Math.min(1.5, currentWeight + adjustment));

          this.patternWeights[pattern] = newWeight;

          console.log(`  [RL] Padrão ${pattern}: ${currentWeight.toFixed(3)} → ${newWeight.toFixed(3)}`);
        }
      }
    }

    // ====================================
    // 3. AJUSTA PESOS DOS MODELOS ML
    // ====================================
    // Se probabilidade ML estava alta e acertou, reforça
    // Se probabilidade ML estava alta e errou, penaliza
    if (trade.mlProbability) {
      const probConfidence = trade.mlProbability / 100; // Normaliza 0-1

      // Ajuste proporcional à confiança
      const mlAdjustment = reward * this.learningRate * probConfidence;

      // Ajusta todos os modelos proporcionalmente
      for (const model of Object.keys(this.modelWeights)) {
        const currentWeight = this.modelWeights[model];
        const newWeight = Math.max(0.1, Math.min(0.6, currentWeight + mlAdjustment * currentWeight));
        this.modelWeights[model] = newWeight;
      }

      // Normaliza para soma = 1.0
      this.normalizeModelWeights();

      console.log(`  [RL] Pesos ML atualizados:`, this.modelWeights);
    }

    // Salva pesos atualizados
    await this.saveModelWeights();
  }

  /**
   * Normaliza pesos dos modelos ML para soma = 1.0
   */
  normalizeModelWeights() {
    const total = Object.values(this.modelWeights).reduce((a, b) => a + b, 0);

    for (const model of Object.keys(this.modelWeights)) {
      this.modelWeights[model] = this.modelWeights[model] / total;
    }
  }

  /**
   * Calcula pips (simplificado)
   */
  calculatePips(entry, exit, direction) {
    const diff = direction === 'BUY' ? exit - entry : entry - exit;
    return diff * 10000; // Converte para pips
  }

  /**
   * Recalcula todas as estatísticas
   */
  async recalculateStats() {
    const history = await this.loadTradeHistory();
    const closedTrades = history.filter(t => t.result !== 'OPEN');

    if (closedTrades.length === 0) {
      this.globalStats = {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        winRate: 0,
        avgRR: 0,
        profitFactor: 0,
        lastUpdated: new Date()
      };
      return;
    }

    const wins = closedTrades.filter(t => t.result === 'WIN').length;
    const losses = closedTrades.filter(t => t.result === 'LOSS').length;
    const breakeven = closedTrades.filter(t => t.result === 'BREAKEVEN').length;

    const winRate = (wins / closedTrades.length) * 100;

    const totalProfit = closedTrades
      .filter(t => t.result === 'WIN')
      .reduce((sum, t) => sum + (t.profit || 0), 0);

    const totalLoss = Math.abs(closedTrades
      .filter(t => t.result === 'LOSS')
      .reduce((sum, t) => sum + (t.profit || 0), 0));

    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    const avgRR = closedTrades
      .reduce((sum, t) => sum + parseFloat(t.riskReward || 0), 0) / closedTrades.length;

    this.globalStats = {
      totalTrades: closedTrades.length,
      wins,
      losses,
      breakeven,
      winRate: winRate.toFixed(2),
      avgRR: avgRR.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalLoss: totalLoss.toFixed(2),
      lastUpdated: new Date()
    };
  }

  /**
   * Retorna estatísticas por timeframe
   */
  async getStatsByTimeframe() {
    const history = await this.loadTradeHistory();
    const closedTrades = history.filter(t => t.result !== 'OPEN');

    const stats = {};

    for (const tf of ['5M', '15M', '1H', '4H']) {
      const tfTrades = closedTrades.filter(t => t.timeframe === tf);

      if (tfTrades.length === 0) {
        stats[tf] = { trades: 0, winRate: 0, weight: this.timeframeWeights[tf] };
        continue;
      }

      const wins = tfTrades.filter(t => t.result === 'WIN').length;
      const winRate = (wins / tfTrades.length) * 100;

      stats[tf] = {
        trades: tfTrades.length,
        wins,
        losses: tfTrades.filter(t => t.result === 'LOSS').length,
        winRate: winRate.toFixed(2),
        weight: this.timeframeWeights[tf].toFixed(3)
      };
    }

    return stats;
  }

  /**
   * Retorna estatísticas por padrão Smart Money
   */
  async getStatsByPattern() {
    const history = await this.loadTradeHistory();
    const closedTrades = history.filter(t => t.result !== 'OPEN');

    const stats = {};

    for (const pattern of Object.keys(this.patternWeights)) {
      const patternTrades = closedTrades.filter(
        t => t.smartMoneyPatterns && t.smartMoneyPatterns.includes(pattern)
      );

      if (patternTrades.length === 0) {
        stats[pattern] = { trades: 0, winRate: 0, weight: this.patternWeights[pattern] };
        continue;
      }

      const wins = patternTrades.filter(t => t.result === 'WIN').length;
      const winRate = (wins / patternTrades.length) * 100;

      stats[pattern] = {
        trades: patternTrades.length,
        wins,
        losses: patternTrades.filter(t => t.result === 'LOSS').length,
        winRate: winRate.toFixed(2),
        weight: this.patternWeights[pattern].toFixed(3)
      };
    }

    return stats;
  }

  /**
   * Retorna recomendações baseadas em aprendizado
   */
  async getRecommendations() {
    const tfStats = await this.getStatsByTimeframe();
    const patternStats = await this.getStatsByPattern();

    const recommendations = [];

    // Recomendações de timeframe
    for (const [tf, stats] of Object.entries(tfStats)) {
      if (stats.trades >= 10) {
        if (parseFloat(stats.winRate) > 70) {
          recommendations.push({
            type: 'POSITIVE',
            message: `Timeframe ${tf} com excelente performance (${stats.winRate}% win rate). Priorizar.`
          });
        } else if (parseFloat(stats.winRate) < 40) {
          recommendations.push({
            type: 'NEGATIVE',
            message: `Timeframe ${tf} com baixa performance (${stats.winRate}% win rate). Revisar estratégia.`
          });
        }
      }
    }

    // Recomendações de padrões
    for (const [pattern, stats] of Object.entries(patternStats)) {
      if (stats.trades >= 5) {
        if (parseFloat(stats.winRate) > 75) {
          recommendations.push({
            type: 'POSITIVE',
            message: `Padrão ${pattern} altamente confiável (${stats.winRate}% win rate).`
          });
        } else if (parseFloat(stats.winRate) < 35) {
          recommendations.push({
            type: 'NEGATIVE',
            message: `Padrão ${pattern} com baixa confiabilidade (${stats.winRate}% win rate). Evitar.`
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Exporta relatório completo de aprendizado
   */
  async exportLearningReport() {
    await this.recalculateStats();

    const tfStats = await this.getStatsByTimeframe();
    const patternStats = await this.getStatsByPattern();
    const recommendations = await this.getRecommendations();

    return {
      timestamp: new Date(),
      globalStats: this.globalStats,
      modelWeights: this.modelWeights,
      timeframeStats: tfStats,
      patternStats: patternStats,
      recommendations,
      learningRate: this.learningRate
    };
  }

  // ====================================
  // PERSISTÊNCIA
  // ====================================

  async loadTradeHistory() {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Arquivo não existe, retorna array vazio
      return [];
    }
  }

  async saveTradeHistory(history) {
    try {
      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error.message);
    }
  }

  async saveTradeToHistory(trade) {
    const history = await this.loadTradeHistory();
    history.push(trade);
    await this.saveTradeHistory(history);
  }

  async loadModelWeights() {
    try {
      const data = await fs.readFile(this.modelWeightsFile, 'utf8');
      const saved = JSON.parse(data);

      this.modelWeights = saved.modelWeights || this.modelWeights;
      this.timeframeWeights = saved.timeframeWeights || this.timeframeWeights;
      this.patternWeights = saved.patternWeights || this.patternWeights;
      this.learningRate = saved.learningRate || this.learningRate;
    } catch (error) {
      // Arquivo não existe, usa valores padrão
    }
  }

  async saveModelWeights() {
    try {
      const data = {
        modelWeights: this.modelWeights,
        timeframeWeights: this.timeframeWeights,
        patternWeights: this.patternWeights,
        learningRate: this.learningRate,
        lastUpdated: new Date()
      };

      await fs.writeFile(this.modelWeightsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Erro ao salvar pesos:', error.message);
    }
  }

  generateTradeId() {
    return `TRADE_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
  }

  /**
   * Retorna pesos atuais para uso nos modelos
   */
  getWeights() {
    return {
      models: this.modelWeights,
      timeframes: this.timeframeWeights,
      patterns: this.patternWeights
    };
  }

  /**
   * Retorna estatísticas globais
   */
  getGlobalStats() {
    return this.globalStats;
  }
}


module.exports = ReinforcementLearningEngine;
