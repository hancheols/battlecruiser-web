(()=>{
  'use strict';
  const KEY='starfleet-mars-scenario-v1';
  const PROFILE_KEY='starfleet-commander-profile-v1';
  const EVA_KEY='starfleet-eva9-tutorial-v1';
  const RESOURCE_KEY='starfleet-game-resources-v1';
  const LOOT_KEY='starfleet-exploration-loot-v1';
  const RESEARCH_KEY='starfleet-tactical-weapon-research-v1';
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  let state={stage:'',index:0,gate6Done:false,gate9Done:false,pendingGate:0,...(read(KEY)||{})};
  let overlay;
  let fxDone='';
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const evaActive=()=>{const step=read(EVA_KEY)?.step;return !!step&&step!=='complete';};
  const captain=()=>{const profile=read(PROFILE_KEY)||{};return {name:[profile.character,profile.lastName].filter(Boolean).join(' ')||'함장',image:profile.character==='Donna'?'captain-donna-scenario-bust.png':'captain-jake-scenario-bust.png'};};
  const gate6Lines=[
    {speaker:'han',name:'한성민 제독',text:'자네가 새로 임관한 함장이군. 환영인사 할 새도 없이 작전에 투입하게 되어 미안하지만, 지금은 화성의 상황이 심상치 않으니 상황이 정리되는 대로 한 번 보도록 하지. 수고해주게.'},
    {speaker:'eva',name:'EVA-9',text:'화성 인근에서 다수의 생체 신호가 감지되고 있습니다. 새로운 생체신호도 감지되고 있으니 주의하십시오. 전투를 통해 자원을 획득하시면 연구소에서 함대 강화하는 것을 잊으시면 안됩니다. 그럼, 무운을 빌겠습니다.'},
    {speaker:'captain',name:'함장',text:'어, AI가 그런것도 하나?'},
    {speaker:'eva',name:'EVA-9',text:'인간에게 친화적인 응대에 관한 코딩의 결과일 뿐입니다.'}
  ];
  const gate9Line={speaker:'han',name:'한성민 제독',text:'화성의 다른 지역은 모두 정리 되었다. 자네가 있는 쪽에 다른 생체 반응이 있다고 하니, 주의해서 확인하도록. 이상.'};
  const titanBriefingLines=[
    {speaker:'han',name:'한성민 제독',text:()=>`배치되자마자 성과를 올렸군, ${captain().name}.`},
    {speaker:'han',name:'한성민 제독',text:'자네에겐 미안하지만 타이탄의 전진기지에서 다수의 생명체 반응이 나타났다고 도움을 요청했네.'},
    {speaker:'han',name:'한성민 제독',text:'사령부의 첩보에 따르면 태양계 밖에서 타이탄으로 이동하는 더 많은 개체가 있다는 군.'},
    {speaker:'han',name:'한성민 제독',text:'이쪽은 정리가 다 되었으니 즉시 타이탄 기지로 향해주게.'},
    {speaker:'han',name:'한성민 제독',text:'그럼..'}
  ];
  const nickname=()=>String(read(PROFILE_KEY)?.lastName||'').trim()||'함장';
  const sibling=()=>read(PROFILE_KEY)?.character==='Donna'?'자매여':'형제여';
  const marsClearLines=[
    {speaker:'farah',name:'파라 나디르',text:()=>`${nickname()}!`},
    {speaker:'farah',name:'파라 나디르',text:'사령부에서 너한테 보내온 지원이야!'},
    {speaker:'farah',name:'파라 나디르',text:'이렇게 많은 골드는 처음봐!'},
    {speaker:'farah',name:'파라 나디르',text:'예상대로 잘 해주고 있는 모양이군, 축하해!'}
  ];
  const malikLines=[
    {speaker:'malik',name:'캡틴 말릭 오코로',text:()=>`${sibling()}, 타이탄 기지로 향하는 수많은 미확인 생명체들이 확인되고 있다.`},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'지금 타이탄 기지에도 적들이 나타나고 있어, 여기서 다 막긴 곤란하거든.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'멀리서 오는 놈들부터 해치우고 와주기 바란다.'}
  ];
  // 타이탄 5관문 첫 클리어: 말릭의 경고 통신
  const titanGate5Lines=[
    {speaker:'malik',name:'캡틴 말릭 오코로',text:()=>`${sibling()}, 이쪽에 이미 다수의 괴물들이 다가오고 있다네.`},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'거대한 녀석들은 물론이고 처음보는 놈들도 보이기 시작했어.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'서둘러, 시간이 얼마 없어.'}
  ];
  // 타이탄 10관문 첫 클리어: EVA-9가 함교로 부른 뒤, 함교에서 말릭과 EVA-9의 대화
  const titanCallLine={speaker:'eva',name:'EVA-9',text:'함장님, 캡틴 말릭에게서 긴급 통신이 들어왔습니다. 함교로 이동해주세요.'};
  const titanFallLines=[
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'안타깝지만, 우린 기지를 지켜내지 못했어...'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'아무래도 태양계에서 멀지 않은 곳에서 몰려오는 것 같더군.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:()=>`부상병들과 호위병력들이 빠져나가도록 막아주게, ${sibling()}.`},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'전진기지에 소개령이 내려 쓸만한 걸 좀 가져왔어.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'난 호송병력과 함께 가야하니 뒤를 부탁하네...'},
    {speaker:'eva',name:'EVA-9',text:'캡틴 말릭이 남겨준 물자를 활용해서 우리 함대를 강화할 수 있습니다.'},
    {speaker:'eva',name:'EVA-9',text:'저는 연구실로 먼저 가서 기다리겠습니다.'}
  ];
  // 히든: 대화 직후 곧바로 연구실로 가면 EVA-9가 추가 물자를 건넵니다.
  const titanLabLines=[
    {speaker:'eva',name:'EVA-9',text:'바로 와주셨군요 함장님.'},
    {speaker:'eva',name:'EVA-9',text:'호송함대 연구소 부관으로 부터 물자를 받았는데 어떻게 할까요?'},
    {speaker:'captain',name:'함장',text:'잘됐군, 이걸로 함대를 강화하도록 하자.'}
  ];
  // 타이탄 전 관문(20관문) 첫 클리어: 한성민 제독의 호출 → 함교 보고 → 연구실 작전 회의
  const titanCall2Line={speaker:'han',name:'한성민 제독',text:()=>`수고했네, ${captain().name}. 지금 바로 함교로 와주게.`};
  const titanReportLines=[
    {speaker:'han',name:'한성민 제독',text:'타이탄 후송 병력이 무사히 귀환했네.'},
    {speaker:'han',name:'한성민 제독',text:'타이탄 위성의 상황은 어떤가?'},
    {speaker:'captain',name:'함장',text:'기지는 지켜내지 못했지만, 후송 병력이 빠져나갈 시간은 벌었습니다. 다만 적의 수가 줄기는커녕 계속 늘어나고 있습니다.'},
    {speaker:'han',name:'한성민 제독',text:'...할 이야기가 있으니 연구실로 와주게.'}
  ];
  const labBriefingLines=[
    {speaker:'eva',name:'EVA-9',text:'제독님께서 기다리고 계십니다.'},
    {speaker:'han',name:'한성민 제독',text:'사령부의 첩보에 따르면 적은 이미 태양계 주변을 포위하듯 다가오고 있다고 하네.'},
    {speaker:'han',name:'한성민 제독',text:'적 규모조차 파악이 되지 않아 지휘관들도 어찌할지 판단을 못하고 있더군.'},
    {speaker:'han',name:'한성민 제독',text:'우리가... 적 본거지로 예상되는 지점을 먼저 타격해야 전황이 역전될 것이야.'},
    {speaker:'captain',name:'함장',text:'제가 맡겠습니다.'},
    {speaker:'han',name:'한성민 제독',text:'...먼저 나서주니 고맙군.'},
    {speaker:'han',name:'한성민 제독',text:'그럼 험난한 전투가 예상되니 철저히 준비하게'},
    {speaker:'eva',name:'EVA-9',text:'제독님께서 특별히 맡기셨습니다.'},
    {speaker:'eva',name:'EVA-9',text:'이 자원으로 필요한 준비를 하시기 바랍니다.'}
  ];
  // 오르트구름 10관문 출격: 한성민 제독의 Fleet Captain 임명 → 또 다른 주인공(파트너)의 만류 → 전투 개시
  // 파트너는 플레이어가 고르지 않은 쪽입니다(Jake를 골랐으면 Donna, Donna를 골랐으면 Jake).
  const partner=()=>read(PROFILE_KEY)?.character==='Donna'?{name:'Jake',image:'captain-jake-scenario-bust.png',call:'도나'}:{name:'Donna',image:'captain-donna-scenario-bust.png',call:'오빠'};
  const oort10Lines=[
    {speaker:'han',name:'한성민 제독',text:'상황이 생각보다 심각하군.'},
    {speaker:'han',name:'한성민 제독',text:'.....'},
    {speaker:'han',name:'한성민 제독',text:()=>`${nickname()}, 지금부터 Fleet Captain 으로 임명한다.`},
    {speaker:'han',name:'한성민 제독',text:'서식지에 있는 적들을 확인하고 적을 섬멸하라.'},
    {speaker:'signal',name:'통신 수신',text:'다른 함선으로부터 교신이 들어옵니다...',incoming:true},
    {speaker:'partner',name:()=>partner().name,text:()=>`${partner().call}! 나야, 지금 거기로 가면 안돼. 너무 위험해!`,remote:true},
    {speaker:'partner',name:()=>partner().name,text:'서식지를 발견한 것 만도 할만큼 한거야. 그만 돌아와.',remote:true},
    {speaker:'captain',name:'함장',text:'여기까지 온 이상... 그냥 돌아갈 수는 없어..'},
    {speaker:'captain',name:'함장',text:'미안, 내가 가야해.'}
  ];
  // 오르트구름 10관문 전투 중 보스 등장 직전: 함장의 짧은 혼잣말(전투를 멈추지 않는 자막)
  const oort10OmenLine={speaker:'captain',text:'저게 뭐지...?'};
  // 오르트구름 10관문 첫 클리어: EVA-9 보고 → 11관문으로
  const oort10ClearLines=[
    {speaker:'eva',name:'EVA-9',text:'등급을 가늠할 수 없는 생명체 신호를 탐지했습니다.'},
    {speaker:'eva',name:'EVA-9',text:'괜찮으십니까, 캡틴?'},
    {speaker:'captain',name:'함장',text:'응, 다행히 금방 물러났어.'},
    {speaker:'captain',name:'함장',text:'그런데 어디로 사라진거지?'},
    {speaker:'eva',name:'EVA-9',text:'근처의 다른 운석군으로 이동했습니다.'},
    {speaker:'eva',name:'EVA-9',text:'위치를 전송해 드리겠습니다.'}
  ];
  // 오르트구름 15관문 출격: 추적하던 개체 발견 → 전투 개시
  const oort15Lines=[
    {speaker:'captain',name:'함장',text:'저기다, 놈을 찾았어.'},
    {speaker:'eva',name:'EVA-9',text:'다수의 다른 생명체도 감지 됩니다.'},
    {speaker:'eva',name:'EVA-9',text:'... ... ...'},
    {speaker:'eva',name:'EVA-9',text:'서식지 땅 속에 있습니다. 주의하십시오!'}
  ];
  // 오르트구름 20관문 출격: 또 다른 서식지 → EVA-9의 보호막 함선 권고 → 전투 개시
  const oort20Lines=[
    {speaker:'captain',name:'함장',text:'여기도 서식지가 있어, 말도 안돼... 도대체 어디까지...'},
    {speaker:'eva',name:'EVA-9',text:'지금 도착 하신 곳에서는 다른 생체신호가 감지 됩니다.'},
    {speaker:'eva',name:'EVA-9',text:'추적하던 개체보다는 작지만 상당한 에너지가 감지됩니다.'},
    {speaker:'eva',name:'EVA-9',text:'보호막 능력을 가진 함선을 준비하시는 것을 권고합니다.'},
    {speaker:'captain',name:'함장',text:'알았어, 자 여기까지다, 가 보자!'}
  ];
  // 오르트구름 20관문 첫 클리어: 함장의 안도 → 제독 교신 → 함교 복귀 대기
  const oort20ClearLines=[
    {speaker:'captain',name:'함장',text:'생각지도 못한 놈과 만났어, 정말 큰일 날 뻔 했다.'},
    {speaker:'signal',name:'통신 수신',text:'한성민 제독으로부터 교신이 들어옵니다...',incoming:true},
    {speaker:'han',name:'한성민 제독',text:'에바에게 보고 받았다. 함대 상태는 어떤가?',remote:true},
    {speaker:'captain',name:'함장',text:'상당한 피해를 입었지만, 서식지의 대장으로 보이는 녀석을 물리쳤습니다.'},
    {speaker:'captain',name:'함장',text:'이 근처에서는 더 이상 보이지 않습니다.'},
    {speaker:'han',name:'한성민 제독',text:'정말 수고 많았군. 돌아와서 만나도록 하지.',remote:true},
    {speaker:'han',name:'한성민 제독',text:'이상.',remote:true}
  ];
  // 마젠타 행성 첫 출격(마젠타 행성 인근 1관문): 빅터 볼코프 사령관 등장 → 전투 개시
  const volkovLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'Здравствуйте! 이번에 큰 공적을 세웠다는 그 동무로군.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'마젠타 행성은 아무것도 없는 텅빈 행성이야.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'놈들이 우릴 유인하려는 수작임이 틀림없지.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'그래도 윗분들의 명령이니 가는 수밖에...'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'몸조심 하라고 새내기 동무 크하하핫'}
  ];
  // 마젠타 행성 인근 5관문 첫 클리어: 함장의 혼잣말
  const magenta5ClearLines=[
    {speaker:'captain',name:'함장',text:'이렇게 끔찍한 녀석은 처음이군...'},
    {speaker:'captain',name:'함장',text:'함대 정비가 필요하겠어..'}
  ];
  // 히든: 클리어 대사 직후 다른 전투·연구소보다 먼저 함대관리를 열면 볼코프 사령관과 조우 → 정비 물자
  const magenta5VolkovLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'아니 신참 동무 아니신가?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'꽤 험난한 전투를 치르고 온 모양이군. 크하하핫'},
    {speaker:'captain',name:'함장',text:'......네.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'훗...눈빛이 살아있는 동무구만 그래!'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'(갑자기 속삭이며)\n내 말대로 여긴 함정이야...'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'정신 바짝차리라구, 언제 놈들한테 당할지 모르니까'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'(태도를 고치며)\n정비하러 온 김에 사용하라고! 크하하핫'}
  ];
  // 클리어 뒤 처음 연구소에 가면: EVA-9의 생체 파편 분석 → 파일럿 루카 등장
  const magenta5LabLines=[
    {speaker:'eva',name:'EVA-9',text:'어서오십시오, 캡틴.'},
    {speaker:'eva',name:'EVA-9',text:'여기서 새로 발견 된 생체 파편을 분석해 보았습니다.'},
    {speaker:'eva',name:'EVA-9',text:'생김새는 같으나 푸른색을 띈 개체들은 훨씬 더 단단한 외피와 같은 종류지만 파괴력이 더 강한 무장을 하고 있었습니다.'},
    {speaker:'eva',name:'EVA-9',text:'분석의 결과를 말씀드리면, 이들은 근본적으로 같은 구조를 가지고 있습니다.'},
    {speaker:'captain',name:'함장',text:'진화한 생명체는 아니라는 것이군.'},
    {speaker:'eva',name:'EVA-9',text:'그렇습니다.'},
    {speaker:'eva',name:'EVA-9',text:'아마 누군가에 의해...'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'이봐 캡틴, 한참 찾았다고!'},
    {speaker:'captain',name:'함장',text:'루카, 무슨일이야?'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'지금 전방에 난리가 났어 빨리가봐!'}
  ];
  // 주인공 호칭: 루카는 이름(제이크/도나)으로, 놀릴 때는 샌님/어린애. 말릭은 형제/자매.
  const heroCall=()=>read(PROFILE_KEY)?.character==='Donna'?'도나':'제이크';
  const heroTease=()=>read(PROFILE_KEY)?.character==='Donna'?'어린애':'샌님';
  const kin=()=>read(PROFILE_KEY)?.character==='Donna'?'자매':'형제';
  // 마젠타 행성 인근 6관문 출격: 루카의 정찰 보고 → 전투 개시
  const magenta6Lines=[
    {speaker:'luca',name:'파일럿 루카 레예스',text:'전방에 정찰나간 병력들이 기겁을 하고 돌아왔어.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'몇몇은 미처 빠져나오지 못한 것 같아.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'마젠타의 위성 타스 쪽으로 피한 정찰병력도 있어.'},
    {speaker:'captain',name:'함장',text:'걱정마 루카 무사할 거야.'},
    {speaker:'captain',name:'함장',text:'단단히 준비해서 가자, 그들을 구해야지!'}
  ];
  // 마젠타 행성 인근 9관문 첫 클리어: EVA-9의 함교 호출 → 말릭 재등장(SSR 함선 교환권·함선골조) → 연구소 브리핑
  const magenta9CallLine={speaker:'eva',name:'EVA-9',text:'캡틴, 함교로 와주십시오. 기다리시는 분이 계십니다.'};
  const magenta9MalikLines=[
    {speaker:'malik',name:'캡틴 말릭 오코로',text:()=>`${sibling()}, 무사했군.`},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'덕분에 무사히 호송을 마쳤어, 그리고 전장으로 돌아왔지.'},
    {speaker:'captain',name:'함장',text:'다행이군, 하지만 지금 우리 정찰 병력이 타스에 고립되어 있어.'},
    {speaker:'captain',name:'함장',text:'한시라도 빨리 구하러 가야해서 지금 이야기 나눌 시간이 없어.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'흥! 이번엔 내가 돕도록 하지!'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'높으신 양반들 구워 삶아서 얻어 낸거야, 귀한 거라고.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:()=>`이걸로 단단히 준비하고 함께 가자고 ${kin()}!`},
    {speaker:'captain',name:'함장',text:'......'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'......?'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'왜그러나?'},
    {speaker:'captain',name:'함장',text:'우린 전혀 모르는 사이인데.. 왜 이렇게 까지...?'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'목숨에는 목숨으로.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'그게 우리 부족의 정신이지.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'날 구해준 널 나도 구해준다. 그뿐이야.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`${heroCall()}, ${heroTease()}처럼 굴지말라고. 감사하게 받아.`},
    {speaker:'captain',name:'함장',text:'.......'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'미안, 캡틴!'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'한시가 급하다고, 서둘러 어서!'}
  ];
  const magenta9LabLines=[
    {speaker:'eva',name:'EVA-9',text:'캡틴, 전방에 거대한 생체신호가 2개가 감지됩니다.'},
    {speaker:'eva',name:'EVA-9',text:'독성 무기를 쓰는 개체와 화염 무기를 사용하는 개체를 동시에 상대하시려면, 준비를 철저히 하셔야 합니다.'},
    {speaker:'eva',name:'EVA-9',text:'상대의 디버프 효과를 무력화 할 방어막이나, 수리드론을 준비하시는 것을 권장합니다.'}
  ];
  // 오르트구름 전 관문 클리어 후 함교로 돌아오면: 제독과의 대화 → 마젠타 행성 준비 물자
  const oortReturnLines=[
    {speaker:'han',name:'한성민 제독',text:'어서오게 캡틴, 자네의 결단 덕분에 오르트 구름 곳곳의 서식지를 찾아 낼 수 있었네.'},
    {speaker:'han',name:'한성민 제독',text:'다른 서식지는 사령부에서 함대를 보내 정화하고 있으니 한시름 놨어.'},
    {speaker:'han',name:'한성민 제독',text:'문제는... 태양계에서 가까운 마젠타 행성으로 적 일부가 이동하는 것을 포착했다네.'},
    {speaker:'han',name:'한성민 제독',text:'앞으로 더 어려운 임무가 기다리고 있을거야.'},
    {speaker:'han',name:'한성민 제독',text:'사령부에서 보내온 물자와 우리 함대의 물자를 나눠 줄테니 마젠타 행성으로 갈 채비를 하게.'}
  ];
  const MARS_CLEAR_REWARD={gold:100000,thorium:100,scoutTron:10,researchStaff:10};
  // 마젠타 인근 10관문 클리어: 함교에서 함장의 독백 → 연구실에서 EVA-9와 이어가는 대화
  const magenta10ClearLines=[
    {speaker:'captain',name:'함장',text:'볼코프 말이 맞다면 절대 이럴 수는 없어.'},
    {speaker:'captain',name:'함장',text:'뭔가 있는 게 분명해, 연구실로 돌아가서 알아봐야겠어.'}
  ];
  const magenta10LabLines=[
    {speaker:'eva',name:'EVA-9',text:'캡틴, 힘든 싸움이었을텐데 무사하셔서 다행입니다.'},
    {speaker:'captain',name:'함장',text:'에바의 조언이 도움이 됐어, 고마워.'},
    {speaker:'eva',name:'EVA-9',text:'별말씀을요. 지난 대화에서 마무리하지 못한 내용이 있습니다. 이어서 할까요?'},
    {speaker:'captain',name:'함장',text:'어, 뭐였지?'},
    {speaker:'eva',name:'EVA-9',text:'마젠타에서 수집한 생명체 표본을 연구한 결과, 진화에 의한 것이 아닌 의도적으로 설계되었다는 대화였습니다.'},
    {speaker:'captain',name:'함장',text:'아, 맞다! 그렇다면, 이 행성에도 역시 무언가 있다는 뜻인가?'},
    {speaker:'eva',name:'EVA-9',text:'그럴 가능성이 큽니다.'},
    {speaker:'eva',name:'EVA-9',text:'행성으로 접근할수록 생명체 반응이 강하게 나타나고 있습니다.'},
    {speaker:'eva',name:'EVA-9',text:'캡틴 혼자서 감당하기는 어렵습니다.'},
    {speaker:'eva',name:'EVA-9',text:'제독님께 보고 드릴까요?'},
    {speaker:'captain',name:'함장',text:'그래, 일단 타스에 피신한 정찰병력은 구해야겠으니 그 사이에 연락을 취해줘.'}
  ];
  // 타스 1관문 출격 전: 루카와 함장의 대화(정찰병력 구조 준비)
  // 주인공이 도나면 루카는 "도나", 도나는 루카를 "오빠"라고 부르고(제이크의 친구), 제이크면 서로 이름으로 부른다.
  const tasDonna=()=>read(PROFILE_KEY)?.character==='Donna';
  const tas1DepartLines=[
    {speaker:'luca',name:'루카',text:()=>`${tasDonna()?'도나':'제이크'}, 이러다 그들을 못 찾을지도 몰라, 너무 늦은거 아닐까?`},
    {speaker:'captain',name:'함장',text:()=>`${tasDonna()?'오빠':'루카'}, 걱정마. 구조신호는 없지만 아마 무사할거야.`},
    {speaker:'captain',name:'함장',text:()=>`${tasDonna()?'오빠':'루카'}는 후방에서 대기하다가 위치를 확인하면 바로 구조하러 와줘.`}
  ];
  // 타스 5관문: 출격 대화와 클리어 대화(루카와 함장의 호칭은 주인공에 따라 다르다)
  const tas5DepartLines=[
    {speaker:'captain',name:'함장',text:'저기서 우리 함대의 레이다 신호가 잡힌다. 서두르자.'},
    {speaker:'luca',name:'루카',text:'조심해, 뭐가 있을지 몰라.'}
  ];
  const tas5ClearLines=[
    {speaker:'captain',name:'함장',text:'또 이놈이야! 여긴 대체 뭐지?'},
    {speaker:'captain',name:'함장',text:()=>`${tasDonna()?'오빠':'루카'}! 저기 정찰병력들이 있어 어서 구조해줘!`},
    {speaker:'captain',name:'함장',text:'난 저녀석을 추적할게!'},
    {speaker:'luca',name:'루카',text:()=>`${tasDonna()?'도나':'제이크'}! 이런...`},
    {speaker:'luca',name:'루카',text:'일단 고립된 병력을 구조하자...'}
  ];
  // 타스 10관문(대기권 보스): 클리어 → 함교(루카) → 연구실(EVA-9) → 함교(볼코프)
  const tas10ClearLines=[
    {speaker:'captain',name:'함장',text:'위험했다...대체 정체가 뭐야..'},
    {speaker:'captain',name:'함장',text:'일단 돌아가자..'}
  ];
  const tas10HomeLines=[
    {speaker:'luca',name:'루카',text:()=>`${tasDonna()?'도':'제'}..아니 캡틴! 위험했잖아!`},
    {speaker:'luca',name:'루카',text:'그렇게 단독으로 행동하면 어떡해!'},
    {speaker:'captain',name:'함장',text:'고립된 병력들은 모두 구한거야?'},
    {speaker:'luca',name:'루카',text:'...조금만 늦었으면 못찾을 뻔 했어...'},
    {speaker:'captain',name:'함장',text:'다행이군.'},
    {speaker:'captain',name:'함장',text:'일단 연구실로 가야겠어. 상황이 심각해.'},
    {speaker:'luca',name:'루카',text:'....'}
  ];
  const tas10LabLines=[
    {speaker:'eva',name:'EVA-9',text:'무사해서 다행입니다, 캡틴.'},
    {speaker:'eva',name:'EVA-9',text:'한성민 제독님께 상황을 보고드렸고, 조금 전 마주친 거대 괴수의 출현도 알려드렸습니다.'},
    {speaker:'eva',name:'EVA-9',text:'사령부에서도 곧 움직인다고 합니다.'},
    {speaker:'captain',name:'함장',text:'고마워, 대체 그놈은 정체가 뭘까?'},
    {speaker:'eva',name:'EVA-9',text:'지금은 알 수 없습니다. 그렇게 거대한 생명체가 있었다는 기록은 없었습니다.'},
    {speaker:'captain',name:'함장',text:'행성 가까이 가봐야겠어.'},
    {speaker:'eva',name:'EVA-9',text:'알겠습니다. 볼코프 사령관님이 찾으십니다. 함교로 이동하십시오.'}
  ];
  const tas10VolkovLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'하! 애송이 캡틴 동무가 일을 내셨구만!'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'평생 전장을 굴러다녔지만 저런 녀석은 처음 봐.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'마젠타에 뭔가 있긴 있는 모양이구만...'},
    {speaker:'captain',name:'함장',text:'하지만, 저 행성은 텅 비었다고 하셨지 않습니까?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'...그랬지...자네가 감당할 일이 아니야. 더 이상 마젠타에 대한 관심을 갖지 말게.'},
    {speaker:'captain',name:'함장',text:'행성에 접근해서 확인해야 겠습니다.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'나야 자네 직속 상관이 아니니 말릴 수 없지만, 나라면 그러지 않을거야.. 동무.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'나는 다른 임무가 있어서 이만 헤어져야겠군.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'목숨을 소중히 하라고 동무.'}
  ];
  // 마젠타 대기권 5관문 클리어 후: 함장과 EVA-9의 대화
  const atm5ClearLines=[
    {speaker:'captain',name:'함장',text:'에바, 여기엔 새로운 개체들이 계속 나오고 있어.'},
    {speaker:'eva',name:'EVA-9',text:'그렇습니다. 캡틴이 함대를 잘 준비하지 않았다면 결과를 예측하기 힘들었을 겁니다.'},
    {speaker:'eva',name:'EVA-9',text:'태양계에서 봤던 개체들 보다 훨씬 강하고 정교합니다.'},
    {speaker:'captain',name:'함장',text:'계속 가보자.'}
  ];
  // 마젠타 대기권 10관문 클리어 후: 함장 독백 → 함교(제독 보고) → 연구실(EVA-9 보급) 순서
  const atm10ClearLines=[
    {speaker:'captain',name:'함장',text:'이건 전혀 생각지 못한 전개로군.'},
    {speaker:'captain',name:'함장',text:'일단 돌아가자.'}
  ];
  const atm10HomeLines=[
    {speaker:'han',name:'한성민 제독',text:'에바한테 그간의 과정을 보고 받았네. 마젠타 행성에는 생명체가 발견되지는 않았네, 다만...'},
    {speaker:'han',name:'한성민 제독',text:'이곳에서 다양한 생명체를 만들어 낸 흔적을 찾았지.'},
    {speaker:'han',name:'한성민 제독',text:'여기에서 발견된 생체조직과 화성과 타이탄에서 발견된 조직이 동일하다는 것은 눈으로 봐도 알 수 있어.'},
    {speaker:'han',name:'한성민 제독',text:'누구인지 알 수는 없지만, 우리에게 위협이 되는 것 만은 분명하네.'},
    {speaker:'han',name:'한성민 제독',text:'본대에서 이 행성을 샅샅이 수색하기 시작했으니 곧 뭔가 밝혀지겠지.'},
    {speaker:'captain',name:'함장',text:'우리는 이제 어떻게 합니까?'},
    {speaker:'han',name:'한성민 제독',text:'케플러 행성에서 적의 신호가 감지 되었네, 우린 거기로 이동한다.'},
    {speaker:'captain',name:'함장',text:'조금전에 만난 적은 분명 기계였습니다.'},
    {speaker:'captain',name:'함장',text:'대체 누가 이런 짓을 벌이는 걸까요?'},
    {speaker:'han',name:'한성민 제독',text:'그걸 알아내는게 자네와 우리의 임무 아니겠나?'},
    {speaker:'han',name:'한성민 제독',text:'어쩌면 우리에게 지구의 운명이 걸려있을지 모르지...'},
    {speaker:'han',name:'한성민 제독',text:'케플러로 떠날 준비를 하게.'},
    {speaker:'captain',name:'함장',text:'네!'}
  ];
  const atm10LabLines=[
    {speaker:'eva',name:'EVA-9',text:'사령본부에서 전투에 필요한 물자를 보내왔습니다.'},
    {speaker:'eva',name:'EVA-9',text:'케플러는 태양계에서 더 멀어지기 때문에 함대에도 부담이 커집니다.'},
    {speaker:'eva',name:'EVA-9',text:'함대관리에 더 신경 쓰셔야 합니다.'}
  ];
  // 케플러 1관문 클리어 후 선발대 함장 오코예의 긴급 무전
  const keplerOkoyeLines=[
    {speaker:'signal',name:'통신 수신',text:'선발대 함장으로부터 긴급 교신이 들어옵니다...',incoming:true},
    {speaker:'okoye',name:'오코예 함장',text:'캡틴, 선발대 함장 오코예 입니다.'},
    {speaker:'okoye',name:'오코예 함장',text:'이곳의 벌레들은 훨씬 강력합니다.'},
    {speaker:'okoye',name:'오코예 함장',text:'저희는 큰 피해를 입고 귀환중입니다.'},
    {speaker:'okoye',name:'오코예 함장',text:'조심 하십시오, 캡틴.'},
    {speaker:'captain',name:'함장',text:'알겠다, 우리가 도우러 갈테니 속히 철수하도록.'},
    {speaker:'okoye',name:'오코예 함장',text:'감사합니다... 캡틴.'},
    {speaker:'captain',name:'함장',text:'....또 전우들을 잃을 순 없어...'},
    {speaker:'captain',name:'함장',text:'귀환하는 병력들을 도우러 가자.'}
  ];
  // 케플러 5관문 전투 시작 후 루카·오코예·EVA-9의 경고 무전
  const kepler5WarningLines=[
    {speaker:'signal',name:'통신 수신',text:'파일럿 루카 레예스로부터 교신이 들어옵니다...',incoming:true},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'이야, 여기 장난 아닌데!'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'캡틴, 괜찮아?'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'몸조심 해, 까딱하면 골로가겠어.'},
    {speaker:'signal',name:'통신 수신',text:'선발대 함장으로부터 교신이 들어옵니다...',incoming:true},
    {speaker:'okoye',name:'오코예 함장',text:'캡틴, 오코예 입니다.'},
    {speaker:'okoye',name:'오코예 함장',text:'저는 무사히 돌아왔지만, 상당수 병력을 잃었습니다.'},
    {speaker:'okoye',name:'오코예 함장',text:'...속히 재정비하고 합류하겠습니다.'},
    {speaker:'eva',name:'EVA-9',text:'캡틴, 굉장히 위험한 수치의 에너지가 감지됩니다.'},
    {speaker:'eva',name:'EVA-9',text:'교전을 준비하십시오.'}
  ];
  // 케플러 5관문 클리어 후 함장의 독백
  const kepler5ClearLines=[
    {speaker:'captain',name:'함장',text:'휴우, 제대로 준비하지 않았다면 큰일 날 뻔 했어.'},
    {speaker:'captain',name:'함장',text:'계속 가보자!'}
  ];
  // 케플러 2-10 클리어 후: 아이라 퇴각과 승전 대화, 격납고의 파라에게 가라는 안내
  const katm210RetreatLines=[
    {speaker:'ayra',name:'아이라',text:'....오늘을 잊지 않겠다.'},
    {speaker:'ayra',name:'아이라',text:'후회하게 해 주마 이방인.'},
    {speaker:'captain',name:'함장',text:'놓쳤군...'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'우리도 위험했어.'},
    {speaker:'okoye',name:'오코예 함장',text:'이정도면 먼저 간 전우들에게 위로가 됐을겁니다.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'애도를 표하는 바요.'},
    {speaker:'captain',name:'함장',text:'이만 돌아가자, 우리도 정비가 필요해.'},
    {speaker:'eva',name:'EVA-9',text:'격납고에서 파라가 기다리고 있습니다.'}
  ];
  // 격납고: 파라가 개량한 정밀탐색드론을 건넨다(7번째 줄에서 정밀탐색드론 10 즉시 지급)
  const katm210ParaLines=[
    {speaker:'farah',name:'파라 나디르',text:'오랜만이야 캡틴!'},
    {speaker:'captain',name:'함장',text:'어, 오랜만이야 파라, 별일 없지?'},
    {speaker:'farah',name:'파라 나디르',text:'세상에, 세상에, 지난번 전투로 저... 녀석들 기체 파편과 장비들을 조금 얻었는데!'},
    {speaker:'farah',name:'파라 나디르',text:'기술력이 장난이 아니야!'},
    {speaker:'captain',name:'함장',text:'파라, 너무 흥분한거 같아, 좀 진정해'},
    {speaker:'farah',name:'파라 나디르',text:'저 기술을 적용해서 간단하게 만들어 봤어.'},
    {speaker:'farah',name:'파라 나디르',text:'짠~~! 탐색드론을 개량해서 탐색 성능을 끌어올렸지!'},
    {speaker:'farah',name:'파라 나디르',text:'봐, 이쁘지? 내 일생의 역작이라구!'},
    {speaker:'captain',name:'함장',text:'정말 대단해, 파라.'},
    {speaker:'captain',name:'함장',text:'그런데 어떻게 사용하는 거지?'},
    {speaker:'farah',name:'파라 나디르',text:'대단은 무슨, 캡틴에 비하면 아무것도 아니지~'},
    {speaker:'farah',name:'파라 나디르',text:'사용법은 에바에게 알려줬어, 가서 시험해봐.'},
    {speaker:'captain',name:'함장',text:'고마워, 그럼 가볼게.'}
  ];
  // 이동 중: 루카와 함장의 대화
  const katm210WalkLines=[
    {speaker:'luca',name:'파일럿 루카 레예스',text:'파라 성격이 밝은 건 알지만, 상관한테 너무 격이 없는걸?'},
    {speaker:'captain',name:'함장',text:'아니야, 처음 여기 배치 됐을 때 부터 날 도와준 사람이야.'},
    {speaker:'captain',name:'함장',text:'친구나 다름이 없지....'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'....?'}
  ];
  // 함교: 에바-9의 정밀탐색 드론 사용법 안내
  const katm210EvaLines=[
    {speaker:'eva',name:'EVA-9',text:'오셨군요, 캡틴'},
    {speaker:'eva',name:'EVA-9',text:'파라가 정밀탐색 드론을 제작해냈습니다. 사용법은 간단합니다.'},
    {speaker:'eva',name:'EVA-9',text:'10회 탐색 버튼 위에 정밀탐색 버튼을 누르시면 됩니다.'},
    {speaker:'eva',name:'EVA-9',text:'원하시는 함종을 선택 후 탐색을 누르시면 됩니다.'},
    {speaker:'captain',name:'함장',text:'간단한 건데.. 파라가 너무 흥분했네.'}
  ];
  // 정밀탐색 버튼: 파라·에바 장면을 마친 뒤에만 연구 화면에 보인다.
  const syncPrecisionSearchButton=()=>{const button=document.getElementById("precision-search-button");if(button)button.classList.toggle("precision-locked",!state.katm210EvaDone);};
  window.addEventListener('load',syncPrecisionSearchButton);
  // 새로고침 후 대화 창이 대기 상태에서도 남아 화면을 가리지 않도록, 불러올 때 현재 상태에 맞춰 한 번 다시 그린다.
  window.addEventListener('load',()=>paint());
  // 케플러 비밀기지 3-1 시작 전 / 3-5 시작 전 / 3-5 클리어 후 대사와 격납고의 파라 장면
  const kb1PreLines=[
    {speaker:'captain',name:'함장',text:'여기 비밀기지가 있다!'},
    {speaker:'captain',name:'함장',text:'전방에 난리가 났군, 모두 전투 준비!'}
  ];
  const kb5PreLines=[
    {speaker:'luca',name:'파일럿 루카 레예스',text:'이거.. 우리끼리 버거울 거 같은데..'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'지원을 요청하고 다시 오는게 어때?'},
    {speaker:'captain',name:'함장',text:'적을 앞에 두고 등을 돌릴 수는 없어.'}
  ];
  const kb5ClearLines=[
    {speaker:'captain',name:'함장',text:'휴... 힘들었다.'},
    {speaker:'captain',name:'함장',text:'앞으로 이런 놈들이 얼마나 있을까...'},
    {speaker:'signal',name:'통신 수신',text:'에바-9으로부터 무전이 들어옵니다...',incoming:true},
    {speaker:'eva',name:'EVA-9',text:'캡틴, 함선의 상태가 심각합니다.'},
    {speaker:'eva',name:'EVA-9',text:'즉시 귀환하셔서 함대를 정비하셔야 합니다.'}
  ];
  const kb5FarahLines=[
    {speaker:'farah',name:'파라 나디르',text:'캡틴, 괜찮아?'},
    {speaker:'farah',name:'파라 나디르',text:'와아, 이거 난리도 아니구만.'},
    {speaker:'farah',name:'파라 나디르',text:'이 녀석을 더 만들었어.'},
    {speaker:'captain',name:'함장',text:'고마워, 파라'}
  ];
  let pendingSortie = null;
  // 출격 준비 단계: 해당 관문의 시작 전 연출을 띄우고, 끝나면 출격 준비를 이어서 진행한다.
  window.beforeSortieHook = (operation, proceed) => {
    if (active()) return false;
    const chapter = Number(operation?.chapter);
    const region = String(operation?.region || '').toLowerCase();
    const gate = Number(operation?.gate);
    let stage = null;
    if (chapter === 3 && region === 'kepler-base' && gate === 1 && !state.kb1PreDone) stage = 'kb1-pre';
    else if (chapter === 3 && region === 'kepler-base' && gate === 5 && !state.kb5PreDone) stage = 'kb5-pre';
    else if (chapter === 3 && region === 'kepler-atmosphere' && gate === 6 && !state.katm6StartDone) stage = 'katm6-start';
    if (!stage) return false;
    pendingSortie = { stage, proceed };
    setStage(stage);
    return true;
  };
  // 파라 장면의 정밀탐색드론 10개가 지급되지 않은 계정에 한 번 보상 메일로 보낸다(시나리오를 마친 계정만).
  window.addEventListener('load',()=>{if(state.katm210EvaDone&&!state.katm210PrecisionCompensated&&window.deliverCaptainMail?.({id:'katm210-precision-comp',title:'정밀탐색드론 보급품',sender:'연합 사령부',body:'파라가 준비한 정밀탐색드론 10개를 다시 보냅니다. 첨부된 보급품을 수령해 주십시오.',rewards:{precisionScout:10}})){state.katm210PrecisionCompensated=true;save();}});
  window.addEventListener('game-screen-changed',syncPrecisionSearchButton);
  // 연구실: 볼코프 등장과 선택지(사실대로 말한다 / 없었다고 말한다)
  const katm5VolkovLines=[
    {speaker:'captain',name:'함장',text:'아니, 볼코프 사령관님이 여긴 어떻게?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'목소리를 낮추게, 동무 흐흐흐'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'내 말대로 마젠타엔 아무것도 없었지?',choices:[
      {text:'사실대로 말한다',flag:'katm5VolkovTruth',next:'katm5-volkov-truth'},
      {text:'없었다고 말한다',flag:'katm5VolkovLie',next:'katm5-volkov-lie'}
    ]}
  ];
  // '사실대로 말한다' 이후: 볼코프의 반응과 두 번째 선택
  const katm5VolkovTruthLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'역시, 그곳에서 전초기지를 세운 거였군.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'왜 나에게 사실대로 말했나?',choices:[
      {text:'거짓말 할 이유가 없습니다.',flag:'katm5VolkovTruthNoReason',next:'katm5-volkov-noreason'},
      {text:'사령관님은 믿을 수 있는 것 같습니다.',flag:'katm5VolkovTruthTrust',next:'katm5-volkov-trust'}
    ]}
  ];
  // '없었다고 말한다' 이후: 볼코프가 함장을 의심하고 두 번째 선택을 한다
  const katm5VolkovLieLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'훗, 풋내기 주제에 나를 시험하는군.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'내가 의심스럽나, 동무?',choices:[
      {text:'아닙니다. 죄송합니다',flag:'katm5VolkovLieApology',next:'katm5-volkov-apology'},
      {text:'당연히 의심스럽습니다.',flag:'katm5VolkovLieSuspicion',next:'katm5-volkov-suspicion'}
    ]}
  ];
  // 케플러 2-6 출격: 오코예·루카·말릭과의 출격 대화
  const katm6StartLines=[
    {speaker:'okoye',name:'오코예 함장',text:'캡틴, 재정비를 마쳤습니다.'},
    {speaker:'okoye',name:'오코예 함장',text:'다음 출격에는 저희도 함께 하겠습니다!'},
    {speaker:'captain',name:'함장',text:'그래, 하지만 사령부에서 교전을 자제하라는 명령이 왔어, 일단 대기하는 게 좋겠어.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'캡틴, 미안하지만 그렇게 한가롭지 않아.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'정찰병력의 보고가 왔어. 이미 적들이 우리 가까이 다가왔어.'},
    {speaker:'captain',name:'함장',text:'뭐? 루카, 오코예 어서 가자.'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'나를 빼놓고 가면 안되지 캡틴.'},
    {speaker:'captain',name:'함장',text:'...좋아, 명령보다는 우리 병력의 안전이 우선이야.'}
  ];
  // 케플러 2-10 외계 함대 등장 후: 아이라가 멈추라고 경고한다
  const katm210AyraLines=[
    {speaker:'ayra',name:'아이라',text:'이방인의 함대는 멈춰라!'},
    {speaker:'captain',name:'함장',text:'이런 짓을 벌이는 이유가 뭐냐?'},
    {speaker:'ayra',name:'아이라',text:'무슨 소리를 하는지 모르겠군.'},
    {speaker:'ayra',name:'아이라',text:'우리의 영역에 들어온 건 너희들이야! 따끔한 맛을 보여줘야겠군!'},
    {speaker:'ayra',name:'아이라',text:"Alt'uk Toluika!!"}
  ];
  // '당연히 의심스럽습니다' 이후: 볼코프가 배신자 이야기를 꺼낸다(11번째 줄에서 탐색드론 10·토륨 300 즉시 지급)
  const katm5VolkovSuspicionLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'어째서 그렇게 생각하지?'},
    {speaker:'captain',name:'함장',text:'사령관님 말과 사실이 달랐고, 지금 이렇게 은밀히 나타나시는 것도 의심을 살만한 행동 아닙니까?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'생각보다 괜찮은 친구로군 그래. 흐흐흐'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'좋아 좋아... 사실 나는 은밀하게 누군가를 감시중이지.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'당연히 자네도 감시 대상이야, 뭐 지금은 아닌 것 같지만'},
    {speaker:'captain',name:'함장',text:'우리 중에 배신자가 있다는 말입니까?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'그런 셈이지, 어디선가 왜곡된 정보가 돌고 있어, 난 그 진원지를 찾고 있지.'},
    {speaker:'captain',name:'함장',text:'그런 얘기를 왜 제게 하시는 겁니까?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'자네는 아니라는 확신이 들었으니까...하지만...'},
    {speaker:'captain',name:'함장',text:'......?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'자네의 가까운 사람 중에 있을 확률이 높아, 지금까지 확인한 바로는 그래.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'그러니 몸조심하게 친구, 가장 믿는 사람의 배신에 대비해야 하는 법이지.'},
    {speaker:'captain',name:'함장',text:'가장... 믿는 사람...?'}
  ];
  // '아닙니다. 죄송합니다' 이후: 볼코프가 신참을 놀리며 선물을 준다(마지막 줄에서 즉시 지급)
  const katm5VolkovApologyLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'훗, 아직 멀었군 신참 동무.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'사람보는 눈을 키워야겠어, 크흐흐'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'작은 선물을 주지, 몸조심 하게.'}
  ];
  // 거짓말 할 이유가 없다고 답한 경우: 볼코프가 탐색드론을 선물한다(두 번째 줄에서 즉시 지급)
  const katm5VolkovNoReasonLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'흐흐흐, 순진한 동무로군.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'좋아, 내 선물을 하나 주지.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'그럼 몸조심 하게 흐흐흐'}
  ];
  // 사령관님은 믿을 수 있다고 답한 경우: 볼코프의 경고
  const katm5VolkovTrustLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'사람을 함부로 믿지는 말게.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'특히, 자네 상관을 조심하는게 좋아.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'가장 믿는 사람의 배신에 대비하라는 말이 있지 크흐흐'}
  ];
  // 케플러 2-5 클리어 후: 아이라 등장, 에바-9의 함교 호출
  const katm5ClearLines=[
    {speaker:'ayra',name:'아이라',text:'......'},
    {speaker:'eva',name:'EVA-9',text:'캡틴, 제독님께서 찾으십니다.'},
    {speaker:'eva',name:'EVA-9',text:'함교로 이동해주세요.'}
  ];
  // 함교: 한성민 제독과의 대화
  const katm5AdmiralLines=[
    {speaker:'han',name:'한성민 제독',text:()=>`${captain().name}, 노고가 많았다.`},
    {speaker:'han',name:'한성민 제독',text:'오코예 함장에게 보고는 받았네. 자네 덕분에 많은 목숨을 구할 수 있었군.'},
    {speaker:'captain',name:'함장',text:'제독님, 사령부에서 다른 소식은 없습니까?'},
    {speaker:'captain',name:'함장',text:'우리와 비슷한 외계 함선에 대해서 말입니다.'},
    {speaker:'han',name:'한성민 제독',text:'지금까지 벌어진 상황만으로도 사령부에선 적잖이 당황한 기색이야.'},
    {speaker:'han',name:'한성민 제독',text:'전 우주적인 큰 문제가 될까 고심하고 있지.'},
    {speaker:'captain',name:'함장',text:'무고한 시민들과 우리 병력들의 많은 희생이 있었습니다.'},
    {speaker:'captain',name:'함장',text:'저들을 가만 둘 수는 없습니다.'},
    {speaker:'han',name:'한성민 제독',text:'그건 우리가 판단할 몫이 아니야, 자중하게.'},
    {speaker:'han',name:'한성민 제독',text:'교전을 가급적 피하고 다음 명령을 기다리도록.'},
    {speaker:'captain',name:'함장',text:'네, 제독!'}
  ];
  // 제독이 떠난 뒤: 사령부 연구인력 지원(첫 줄에서 즉시 지급)
  const katm5SupplyLines=[
    {speaker:'eva',name:'EVA-9',text:'사령부로부터 연구인력이 대거 도착했습니다.'},
    {speaker:'captain',name:'함장',text:'연구나 하자고 여기까지 온 게 아닌데...'},
    {speaker:'eva',name:'EVA-9',text:'그렇습니다. 하지만, 연구도 우리 함대 전력 증강에 도움이 됩니다.'},
    {speaker:'captain',name:'함장',text:'그래 연구실로 가자.'}
  ];
  // 케플러 2-5(대기권 5관문) 시작 시와 보스 등장 시의 함장 대사
  const katm5StartLines=[{speaker:'captain',name:'함장',text:'저기, 전에 봤던 그놈이다.'}];
  const katm5BossLines=[{speaker:'captain',name:'함장',text:'역시, 이런게 더 있었어.'}];
  // 케플러 10관문 클리어 후: 함장이 에바를 찾아가는 독백
  const kepler10ClearLines=[
    {speaker:'captain',name:'함장',text:'이건 설명이 필요하겠어.'},
    {speaker:'captain',name:'함장',text:'에바한테 가보자.'}
  ];
  // 연구실에서 에바-9가 외계 함선을 분석하는 대화
  const kepler10LabLines=[
    {speaker:'eva',name:'EVA-9',text:'캡틴, 저 함선은 분명 외계 문명의 전함임이 틀림없습니다.'},
    {speaker:'eva',name:'EVA-9',text:'게다가, 우리 연합의 앙헬라와 흡사한 모양과 기술을 사용하는 것으로 포착됐습니다.'},
    {speaker:'captain',name:'함장',text:'그럼 우리 함대를 모방해서 만든 것인가?'},
    {speaker:'eva',name:'EVA-9',text:'그렇다기엔 저쪽의 기술이 더 우수합니다.'},
    {speaker:'eva',name:'EVA-9',text:'누군가 모방을 했다면 우리 쪽일 가능성이 큽니다.'},
    {speaker:'captain',name:'함장',text:'그럼 이 사태의 배후가 저들이라는 건가?'},
    {speaker:'captain',name:'함장',text:'이게 대체 무슨 일이지?'}
  ];
  // ── 케플러 비밀기지 10관문 클리어 후 ──
  // 호칭: 제이크가 주인공이면 도나가 파트너(오빠), 도나가 주인공이면 제이크가 파트너. 주인공은 연구실 장면에서 파트너로 교체된다.
  const heroName=()=>read(PROFILE_KEY)?.character==='Donna'?'도나':'제이크';
  const partnerName=()=>partner().name==='Donna'?'도나':'제이크';
  const partnerCallsLuca=()=>partner().name==='Donna'?'오빠':'루카';
  const capturedCall=()=>partner().name==='Donna'?'오빠를':'도나를';
  const kb10ClearLines=[
    {speaker:'captain',name:'함장',text:'저 우주항모를 우리 힘만으로 상대하는 건 무리야.',fx:'start'},
    {speaker:'captain',name:'함장',text:'함대로 복귀하자, 제독님께 알려야겠어.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`${heroName()}! 저쪽에!`,fx:'return'},
    {speaker:'ayra',name:'아이라',text:'네놈들 따위가 감히 상대가 된다고 생각했나!'},
    {speaker:'ayra',name:'아이라',text:'아무도 살아서 돌아가지 못할 것이다.'},
    {speaker:'captain',name:'함장',text:'...루카, 말릭 어서 함대로 복귀해!'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`안돼, ${heroName()}!`,fx:'net'},
    {speaker:'okoye',name:'아마라 오코예 함장',text:'캡틴... ...'},
    {speaker:'okoye',name:'아마라 오코예 함장',text:'이럴수가...'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'캡틴의 명령이다. 모두 퇴각!'}
  ];
  const kb10BridgeLines=[
    {speaker:'narration',name:'',text:'루카, 한성민 제독에게 그간의 일을 보고한다.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`제독님, 어서 ${heroName()}를 구하러 가야합니다.`},
    {speaker:'han',name:'한성민 제독',text:'안타깝지만, 그건 무모한 일일세.'},
    {speaker:'han',name:'한성민 제독',text:'적의 규모도 모른 채 경거망동 했다간 우리 함대 전체가 위험할 수 있어.'},
    {speaker:'okoye',name:'아마라 오코예 함장',text:'......'},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'......'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'그럼 사령부에 지원을 요청하면 되지 않습니까?'},
    {speaker:'han',name:'한성민 제독',text:'사령부에는 이미 보고했네, 각 지역의 잔당들을 소탕하느라 버거운 모양이야.'},
    {speaker:'han',name:'한성민 제독',text:'일단 기다려보세.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'제독님, 기다릴 여유가 없습니다!'},
    {speaker:'han',name:'한성민 제독',text:'우린 지금 전장 한복판에 와있다.'},
    {speaker:'han',name:'한성민 제독',text:'함장 한 명 때문에 모두를 희생시킬 순 없어!'},
    {speaker:'han',name:'한성민 제독',text:()=>`캡틴 ${heroName()}는... 아무 일 없을 거야..`},
    {speaker:'han',name:'한성민 제독',text:'이만 모두 해산! 적의 움직임에 대비하라!'}
  ];
  const kb10LabLines=[
    {speaker:'luca',name:'파일럿 루카 레예스',text:'에바, 저쪽에서 어떤 신호나 연락은 없어?'},
    {speaker:'eva',name:'EVA-9',text:'적 기지 쪽에서는 아무런 신호도 잡히지 않습니다. 아마 차단막 때문인 것 같습니다.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'으으.. 어떻게 해야하지?'},
    {speaker:'partner',name:()=>partner().name,text:()=>`${partnerCallsLuca()}!`},
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`${partnerName()}...`},
    {speaker:'partner',name:()=>partner().name,text:'어떻게 된거야? 사령부에서 소식을 듣고 바로 왔어.'},
    {speaker:'partner',name:()=>partner().name,text:()=>`${capturedCall()} 구하러가지 않는거야?`,swap:true},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'제독님은 꼼짝도 안하고 있어...'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'앗! 정찰대에서 호출이야. 뭔가 발견한 것 같아.'},
    {speaker:'eva',name:'EVA-9',text:'적이 기지를 버리고 이동하는 것 같습니다.'},
    {speaker:'eva',name:'EVA-9',text:'우리 함선의 신호가 잡힙니다.'},
    {speaker:'captain',name:'함장',text:'함교로 가보자!'}
  ];
  // ── 타파오 통 행성 도입부(케플러 시나리오 종료 후) ──
  // 주인공 교체 이후이므로 heroName()은 지금 플레이하는 캡틴, partnerName()은 나포되었던 캡틴이다. 나포된 쪽이 제이크면 오빠, 도나면 도나로 부른다.
  const capturedAddress=()=>partner().name==='Jake'?'오빠':'도나';
  const tapaoBridgeLines=[
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`${heroName()}! 나포 되었던 우리 함선을 찾았어!`},
    {speaker:'luca',name:'파일럿 루카 레예스',text:()=>`${partnerName()}가 있을지도 몰라...`},
    {speaker:'eva',name:'EVA-9',text:'적이 비밀기지를 버리고 이동하면서 우리 함선도 버린 것 같습니다.'},
    {speaker:'eva',name:'EVA-9',text:'함선 내에 생체신호는 없습니다.'},
    {speaker:'captain',name:'함장',text:'어쨌든 회수해오자...'},
    {speaker:'captain',name:'함장',text:()=>`(${capturedAddress()}, 제발 살아있어 줘.)`},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'별일 없을 거야, 격납고로 가보자.'}
  ];
  const tapaoHangarLines=[
    {speaker:'farah',name:'파라 나디르',text:'지금 우리 함선을 인양하고 있어. 안에... 아무도 없는 것 같아...흑..'},
    {speaker:'captain',name:'함장',text:'... ...'},
    {speaker:'narration',name:'',text:'루카가 주인공의 어깨를 토닥인다.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'...아무 일 없을 거야...'},
    {speaker:'captain',name:'함장',text:'파라, 함선을 가동할 수 있게 정비해줘.'},
    {speaker:'captain',name:'함장',text:()=>`${capturedAddress()}를 찾으러 갈 거야.`},
    {speaker:'farah',name:'파라 나디르',text:'어? 어... 어쨌든 정비는 해 둘게.'},
    {speaker:'eva',name:'EVA-9',text:'우리 함대의 타파오 통 행성으로 출격할지 여부는 아직 결정되지 않았습니다.'},
    {speaker:'captain',name:'함장',text:'알아, 난 어떻게든 갈 거야.'},
    {speaker:'captain',name:'함장',text:'제독님을 만나야겠어!'},
    {speaker:'eva',name:'EVA-9',text:'현재 함교에 계십니다.'}
  ];
  const tapaoAdmiralLines=[
    {speaker:'narration',name:'',text:()=>`${heroName()}, 한성민 제독에게 그간의 일을 설명한다.`},
    {speaker:'captain',name:'함장',text:'그래서 저는 타파오 행성으로 가겠습니다.'},
    {speaker:'han',name:'한성민 제독',text:'...말려도 소용없겠군.'},
    {speaker:'han',name:'한성민 제독',text:'자네 역시 돌아오지 못할 수도 있네, 그래도 가겠나?'},
    {speaker:'captain',name:'함장',text:'저는 반드시 가야 합니다.'},
    {speaker:'han',name:'한성민 제독',text:'..... 그래, 천륜을 막을 수는 없겠지.'},
    {speaker:'han',name:'한성민 제독',text:'가도 좋다. 자원하는 사람은 데려가도 좋아.'},
    {speaker:'eva',name:'EVA-9',text:'제독님, 이렇게 적은 부대를 적의 주요 거점에 보내는 것은..'},
    {speaker:'han',name:'한성민 제독',text:'에바, 그쯤 하지. 무슨 말인지 나도 알아.'},
    {speaker:'eva',name:'EVA-9',text:'네, 제독님. 사령부에 통신을 열어두겠습니다.'},
    {speaker:'han',name:'한성민 제독',text:'좋아, 저들을 연구실로 데려가서 필요한 보급품을 주도록 해. 이상.'}
  ];
  // 타파오 행성 인근 1관문 출격: 도착 대사가 끝나면 준비된 전투가 바로 시작된다. 나포된 쪽이 제이크면 '오빠', 도나면 '도나'로 부른다.
  const tapaoNearPreLines=[
    {speaker:'captain',name:'함장',text:'타파오 통 근처에 도착했어.'},
    {speaker:'captain',name:'함장',text:()=>`${capturedAddress()}가 여기에 있을까?`},
    {speaker:'malik',name:'캡틴 말릭 오코로',text:'글쎄, 적들이 이동한 곳이 여기니 찾아볼 수밖에.'},
    {speaker:'okoye',name:'아마라 오코예 함장',text:'여기에 없다면 저들의 행성까지라도 쫓아가겠습니다.'},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'전방에 적 함대 출현!',remote:true},
    {speaker:'luca',name:'파일럿 루카 레예스',text:'벌써 눈치들 채셨어, 조심하라고.',remote:true},
    {speaker:'captain',name:'함장',text:'전원 위치로! 충격에 대비하라!'}
  ];
  // 타파오 행성인근 5관문 클리어 직후
  const tapaoNear5ClearLines=[
    {speaker:'luca',name:'파일럿 루카 레예스',text:'이 녀석들 전보다 더 강해진 거 같아.'},
    {speaker:'captain',name:'함장',text:'다른 행성에서 상대했던 것과는 다른 것 같아...'},
    {speaker:'okoye',name:'아마라 오코예 함장',text:'저기 계속 옵니다.'}
  ];
  // 타파오 행성인근 10관문 클리어: 에바의 무전 → 격납고(강제 이동) → 연구실(볼코프·한 제독) → 함교.
  // 호칭: 제이크로 플레이 중이면 나포된 쪽은 도나(동생), 도나로 플레이 중이면 제이크(오빠)다. 볼코프는 주인공을 나포된 사람의 반대 호칭으로 부른다.
  const protagonistIsJake=()=>read(PROFILE_KEY)?.character!=='Donna';
  const capturedRole=()=>protagonistIsJake()?'동생':'오빠';
  const protagonistRole=()=>protagonistIsJake()?'오빠':'동생';
  const tapaoNear10ClearLines=[
    {speaker:'eva',name:'EVA-9',text:'함장님, 기체 손상이 심각합니다.',remote:true},
    {speaker:'eva',name:'EVA-9',text:'돌아오셔서 재정비 후에 진행하시는 것을 권고합니다.',remote:true},
    {speaker:'captain',name:'함장',text:'생각보다 힘든 상대였어.'},
    {speaker:'captain',name:'함장',text:'돌아가서 함선을 재정비한다. 모두 귀환하라.'}
  ];
  const tapaoNear10HangarLines=[
    {speaker:'farah',name:'파라 나디르',text:'세상에, 함선이 난리도 아니네.. 실드가 뚫려서 선체가 파괴될 뻔 했어.'},
    {speaker:'farah',name:'파라 나디르',text:'더 이상은 무리일 것 같은데...'},
    {speaker:'captain',name:'함장',text:'엔지니어? 최대한 빨리 정비해줘.'},
    {speaker:'captain',name:'함장',text:'곧 다시 나가야 하니까.'},
    {speaker:'farah',name:'파라 나디르',text:'네, 알겠습니다. 그런데 소식은...?'},
    {speaker:'captain',name:'함장',text:'아직 아무 단서도 없었어.'},
    {speaker:'farah',name:'파라 나디르',text:'그렇군요... 연구실로 와 달라고 에바가 전해달라고 했습니다.'},
    {speaker:'captain',name:'함장',text:'...? 알았어. 바로 가볼게'}
  ];
  const tapaoNear10LabLines=[
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:()=>`자네가 그 납치된 녀석의 ${protagonistRole()}인가?`},
    {speaker:'captain',name:'함장',text:'누구십니까?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'나는 사령관 볼코프라고 하네.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'사라진 녀석의 소식을 듣고 왔는데, 남매가 있을 줄은 몰랐군.'},
    {speaker:'captain',name:'함장',text:()=>`제 ${capturedRole()}${capturedRole()==='동생'?'을':'를'} 아십니까?`},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'가까운 사람을 조심하라고 경고했는데... 듣지 않은 모양이더군.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'그 녀석과 자네에겐 안됐지만, 덕분에 실체가 드러나게 되었지.'},
    {speaker:'captain',name:'함장',text:'배신자가 있다는 뜻입니까?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'목소리를 낮추게, 누군가 듣고 있을지 모르니..'},
    {speaker:'captain',name:'함장',text:'대체 무슨...'},
    {speaker:'han',name:'한성민 제독',text:'볼코프, 자네가 여긴 웬일인가?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'오랜만이군, 한 제독. 잘 지냈나?'},
    {speaker:'han',name:'한성민 제독',text:'사령관께서 온다는 이야기는 듣지 못했는데, 내 부하들이 보고를 안한건가?'},
    {speaker:'han',name:'한성민 제독',text:'아니면, 뭔가 사연이 있어서 몰래 온건가?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'(웃으며) 상관을 대하는 태도가 이게 뭔가?'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'아무리 전쟁영웅이라도 말이지.'},
    {speaker:'han',name:'한성민 제독',text:'상관이라면 우리 함대에 몰래 잠입하지는 않았겠지.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'농담이야, 한. 적의 동태를 살피는 비밀임무 중에 한 제독 함대의 이야기를 듣고 잠시 와본 것 뿐이야.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'물론 빈 손으로 온건 아니지.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'보아하니 자네도 입장이 난처하겠군, 제독.'},
    {speaker:'volkov',name:'사령관 빅터 볼코프',text:'몸조심하게, 지켜보는 눈들이 많으니...그럼 이만.'},
    {speaker:'han',name:'한성민 제독',text:'조심히 가게 친구. 다음부터는 몰래 다니지 말라고.'},
    {speaker:'han',name:'한성민 제독',text:'자네는, 연구실에 용건이 있나?'},
    {speaker:'captain',name:'함장',text:'네.. 네 그렇습니다.'},
    {speaker:'han',name:'한성민 제독',text:'용건이 끝나면 함교로 오게, 할 말이 있으니.'},
    {speaker:'captain',name:'함장',text:'네, 제독.'}
  ];
  const tapaoNear10RewardIndex=tapaoNear10LabLines.findIndex(line=>String(line.text).startsWith('물론 빈 손으로'));
  // 함교로 이동하면 제독이 묻고, 주인공이 대답을 고른다(이후 전개는 선택값만 저장한다).
  const tapaoNear10BridgeLines=[
    {speaker:'han',name:'한성민 제독',text:'볼코프 사령관과 아는 사이인가?',choices:[
      {text:'아는 사이다.',flag:'tapaoVolkovKnown'},
      {text:'모르는 사이다.',flag:'tapaoVolkovUnknown'}
    ]}
  ];
  const tapaoLabLines=[
    {speaker:'eva',name:'EVA-9',text:'제독님의 지시에 따라 보급품을 지급합니다. 탐사드론 30개, 연구인력 30명, 골드 30,000이 입고되었습니다.'}
  ];
  // 주인공 교체: 연구실에서 파트너가 등장한 뒤부터 플레이하는 함장이 파트너로 바뀐다(초상화 포함).
  const swapProtagonist=()=>{
    if(state.kb10Swapped)return;
    const next=partner().name;
    state.kb10Swapped=true;save();
    window.setCommanderCharacter?.(next);
  };
  // 전투 장면에서 까맣게 사라졌다가 밝아지며 함교로 이동한다.
  const wait2=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const kb10ToBridge=async()=>{
    setStage('kb10-fade');
    const fade=document.createElement('div');
    fade.className='kb10-fade';
    document.body.append(fade);
    void fade.offsetWidth;
    fade.classList.add('on');
    await wait2(1100);
    window.keplerEndingFx?.('end');
    window.show?.('home');
    setStage('kb10-bridge');
    await wait2(700);
    fade.classList.remove('on');
    await wait2(1700);
    fade.remove();
  };
  // 케플러 10관문: 외계 함대 등장 직전의 조우 연출
  const kepler10IntroLines=[
    {speaker:'captain',name:'함장',text:'저건... 함선이잖아..'},
    {speaker:'signal',name:'통신 수신',text:'선발대 함장으로부터 교신이 들어옵니다...',incoming:true},
    {speaker:'okoye',name:'오코예 함장',text:'캡틴, 조심하십시오.'},
    {speaker:'okoye',name:'오코예 함장',text:'선발대 생존자가 저 함선으로부터 공격을 받았다고 합니다.'},
    {speaker:'captain',name:'함장',text:'일단 우리편은 아니란 거군... 전원 전투 준비!'}
  ];
  const multiLine={'kb10-clear':kb10ClearLines,'kb10-bridge':kb10BridgeLines,'kb10-lab':kb10LabLines,'tapao-bridge':tapaoBridgeLines,'tapao-hangar':tapaoHangarLines,'tapao-admiral':tapaoAdmiralLines,'tapao-lab':tapaoLabLines,'tapao-near-pre':tapaoNearPreLines,'tapao-near5-clear':tapaoNear5ClearLines,'tapao-near10-clear':tapaoNear10ClearLines,'tapao-near10-hangar':tapaoNear10HangarLines,'tapao-near10-lab':tapaoNear10LabLines,'tapao-near10-bridge':tapaoNear10BridgeLines,'kb1-pre':kb1PreLines,'kb5-pre':kb5PreLines,'kb5-clear':kb5ClearLines,'kb5-farah':kb5FarahLines,'katm210-retreat':katm210RetreatLines,'katm210-para':katm210ParaLines,'katm210-walk':katm210WalkLines,'katm210-eva':katm210EvaLines,'katm6-start':katm6StartLines,'katm210-ayra':katm210AyraLines,'katm5-volkov':katm5VolkovLines,'katm5-volkov-truth':katm5VolkovTruthLines,'katm5-volkov-noreason':katm5VolkovNoReasonLines,'katm5-volkov-trust':katm5VolkovTrustLines,'katm5-volkov-lie':katm5VolkovLieLines,'katm5-volkov-apology':katm5VolkovApologyLines,'katm5-volkov-suspicion':katm5VolkovSuspicionLines,'katm5-clear':katm5ClearLines,'katm5-admiral':katm5AdmiralLines,'katm5-supply':katm5SupplyLines,'katm5-start':katm5StartLines,'katm5-boss':katm5BossLines,'kepler-okoye-call':keplerOkoyeLines,'kepler5-warning':kepler5WarningLines,'kepler5-clear':kepler5ClearLines,'kepler10-intro':kepler10IntroLines,'kepler10-clear':kepler10ClearLines,'kepler10-lab':kepler10LabLines,'atm10-clear':atm10ClearLines,'atm10-home':atm10HomeLines,'atm10-lab':atm10LabLines,'atm5-clear':atm5ClearLines,'tas10-clear':tas10ClearLines,'tas10-home':tas10HomeLines,'tas10-lab':tas10LabLines,'tas10-volkov':tas10VolkovLines,'tas5-depart':tas5DepartLines,'tas5-clear':tas5ClearLines,'tas1-depart':tas1DepartLines,'magenta10-clear':magenta10ClearLines,'magenta10-lab':magenta10LabLines,briefing:gate6Lines,'titan-briefing':titanBriefingLines,'mars-clear':marsClearLines,malik:malikLines,'titan-gate5':titanGate5Lines,'titan-fall':titanFallLines,'titan-lab':titanLabLines,'titan-report':titanReportLines,'lab-briefing':labBriefingLines,oort10:oort10Lines,'oort10-clear':oort10ClearLines,oort15:oort15Lines,oort20:oort20Lines,'oort20-clear':oort20ClearLines,'oort-return':oortReturnLines,volkov:volkovLines,'magenta5-clear':magenta5ClearLines,'magenta5-volkov':magenta5VolkovLines,'magenta5-lab':magenta5LabLines,magenta6:magenta6Lines,'magenta9-malik':magenta9MalikLines,'magenta9-lab':magenta9LabLines};
  // 출격 직후 통신이 끝나면 준비된 전투를 바로 개시하는 단계
  const AUTO_START_STAGES=['malik','oort10','oort15','volkov','magenta6','tapao-near-pre'];
  // 출격 직후 대화 단계(새로고침하면 준비된 전투가 사라지므로 다음 출격 때 다시 보여줌). 오르트 20관문은 보호막 함선 권고에 따라 편성을 바꿀 수 있게 [전투 개시]를 기다립니다.
  const PREBATTLE_STAGES=[...AUTO_START_STAGES,'oort20'];
  // 대사 중간에 보상을 주는 지점: 해당 줄에서 [계속]을 누르면 지급 + 물자창고 이송 연출 후 다음 줄로 넘어갑니다.
  const REWARD_ICON={gold:['골드','gold-resource-icon.svg'],precisionScout:['정밀탐색드론','icons/precision-scout-drone.webp'],ssrShipTicket:['SSR 함선 선택 교환권','icons/ssr-ship-ticket.svg?v=3'],frameTicket:['함선골조 교환권','icons/frame-ticket.svg?v=2'],frameCannon:['함포 골조','icons/ship-frame.png'],frameMissile:['미사일 골조','icons/ship-frame.png'],frameLaser:['레이저포 골조','icons/ship-frame.png'],framePiercing:['관통레이저 골조','icons/ship-frame.png'],frameCarrier:['함재기 골조','icons/ship-frame.png'],goldVault:['금고','icons/vault.png'],thoriumBox:['토륨 상자','icons/thorium-box.png'],thorium:['토륨','thorium-crystal-icon.png'],scoutTron:['탐사드론','icons/scout-drone.png'],researchStaff:['연구인력','icons/research-personnel-20261002.png'],journal:['연구일지','icons/research-journal.png'],core:['범용연구코어','icons/research-core.png']};
  const rewardSteps={
    'tapao-near10-lab':{index:tapaoNear10RewardIndex,flag:'tapaoNear10VolkovRewardGranted',kicker:'COMMANDER VOLKOV · SECRET SUPPLY',title:'볼코프의 지원 물자',rewards:{scoutTron:30,researchStaff:30,gold:50000}},
    'tapao-lab':{index:0,flag:'tapaoLabRewardGranted',kicker:'ADMIRAL HAN · TAPAO SORTIE SUPPLY',title:'타파오 출정 보급품',rewards:{scoutTron:30,researchStaff:30,gold:30000}},
    'katm5-supply':{index:0,flag:'katm5SupplyRewardGranted',kicker:'EVA-9 · RESEARCH PERSONNEL',title:'사령부 연구인력 지원',rewards:{researchStaff:100}},
    'kb5-farah':{index:2,flag:'kb5FarahPrecisionGranted',kicker:'FARAH · PRECISION SCOUT',title:'정밀탐색드론 개량품',rewards:{precisionScout:20}},
    'katm210-para':{index:6,flag:'katm210PrecisionScoutGranted',kicker:'FARAH · PRECISION SCOUT',title:'정밀탐색드론 개량품',rewards:{precisionScout:10}},
    'katm5-volkov-noreason':{index:1,flag:'katm5VolkovGiftGranted',kicker:'VOLKOV · PERSONAL GIFT',title:'볼코프의 선물',rewards:{scoutTron:10}},
    'katm5-volkov-apology':{index:2,flag:'katm5VolkovApologyGiftGranted',kicker:'VOLKOV · PERSONAL GIFT',title:'볼코프의 선물',rewards:{scoutTron:10}},
    'katm5-volkov-suspicion':{index:11,flag:'katm5VolkovSuspicionGiftGranted',kicker:'VOLKOV · PERSONAL GIFT',title:'볼코프의 선물',rewards:{scoutTron:10,thorium:300}},
    'atm10-lab':{index:0,flag:'atm10SupplyRewardGranted',kicker:'ADMIRAL HAN · FLEET SUPPLY',title:'사령본부 전투 물자',rewards:{scoutTron:50,researchStaff:50,thorium:500,frameTicket:1}},
    'tas10-volkov':{index:8,flag:'tas10VolkovRewardGranted',kicker:'VOLKOV · FLEET SUPPLY',title:'볼코프의 지원 물자',rewards:{scoutTron:10,researchStaff:10}},
    'titan-fall':{index:3,flag:'titanFallRewardGranted',kicker:'TITAN · FORWARD BASE EVACUATION',title:'전진기지 물자 인수',rewards:{scoutTron:30,journal:20,core:5}},
    'titan-lab':{index:1,flag:'titanLabRewardGranted',kicker:'RESEARCH LAB · HIDDEN SUPPLY',title:'호송함대 지원 물자',rewards:{scoutTron:10,researchStaff:10}},
    'lab-briefing':{index:7,flag:'labBriefingRewardGranted',kicker:'ADMIRAL HAN · SPECIAL SUPPLY',title:'제독의 특별 지원',rewards:{scoutTron:20,researchStaff:20,thorium:500}},
    'oort-return':{index:4,flag:'oortReturnRewardGranted',kicker:'ADMIRAL HAN · MAGENTA PREPARATION',title:'마젠타 행성 출정 물자',rewards:{scoutTron:20,researchStaff:20,thorium:500}},
    'magenta9-malik':{index:5,flag:'magenta9MalikRewardGranted',kicker:'CAPTAIN MALIK · HARD-WON SUPPLY',title:'말릭의 지원 물자',rewards:{ssrShipTicket:1,frameCannon:1,frameMissile:1,frameLaser:1,framePiercing:1,frameCarrier:1}},
    'magenta5-volkov':{index:6,flag:'magenta5VolkovRewardGranted',kicker:'COMMANDER VOLKOV · HIDDEN SUPPLY',title:'볼코프의 정비 물자',rewards:{scoutTron:10,thoriumBox:10,goldVault:10}}
  };
  let rewardPlaying=false,labHiddenArmed=false,labHiddenPending=false;
  const active=()=>!!state.stage;
  const current=()=>{
    if(state.stage==='call')return {speaker:'eva',name:'EVA-9',text:'함장님, 제독님께서 찾으십니다. 함교로 이동해주세요.'};
    if(state.stage==='titan-call')return titanCallLine;
    if(state.stage==='titan-call2')return titanCall2Line;
    if(state.stage==='magenta9-call')return magenta9CallLine;
    if(state.stage==='warning')return gate9Line;
    // 연구실 대기 중에는 대화를 띄우지 않는다. 연구실 메뉴를 열면 작전 회의가 시작된다.
    if(/-pending$/.test(state.stage))return null;
    const lines=multiLine[state.stage];
    return lines?lines[Math.min(state.index,lines.length-1)]:null;
  };
  const STAGE_KICKERS={
    'kepler-okoye-call':'KEPLER · ORBIT GATE 01 / EMERGENCY SIGNAL',
    'kepler5-warning':'KEPLER · ORBIT GATE 05 / ENERGY WARNING',
    'kepler5-clear':'KEPLER · ORBIT GATE 05 / MISSION COMPLETE',
    'kepler10-intro':'KEPLER · ORBIT GATE 10 / CONTACT',
    'katm5-start':'KEPLER · ATMOSPHERE GATE 05 / BATTLE START',
    'katm5-clear':'KEPLER · ATMOSPHERE GATE 05 / MISSION COMPLETE',
    'katm5-volkov':'RESEARCH LAB · VOLKOV',
    'katm6-start':'KEPLER · ATMOSPHERE GATE 06 / SORTIE',
    'katm210-retreat':'KEPLER · ATMOSPHERE GATE 10 / MISSION COMPLETE',
    'kb1-pre':'KEPLER SECRET BASE · GATE 01 / BRIEFING',
    'kb5-pre':'KEPLER SECRET BASE · GATE 05 / BRIEFING',
    'kb5-clear':'KEPLER SECRET BASE · GATE 05 / MISSION COMPLETE',
    'kb10-clear':'KEPLER SECRET BASE · GATE 10 / ALIEN CARRIER',
    'kb10-bridge':'UNITED STAR FLEET · BRIDGE / ADMIRAL HAN',
    'kb10-lab':'RESEARCH LAB · EVA-9',
    'tapao-bridge':'UNITED STAR FLEET · BRIDGE / TAPAO THONG',
    'tapao-hangar':'HANGAR · FARAH NADIR',
    'tapao-admiral':'UNITED STAR FLEET · BRIDGE / ADMIRAL HAN',
    'tapao-lab':'RESEARCH LAB · FLEET SUPPLY',
    'tapao-near-pre':'TAPAO THONG · PLANET VICINITY GATE 01 / ARRIVAL',
    'tapao-near5-clear':'TAPAO THONG · PLANET VICINITY GATE 05 / MISSION COMPLETE',
    'tapao-near10-clear':'TAPAO THONG · PLANET VICINITY GATE 10 / MISSION COMPLETE',
    'tapao-near10-hangar':'HANGAR · FARAH NADIR',
    'tapao-near10-lab':'RESEARCH LAB · COMMANDER VOLKOV',
    'tapao-near10-bridge':'UNITED STAR FLEET · BRIDGE / ADMIRAL HAN',
    'kb5-farah':'HANGAR · FARAH NADIR',
    'katm210-para':'HANGAR · FARAH NADIR',
    'katm210-walk':'FLEET CORRIDOR',
    'katm210-eva':'FLEET BRIDGE · EVA-9',
    'katm210-ayra':'KEPLER · ATMOSPHERE GATE 10 / CONTACT',
    'katm5-volkov-truth':'RESEARCH LAB · VOLKOV',
    'katm5-volkov-noreason':'RESEARCH LAB · VOLKOV GIFT',
    'katm5-volkov-trust':'RESEARCH LAB · VOLKOV WARNING',
    'katm5-volkov-lie':'RESEARCH LAB · VOLKOV TEST',
    'katm5-volkov-apology':'RESEARCH LAB · VOLKOV GIFT',
    'katm5-volkov-suspicion':'RESEARCH LAB · VOLKOV SECRET',
    'katm5-admiral':'FLEET BRIDGE · ADMIRAL HAN',
    'katm5-supply':'FLEET SUPPLY · RESEARCH PERSONNEL',
    'katm5-boss':'KEPLER · ATMOSPHERE GATE 05 / BOSS APPEARANCE',
    'kepler10-clear':'KEPLER · ORBIT GATE 10 / MISSION COMPLETE',
    'kepler10-lab':'KEPLER · RESEARCH LAB / ANALYSIS',
    call:'MARS · GATE 06 / MISSION COMPLETE','tas1-depart':'MAGENTA TAS · GATE 01 / DEPARTURE BRIEFING','tas5-depart':'MAGENTA TAS · GATE 05 / DEPARTURE BRIEFING','tas10-clear':'MAGENTA TAS · GATE 10 / MISSION COMPLETE','atm5-clear':'MAGENTA ATMOSPHERE · GATE 05 / MISSION COMPLETE','atm10-clear':'MAGENTA ATMOSPHERE · GATE 10 / MISSION COMPLETE','atm10-home':'UNITED STAR FLEET · BRIDGE / ADMIRAL HAN','atm10-lab':'RESEARCH LAB · EVA-9','tas10-home':'UNITED STAR FLEET · BRIDGE / LUCA REYES','tas10-lab':'RESEARCH LAB · EVA-9','tas10-volkov':'UNITED STAR FLEET · BRIDGE / COMMANDER VOLKOV','tas5-clear':'MAGENTA TAS · GATE 05 / MISSION COMPLETE','magenta10-clear':'MAGENTA ORBIT · GATE 10 / MISSION COMPLETE','magenta10-lab':'RESEARCH LAB · EVA-9',warning:'MARS · GATE 09 / COMMAND TRANSMISSION','titan-briefing':'TITAN · SCENARIO 02 / COMMAND BRIEFING',
    'mars-clear':'MARS · OPERATION CLEAR / COMMAND SUPPORT',malik:'TITAN · GATE 01 / FIELD TRANSMISSION','titan-gate5':'TITAN · GATE 05 / FIELD TRANSMISSION',
    'titan-call':'TITAN · GATE 10 / MISSION COMPLETE','titan-fall':'TITAN · FORWARD BASE / EMERGENCY TRANSMISSION','titan-lab':'RESEARCH LAB · EVA-9',
    'titan-call2':'TITAN · ALL GATES CLEAR / COMMAND TRANSMISSION','titan-report':'UNITED STAR FLEET · BRIDGE / ADMIRAL HAN','lab-briefing':'RESEARCH LAB · STRATEGIC BRIEFING',
    oort10:'OORT CLOUD · GATE 10 / COMMAND TRANSMISSION','oort10-clear':'OORT CLOUD · GATE 10 / MISSION COMPLETE',oort15:'OORT CLOUD · GATE 15 / TARGET LOCATED',
    volkov:'MAGENTA ORBIT · GATE 01 / FLEET COMMANDER','magenta5-clear':'MAGENTA ORBIT · GATE 05 / MISSION COMPLETE','magenta5-volkov':'FLEET MANAGEMENT · UNEXPECTED VISITOR','magenta5-lab':'RESEARCH LAB · BIO-FRAGMENT ANALYSIS',magenta6:'MAGENTA ORBIT · GATE 06 / RECON REPORT','magenta9-call':'MAGENTA ORBIT · GATE 09 / MISSION COMPLETE','magenta9-malik':'UNITED STAR FLEET · BRIDGE / CAPTAIN MALIK','magenta9-lab':'RESEARCH LAB · THREAT ANALYSIS',oort20:'OORT CLOUD · GATE 20 / FIELD BRIEFING','oort20-clear':'OORT CLOUD · ALL GATES CLEAR / COMMAND TRANSMISSION','oort-return':'UNITED STAR FLEET · BRIDGE / ADMIRAL HAN'
  };
  // 교신 수신 줄은 초상화 자리에 신호 파동을, 원거리 교신 줄은 초상화에 통신 화면(주사선) 효과를 씌웁니다.
  const SIGNAL_PORTRAIT='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="7" fill="#9ff0ff"/><path d="M42 42a26 26 0 0 0 0 36M78 42a26 26 0 0 1 0 36M30 30a43 43 0 0 0 0 60M90 30a43 43 0 0 1 0 60" fill="none" stroke="#7fdcff" stroke-width="5" stroke-linecap="round"/><path d="M60 67v40" stroke="#7fdcff" stroke-width="5" stroke-linecap="round"/></svg>');
  const portraitFor=speaker=>speaker==='signal'?SIGNAL_PORTRAIT:speaker==='okoye'?'okoye-scenario-bust.webp':speaker==='ayra'?'ayra-scenario-bust.webp':speaker==='han'?'han-seong-min-bust.png':speaker==='captain'?captain().image:speaker==='partner'?partner().image:speaker==='farah'?'farah-nadir-confident.png':speaker==='malik'?'captain-malik-okoro-bust.png?v=20261011-3':speaker==='volkov'?'viktor-volkov-bust.png?v=20261013-2':speaker==='luca'?'luca-reyes-bust.png?v=20261013-1':'eva9-tutorial-bust.png';
  const paint=()=>{
    if(!overlay)return;
    const line=current();overlay.hidden=!line;document.body.dataset.marsScene=line?state.stage:'';
    if(!line)return;
    overlay.dataset.speaker=line.speaker;
    if(line.fx){const fxKey=state.stage+':'+state.index;if(fxDone!==fxKey){fxDone=fxKey;window.keplerEndingFx?.(line.fx);}}
    overlay.dataset.channel=line.incoming?'incoming':line.remote?'remote':'';
    // 표정이 지정된 대사는 표정 그림({인물}-expr-{표정}.png)을 쓰고, 같은 인물의 표정이 바뀌면 짧게 전환 효과를 준다.
    const portrait=overlay.querySelector('.mars-scenario-portrait');
    const portraitSrc=line.expression?`${line.speaker}-expr-${line.expression}.png?v=20261013-1`:portraitFor(line.speaker);
    const sameSpeaker=portrait.dataset.speaker===line.speaker;
    if(portrait.getAttribute('src')!==portraitSrc){
      portrait.src=portraitSrc;
      if(sameSpeaker){portrait.classList.remove('portrait-expression-change');void portrait.offsetWidth;portrait.classList.add('portrait-expression-change');}
    }
    portrait.dataset.speaker=line.speaker;
    portrait.classList.toggle('portrait-close-up',!!line.expression);
    const speakerName=line.speaker==='captain'?captain().name:typeof line.name==='function'?line.name():line.name;
    overlay.querySelector('.mars-scenario-portrait').alt=`${speakerName} 흉상`;
    overlay.querySelector('.mars-scenario-kicker').textContent=line.incoming?'INCOMING TRANSMISSION':STAGE_KICKERS[state.stage]||'UNITED STAR FLEET · BRIDGE';
    overlay.querySelector('.mars-scenario-name').textContent=speakerName;
    overlay.querySelector('.mars-scenario-text').textContent=typeof line.text==='function'?line.text():line.text;
    // 선택지가 있는 대사는 '계속' 대신 선택 버튼을 보인다.
    const choiceBox=overlay.querySelector('.mars-scenario-choices');
    if(choiceBox){choiceBox.hidden=!line.choices;choiceBox.innerHTML=line.choices?line.choices.map((choice,index)=>`<button type="button" class="mars-scenario-choice" data-choice="${index}">${choice.text}</button>`).join(''):'';}
    overlay.querySelector('.mars-scenario-next').hidden=!!line.choices;
    const lineCount=multiLine[state.stage]?.length||1;
    overlay.querySelector('.mars-scenario-next').textContent=state.stage==='call'||state.stage==='titan-call'||state.stage==='titan-call2'||state.stage==='magenta9-call'?'함교':line.incoming?'수신':state.index<lineCount-1?'계속':state.stage==='titan-report'?'연구실':'확인';
    overlay.querySelector('.mars-scenario-next').focus({preventScroll:true});
  };
  const setStage=(stage,index=0)=>{state.stage=stage;state.index=index;save();paint();};
  const grantMarsClearReward=()=>{
    if(state.marsClearRewardGranted)return;
    const count=value=>Math.max(0,Math.floor(Number(value)||0));
    const balances={gold:0,thorium:0,...(read(RESOURCE_KEY)||{}),...(window.gameResources||{})};
    const loot=read(LOOT_KEY)||{};
    balances.gold=count(balances.gold)+MARS_CLEAR_REWARD.gold;
    balances.thorium=count(balances.thorium)+MARS_CLEAR_REWARD.thorium;
    loot.scoutTron=count(loot.scoutTron)+MARS_CLEAR_REWARD.scoutTron;
    loot.researchStaff=count(loot.researchStaff)+MARS_CLEAR_REWARD.researchStaff;
    try{
      localStorage.setItem(RESOURCE_KEY,JSON.stringify(balances));
      localStorage.setItem(LOOT_KEY,JSON.stringify(loot));
      window.gameResources=balances;
      state.marsClearRewardGranted=true;save();
      window.updateGameResourceHud?.();
      window.dispatchEvent(new Event('game-resources-updated'));
    }catch{}
  };
  const MARS_CLEAR_REWARD_ICONS=[
    {key:'gold',name:'골드',image:'gold-resource-icon.svg'},
    {key:'thorium',name:'토륨',image:'thorium-crystal-icon.png'},
    {key:'scoutTron',name:'탐사드론',image:'icons/scout-drone.png'},
    {key:'researchStaff',name:'연구인력',image:'icons/research-personnel-20261002.png'}
  ];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // 화면 중앙에 보상 아이콘을 띄운 뒤 함교의 물자창고 버튼으로 날아가 수납되는 연출입니다.
  // items: [{name, image, amount}] — 물자창고 버튼이 보이지 않는 화면에서는 메일 보상과 같은 "물자창고" 표지로 날아갑니다.
  const playRewardFlight=async({kicker,title,items})=>{
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const layer=document.createElement('div');
    layer.className='mars-reward-flight';layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');
    layer.innerHTML=`<div class="mars-reward-panel"><small>${kicker}</small><strong>${title}</strong><div class="mars-reward-items">${items.map(({name,image,amount},index)=>`<div class="mars-reward-item" style="--delay:${index*110}ms"><span class="mars-reward-icon"><img src="${image}" alt=""/></span><b>${name}</b><em>+${Number(amount).toLocaleString('ko-KR')}</em></div>`).join('')}</div><p>물자창고로 이송합니다</p></div>`;
    document.body.append(layer);
    await wait(reduced?600:1500);
    const target=document.querySelector('#home .deck-shortcut.warehouse');
    const targetRect=target?.getBoundingClientRect();
    const visibleTarget=targetRect&&targetRect.width>0&&targetRect.height>0;
    layer.classList.add('is-leaving');
    if(!reduced&&!visibleTarget&&window.animateRewardsToWarehouse){
      const flights=[...layer.querySelectorAll('.mars-reward-item')].map((item,index)=>{const icon=item.querySelector('.mars-reward-icon');const rect=icon.getBoundingClientRect();icon.style.visibility='hidden';return {src:items[index].image,amount:`+${Number(items[index].amount).toLocaleString('ko-KR')}`,rect};});
      window.animateRewardsToWarehouse(flights);
      await wait(1050+flights.length*115+450);
      layer.remove();
      return;
    }
    if(!reduced&&visibleTarget&&typeof Element.prototype.animate==='function'){
      const tx=targetRect.left+targetRect.width/2,ty=targetRect.top+targetRect.height/2;
      const flights=[...layer.querySelectorAll('.mars-reward-icon')].map((icon,index)=>{
        const rect=icon.getBoundingClientRect();
        const ghost=icon.cloneNode(true);ghost.classList.add('mars-reward-ghost');
        Object.assign(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
        document.body.append(ghost);icon.style.visibility='hidden';
        const dx=tx-(rect.left+rect.width/2),dy=ty-(rect.top+rect.height/2);
        // 위로 살짝 솟았다가 물자창고로 빨려 들어가는 곡선 경로입니다.
        return ghost.animate([
          {transform:'translate(0,0) scale(1)',opacity:1},
          {transform:`translate(${dx*.35}px,${dy*.35-60}px) scale(.85)`,opacity:1,offset:.45},
          {transform:`translate(${dx}px,${dy}px) scale(.22)`,opacity:.15}
        ],{duration:760,delay:index*130,easing:'cubic-bezier(.5,0,.75,.4)',fill:'forwards'}).finished.then(()=>{
          ghost.remove();
          target.classList.remove('mars-reward-received');void target.offsetWidth;target.classList.add('mars-reward-received');
        });
      });
      await Promise.all(flights);
      await wait(450);
    }else{
      await wait(400);
    }
    layer.remove();
    target?.classList.remove('mars-reward-received');
  };
  const playMarsClearRewardFlight=()=>playRewardFlight({kicker:'MARS · OPERATION CLEAR',title:'사령부 지원 도착',items:MARS_CLEAR_REWARD_ICONS.map(({key,name,image})=>({name,image,amount:MARS_CLEAR_REWARD[key]}))});
  // 탐사드론·연구인력은 물자창고 보관함에, 연구일지·범용연구코어는 전술무기 연구 재화에 더합니다.
  const grantStepRewards=step=>{
    if(state[step.flag])return false;
    const count=value=>Math.max(0,Math.floor(Number(value)||0));
    const loot=read(LOOT_KEY)||{},research=read(RESEARCH_KEY)||{};
    const balances={gold:0,thorium:0,...(read(RESOURCE_KEY)||{}),...(window.gameResources||{})};
    for(const key of ['scoutTron','precisionScout','researchStaff','goldVault','thoriumBox','ssrShipTicket','frameTicket','frameCannon','frameMissile','frameLaser','framePiercing','frameCarrier'])if(step.rewards[key])loot[key]=count(loot[key])+step.rewards[key];
    if(step.rewards.journal)research.researchJournal=count(research.researchJournal)+step.rewards.journal;
    if(step.rewards.core)research.researchCore=count(research.researchCore)+step.rewards.core;
    for(const key of ['gold','thorium'])if(step.rewards[key])balances[key]=count(balances[key])+step.rewards[key];
    try{
      localStorage.setItem(LOOT_KEY,JSON.stringify(loot));
      if(step.rewards.journal||step.rewards.core)localStorage.setItem(RESEARCH_KEY,JSON.stringify(research));
      if(step.rewards.gold||step.rewards.thorium){
        localStorage.setItem(RESOURCE_KEY,JSON.stringify(balances));
        // 다른 화면이 같은 자원 객체를 참조하고 있으므로 객체를 바꾸지 않고 값만 갱신합니다.
        if(window.gameResources)Object.assign(window.gameResources,balances);else window.gameResources=balances;
        window.updateGameResourceHud?.();
      }
      state[step.flag]=true;save();
    }catch{return false;}
    window.syncTacticalResearchInventory?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    window.dispatchEvent(new Event('commander-research-updated'));
    return true;
  };
  const stepRewardItems=step=>Object.entries(step.rewards).map(([key,amount])=>({name:REWARD_ICON[key]?.[0]||key,image:REWARD_ICON[key]?.[1]||'',amount}));
  const finish=()=>{
    const stage=state.stage;
    if(stage==='briefing')state.gate6Done=true;
    if(stage==='warning')state.gate9Done=true;
    if(stage==='titan-briefing')state.titanIntroDone=true;
    if(stage==='malik')state.malikDone=true;
    if(stage==='oort10')state.oort10Done=true;
    if(stage==='oort10-clear')state.oort10ClearDone=true;
    if(stage==='oort15')state.oort15Done=true;
    if(stage==='oort20')state.oort20Done=true;
    if(stage==='oort20-clear'){state.oort20ClearDone=true;state.oortReturnPending=true;}
    if(stage==='oort-return'){state.oortReturnDone=true;state.oortReturnPending=false;}
    if(stage==='volkov')state.volkovDone=true;
    if(stage==='magenta5-clear'){
      // 다음 전투·연구소 방문 전에 함대관리를 열면 볼코프 히든, 연구소에 가면 EVA-9·루카 대화.
      state.magenta5ClearDone=true;state.magenta5LabPending=true;
      state.magenta5VolkovArmed=!state.magenta5VolkovDone;
    }
    if(stage==='magenta5-volkov'){state.magenta5VolkovDone=true;state.magenta5VolkovArmed=false;}
    if(stage==='magenta5-lab'){state.magenta5LabDone=true;state.magenta5LabPending=false;state.magenta5VolkovArmed=false;}
    if(stage==='magenta6')state.magenta6Done=true;
    if(stage==='magenta9-malik'){state.magenta9MalikDone=true;state.magenta9LabPending=true;}
    if(stage==='magenta9-lab'){state.magenta9LabDone=true;state.magenta9LabPending=false;}
    if(stage==='titan-gate5')state.titanGate5Done=true;
    if(stage==='titan-lab')state.titanLabDone=true;
    if(stage==='lab-briefing')state.titanFinaleDone=true;
    if(stage==='tas1-depart')state.tas1DepartDone=true;
    if(stage==='tas10-clear')state.tas10ClearDone=true;
    if(stage==='atm5-clear')state.atm5ClearDone=true;
    if(stage==='kepler-okoye-call')state.keplerOkoyeDone=true;
    if(stage==='kepler5-warning')state.kepler5WarningDone=true;
    if(stage==='kepler5-clear')state.kepler5ClearDone=true;
    if(stage==='kepler10-intro'){state.kepler10IntroDone=true;window.setBattleHold?.(false);}
    if(stage==='kepler10-clear')state.kepler10ClearDone=true;
    if(stage==='katm5-start')state.katm5StartDone=true;
    if(stage==='katm210-walk')state.katm210WalkDone=true;
    if(stage==='katm6-start')state.katm6StartDone=true;
    if(stage==='kb1-pre')state.kb1PreDone=true;
    if(stage==='kb5-pre')state.kb5PreDone=true;
    if(stage==='kb5-clear')state.kb5ClearDone=true;
    if(stage==='kb5-farah')state.kb5FarahDone=true;
    if(stage==='kb10-lab')state.kb10LabDone=true;
    if(stage==='tapao-lab')state.tapaoLabDone=true;
    if(stage==='tapao-near-pre')state.tapaoNearPreDone=true;
    if(stage==='tapao-near5-clear')state.tapaoNear5ClearDone=true;
    if(stage==='tapao-near10-clear')state.tapaoNear10ClearDone=true;
    if(stage==='tapao-near10-hangar')state.tapaoNear10HangarDone=true;
    if(stage==='tapao-near10-lab')state.tapaoNear10LabDone=true;
    if(stage==='tapao-near10-bridge')state.tapaoNear10BridgeDone=true;
    if(pendingSortie&&pendingSortie.stage===stage){const proceed=pendingSortie.proceed;pendingSortie=null;setTimeout(proceed,0);}
    if(stage==='katm210-eva'){state.katm210EvaDone=true;syncPrecisionSearchButton();}
    if(stage==='katm210-ayra'){state.katm210AyraDone=true;window.setBattleHold?.(false);}
    if(stage==='katm5-clear')state.katm5ClearDone=true;
    if(stage==='katm5-admiral')state.katm5AdmiralDone=true;
    if(stage==='katm5-supply')state.katm5SupplyDone=true;
    if(['katm5-volkov','katm5-volkov-truth','katm5-volkov-noreason','katm5-volkov-trust','katm5-volkov-lie','katm5-volkov-apology','katm5-volkov-suspicion'].includes(stage))state.katm5VolkovDone=true;
    if(stage==='katm5-boss'){state.katm5BossDone=true;window.setBattleHold?.(false);}
    if(stage==='kepler10-lab')state.kepler10LabDone=true;
    if(stage==='atm10-clear')state.atm10ClearDone=true;
    if(stage==='atm10-lab')state.atm10LabDone=true;
    if(stage==='tas10-volkov')state.tas10VolkovDone=true;
    if(stage==='tas5-depart')state.tas5DepartDone=true;
    if(stage==='tas5-clear')state.tas5ClearDone=true;
    if(stage==='magenta10-clear')state.magenta10ClearDone=true;
    if(stage==='magenta10-lab')state.magenta10LabDone=true;
    if(stage==='titan-fall'){
      // 대화가 끝난 직후 "첫 클릭"이 연구실이면 히든 보상, 다른 곳이면 히든 보상 없음.
      state.titanFallDone=true;
      labHiddenArmed=!state.titanLabDone&&!state.titanLabMissed;
    }
    if(stage==='mars-clear'){
      // 파라 대화가 끝나는 즉시 사령부 지원을 지급하고, 수납 연출 뒤 제독의 타이탄 브리핑으로 이어갑니다.
      state.marsClearDone=true;grantMarsClearReward();
      setStage('mars-reward');
      playMarsClearRewardFlight().finally(()=>{
        if(state.stage!=='mars-reward')return;
        if(!state.titanIntroDone)setStage('titan-briefing');
        else{state.pendingTitanIntro=false;setStage('');}
      });
      return;
    }
    // 타파오 통 도입부: 케플러 연구실 장면 → 함교 → 격납고 → 함교(제독) → 연구실 순서로, 각 장면이 끝나면 다음 화면으로 이동할 때까지 기다린다.
    const TAPAO_FLOW={'tapao-near10-hangar':'tapao-near10-lab-pending','tapao-near10-lab':'tapao-near10-bridge-pending','kb10-lab':'tapao-bridge-pending','tapao-bridge':'tapao-hangar-pending','tapao-hangar':'tapao-admiral-pending','tapao-admiral':'tapao-lab-pending'};
    if(stage==='tapao-bridge')state.tapaoBridgeDone=true;
    if(stage==='tapao-hangar')state.tapaoHangarDone=true;
    if(stage==='tapao-admiral')state.tapaoAdmiralDone=true;
    if(TAPAO_FLOW[stage]){state.pendingTitanIntro=false;setStage(TAPAO_FLOW[stage]);return;}
    state.pendingTitanIntro=false;
    setStage('');
    if(AUTO_START_STAGES.includes(stage)){
      // 말릭(타이탄 1관문)·오르트 10·15·20관문 출격 대화가 끝나면 준비된 전투를 바로 개시합니다.
      setTimeout(()=>{const start=document.getElementById('battle-start');if(start&&!start.hidden)start.click();},0);
    }
  };
  const beginTitanBriefing=()=>{
    if(active()||state.marsClearDone&&state.titanIntroDone)return;
    state.pendingTitanIntro=false;save();
    window.show?.('home');
    setStage(state.marsClearDone?'titan-briefing':'mars-clear');
  };
  const advance=()=>{
    if(rewardPlaying)return;
    if(current()?.swap)swapProtagonist();
    const step=rewardSteps[state.stage];
    if(step&&state.index===step.index){
      // 이 줄에서 보상을 지급하고, 물자창고 이송 연출이 끝나면 다음 대사로 넘어갑니다.
      const stage=state.stage,next=state.index+1;
      if(!grantStepRewards(step)){if(next>=(multiLine[stage]?.length||0))finish();else setStage(stage,next);return;}
      rewardPlaying=true;overlay.hidden=true;
      // 마지막 줄에서 주는 보상이면 연출 뒤 대화를 마칩니다.
      playRewardFlight({kicker:step.kicker,title:step.title,items:stepRewardItems(step)}).finally(()=>{rewardPlaying=false;if(state.stage!==stage)return;if(next>=(multiLine[stage]?.length||0))finish();else setStage(stage,next);});
      return;
    }
    if(state.stage==='call'){
      // The bridge is the only permitted destination while EVA-9 calls the captain.
      setStage('briefing');
      window.show?.('home');
      paint();
    }else if(state.stage==='titan-call'){
      // EVA-9의 안내에 따라 함교로 이동한 뒤 말릭의 통신이 시작됩니다.
      setStage('titan-fall');
      window.show?.('home');
      paint();
    }else if(state.stage==='magenta9-call'){
      // EVA-9의 호출: 함교로 이동해 말릭과의 대화를 이어갑니다.
      setStage('magenta9-malik');
      window.show?.('home');
      paint();
    }else if(state.stage==='titan-call2'){
      // 한성민 제독의 호출: 함교로 이동해 보고를 이어갑니다.
      setStage('titan-report');
      window.show?.('home');
      paint();
    }else if(state.stage==='titan-report'&&state.index>=titanReportLines.length-1){
      // 마지막 줄: 자동으로 연구실로 가지 않고, 플레이어가 연구실 메뉴를 누를 때 작전 회의가 시작됩니다(lab-pending 대기).
      window.show?.('home');
      setStage('lab-pending');
      state.labDirect=true;save();
      paint();
    }else if(state.stage==='tapao-near10-clear'&&state.index>=tapaoNear10ClearLines.length-1){
      // 마지막 줄: 격납고로 강제 이동해 파라와의 대화가 이어진다.
      state.tapaoNear10ClearDone=true;save();
      window.show?.('collection');setStage('tapao-near10-hangar');paint();
    }else if(state.stage==='kb5-clear'&&state.index>=kb5ClearLines.length-1){
      window.show?.('home');setStage('kb5-hangar-pending');paint();
    }else if(state.stage==='katm210-retreat'&&state.index>=katm210RetreatLines.length-1){
      window.show?.('home');setStage('katm210-para-pending');paint();
    }else if(state.stage==='katm210-para'&&state.index>=katm210ParaLines.length-1){
      setStage('katm210-walk');paint();
    }else if(state.stage==='katm210-walk'&&state.index>=katm210WalkLines.length-1){
      window.show?.('home');setStage('katm210-eva');paint();
    }else if(state.stage==='katm5-clear'&&state.index>=katm5ClearLines.length-1){
      window.show?.('home');setStage('katm5-admiral');paint();
    }else if(state.stage==='katm5-admiral'&&state.index>=katm5AdmiralLines.length-1){
      setStage('katm5-supply');paint();
    }else if(state.stage==='kb10-clear'&&state.index>=kb10ClearLines.length-1){
      state.kb10ClearDone=true;save();overlay.hidden=true;kb10ToBridge();
    }else if(state.stage==='kb10-bridge'&&state.index>=kb10BridgeLines.length-1){
      state.kb10BridgeDone=true;save();window.show?.('home');setStage('kb10-lab-pending');paint();
    }else if(state.stage==='kepler10-clear'&&state.index>=kepler10ClearLines.length-1){
      window.show?.('home');setStage('kepler10-lab-pending');paint();
    }else if(state.stage==='atm10-clear'&&state.index>=atm10ClearLines.length-1){
      window.show?.('home');setStage('atm10-home-pending');paint();
    }else if(state.stage==='atm10-home'&&state.index>=atm10HomeLines.length-1){
      window.show?.('home');setStage('atm10-lab-pending');paint();
    }else if(state.stage==='tas10-clear'&&state.index>=tas10ClearLines.length-1){
      window.show?.('home');setStage('tas10-home-pending');paint();
    }else if(state.stage==='tas10-home'&&state.index>=tas10HomeLines.length-1){
      window.show?.('home');setStage('tas10-lab-pending');paint();
    }else if(state.stage==='tas10-lab'&&state.index>=tas10LabLines.length-1){
      // 연구실 대화가 끝나면 함교로 이동해 볼코프 사령관이 나타난다.
      window.show?.('home');setStage('tas10-volkov');paint();
    }else if(state.stage==='magenta10-clear'&&state.index>=magenta10ClearLines.length-1){
      // 함교 독백이 끝나면 연구실 메뉴를 누를 때까지 기다린다(대화는 연구실에서 이어진다).
      window.show?.('home');
      setStage('magenta10-lab-pending');
      paint();
    }else if(multiLine[state.stage]){
      if(state.index<multiLine[state.stage].length-1)setStage(state.stage,state.index+1);
      else finish();
    }else if(state.stage==='warning')finish();
  };
  const preparePreviousBattle=window.prepareBattle;
  window.prepareBattle=operation=>{
    const result=preparePreviousBattle?.(operation);
    // 마젠타 5관문 클리어 뒤 함대관리보다 먼저 다른 전투에 나가면 볼코프 히든은 사라집니다.
    if(state.magenta5VolkovArmed&&!operation?.arenaMatch){state.magenta5VolkovArmed=false;save();}
    if(Number(operation?.chapter)===1&&operation?.region==='titan'&&Number(operation?.gate)===1&&!state.malikDone&&!active()){
      setTimeout(()=>{if(!active())setStage('malik');},0);
    }
    if(Number(operation?.chapter)===1&&operation?.region==='oort'){
      const gate=Number(operation?.gate);
      const stage=gate===10&&!state.oort10Done?'oort10':gate===15&&!state.oort15Done?'oort15':gate===20&&!state.oort20Done?'oort20':'';
      if(stage&&!active())setTimeout(()=>{if(!active())setStage(stage);},0);
    }
    if(Number(operation?.chapter)===2&&operation?.region==='magenta-near'&&Number(operation?.gate)===6&&!state.magenta6Done&&!active()){
      setTimeout(()=>{if(!active())setStage('magenta6');},0);
    }
    if(Number(operation?.chapter)===2&&operation?.region==='magenta-near'&&Number(operation?.gate)===1&&!state.volkovDone&&!active()){
      setTimeout(()=>{if(!active())setStage('volkov');},0);
    }
    if(Number(operation?.chapter)===4&&operation?.region==='tapao-near'&&Number(operation?.gate)===1&&!state.tapaoNearPreDone&&!active()){
      setTimeout(()=>{if(!active())setStage('tapao-near-pre');},0);
    }
    if(Number(operation?.chapter)===2&&operation?.region==='magenta-tas'&&Number(operation?.gate)===1&&!state.tas1DepartDone&&!active()){
      setTimeout(()=>{if(!active())setStage('tas1-depart');},0);
    }
    if(Number(operation?.chapter)===2&&operation?.region==='magenta-tas'&&Number(operation?.gate)===5&&!state.tas5DepartDone&&!active()){
      setTimeout(()=>{if(!active())setStage('tas5-depart');},0);
    }
    return result;
  };
  // 오르트 10관문 보스 등장 직전: 전투를 멈추지 않고 화면 위쪽에 함장의 혼잣말 자막을 잠시 띄웁니다.
  // 타스 10관문 보스 직전: 함장의 한마디 자막
  // 케플러 5관문 전투가 시작되면(한 번만) 경고 무전을 띄운다.
  // 케플러 10관문 외계 함대 등장 직전: 연출을 띄우고, 이미 봤거나 연출을 띄울 수 없으면 전투를 바로 재개한다.
  // 케플러 2-10 외계 함대가 등장한 뒤: 아이라의 경고를 띄우고, 이미 봤으면 전투를 바로 재개한다.
  window.addEventListener('kepler-atmosphere-boss-spawned',()=>{
    if(!state.katm210AyraDone&&!active()){setStage('katm210-ayra');return;}
    window.setBattleHold?.(false);
  });
  // 케플러 2-5 보스 등장 순간: 연출을 띄우고, 이미 봤거나 띄울 수 없으면 전투를 바로 재개한다.
  window.addEventListener('kepler-boss-spawn-intro',()=>{
    if(!state.katm5BossDone&&!active()){setStage('katm5-boss');return;}
    window.setBattleHold?.(false);
  });
  window.addEventListener('kepler-boss-intro',event=>{
    const op=event.detail?.operation;
    if(Number(op?.chapter)===3&&op?.region==='kepler-orbit'&&Number(op?.gate)===10&&!state.kepler10IntroDone&&!active()){setStage('kepler10-intro');return;}
    window.setBattleHold?.(false);
  });
  window.addEventListener('tutorial-battle-started',event=>{
    const op=event.detail?.operation;
    if(Number(op?.chapter)===3&&op?.region==='kepler-atmosphere'&&Number(op?.gate)===5&&!state.katm5StartDone&&!active()){setStage('katm5-start');return;}
    if(Number(op?.chapter)===3&&op?.region==='kepler-orbit'&&Number(op?.gate)===5&&!state.kepler5WarningDone&&!active())setStage('kepler5-warning');
  });
  window.addEventListener('battle-boss-omen',event=>{
    const op=event.detail?.operation;
    if(Number(op?.chapter)===2&&op?.region==='magenta-tas'&&Number(op?.gate)===10&&!state.tas10OmenDone){
      state.tas10OmenDone=true;save();
      const tip=document.createElement('div');
      tip.className='scenario-battle-toast';tip.setAttribute('role','status');
      tip.innerHTML=`<img src="${captain().image}" alt=""/><div><b></b><p></p></div>`;
      tip.querySelector('b').textContent=captain().name;
      tip.querySelector('p').textContent='저건...? 전 함대 교전준비! 포격에 대비해!';
      (document.querySelector('#battle .battle-viewport')||document.body).append(tip);
      setTimeout(()=>tip.classList.add('is-leaving'),2600);
      setTimeout(()=>tip.remove(),3100);
    }
  });
  window.addEventListener('battle-boss-omen',event=>{
    const operation=event.detail?.operation;
    if(Number(operation?.chapter||1)!==1||operation?.region!=='oort'||Number(operation?.gate)!==10||state.oort10OmenDone)return;
    state.oort10OmenDone=true;save();
    const toast=document.createElement('div');
    toast.className='scenario-battle-toast';toast.setAttribute('role','status');
    toast.innerHTML=`<img src="${captain().image}" alt=""/><div><b></b><p></p></div>`;
    toast.querySelector('b').textContent=captain().name;
    toast.querySelector('p').textContent=oort10OmenLine.text;
    (document.querySelector('#battle .battle-viewport')||document.body).append(toast);
    setTimeout(()=>toast.classList.add('is-leaving'),2600);
    setTimeout(()=>toast.remove(),3100);
  });
  // 오르트 전 관문 클리어 후 함교로 돌아오면 제독과의 대화를 시작합니다.
  const beginOortReturn=()=>{
    if(!state.oortReturnPending||state.oortReturnDone||active())return;
    setTimeout(()=>{if(state.oortReturnPending&&!active()&&document.getElementById('home')?.classList.contains('active'))setStage('oort-return');},450);
  };
  window.addEventListener('game-screen-changed',event=>{if(event.detail?.screen==='home')beginOortReturn();});
  // 마젠타 5관문 클리어 후: 함대관리(히든 볼코프) / 연구소(EVA-9·루카)
  const beginMagenta5Scene=screen=>{
    if(active())return;
    if(screen==='collection'&&state.magenta5VolkovArmed&&!state.magenta5VolkovDone){
      setTimeout(()=>{if(!active()&&document.getElementById('collection')?.classList.contains('active'))setStage('magenta5-volkov');},450);
    }else if(screen==='summon'&&state.magenta9LabPending&&!state.magenta9LabDone){
      setTimeout(()=>{if(!active()&&document.getElementById('summon')?.classList.contains('active'))setStage('magenta9-lab');},450);
    }else if(screen==='summon'&&state.magenta5LabPending&&!state.magenta5LabDone){
      setTimeout(()=>{if(!active()&&document.getElementById('summon')?.classList.contains('active'))setStage('magenta5-lab');},450);
    }
  };
  window.addEventListener('game-screen-changed',event=>beginMagenta5Scene(event.detail?.screen));
  const begin=(gate)=>{
    if(active())return;
    if(evaActive()){state.pendingGate=gate;save();return;}
    state.pendingGate=0;save();
    if(gate===6&&!state.gate6Done)setStage('call');
    if(gate===9&&!state.gate9Done)setStage('warning');
  };
  const previousAllowsScreen=window.tutorialAllowsScreen;
  window.tutorialAllowsScreen=id=>{
    if(previousAllowsScreen&&!previousAllowsScreen(id))return false;
    if(!active())return true;
    // 연구실 대기 중에는 다른 화면을 자유롭게 오갈 수 있다(연구실을 열 때 대화가 이어진다).
    if(/-pending$/.test(state.stage))return true;
    // 함교에서 진행되는 대화는 새로고침 후 복원될 때도 함교로 이동할 수 있어야 합니다.
    if(state.stage==='katm210-para')return id==='collection';
    if(state.stage==='titan-lab'||state.stage==='lab-briefing'||state.stage==='magenta5-lab'||state.stage==='magenta9-lab'||state.stage==='magenta10-lab'||state.stage==='tas10-lab'||state.stage==='atm10-lab'||state.stage==='kepler10-lab'||state.stage==='kb10-lab'||state.stage==='tapao-lab'||state.stage==='tapao-near10-lab'||state.stage==='katm5-volkov'||state.stage==='katm5-volkov-truth'||state.stage==='katm5-volkov-noreason'||state.stage==='katm5-volkov-trust'||state.stage==='katm5-volkov-lie'||state.stage==='katm5-volkov-apology'||state.stage==='katm5-volkov-suspicion')return id==='summon';
    if(state.stage==='magenta5-volkov')return id==='collection';
    if(state.stage==='katm210-para')return id==='collection';
    // 클리어 직후 안내 장면은 전투 결과 화면에서 어느 메뉴로 나가도 막지 않는다(막히면 버튼이 먹지 않는다).
    if(state.stage==='katm210-retreat'||state.stage==='tapao-near5-clear'||state.stage==='tapao-near10-clear')return true;
    if(state.stage==='kb5-farah'||state.stage==='tapao-hangar'||state.stage==='tapao-near10-hangar')return id==='collection';
    if(state.stage==='katm210-walk')return id==='collection'||id==='home';
    return ['briefing','mars-clear','titan-briefing','titan-fall','titan-report','oort-return','magenta9-malik','magenta10-clear','tas10-clear','tas10-home','tas10-volkov','atm10-clear','atm10-home','kepler10-clear','kb10-clear','kb10-fade','kb10-bridge','katm5-clear','katm5-admiral','katm5-supply','katm210-retreat','katm210-eva','kb5-clear','tapao-bridge','tapao-admiral','tapao-near10-bridge'].includes(state.stage)&&id==='home';
  };
  // 플레이어가 연구실(summon) 화면을 직접 열었을 때만 작전 회의를 시작한다.
  // 연구실로 바로 들어가면 지원 물품을 기본 지원의 50%만큼 추가로 지급한다(다른 화면을 거쳤다면 추가 지급 없음).
  const LAB_DIRECT_BONUS={flag:'labDirectBonusGranted',kicker:'ADMIRAL HAN · DIRECT SUPPLY',title:'연구실 직행 추가 지원',rewards:{scoutTron:10,researchStaff:10,thorium:250}};
  window.addEventListener('game-screen-changed',event=>{
    const screen=event.detail?.screen;
    // 타스 10관문: 함교로 돌아오면 루카와의 대화, 연구실을 열면 EVA-9와의 대화가 이어진다.
    const TAS10_NEXT={'tapao-near10-lab-pending':{screen:'summon',stage:'tapao-near10-lab'},'tapao-near10-bridge-pending':{screen:'home',stage:'tapao-near10-bridge'},'tapao-bridge-pending':{screen:'home',stage:'tapao-bridge'},'tapao-hangar-pending':{screen:'collection',stage:'tapao-hangar'},'tapao-admiral-pending':{screen:'home',stage:'tapao-admiral'},'tapao-lab-pending':{screen:'summon',stage:'tapao-lab'},'tas10-home-pending':{screen:'home',stage:'tas10-home'},'tas10-lab-pending':{screen:'summon',stage:'tas10-lab'},'atm10-home-pending':{screen:'home',stage:'atm10-home'},'atm10-lab-pending':{screen:'summon',stage:'atm10-lab'},'kepler10-lab-pending':{screen:'summon',stage:'kepler10-lab'},'katm210-para-pending':{screen:'collection',stage:'katm210-para'},'kb5-hangar-pending':{screen:'collection',stage:'kb5-farah'},'kb10-lab-pending':{screen:'summon',stage:'kb10-lab'}};
    const tasNext=TAS10_NEXT[state.stage];
    if(tasNext){if(screen===tasNext.screen){setStage(tasNext.stage);window.show?.(tasNext.screen);}return;}
    // 케플러 10관문 클리어를 이미 지나간 경우에도, 연구실을 열면 에바-9와의 대화가 나온다(한 번만).
    // 이미 케플러 연구실 장면을 지나간 저장 데이터도, 함교로 이동하면 타파오 통 도입부가 한 번 시작된다.
    if(screen==='home'&&!active()&&state.kb10LabDone&&!state.tapaoBridgeDone){setStage('tapao-bridge');window.show?.('home');return;}
    if(screen==='summon'&&!active()&&state.katm5SupplyDone&&!state.katm5VolkovDone){setStage('katm5-volkov');window.show?.('summon');return;}
    if(screen==='summon'&&!active()&&state.kepler10ClearDone&&!state.kepler10LabDone){setStage('kepler10-lab');window.show?.('summon');return;}
    if(state.stage==='magenta10-lab-pending'){
      if(screen==='summon'){setStage('magenta10-lab');window.show?.('summon');}
      return;
    }
    if(state.stage!=='lab-pending')return;
    if(screen!=='summon'){if(state.labDirect){state.labDirect=false;save();}return;}
    const direct=!!state.labDirect;
    state.labDirect=false;
    setStage('lab-briefing');
    if(direct&&grantStepRewards(LAB_DIRECT_BONUS))playRewardFlight({kicker:LAB_DIRECT_BONUS.kicker,title:LAB_DIRECT_BONUS.title,items:stepRewardItems(LAB_DIRECT_BONUS)});
    window.show?.('summon');
  });
  window.addEventListener('campaign-gate-cleared',event=>{
    const {chapter,region,gate,firstClear}=event.detail||{};
    if(Number(chapter)===3&&region==='kepler-orbit'&&Number(gate)===1&&firstClear&&!state.keplerOkoyeDone&&!active()){setStage('kepler-okoye-call');return;}
    if(Number(chapter)===3&&region==='kepler-orbit'&&Number(gate)===5&&firstClear&&!state.kepler5ClearDone&&!active()){setStage('kepler5-clear');return;}
    if(Number(chapter)===3&&region==='kepler-orbit'&&Number(gate)===10&&firstClear&&!state.kepler10ClearDone&&!active()){setStage('kepler10-clear');return;}
    if(Number(chapter)===3&&region==='kepler-atmosphere'&&Number(gate)===5&&firstClear&&!state.katm5ClearDone&&!active()){setStage('katm5-clear');return;}
    if(Number(chapter)===3&&region==='kepler-atmosphere'&&Number(gate)===10&&firstClear&&!state.katm210EvaDone&&!active()){setStage('katm210-retreat');return;}
    if(Number(chapter)===3&&region==='kepler-base'&&Number(gate)===5&&firstClear&&!state.kb5ClearDone&&!active()){setStage('kb5-clear');return;}
    if(Number(chapter)===3&&region==='kepler-base'&&Number(gate)===10&&firstClear&&!state.kb10ClearDone&&!active()){setStage('kb10-clear');return;}
    if(Number(chapter)===4&&region==='tapao-near'&&Number(gate)===5&&firstClear&&!state.tapaoNear5ClearDone&&!active()){setStage('tapao-near5-clear');return;}
    if(Number(chapter)===4&&region==='tapao-near'&&Number(gate)===10&&firstClear&&!state.tapaoNear10ClearDone&&!active()){setStage('tapao-near10-clear');return;}
    if(Number(chapter)===1&&region==='titan'&&firstClear){
      if(Number(gate)===5&&!state.titanGate5Done&&!active())setStage('titan-gate5');
      if(Number(gate)===10&&!state.titanFallDone&&!active())setStage('titan-call');
      if(Number(gate)===20&&!state.titanFinaleDone&&!active())setStage('titan-call2');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-atmosphere'&&Number(gate)===10&&firstClear&&!state.atm10ClearDone&&!active()){
      setStage('atm10-clear');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-atmosphere'&&Number(gate)===5&&firstClear&&!state.atm5ClearDone&&!active()){
      setStage('atm5-clear');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-tas'&&Number(gate)===10&&firstClear&&!state.tas10ClearDone&&!active()){
      setStage('tas10-clear');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-tas'&&Number(gate)===5&&firstClear&&!state.tas5ClearDone&&!active()){
      setStage('tas5-clear');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-near'&&Number(gate)===10&&firstClear&&!state.magenta10ClearDone&&!active()){
      setStage('magenta10-clear');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-near'&&Number(gate)===9&&firstClear&&!state.magenta9MalikDone&&!active()){
      setStage('magenta9-call');
      return;
    }
    if(Number(chapter)===2&&region==='magenta-near'&&Number(gate)===5&&firstClear&&!state.magenta5ClearDone&&!active()){
      setStage('magenta5-clear');
      return;
    }
    if(Number(chapter)===1&&region==='oort'&&firstClear){
      if(Number(gate)===10&&!state.oort10ClearDone&&!active())setStage('oort10-clear');
      if(Number(gate)===20&&!state.oort20ClearDone&&!active())setStage('oort20-clear');
      return;
    }
    if(Number(chapter)!==1||region!=='mars'||!firstClear)return;
    if(Number(gate)===6||Number(gate)===9)begin(Number(gate));
    if(Number(gate)===10&&!(state.marsClearDone&&state.titanIntroDone)){
      if(evaActive()){state.pendingTitanIntro=true;save();}
      else beginTitanBriefing();
    }
  });
  window.addEventListener('eva9-tutorial-completed',()=>{if(state.pendingTitanIntro)beginTitanBriefing();else if(state.pendingGate)begin(Number(state.pendingGate));});
  document.addEventListener('click',event=>{
    if(!active()||/-pending$/.test(state.stage)||event.target.closest('.mars-scenario'))return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  // 히든 보상 판정: 말릭·EVA-9 대화가 끝난 뒤 첫 클릭이 연구실(함교 연구실 버튼 또는 하단 메뉴)인지 확인합니다.
  document.addEventListener('click',event=>{
    if(!labHiddenArmed||active())return;
    labHiddenArmed=false;
    if(!event.target.closest('#command-deck .deck-shortcut.research,.fixed-nav button[data-screen="summon"]')){state.titanLabMissed=true;save();return;}
    labHiddenPending=true;
    setTimeout(()=>{if(labHiddenPending&&document.getElementById('summon')?.classList.contains('active'))startLabHidden();else labHiddenPending=false;},900);
  },true);
  const startLabHidden=()=>{
    if(!labHiddenPending)return;
    labHiddenPending=false;
    setTimeout(()=>{if(!active()&&!state.titanLabDone)setStage('titan-lab');},450);
  };
  window.addEventListener('game-screen-changed',event=>{if(labHiddenPending&&event.detail?.screen==='summon')startLabHidden();});
  window.addEventListener('DOMContentLoaded',()=>{
    overlay=document.createElement('div');
    overlay.className='mars-scenario';overlay.hidden=true;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','화성 작전 시나리오');
    overlay.innerHTML='<div class="mars-scenario-card"><img class="mars-scenario-portrait" alt=""/><div class="mars-scenario-dialogue"><small class="mars-scenario-kicker"></small><strong class="mars-scenario-name"></strong><p class="mars-scenario-text"></p><div class="mars-scenario-actions"><button type="button" class="mars-scenario-next"></button></div></div></div>';
    document.body.append(overlay);
    overlay.querySelector('.mars-scenario-next').addEventListener('click',advance);
    const choiceBox=document.createElement('div');
    choiceBox.className='mars-scenario-choices';
    choiceBox.hidden=true;
    overlay.querySelector('.mars-scenario-dialogue').append(choiceBox);
    choiceBox.addEventListener('click',event=>{
      const button=event.target.closest('[data-choice]');
      const choice=current()?.choices?.[Number(button?.dataset.choice)];
      if(!choice)return;
      state[choice.flag]=true;save();
      // 다음 장면이 정해진 선택지는 그 장면으로 넘어가고, 아니면 대화를 마친다.
      if(choice.next){setStage(choice.next);return;}
      finish();
    });
    overlay.addEventListener('click',event=>{if(event.target===overlay)event.preventDefault();});
    if(state.stage==='mars-reward'){
      // 수납 연출 중에 새로고침했다면 보상은 이미 지급됐으므로 제독 브리핑부터 이어갑니다.
      state.stage=state.titanIntroDone?'':'titan-briefing';state.index=0;save();
    }
    if(state.stage==='titan-call'){state.stage='titan-fall';state.index=0;save();}
    if(state.stage==='titan-call2'){state.stage='titan-report';state.index=0;save();}
    if(state.stage==='titan-report'){
      state.index=Math.max(0,Math.min(titanReportLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('home');paint();},120);
    }else if(state.stage==='lab-briefing'){
      state.index=Math.max(0,Math.min(labBriefingLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('summon');paint();},120);
    }else if(state.stage==='titan-lab'){
      // 히든 대화 도중 새로고침: 연구실에서 이어서 보여줍니다.
      state.index=Math.max(0,Math.min(titanLabLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('summon');paint();},120);
    }else if(state.stage==='titan-gate5'){
      state.index=Math.max(0,Math.min(titanGate5Lines.length-1,Number(state.index)||0));save();paint();
    }else if(state.stage==='titan-fall'){
      state.index=Math.max(0,Math.min(titanFallLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('home');paint();},120);
    }else if(PREBATTLE_STAGES.includes(state.stage)){
      // 새로고침하면 준비된 전투가 사라지므로, 다음 출격 때 다시 보여줍니다.
      state.stage='';state.index=0;save();
    }else if(state.stage==='oort10-clear'||state.stage==='oort20-clear'){
      // 관문 클리어 대화 도중 새로고침: 첫 화면 위에 이어서 보여줍니다.
      state.index=Math.max(0,Math.min(multiLine[state.stage].length-1,Number(state.index)||0));save();paint();
    }else if(state.stage==='magenta9-call'||state.stage==='magenta9-malik'){
      // 호출 중이거나 함교 대화 도중 새로고침: 함교에서 말릭과의 대화를 이어갑니다.
      if(state.stage==='magenta9-call'){state.stage='magenta9-malik';state.index=0;}
      state.index=Math.max(0,Math.min(magenta9MalikLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('home');paint();},120);
    }else if(state.stage==='magenta9-lab'){
      state.index=Math.max(0,Math.min(magenta9LabLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('summon');paint();},120);
    }else if(state.stage==='magenta5-clear'){
      state.index=Math.max(0,Math.min(magenta5ClearLines.length-1,Number(state.index)||0));save();paint();
    }else if(state.stage==='magenta5-volkov'){
      state.index=Math.max(0,Math.min(magenta5VolkovLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('collection');paint();},120);
    }else if(state.stage==='magenta5-lab'){
      state.index=Math.max(0,Math.min(magenta5LabLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('summon');paint();},120);
    }else if(state.stage==='oort-return'){
      state.index=Math.max(0,Math.min(oortReturnLines.length-1,Number(state.index)||0));save();
      setTimeout(()=>{window.show?.('home');paint();},120);
    }else if(state.stage==='call'||state.stage==='briefing'||state.stage==='titan-briefing'||state.stage==='mars-clear'){
      // A reload cannot restore the completed battle result; resume safely on the bridge.
      if(multiLine[state.stage]&&state.stage!=='briefing')state.index=Math.max(0,Math.min(multiLine[state.stage].length-1,Number(state.index)||0));
      else{state.stage='briefing';state.index=Math.max(0,Math.min(gate6Lines.length-1,Number(state.index)||0));}
      save();
      setTimeout(()=>{window.show?.('home');paint();},120);
    }else if(state.stage==='warning')paint();
    else if(state.pendingTitanIntro&&!evaActive())setTimeout(beginTitanBriefing,120);
    else if(state.pendingGate&&!evaActive())setTimeout(()=>begin(Number(state.pendingGate)),120);
    else if(state.oortReturnPending)setTimeout(beginOortReturn,600);
  });
})();

