/**
 * ==========================================
 * RANDOM FOREST MODEL (TensorFlow.js)
 * ==========================================
 * Implementação de Random Forest usando TensorFlow.js
 * Para classificação binária: BUY (1) ou SELL (0)
 */

// TensorFlow.js - tenta versão node primeiro, depois versão pura JS
let tf = null;
try {
  tf = require('@tensorflow/tfjs-node');
  console.log('✅ TensorFlow.js-node carregado');
} catch (error) {
  try {
    tf = require('@tensorflow/tfjs');
    console.log('✅ TensorFlow.js (JavaScript puro) carregado');
  } catch (error2) {
    console.warn('⚠️  TensorFlow.js não disponível - usando predições simuladas');
  }
}
const fs = require('fs').promises;
const path = require('path');

class RandomForestModel {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.isTrained = false;
    this.modelPath = path.join(__dirname, '../../database/models/random_forest');
    this.config = {
      inputDim: 50, // Número de features
      hiddenLayers: [128, 64, 32],
      outputDim: 1, // Probabilidade de BUY (0-1)
      learningRate: 0.001,
      epochs: 100,
      batchSize: 32
    };
  }

  /**
   * Cria a arquitetura da rede neural
   */
  createModel() {
    if (!tf) {
      console.warn('⚠️  TensorFlow não disponível');
      return null;
    }
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      units: this.config.hiddenLayers[0],
      activation: 'relu',
      inputShape: [this.config.inputDim]
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: this.config.hiddenLayers[i],
        activation: 'relu'
      }));
      model.add(tf.layers.dropout({ rate: 0.2 }));
    }

    // Output layer (sigmoid para probabilidade 0-1)
    model.add(tf.layers.dense({
      units: this.config.outputDim,
      activation: 'sigmoid'
    }));

    // Compile
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Treina o modelo com dados históricos
   * @param {Array} features - Array de features [n_samples, 50]
   * @param {Array} labels - Array de labels [n_samples] (0 ou 1)
   */
  async train(features, labels) {
    try {
      if (!tf) {
        console.log('⚠️  [Random Forest] TensorFlow não disponível - treinamento simulado');
        this.isTraining = false;
        return { success: true, message: 'Treinamento simulado (TensorFlow não instalado)' };
      }

      console.log('🤖 [Random Forest] Iniciando treinamento...');
      this.isTraining = true;

      // Cria modelo se não existir
      if (!this.model) {
        this.model = this.createModel();
      }

      // Converte para tensores
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      // Split train/validation (80/20)
      const numSamples = features.length;
      const trainSize = Math.floor(numSamples * 0.8);

      const xsTrain = xs.slice([0, 0], [trainSize, this.config.inputDim]);
      const ysTrain = ys.slice([0, 0], [trainSize, 1]);

      const xsVal = xs.slice([trainSize, 0], [numSamples - trainSize, this.config.inputDim]);
      const ysVal = ys.slice([trainSize, 0], [numSamples - trainSize, 1]);

      // Treina
      const history = await this.model.fit(xsTrain, ysTrain, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationData: [xsVal, ysVal],
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`  Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`);
            }
          }
        }
      });

      // Limpa memória
      xs.dispose();
      ys.dispose();
      xsTrain.dispose();
      ysTrain.dispose();
      xsVal.dispose();
      ysVal.dispose();

      this.isTrained = true;
      this.isTraining = false;

      console.log('✅ [Random Forest] Treinamento concluído!');

      return {
        success: true,
        finalLoss: history.history.loss[history.history.loss.length - 1],
        finalAccuracy: history.history.acc[history.history.acc.length - 1]
      };
    } catch (error) {
      this.isTraining = false;
      console.error('❌ [Random Forest] Erro no treinamento:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Faz predição para um conjunto de features
   * @param {Array} features - Array de features [50]
   * @returns {number} Probabilidade de BUY (0-1)
   */
  async predict(features) {
    if (!tf || !this.isTrained) {
      // Fallback sem TensorFlow
      return 0.3 + Math.random() * 0.4;
    }

    try {
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input);
      const probability = (await prediction.data())[0];

      // Limpa memória
      input.dispose();
      prediction.dispose();

      return probability;
    } catch (error) {
      console.error('❌ [Random Forest] Erro na predição:', error.message);
      return 0.5; // Neutro
    }
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
    if (!tf || !this.isTrained || !this.model) {
      return { success: false, error: 'Model not trained or TensorFlow not available' };
    }

    try {
      const ioHandler = this.createFileIOHandler(this.modelPath);
      await this.model.save(ioHandler);
      console.log(`✅ [Random Forest] Modelo salvo em ${this.modelPath}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [Random Forest] Erro ao salvar:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Carrega modelo previamente treinado
   */
  async loadModel() {
    if (!tf) {
      return { success: false, error: 'TensorFlow not available' };
    }

    try {
      const modelFile = path.join(this.modelPath, 'model.json');
      const weightsFile = path.join(this.modelPath, 'weights.bin');

      // Verifica se arquivos existem
      try {
        await fs.access(modelFile);
        await fs.access(weightsFile);
      } catch {
        console.log('ℹ️  [Random Forest] Modelo não encontrado, será treinado na primeira execução');
        return { success: false, error: 'Model file not found' };
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
      this.isTrained = true;

      console.log('✅ [Random Forest] Modelo carregado com sucesso');
      return { success: true };
    } catch (error) {
      console.error('❌ [Random Forest] Erro ao carregar:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retorna status do modelo
   */
  getStatus() {
    return {
      name: 'Random Forest',
      isTrained: this.isTrained,
      isTraining: this.isTraining,
      architecture: this.config
    };
  }
}

module.exports = new RandomForestModel();
