const token = () => process.env.TELEGRAM_BOT_TOKEN!;

export async function tg(method: string, body: Record<string, any>) {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function send(text: string, extra: Record<string, any> = {}, chatId?: string | number) {
  return tg('sendMessage', {
    chat_id: chatId ?? process.env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

export function keyboard(rows: { text: string; callback_data?: string; url?: string }[][]) {
  return { reply_markup: { inline_keyboard: rows } };
}

export function actionRow(id: string) {
  return [
    { text: '✓ Done', callback_data: `d:${id}` },
    { text: 'Tomorrow', callback_data: `t:${id}` },
    { text: '+2 hours', callback_data: `s:${id}` },
  ];
}

export async function downloadFile(fileId: string) {
  const f = await tg('getFile', { file_id: fileId });
  if (!f.ok) throw new Error('Could not fetch voice note');
  const path: string = f.result.file_path;
  const r = await fetch(`https://api.telegram.org/file/bot${token()}/${path}`);
  return { buf: await r.arrayBuffer(), name: path.split('/').pop() || 'voice.ogg' };
}
