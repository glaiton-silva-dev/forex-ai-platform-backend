/**
 * ==========================================
 * CONTINUOUS LEARNING SYSTEM
 * ==========================================
 * Sistema de aprendizado contínuo que:
 * - Coleta feedback de trades reais
 * - Re-treina modelos periodicamente
 * - Ajusta pesos dinamicamente baseado em performance
 * - Implementa transfer learning para adaptar a novas condições de mercado
 */

const fs = require('fs').promises;
const path = require('path');
const randomForestModel = require('./randomForestModel');
const lstmModel = require('./lstmModel');

class ContinuousLearning {
  constructor() {
    // Caminho para salvar dados de feedback
    this.dataPath = path.join(__dirname, '../../database/training_data');
    this.feedbackPath = path.join(this.dataPath, 'trade_feedback.json');
    this.modelWeightsPath = path.join(this.dataPath, 'model_weights.json');

    // Buffer de trades para aprendizado
    this.tradeBuffer = [];
    this.minBufferSize = 50; // Mínimo de trades para retreinar

    // Pesos dinâmicos dos modelos
    this.modelWeights = {
      randomForest: 0.30,
      lstm: 0.35,
      gradientBoosting: 0.35,
      lastUpdated: null
    };

    // Performance tracking por modelo
    this.modelPerformance = {
      randomForest: { correct: 0, total: 0, accuracy: 0 },
      lstm: { correct: 0, total: 0, accuracy: 0 },
      gradientBoosting: { correct: 0, total: 0, accuracy: 0 }
    };

    // Configurações de retreinamento
    this.config = {
      autoRetrainEnabled: true,
      retrainThreshold: 100,        // Retreina após N trades
      minAccuracyDrop: 0.05,        // Retreina se accuracy cair mais que 5%
      retrainInterval: 24 * 60 * 60 * 1000, // Máximo 1x por dia
      lastRetrainTime: null
    };

    // Status
    this.isRetraining = false;

    console.log('🔄 Continuous Learning System inicializado');
  }

  /**
   * Inicializa o sistema, carrega dados salvos
   */
  async initialize() {
    try {
      // Cria diretório se não existir
      await fs.mkdir(this.dataPath, { recursive: true });

      // Carrega feedback existente
      await this.loadFeedback();

      // Carrega pesos salvos
      await this.loadModelWeights();

      console.log('✅ [CL] Dados de aprendizado carregados');
      console.log(`   📊 Trades no buffer: ${this.tradeBuffer.length}`);

    } catch (error) {
      console.log('ℹ️  [CL] Iniciando com dados limpos:', error.message);
    }
  }

  /**
   * Registra resultado de um trade para aprendizado
   *
   * @param {Object} trade - Informações do trade
   */
  async recordTradeResult(trade) {
    const {
      pair,
      timeframe,
      direction,           // 'BUY' ou 'SELL'
      entryPrice,
      exitPrice,
      profit,              // Lucro/prejuízo em pips ou %
      mlPrediction,        // Predição do ML quando o trade foi aberto
      indicators,          // Indicadores no momento da entrada
      models               // Predições individuais de cada modelo
    } = trade;

    // Determina se a predição estava correta
    const actualDirection = exitPrice > entryPrice ? 'BUY' : 'SELL';
    const wasCorrect = direction === actualDirection;

    // Cria registro de feedback
    const feedback = {
      timestamp: new Date().toISOString(),
      pair,
      timeframe,
      direction,
      actualDirection,
      wasCorrect,
      profit,
      mlPrediction,
      indicators,
      models,

      // Features para retreinamento
      features: this.extractFeatures(indicators),
      label: actualDirection === 'BUY' ? 1 : 0
    };

    // Adiciona ao buffer
    this.tradeBuffer.push(feedback);

    // Atualiza performance de cada modelo
    if (models) {
      this.updateModelPerformance('randomForest', models.randomForest, actualDirection);
      this.updateModelPerformance('lstm', models.lstm, actualDirection);
      this.updateModelPerformance('gradientBoosting', models.gradientBoosting, actualDirection);
    }

    // Salva feedback periodicamente
    if (this.tradeBuffer.length % 10 === 0) {
      await this.saveFeedback();
    }

    // Verifica se deve retreinar
    if (this.config.autoRetrainEnabled && this.shouldRetrain()) {
      console.log('🔄 [CL] Iniciando retreinamento automático...');
      await this.retrain();
    }

    console.log(`📝 [CL] Trade registrado: ${pair} ${direction} - ${wasCorrect ? '✅ CORRETO' : '❌ INCORRETO'}`);

    return { recorded: true, bufferSize: this.tradeBuffer.length };
  }

  /**
   * Extrai features dos indicadores para treinar
   */
  extractFeatures(indicators) {
    if (!indicators) return new Array(50).fill(0);

    const features = [];

    // Trend features
    features.push(indicators.ema9?.above ? 1 : 0);
    features.push(indicators.ema21?.above ? 1 : 0);
    features.push(indicators.ema50?.above ? 1 : 0);
    features.push(indicators.ema200?.above ? 1 : 0);

    // Momentum features
    features.push((indicators.rsi14?.value || 50) / 100);
    features.push(indicators.macd?.histogram > 0 ? 1 : 0);
    features.push((indicators.stochastic?.k || 50) / 100);

    // Volume features
    features.push(indicators.volumeRatio?.ratio > 1 ? 1 : 0);
    features.push(indicators.obv?.value > 0 ? 1 : 0);

    // Volatility features
    features.push(indicators.atr14?.percentage || 0);
    features.push(indicators.bollingerBands?.percentB || 0.5);

    // Institutional features
    features.push(indicators.institutionalTrend?.bullish ? 1 : indicators.institutionalTrend?.bearish ? -1 : 0);
    features.push((indicators.trendStrength?.value || 50) / 100);
    features.push((indicators.pricePosition?.value || 50) / 100);

    // Preenche até 50
    while (features.length < 50) {
      features.push(0);
    }

    return features.slice(0, 50);
  }

  /**
   * Atualiza estatísticas de performance de um modelo
   */
  updateModelPerformance(modelName, prediction, actualDirection) {
    if (!prediction || !this.modelPerformance[modelName]) return;

    const predictedDirection = prediction.probability > 50 ? 'BUY' : 'SELL';
    const wasCorrect = predictedDirection === actualDirection;

    this.modelPerformance[modelName].total++;
    if (wasCorrect) {
      this.modelPerformance[modelName].correct++;
    }

    // Recalcula accuracy
    const perf = this.modelPerformance[modelName];
    perf.accuracy = perf.total > 0 ? perf.correct / perf.total : 0;
  }

  /**
   * Verifica se deve retreinar os modelos
   */
  shouldRetrain() {
    // Não retreina se já está em andamento
    if (this.isRetraining) return false;

    // Verifica buffer mínimo
    if (this.tradeBuffer.length < this.config.retrainThreshold) return false;

    // Verifica intervalo mínimo
    if (this.config.lastRetrainTime) {
      const elapsed = Date.now() - this.config.lastRetrainTime;
      if (elapsed < this.config.retrainInterval) return false;
    }

    // Verifica queda de accuracy
    for (const [model, perf] of Object.entries(this.modelPerformance)) {
      if (perf.total > 20 && perf.accuracy < 0.5 - this.config.minAccuracyDrop) {
        console.log(`⚠️  [CL] ${model} com baixa accuracy: ${(perf.accuracy * 100).toFixed(1)}%`);
        return true;
      }
    }

    return this.tradeBuffer.length >= this.config.retrainThreshold;
  }

  /**
   * Retreina modelos com feedback coletado
   */
  async retrain() {
    if (this.isRetraining) return { success: false, error: 'Já está retreinando' };

    try {
      this.isRetraining = true;
      console.log('\n🔄 [CL] === INICIANDO RETREINAMENTO ===');
      console.log(`   📊 ${this.tradeBuffer.length} trades no buffer`);

      // Extrai features e labels do buffer
      const features = this.tradeBuffer.map(t => t.features);
      const labels = this.tradeBuffer.map(t => t.label);

      console.log(`   📈 Labels: ${labels.filter(l => l === 1).length} BUY, ${labels.filter(l => l === 0).length} SELL`);

      // Retreina Random Forest
      console.log('\n🌲 Retreinando Random Forest...');
      const rfResult = await randomForestModel.train(features, labels);

      if (rfResult.success && !rfResult.simulated) {
        await randomForestModel.saveModel();
        console.log(`   ✅ Random Forest: ${(rfResult.finalAccuracy * 100).toFixed(2)}% accuracy`);
      }

      // Atualiza pesos dos modelos baseado na performance
      this.updateModelWeights();
      await this.saveModelWeights();

      // Limpa buffer (mantém últimos 20 para continuidade)
      this.tradeBuffer = this.tradeBuffer.slice(-20);
      await this.saveFeedback();

      // Atualiza timestamp
      this.config.lastRetrainTime = Date.now();

      this.isRetraining = false;

      console.log('\n✅ [CL] === RETREINAMENTO CONCLUÍDO ===\n');

      return {
        success: true,
        results: {
          randomForest: rfResult
        },
        newWeights: this.modelWeights
      };

    } catch (error) {
      this.isRetraining = false;
      console.error('❌ [CL] Erro no retreinamento:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Atualiza pesos dos modelos baseado em performance
   */
  updateModelWeights() {
    const performances = this.modelPerformance;

    // Calcula total de accuracy
    let totalAccuracy = 0;
    for (const perf of Object.values(performances)) {
      if (perf.total >= 10) { // Mínimo de trades para considerar
        totalAccuracy += perf.accuracy;
      } else {
        totalAccuracy += 0.5; // Default 50% para modelos sem dados
      }
    }

    if (totalAccuracy === 0) totalAccuracy = 1;

    // Atualiza pesos proporcionalmente à accuracy
    this.modelWeights.randomForest = (performances.randomForest.total >= 10 ? performances.randomForest.accuracy : 0.5) / totalAccuracy;
    this.modelWeights.lstm = (performances.lstm.total >= 10 ? performances.lstm.accuracy : 0.5) / totalAccuracy;
    this.modelWeights.gradientBoosting = (performances.gradientBoosting.total >= 10 ? performances.gradientBoosting.accuracy : 0.5) / totalAccuracy;

    // Normaliza para somar 1
    const sum = this.modelWeights.randomForest + this.modelWeights.lstm + this.modelWeights.gradientBoosting;
    this.modelWeights.randomForest /= sum;
    this.modelWeights.lstm /= sum;
    this.modelWeights.gradientBoosting /= sum;

    this.modelWeights.lastUpdated = new Date().toISOString();

    console.log('📊 [CL] Pesos atualizados:');
    console.log(`   Random Forest: ${(this.modelWeights.randomForest * 100).toFixed(1)}%`);
    console.log(`   LSTM: ${(this.modelWeights.lstm * 100).toFixed(1)}%`);
    console.log(`   Gradient Boosting: ${(this.modelWeights.gradientBoosting * 100).toFixed(1)}%`);
  }

  /**
   * Salva feedback em arquivo
   */
  async saveFeedback() {
    try {
      await fs.writeFile(this.feedbackPath, JSON.stringify({
        trades: this.tradeBuffer,
        performance: this.modelPerformance,
        lastSaved: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('⚠️  [CL] Erro ao salvar feedback:', error.message);
    }
  }

  /**
   * Carrega feedback de arquivo
   */
  async loadFeedback() {
    try {
      const data = JSON.parse(await fs.readFile(this.feedbackPath, 'utf-8'));
      this.tradeBuffer = data.trades || [];
      this.modelPerformance = data.performance || this.modelPerformance;
    } catch {
      // Arquivo não existe, ok
    }
  }

  /**
   * Salva pesos dos modelos
   */
  async saveModelWeights() {
    try {
      await fs.writeFile(this.modelWeightsPath, JSON.stringify(this.modelWeights, null, 2));
    } catch (error) {
      console.error('⚠️  [CL] Erro ao salvar pesos:', error.message);
    }
  }

  /**
   * Carrega pesos dos modelos
   */
  async loadModelWeights() {
    try {
      this.modelWeights = JSON.parse(await fs.readFile(this.modelWeightsPath, 'utf-8'));
    } catch {
      // Arquivo não existe, usa defaults
    }
  }

  /**
   * Retorna pesos atuais dos modelos
   */
  getModelWeights() {
    return { ...this.modelWeights };
  }

  /**
   * Retorna estatísticas de performance
   */
  getPerformanceStats() {
    return {
      modelPerformance: this.modelPerformance,
      bufferSize: this.tradeBuffer.length,
      modelWeights: this.modelWeights,
      isRetraining: this.isRetraining,
      config: {
        autoRetrainEnabled: this.config.autoRetrainEnabled,
        retrainThreshold: this.config.retrainThreshold,
        lastRetrainTime: this.config.lastRetrainTime
      }
    };
  }

  /**
   * Força retreinamento manual
   */
  async forceRetrain() {
    console.log('🔄 [CL] Retreinamento forçado solicitado...');
    return await this.retrain();
  }

  /**
   * Reseta estatísticas de performance
   */
  resetPerformance() {
    this.modelPerformance = {
      randomForest: { correct: 0, total: 0, accuracy: 0 },
      lstm: { correct: 0, total: 0, accuracy: 0 },
      gradientBoosting: { correct: 0, total: 0, accuracy: 0 }
    };
    console.log('🔄 [CL] Estatísticas de performance resetadas');
  }
}

module.exports = new ContinuousLearning();
