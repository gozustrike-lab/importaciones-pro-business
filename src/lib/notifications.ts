import fs from 'fs';
import path from 'path';

export interface NotificationConfig {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  whatsappEnabled: boolean;
  whatsappProvider: 'ultramsg' | 'green-api';
  whatsappInstanceId: string;
  whatsappToken: string;
  whatsappPhone: string; // e.g. 51976202683
  minDiscountPct: number; // default: 25
  notifyOnMiamiDelivery: boolean;
  notifyOnRadarDeal: boolean;
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'notification-config.json');

/**
 * Load notification config from data/notification-config.json and process.env
 */
export function getNotificationConfig(): NotificationConfig {
  let fileConfig: Partial<NotificationConfig> = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error leyendo notification-config.json:', err);
  }

  return {
    telegramEnabled: fileConfig.telegramEnabled ?? (process.env.TELEGRAM_ENABLED === 'true' || !!process.env.TELEGRAM_BOT_TOKEN),
    telegramBotToken: fileConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: fileConfig.telegramChatId || process.env.TELEGRAM_CHAT_ID || '',
    whatsappEnabled: fileConfig.whatsappEnabled ?? (process.env.WHATSAPP_ENABLED === 'true' || !!process.env.WHATSAPP_TOKEN),
    whatsappProvider: (fileConfig.whatsappProvider || process.env.WHATSAPP_PROVIDER || 'ultramsg') as 'ultramsg' | 'green-api',
    whatsappInstanceId: fileConfig.whatsappInstanceId || process.env.WHATSAPP_INSTANCE_ID || '',
    whatsappToken: fileConfig.whatsappToken || process.env.WHATSAPP_TOKEN || '',
    whatsappPhone: fileConfig.whatsappPhone || process.env.WHATSAPP_PHONE || process.env.WHATSAPP_NOTIFY_PHONE || '',
    minDiscountPct: Number(fileConfig.minDiscountPct ?? process.env.NOTIFY_RADAR_MIN_DISCOUNT ?? 25),
    notifyOnMiamiDelivery: fileConfig.notifyOnMiamiDelivery ?? true,
    notifyOnRadarDeal: fileConfig.notifyOnRadarDeal ?? true,
  };
}

/**
 * Save updated notification config
 */
export function saveNotificationConfig(updated: Partial<NotificationConfig>): NotificationConfig {
  const current = getNotificationConfig();
  const merged: NotificationConfig = {
    ...current,
    ...updated,
  };

  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando notification-config.json:', err);
  }

  return merged;
}

/**
 * Send message to Telegram Bot
 */
export async function sendTelegramMessage(
  text: string,
  options?: { url?: string; buttonText?: string }
): Promise<{ success: boolean; error?: string }> {
  const config = getNotificationConfig();
  if (!config.telegramBotToken || !config.telegramChatId) {
    return { success: false, error: 'Telegram no configurado (Falta Token o Chat ID)' };
  }

  try {
    const payload: Record<string, any> = {
      chat_id: config.telegramChatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    if (options?.url) {
      payload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: options.buttonText || '🔥 Ver Producto en eBay',
              url: options.url,
            },
          ],
        ],
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description || 'Error de respuesta de Telegram API');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Telegram notification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send WhatsApp message using UltraMsg or Green-API
 * Free / Zero risk to personal number
 */
export async function sendWhatsAppMessage(
  text: string
): Promise<{ success: boolean; error?: string }> {
  const config = getNotificationConfig();
  if (!config.whatsappInstanceId || !config.whatsappToken || !config.whatsappPhone) {
    return { success: false, error: 'WhatsApp no configurado (Falta Instance ID, Token o Teléfono)' };
  }

  // Normalize phone number (strip +, spaces, dashes)
  const cleanPhone = config.whatsappPhone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 9) {
    return { success: false, error: 'Número de WhatsApp inválido (debe incluir código de país, ej: 51976202683)' };
  }

  try {
    if (config.whatsappProvider === 'green-api') {
      // Green-API format: https://api.green-api.com/waInstance{idInstance}/sendMessage/{apiTokenInstance}
      const url = `https://api.green-api.com/waInstance${config.whatsappInstanceId}/sendMessage/${config.whatsappToken}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          message: text,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || data.error || 'Error enviando mensaje por Green-API');
      }

      return { success: true };
    } else {
      // UltraMsg format: https://api.ultramsg.com/{instance_id}/messages/chat
      const url = `https://api.ultramsg.com/${config.whatsappInstanceId}/messages/chat`;
      const params = new URLSearchParams();
      params.append('token', config.whatsappToken);
      params.append('to', cleanPhone);
      params.append('body', text);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error enviando mensaje por UltraMsg');
      }

      return { success: true };
    }
  } catch (error: any) {
    console.error('WhatsApp notification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Dispatch notification to all active channels (Telegram & WhatsApp Hybrid)
 */
export async function dispatchHybridAlert(options: {
  title: string;
  telegramHtml: string;
  whatsappText: string;
  url?: string;
  buttonText?: string;
}): Promise<{
  telegram: { success: boolean; error?: string };
  whatsapp: { success: boolean; error?: string };
}> {
  const config = getNotificationConfig();
  const results: {
    telegram: { success: boolean; error?: string };
    whatsapp: { success: boolean; error?: string };
  } = {
    telegram: { success: false, error: 'Desactivado' },
    whatsapp: { success: false, error: 'Desactivado' },
  };

  const tasks: Promise<any>[] = [];

  if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    tasks.push(
      sendTelegramMessage(options.telegramHtml, {
        url: options.url,
        buttonText: options.buttonText,
      }).then((res) => {
        results.telegram = res;
      })
    );
  }

  if (config.whatsappEnabled && config.whatsappInstanceId && config.whatsappToken) {
    tasks.push(
      sendWhatsAppMessage(options.whatsappText).then((res) => {
        results.whatsapp = res;
      })
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return results;
}

/**
 * Trigger 1: Radar Deal Alert (>= 25% discount or user configured threshold)
 */
export async function notifyRadarDeal(deal: {
  title: string;
  sellerUsername: string;
  currentPriceUsd: number;
  originalPriceUsd?: number | null;
  discountPct?: number | null;
  couponCode?: string | null;
  condition?: string | null;
  itemUrl: string;
}) {
  const config = getNotificationConfig();
  if (!config.notifyOnRadarDeal) return;

  const discount = deal.discountPct || 0;
  if (discount < config.minDiscountPct) {
    // Only alert if meets minimum threshold
    return;
  }

  const originalPriceStr = deal.originalPriceUsd ? `$${deal.originalPriceUsd.toFixed(2)} USD` : 'N/A';
  const currentPriceStr = `$${deal.currentPriceUsd.toFixed(2)} USD`;
  const savings = deal.originalPriceUsd && deal.originalPriceUsd > deal.currentPriceUsd
    ? `$${(deal.originalPriceUsd - deal.currentPriceUsd).toFixed(2)} USD`
    : null;
  const landedPen = `S/ ${(deal.currentPriceUsd * 3.40).toFixed(2)}`;

  // Telegram HTML version
  const telegramHtml = `🚨 <b>¡OFERTA RADAR DETECTADA (-${discount}% OFF)!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 <b>${deal.title}</b>\n` +
    `🏢 <b>Vendedor:</b> ${deal.sellerUsername} (eBay)\n` +
    `💵 <b>Precio Normal:</b> <s>${originalPriceStr}</s>\n` +
    `🔥 <b>Precio Oferta:</b> <b>${currentPriceStr}</b> ${savings ? `<i>(Ahorro: ${savings})</i>` : ''}\n` +
    `🇵🇪 <b>Llegada estimada a Perú:</b> ${landedPen}\n` +
    (deal.couponCode ? `🏷️ <b>Cupón Aplicable:</b> <code>${deal.couponCode}</code>\n` : '') +
    (deal.condition ? `⭐ <b>Condición:</b> ${deal.condition}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 <a href="${deal.itemUrl}">Toca aquí para ver y comprar en eBay</a>`;

  // WhatsApp plain text version
  const whatsappText = `🚨 *¡OFERTA RADAR DETECTADA (-${discount}% OFF)!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *${deal.title}*\n` +
    `🏢 *Vendedor:* ${deal.sellerUsername}\n` +
    `💵 *Precio Original:* ${originalPriceStr}\n` +
    `🔥 *Precio Oferta:* ${currentPriceStr} ${savings ? `(Ahorro: ${savings})` : ''}\n` +
    `🇵🇪 *Llegada a Perú:* ${landedPen}\n` +
    (deal.couponCode ? `🏷️ *Cupón:* ${deal.couponCode}\n` : '') +
    (deal.condition ? `⭐ *Condición:* ${deal.condition}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔗 *Enlace directo:* ${deal.itemUrl}`;

  return await dispatchHybridAlert({
    title: `Oferta Radar: ${deal.title}`,
    telegramHtml,
    whatsappText,
    url: deal.itemUrl,
    buttonText: `🔥 Comprar por ${currentPriceStr} en eBay`,
  });
}

/**
 * Trigger 2: Package Delivered in Miami (Shipper)
 */
export async function notifyMiamiArrival(pkg: {
  orderNumber: string;
  trackingNumber: string;
  courier?: string;
  description: string;
  model?: string;
  recipientName?: string;
  actualArrival?: Date | string | null;
}) {
  const config = getNotificationConfig();
  if (!config.notifyOnMiamiDelivery) return;

  const dateStr = pkg.actualArrival
    ? new Date(pkg.actualArrival).toLocaleString('es-PE', { timeZone: 'America/Lima' })
    : 'Recién registrado';

  const cleanModel = pkg.model || 'A1701';

  // Telegram HTML
  const telegramHtml = `📦 <b>¡PAQUETE ENTREGADO EN MIAMI!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 <b>Casillero:</b> ${pkg.recipientName || 'SHIPER FABIO CESAR HERRERA BONILLA'}\n` +
    `🚚 <b>Courier:</b> ${pkg.courier || 'USPS'} | <b>Tracking:</b> <code>${pkg.trackingNumber}</code>\n` +
    `📱 <b>Modelo Técnico SUNAT:</b> <b>${cleanModel}</b>\n` +
    `📝 <b>Producto:</b> ${pkg.description}\n` +
    `📄 <b>Orden de Compra:</b> <code>${pkg.orderNumber}</code>\n` +
    `⏰ <b>Fecha Entrega:</b> ${dateStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ <b>Estado:</b> <i>Almacén Shiper Miami OK</i>\n` +
    `Listo para ser incluido en el próximo vuelo/embarque a Lima.`;

  // WhatsApp Text
  const whatsappText = `📦 *¡PAQUETE ENTREGADO EN MIAMI!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 *Casillero:* ${pkg.recipientName || 'SHIPER FABIO CESAR HERRERA BONILLA'}\n` +
    `🚚 *Courier:* ${pkg.courier || 'USPS'}\n` +
    `🔢 *Tracking:* ${pkg.trackingNumber}\n` +
    `📱 *Modelo SUNAT:* ${cleanModel}\n` +
    `📝 *Producto:* ${pkg.description}\n` +
    `📄 *Orden:* ${pkg.orderNumber}\n` +
    `⏰ *Entrega:* ${dateStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Estado:* Almacén Shiper Miami OK\n` +
    `Listo para incluir en el próximo correo de embarque a Lima.`;

  return await dispatchHybridAlert({
    title: `Paquete Entregado en Miami: ${pkg.trackingNumber}`,
    telegramHtml,
    whatsappText,
  });
}
