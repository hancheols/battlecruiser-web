// GET /api/config — 게임이 시작할 때 읽는 공개 설정. 구글 클라이언트 ID 는 공개되어도 되는 값이다(비밀값 아님).
import { json } from '../_lib/util.js';

export async function onRequestGet({ env }) {
  return json({ googleClientId: env.GOOGLE_CLIENT_ID || null });
}
