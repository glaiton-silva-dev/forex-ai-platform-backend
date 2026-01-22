/**
 * ========================================
 * LIVE ANALYSIS SERVICE
 * ========================================
 *
 * Serviço de análise ao vivo que roda continuamente
 * analisando todos os pares e armazenando os resultados
 */

class LiveAnalysisService {
  constructor(decisionEngine, marketDataService) {
    this.decisionEngine = decisionEngine;
    this.marketDataService = marketDataService;
    this.liveSignals = new Map(); // Par -> Último sinal
    this.isRunning = false;
    this.analysisInterval = null;
    this.updateFrequency = 5 * 60 * 1000; // 5 minutos

    // Pares para análise ao vivo
    this.pairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
      'EURGBP', 'EURJPY', 'GBPJPY',
      'XAUUSD', 'BTCUSD', 'US30'
    ];
  }

  /**
   * Inicia análise ao vivo
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Análise ao vivo já está rodando');
      return;
    }

    this.isRunning = true;
    console.log('\n🔴 INICIANDO ANÁLISE AO VIVO');
    console.log(`📊 Analisando ${this.pairs.length} pares a cada ${this.updateFrequency / 1000}s\n`);

    // Primeira análise imediatamente
    this.runAnalysisCycle();

    // Análises subsequentes
    this.analysisInterval = setInterval(() => {
      this.runAnalysisCycle();
    }, this.updateFrequency);
  }

  /**
   * Para análise ao vivo
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    console.log('\n🔴 ANÁLISE AO VIVO PARADA\n');
  }

  /**
   * Executa um ciclo de análise em todos os pares
   */
  async runAnalysisCycle() {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔴 ANÁLISE AO VIVO - ${new Date().toLocaleString('pt-BR')}`);
    console.log(`${'='.repeat(70)}\n`);

    let approvedCount = 0;
    let rejectedCount = 0;

    for (const pair of this.pairs) {
      try {
        await this.analyzePair(pair);

        const signal = this.liveSignals.get(pair);
        if (signal && signal.approved) {
          approvedCount++;
          console.log(`✅ ${pair}: SINAL APROVADO - ${signal.direction} @ ${signal.entry}`);
        } else {
          rejectedCount++;
          console.log(`❌ ${pair}: Rejeitado`);
        }

      } catch (error) {
        console.error(`❌ Erro ao analisar ${pair}:`, error.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ Ciclo completo em ${elapsed}s`);
    console.log(`📊 Aprovados: ${approvedCount} | Rejeitados: ${rejectedCount}`);
    console.log(`🕒 Próxima análise em ${this.updateFrequency / 1000}s`);
    console.log(`${'='.repeat(70)}\n`);
  }

  /**
   * Analisa um par específico
   */
  async analyzePair(pair) {
    // Obtém dados de mercado
    const marketDataPoints = await this.marketDataService.getMarketData(pair);

    // Executa análise completa
    const result = await this.decisionEngine.makeDecision(marketDataPoints, pair);

    // Extrai dados da estrutura correta
    const decision = result.decision;
    const analyses = result.analyses;

    // Armazena resultado
    this.liveSignals.set(pair, {
      pair,
      timestamp: new Date(),
      approved: decision.approved || false,
      direction: decision.direction || 'NEUTRAL',
      entry: decision.setup?.entry || null,
      stopLoss: decision.setup?.stopLoss || null,
      takeProfit: decision.setup?.takeProfit || null,
      confidence: analyses?.smartMoney?.alignment?.confidence || 0,
      mlProbability: analyses?.technical?.confidence || 0,
      score: this.calculateScore(decision, analyses),
      criteria: decision.criteria,
      reasoning: decision.reason || decision.justification,
      fullDecision: result
    });
  }

  /**
   * Calcula score do sinal
   */
  calculateScore(decision, analyses) {
    const smConfidence = analyses?.smartMoney?.alignment?.confidence || 0;
    const mlConfidence = analyses?.technical?.confidence || 0;
    return Math.round((smConfidence * 0.6) + (mlConfidence * 0.4));
  }

  /**
   * Retorna todos os sinais ao vivo
   */
  getLiveSignals() {
    const signals = [];

    for (const [pair, signal] of this.liveSignals) {
      signals.push(signal);
    }

    // Ordena por score (melhores primeiro)
    signals.sort((a, b) => b.score - a.score);

    return {
      timestamp: new Date(),
      isRunning: this.isRunning,
      updateFrequency: this.updateFrequency,
      totalPairs: this.pairs.length,
      signals: signals,
      approved: signals.filter(s => s.approved),
      rejected: signals.filter(s => !s.approved)
    };
  }

  /**
   * Retorna sinal específico de um par
   */
  getSignalForPair(pair) {
    const signal = this.liveSignals.get(pair);
    if (!signal) return null;

    return {
      ...signal,
      isLive: this.isRunning
    };
  }

  /**
   * Retorna apenas sinais aprovados
   */
  getApprovedSignals() {
    const signals = [];

    for (const [pair, signal] of this.liveSignals) {
      if (signal.approved) {
        signals.push(signal);
      }
    }

    signals.sort((a, b) => b.score - a.score);

    return {
      timestamp: new Date(),
      count: signals.length,
      signals
    };
  }

  /**
   * Status do serviço
   */
  getStatus() {
    const signalCount = this.liveSignals.size;
    const approvedCount = Array.from(this.liveSignals.values()).filter(s => s.approved).length;

    return {
      isRunning: this.isRunning,
      updateFrequency: this.updateFrequency,
      totalPairs: this.pairs.length,
      analyzedPairs: signalCount,
      approvedSignals: approvedCount,
      lastUpdate: signalCount > 0 ?
        Math.max(...Array.from(this.liveSignals.values()).map(s => s.timestamp)) :
        null
    };
  }
}

module.exports = LiveAnalysisService;
