/**
 * ==========================================
 * LSTM MODEL (TensorFlow.js) - REAL
 * ==========================================
 * Implementação de LSTM (Long Short-Term Memory) usando TensorFlow.js
 * Para previsão de séries temporais de preços
 *
 * LSTM é ideal para dados sequenciais pois "lembra" padrões históricos
 */

let tf = null;
try {
  tf = require('@tensorflow/tfjs-node');
  console.log('✅ [LSTM] TensorFlow.js-node carregado');
} catch (error) {
  try {
    tf = require('@tensorflow/tfjs');
    console.log('✅ [LSTM] TensorFlow.js (JavaScript puro) carregado');
  } catch (error2) {
    console.warn('⚠️  TensorFlow.js não disponível - LSTM usará fallback');
  }
}
const fs = require('fs').promises;
const path = require('path');

class LSTMModel {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.isTrained = false;
    this.modelPath = path.join(__dirname, '../../database/models/lstm');

    // Configuração LSTM
    this.config = {
      sequenceLength: 60,      // Usa últimos 60 candles para prever
      features: 8,             // Número de features por candle
      lstmUnits: [64, 32],     // Unidades nas camadas LSTM
      denseUnits: [16],        // Unidades nas camadas densas
      outputDim: 1,            // Saída: probabilidade de BUY (0-1)
      learningRate: 0.001,
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2
    };

    // Estatísticas de treinamento
    this.trainingHistory = {
      lastTrainedAt: null,
      totalEpochs: 0,
      bestAccuracy: 0,
      trainingSamples: 0
    };
  }

  /**
   * Cria a arquitetura LSTM
   */
  createModel() {
    if (!tf) {
      console.warn('⚠️  TensorFlow não disponível para criar modelo LSTM');
      return null;
    }

    const model = tf.sequential();

    // Primeira camada LSTM
    model.add(tf.layers.lstm({
      units: this.config.lstmUnits[0],
      returnSequences: true,
      inputShape: [this.config.sequenceLength, this.config.features]
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Segunda camada LSTM
    model.add(tf.layers.lstm({
      units: this.config.lstmUnits[1],
      returnSequences: false
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Camadas densas
    for (const units of this.config.denseUnits) {
      model.add(tf.layers.dense({
        units,
        activation: 'relu'
      }));
      model.add(tf.layers.dropout({ rate: 0.1 }));
    }

    // Camada de saída (sigmoid para probabilidade 0-1)
    model.add(tf.layers.dense({
      units: this.config.outputDim,
      activation: 'sigmoid'
    }));

    // Compilar
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    console.log('🧠 [LSTM] Modelo criado com arquitetura:');
    model.summary();

    return model;
  }

  /**
   * Prepara sequências para o LSTM
   * Transforma dados em formato [samples, timesteps, features]
   *
   * @param {Array} candles - Array de candles OHLCV
   * @returns {Object} { sequences, labels }
   */
  prepareSequences(candles) {
    const sequences = [];
    const labels = [];

    // Calcula indicadores adicionais para features
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 0);

    // Normaliza os dados
    const minPrice = Math.min(...closes);
    const maxPrice = Math.max(...closes);
    const priceRange = maxPrice - minPrice || 1;

    const maxVolume = Math.max(...volumes) || 1;

    // Gera sequências
    const seqLen = this.config.sequenceLength;
    const lookahead = 5; // Preve 5 candles à frente
    const threshold = 0.003; // 0.3% de movimento para considerar BUY

    for (let i = seqLen; i < candles.length - lookahead; i++) {
      const sequence = [];

      // Últimos 60 candles
      for (let j = i - seqLen; j < i; j++) {
        const candle = candles[j];
        const prevClose = j > 0 ? candles[j - 1].close : candle.close;

        // 8 features por timestep:
        const features = [
          // 1. Preço normalizado
          (candle.close - minPrice) / priceRange,
          // 2. Retorno
          (candle.close - prevClose) / prevClose,
          // 3. High-Low range normalizado
          (candle.high - candle.low) / priceRange,
          // 4. Close position (onde fechou no range H-L)
          candle.high !== candle.low
            ? (candle.close - candle.low) / (candle.high - candle.low)
            : 0.5,
          // 5. Volume normalizado
          candle.volume ? candle.volume / maxVolume : 0,
          // 6. Body size (bullish = positivo, bearish = negativo)
          (candle.close - candle.open) / priceRange,
          // 7. Upper wick
          (candle.high - Math.max(candle.open, candle.close)) / priceRange,
          // 8. Lower wick
          (Math.min(candle.open, candle.close) - candle.low) / priceRange
        ];

        sequence.push(features);
      }

      sequences.push(sequence);

      // Label: 1 se preço subiu mais que threshold nos próximos 5 candles
      const currentPrice = candles[i].close;
      const futureMax = Math.max(...candles.slice(i + 1, i + lookahead + 1).map(c => c.high));
      const futureReturn = (futureMax - currentPrice) / currentPrice;

      labels.push(futureReturn > threshold ? 1 : 0);
    }

    console.log(`📊 [LSTM] Gerou ${sequences.length} sequências de ${seqLen} timesteps`);
    console.log(`   📈 Labels: ${labels.filter(l => l === 1).length} BUY, ${labels.filter(l => l === 0).length} SELL`);

    return { sequences, labels };
  }

  /**
   * Treina o modelo LSTM com dados históricos
   *
   * @param {Array} candles - Array de candles (mínimo 500)
   */
  async train(candles) {
    if (!tf) {
      console.log('⚠️  [LSTM] TensorFlow não disponível - treinamento simulado');
      this.isTrained = true; // Marca como treinado para usar fallback
      return {
        success: true,
        message: 'Treinamento simulado (TensorFlow não instalado)',
        simulated: true
      };
    }

    try {
      console.log('\n🧠 [LSTM] Iniciando treinamento...');
      this.isTraining = true;

      // Valida dados
      if (candles.length < 500) {
        throw new Error(`Dados insuficientes: ${candles.length} candles (mínimo 500)`);
      }

      // Cria modelo se não existir
      if (!this.model) {
        this.model = this.createModel();
      }

      // Prepara sequências
      const { sequences, labels } = this.prepareSequences(candles);

      if (sequences.length < 100) {
        throw new Error(`Sequências insuficientes: ${sequences.length} (mínimo 100)`);
      }

      // Converte para tensores
      const xs = tf.tensor3d(sequences);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      // Treina
      console.log(`🚀 [LSTM] Treinando com ${sequences.length} amostras...`);

      const history = await this.model.fit(xs, ys, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: this.config.validationSplit,
        shuffle: true,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 5 === 0 || epoch === this.config.epochs - 1) {
              console.log(`   Epoch ${epoch + 1}/${this.config.epochs}: loss=${logs.loss.toFixed(4)}, acc=${(logs.acc * 100).toFixed(2)}%, val_acc=${(logs.val_acc * 100).toFixed(2)}%`);
            }
          }
        }
      });

      // Limpa memória
      xs.dispose();
      ys.dispose();

      // Atualiza estatísticas
      const finalAccuracy = history.history.val_acc[history.history.val_acc.length - 1];
      this.trainingHistory = {
        lastTrainedAt: new Date(),
        totalEpochs: this.trainingHistory.totalEpochs + this.config.epochs,
        bestAccuracy: Math.max(this.trainingHistory.bestAccuracy, finalAccuracy),
        trainingSamples: sequences.length
      };

      this.isTrained = true;
      this.isTraining = false;

      console.log(`\n✅ [LSTM] Treinamento concluído!`);
      console.log(`   📊 Accuracy: ${(finalAccuracy * 100).toFixed(2)}%`);

      return {
        success: true,
        finalLoss: history.history.loss[history.history.loss.length - 1],
        finalAccuracy,
        valAccuracy: finalAccuracy,
        epochs: this.config.epochs,
        samples: sequences.length
      };

    } catch (error) {
      this.isTraining = false;
      console.error('❌ [LSTM] Erro no treinamento:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Faz predição para uma sequência de candles
   *
   * @param {Array} candles - Últimos 60 candles
   * @returns {number} Probabilidade de BUY (0-1)
   */
  async predict(candles) {
    // Fallback se TensorFlow não disponível ou modelo não treinado
    if (!tf || !this.model || !this.isTrained) {
      return this.simulatedPrediction(candles);
    }

    try {
      // Prepara sequência única
      const { sequences } = this.prepareSequences([...candles.slice(-61), candles[candles.length - 1]]);

      if (sequences.length === 0) {
        return this.simulatedPrediction(candles);
      }

      // Usa última sequência
      const sequence = sequences[sequences.length - 1];
      const input = tf.tensor3d([sequence]);

      const prediction = this.model.predict(input);
      const probability = (await prediction.data())[0];

      // Limpa memória
      input.dispose();
      prediction.dispose();

      return probability;

    } catch (error) {
      console.error('⚠️  [LSTM] Erro na predição, usando fallback:', error.message);
      return this.simulatedPrediction(candles);
    }
  }

  /**
   * Predição simulada quando TensorFlow não está disponível
   */
  simulatedPrediction(candles) {
    if (candles.length < 20) return 0.5;

    // Análise simples baseada em tendência recente
    const recent = candles.slice(-20);
    const closes = recent.map(c => c.close);

    // Tendência
    const firstHalf = closes.slice(0, 10).reduce((a, b) => a + b) / 10;
    const secondHalf = closes.slice(10).reduce((a, b) => a + b) / 10;
    const trend = secondHalf > firstHalf ? 0.6 : 0.4;

    // Momentum
    const momentum = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];
    const momentumScore = momentum > 0 ? 0.55 : 0.45;

    // Combina
    const probability = (trend * 0.6 + momentumScore * 0.4);

    return Math.max(0.1, Math.min(0.9, probability));
  }

  /**
   * Cria um IOHandler customizado para salvar modelo em arquivo
   */
  createFileIOHandler(modelPath) {
    return {
      save: async (modelArtifacts) => {
        await fs.mkdir(modelPath, { recursive: true });

        // Salva topologia do modelo (model.json)
        const modelJSON = {
          modelTopology: modelArtifacts.modelTopology,
          weightsManifest: [{
            paths: ['weights.bin'],
            weights: modelArtifacts.weightSpecs
          }],
          format: modelArtifacts.format,
          generatedBy: modelArtifacts.generatedBy,
          convertedBy: modelArtifacts.convertedBy
        };

        await fs.writeFile(
          path.join(modelPath, 'model.json'),
          JSON.stringify(modelJSON)
        );

        // Salva pesos binários
        const weightData = modelArtifacts.weightData;
        await fs.writeFile(
          path.join(modelPath, 'weights.bin'),
          Buffer.from(weightData)
        );

        return { modelArtifactsInfo: { dateSaved: new Date() } };
      }
    };
  }

  /**
   * Salva o modelo treinado
   */
  async saveModel() {
    if (!tf || !this.model || !this.isTrained) {
      return { success: false, error: 'Modelo não disponível para salvar' };
    }

    try {
      // Cria diretório se não existir
      await fs.mkdir(this.modelPath, { recursive: true });

      // Usa IOHandler customizado
      const ioHandler = this.createFileIOHandler(this.modelPath);
      await this.model.save(ioHandler);

      // Salva também as estatísticas de treinamento
      const statsPath = path.join(this.modelPath, 'training_stats.json');
      await fs.writeFile(statsPath, JSON.stringify(this.trainingHistory, null, 2));

      console.log(`✅ [LSTM] Modelo salvo em ${this.modelPath}`);
      return { success: true };

    } catch (error) {
      console.error('❌ [LSTM] Erro ao salvar modelo:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Carrega modelo previamente treinado
   */
  async loadModel() {
    if (!tf) {
      return { success: false, error: 'TensorFlow não disponível' };
    }

    try {
      const modelFile = path.join(this.modelPath, 'model.json');
      const weightsFile = path.join(this.modelPath, 'weights.bin');

      // Verifica se arquivos existem
      try {
        await fs.access(modelFile);
        await fs.access(weightsFile);
      } catch {
        console.log('ℹ️  [LSTM] Modelo não encontrado, será treinado na primeira execução');
        return { success: false, error: 'Modelo não encontrado' };
      }

      // Carrega topologia
      const modelJSON = JSON.parse(await fs.readFile(modelFile, 'utf-8'));

      // Carrega pesos
      const weightsData = await fs.readFile(weightsFile);
      const weightData = new Uint8Array(weightsData).buffer;

      // Cria IOHandler para carregar
      const loadHandler = {
        load: async () => ({
          modelTopology: modelJSON.modelTopology,
          weightSpecs: modelJSON.weightsManifest[0].weights,
          weightData: weightData,
          format: modelJSON.format,
          generatedBy: modelJSON.generatedBy,
          convertedBy: modelJSON.convertedBy
        })
      };

      this.model = await tf.loadLayersModel(loadHandler);

      // Tenta carregar estatísticas
      try {
        const statsPath = path.join(this.modelPath, 'training_stats.json');
        const stats = JSON.parse(await fs.readFile(statsPath, 'utf-8'));
        this.trainingHistory = stats;
      } catch {
        // Stats não disponíveis, ok
      }

      this.isTrained = true;

      console.log('✅ [LSTM] Modelo carregado com sucesso');
      return { success: true };

    } catch (error) {
      console.error('❌ [LSTM] Erro ao carregar modelo:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retorna status do modelo
   */
  getStatus() {
    return {
      name: 'LSTM (Long Short-Term Memory)',
      isTrained: this.isTrained,
      isTraining: this.isTraining,
      hasTensorFlow: !!tf,
      config: this.config,
      trainingHistory: this.trainingHistory
    };
  }
}

module.exports = new LSTMModel();
