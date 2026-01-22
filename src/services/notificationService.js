/**
 * NOTIFICATION SERVICE
 * Email, Telegram, Discord
 */

const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

class NotificationService {
  constructor() {
    // Email (Nodemailer)
    this.emailTransporter = null;
    if (process.env.EMAIL_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }

    // Telegram
    this.telegram = null;
    if (process.env.TELEGRAM_BOT_TOKEN) {
      this.telegram = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    }

    // Discord
    this.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  }

  /**
   * Envia notificação de novo sinal
   */
  async notifyNewSignal(signal) {
    const message = this.formatSignalMessage(signal);

    const results = await Promise.allSettled([
      this.sendEmail('🚨 Novo Sinal de Trading', message),
      this.sendTelegram(message),
      this.sendDiscord(message)
    ]);

    return {
      success: true,
      sent: results.filter(r => r.status === 'fulfilled').length
    };
  }

  /**
   * Envia notificação de ordem executada
   */
  async notifyOrderExecuted(execution) {
    const message = `✅ ORDEM EXECUTADA\n\n` +
                   `Instrumento: ${execution.instrument}\n` +
                   `Tipo: ${execution.type}\n` +
                   `Preço: ${execution.fillPrice}\n` +
                   `SL: ${execution.stopLoss}\n` +
                   `TP: ${execution.takeProfit}`;

    await Promise.allSettled([
      this.sendTelegram(message),
      this.sendDiscord(message)
    ]);
  }

  /**
   * Formata mensagem de sinal
   */
  formatSignalMessage(signal) {
    if (signal.decision === 'NO_TRADE') {
      return `⛔ SINAL REJEITADO\n\nMotivo: ${signal.failed_criteria?.join(', ')}`;
    }

    return `🎯 NOVO SINAL - ${signal.type}\n\n` +
           `Par: ${signal.instrument}\n` +
           `Tipo: ${signal.type}\n` +
           `Entrada: ${signal.entry_price}\n` +
           `Stop: ${signal.stop_loss}\n` +
           `Take: ${signal.take_profit}\n` +
           `RR: ${signal.risk_reward}:1\n` +
           `Probabilidade: ${signal.probability}%\n\n` +
           `Justificativa:\n${signal.justification?.smart_money || 'N/A'}`;
  }

  /**
   * Envia email
   */
  async sendEmail(subject, text) {
    if (!this.emailTransporter) return { success: false };

    try {
      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_USER,
        subject,
        text
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao enviar email:', error.message);
      return { success: false };
    }
  }

  /**
   * Envia mensagem Telegram
   */
  async sendTelegram(message) {
    if (!this.telegram || !process.env.TELEGRAM_CHAT_ID) return { success: false };

    try {
      await this.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message);
      return { success: true };
    } catch (error) {
      console.error('Erro ao enviar Telegram:', error.message);
      return { success: false };
    }
  }

  /**
   * Envia mensagem Discord
   */
  async sendDiscord(message) {
    if (!this.discordWebhook) return { success: false };

    try {
      await axios.post(this.discordWebhook, {
        content: message
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao enviar Discord:', error.message);
      return { success: false };
    }
  }
}

module.exports = new NotificationService();
