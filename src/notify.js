import { config } from './config.js'

// 사진 업로드 시 텔레그램으로 알림.
// fire-and-forget: 실패해도 업로드 응답엔 전혀 영향 없음.
export async function notifyNewPhoto(photoUrl) {
  const { botToken, chatId } = config.telegram
  if (!botToken || !chatId) return // 미설정이면 조용히 스킵

  const call = (method, body) =>
    fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const caption = '📸 새 사진이 업로드됐어요!'
  try {
    const res = await call('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
    })
    // 사진 전송 실패 시(용량/포맷 등) 링크 메시지로 폴백
    if (!res.ok) {
      await call('sendMessage', { chat_id: chatId, text: `${caption}\n${photoUrl}` })
    }
  } catch (err) {
    console.error('[telegram] 사진 알림 실패:', err.message)
  }
}
