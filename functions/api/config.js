// GET /api/config — 게임이 시작할 때 읽는 공개 설정. 구글 클라이언트 ID 는 공개되어도 되는 값이다(비밀값 아님).
// 홈페이지 상점도 같은 값으로 구글 로그인 버튼을 띄우므로 홈페이지 출처에 CORS 를 허용한다.
import { json, withHomeCors } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  return withHomeCors(json({ googleClientId: env.GOOGLE_CLIENT_ID || null }), request);
}
