import { NextRequest, NextResponse } from 'next/server';
import { getNotificationConfig, saveNotificationConfig, NotificationConfig } from '@/lib/notifications';

export async function GET() {
  try {
    const config = getNotificationConfig();

    // Mask sensitive tokens for security when rendering in the UI
    const masked: Record<string, any> = {
      ...config,
      telegramBotToken: config.telegramBotToken
        ? `${config.telegramBotToken.slice(0, 8)}...${config.telegramBotToken.slice(-4)}`
        : '',
      whatsappToken: config.whatsappToken
        ? `${config.whatsappToken.slice(0, 4)}...${config.whatsappToken.slice(-4)}`
        : '',
      isTelegramConfigured: Boolean(config.telegramBotToken && config.telegramChatId),
      isWhatsappConfigured: Boolean(config.whatsappInstanceId && config.whatsappToken && config.whatsappPhone),
    };

    return NextResponse.json(masked);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const current = getNotificationConfig();

    const updatePayload: Partial<NotificationConfig> = {};

    if (body.telegramEnabled !== undefined) updatePayload.telegramEnabled = Boolean(body.telegramEnabled);
    if (body.telegramChatId !== undefined) updatePayload.telegramChatId = body.telegramChatId.trim();
    // Only update token if it wasn't the masked version
    if (body.telegramBotToken && !body.telegramBotToken.includes('...')) {
      updatePayload.telegramBotToken = body.telegramBotToken.trim();
    }

    if (body.whatsappEnabled !== undefined) updatePayload.whatsappEnabled = Boolean(body.whatsappEnabled);
    if (body.whatsappProvider !== undefined) updatePayload.whatsappProvider = body.whatsappProvider;
    if (body.whatsappInstanceId !== undefined) updatePayload.whatsappInstanceId = body.whatsappInstanceId.trim();
    if (body.whatsappPhone !== undefined) updatePayload.whatsappPhone = body.whatsappPhone.trim();
    if (body.whatsappToken && !body.whatsappToken.includes('...')) {
      updatePayload.whatsappToken = body.whatsappToken.trim();
    }

    if (body.minDiscountPct !== undefined) updatePayload.minDiscountPct = Number(body.minDiscountPct) || 25;
    if (body.notifyOnMiamiDelivery !== undefined) updatePayload.notifyOnMiamiDelivery = Boolean(body.notifyOnMiamiDelivery);
    if (body.notifyOnRadarDeal !== undefined) updatePayload.notifyOnRadarDeal = Boolean(body.notifyOnRadarDeal);

    const saved = saveNotificationConfig(updatePayload);

    return NextResponse.json({
      success: true,
      message: 'Configuración de notificaciones guardada con éxito',
      config: {
        ...saved,
        isTelegramConfigured: Boolean(saved.telegramBotToken && saved.telegramChatId),
        isWhatsappConfigured: Boolean(saved.whatsappInstanceId && saved.whatsappToken && saved.whatsappPhone),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
