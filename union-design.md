# 지구연합 설계 (1단계: 회의장)

## 방향

- 실제 플레이어 연합이다. 연합원이 서로의 정보를 보려면 서버가 필요하다.
- 서버를 고르기 전에도 화면과 규칙을 만들 수 있도록, 화면은 **데이터 어댑터**만 바라본다.
- 지금은 브라우저 저장소를 쓰는 **로컬 어댑터**(가상 연합 3개 포함)로 동작하고, 서버가 정해지면 같은 인터페이스의 **서버 어댑터**로 교체한다.

## 시설 (5개)

| 시설 | 단계 | 상태 |
|---|---|---|
| 회의장 | 1단계 | 이번에 구현 |
| 토륨 분배기 | 후속 | 컨셉 미정 (토륨 광산 아이디어) |
| 기술협력소 | 후반 | 연구에 진행 시간 도입 후 |
| 연합 R&D센터 | 후속 | 연합 전용 함선 업그레이드 |
| 기록관 | 후속 | 시뮬레이션 전투 시나리오 (아레나 엔진 재사용 가능) |

## 회의장 규칙 (1단계 제안값)

- 연합 이름: 2~12자, 중복 불가(대소문자 무시)
- 엠블럼: 6종 중 선택
- 가입 방식: 자유 가입 / 승인 가입
- 인원 상한: 30명 (연합 레벨에 따라 늘릴 수 있게 필드 분리)
- 연합 레벨: 1부터 시작 (경험치는 후속 시설에서 쌓음)
- 직책: 연합장 · 부연합장 · 연합원

| 동작 | 연합장 | 부연합장 | 연합원 |
|---|---|---|---|
| 멤버 목록·공지 보기 | O | O | O |
| 공지 수정 | O | O | X |
| 가입 신청 승인·거절 | O | O | X |
| 연합원 추방 | O (전원) | O (연합원만) | X |
| 부연합장 임명·해임 | O | X | X |
| 가입 방식 변경 | O | X | X |
| 연합장 위임 | O | X | X |
| 탈퇴 | 위임 후 | O | O |
| 해체 | 혼자 남았을 때 | X | X |

## 데이터 모델

```
Player   { playerId, name }
Union    { id, name, emblem, level, exp, notice, joinMode('open'|'approval'),
           capacity, createdAt,
           members:[{ playerId, name, role('leader'|'officer'|'member'), joinedAt, lastSeen, contribution }],
           applications:[{ playerId, name, at }] }
```

## 어댑터 인터페이스 (서버 어댑터도 같은 형태)

```
me()                          → { playerId, name }
getMyUnion()                  → Union | null
searchUnions(query)           → Union 요약 목록
createUnion({name,emblem,notice,joinMode}) → Union
joinUnion(unionId)            → 'joined' | 'applied'
leaveUnion()
updateUnion({notice?, joinMode?})
setRole(playerId, role)       (연합장)
kick(playerId)
handleApplication(playerId, approve)
transferLeader(playerId)
disband()
```

## 서버 선택 시 확인할 것 (미정)

- 계정 방식(익명 로그인 / 소셜 / 자체 계정)과 부정행위 방지
- 실시간 갱신이 필요한지(멤버 접속 표시, 신청 알림)
- 권한 검사는 **서버에서** 다시 해야 한다(화면의 권한 표시는 편의일 뿐)
- 비용과 데이터 보관 정책

## 후속 시설과 연결되는 필드

- `members[].contribution`: 토륨 분배·기술 협력 기여도에 사용
- `exp`, `level`, `capacity`: 연합 성장 규칙에 사용
