import { config } from './config.js'

// 사진 업로드 시 텔레그램으로 알림.
// fire-and-forget: 실패해도 업로드 응답엔 전혀 영향 없음.
export async function notifyNewPhoto(photoUrl) {
  const { botToken, chatId } = config.telegram
  if (!botToken || !chatId) return // 미설정이면 조용히 스킵

  if (config.publicBaseUrl.includes('localhost')) {
    console.warn('[telegram] PUBLIC_BASE_URL이 localhost를 가리킵니다. Telegram에서 사진 URL을 읽지 못할 수 있습니다.')
  }

  const call = async (method, body) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    let payload = ''
    try {
      payload = await res.text()
    } catch {
      payload = ''
    }

    return { res, payload }
  }

  const caption = '📸 새 사진이 업로드됐어요!'
  try {
    const { res, payload } = await call('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
    })

    console.log(`[telegram] sendPhoto response: ${res.status} ${payload}`)

    if (!res.ok) {
      console.error(`[telegram] sendPhoto 실패: ${res.status} ${payload}`)
      const { res: fallbackRes, payload: fallbackPayload } = await call('sendMessage', {
        chat_id: chatId,
        text: `${caption}\n${photoUrl}`,
      })

      console.log(`[telegram] sendMessage fallback response: ${fallbackRes.status} ${fallbackPayload}`)

      if (!fallbackRes.ok) {
        console.error(`[telegram] sendMessage fallback 실패: ${fallbackRes.status} ${fallbackPayload}`)
      }
    }
  } catch (err) {
    console.error('[telegram] 사진 알림 실패:', err.message)
  }
}
