import {
  PixelAurora,
  PixelBerg,
  PixelBookshelf,
  PixelMoon,
  PixelPenguinGaze,
  PixelPenguinReading,
  PixelPenguinTiny,
  PixelPortWindow,
  PixelStar,
  PixelTracks,
} from "./pixel";

// 눈송이 — SSR 일관성을 위해 난수 대신 고정 배치. 음수 delay로 첫 화면부터 내리는 중
const FLAKES = [
  { left: "4%", delay: "-2s", dur: "13s", size: 3 },
  { left: "11%", delay: "-9s", dur: "16s", size: 2 },
  { left: "19%", delay: "-5s", dur: "12s", size: 3 },
  { left: "27%", delay: "-11s", dur: "17s", size: 2 },
  { left: "34%", delay: "-1s", dur: "14s", size: 2 },
  { left: "43%", delay: "-7s", dur: "12s", size: 3 },
  { left: "51%", delay: "-13s", dur: "18s", size: 2 },
  { left: "58%", delay: "-3s", dur: "13s", size: 3 },
  { left: "66%", delay: "-10s", dur: "15s", size: 2 },
  { left: "73%", delay: "-6s", dur: "12s", size: 3 },
  { left: "81%", delay: "-14s", dur: "17s", size: 2 },
  { left: "88%", delay: "-4s", dur: "13s", size: 3 },
  { left: "95%", delay: "-8s", dur: "15s", size: 2 },
];

function Snowfall() {
  return (
    <>
      {FLAKES.map((f) => (
        <span
          key={f.left}
          className="flake"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            animationDelay: f.delay,
            animationDuration: f.dur,
          }}
        />
      ))}
    </>
  );
}

/**
 * 남극 지평선 — CV·홈 공용 배경 (#65).
 * 빙하 산 → 눈드리프트 지면 → 꼬마 펭귄 순으로 쌓고, 눈이 성글게 내린다.
 * -z-10 고정 레이어라 페이지 콘텐츠는 그대로 위에 얹힌다.
 */
export function IceScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Snowfall />
      <div className="absolute bottom-9 left-[2%]">
        <PixelBerg size={190} />
      </div>
      <div className="absolute bottom-10 right-[4%]">
        <PixelBerg size={140} flip />
      </div>
      <div className="ice-ground" />
      <div className="absolute bottom-[38px] left-[6%]">
        <PixelPenguinTiny size={26} />
      </div>
      <div className="absolute bottom-9 left-[12%]">
        <PixelPenguinTiny size={20} flip />
      </div>
      <div className="absolute bottom-[30px] left-[32%]">
        <PixelPenguinTiny size={20} />
      </div>
      <div className="absolute bottom-8 right-[13%] opacity-80">
        <PixelTracks size={80} />
      </div>
      <div className="absolute bottom-10 right-[7%]">
        <PixelPenguinTiny size={24} flip />
      </div>
    </div>
  );
}

/**
 * 이글루 서재(책, #66) — 얼음 블록 벽 아래 나무 책장, 둥근 창 밖은 설원.
 * 펭귄들이 바닥에 앉아 무릎에 책을 펼치고 읽는다.
 */
export function IglooScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="igloo-wall" />
      <div className="absolute bottom-[52px] left-[7%]">
        <PixelPortWindow size={52} />
      </div>
      <div className="absolute bottom-[10px] right-[5%]">
        <PixelBookshelf size={120} />
      </div>
      <div className="absolute bottom-[10px] right-[27%]">
        <PixelPenguinReading size={40} />
      </div>
      <div className="absolute bottom-[10px] right-[38%]">
        <PixelPenguinReading size={34} book="#d9821f" flip />
      </div>
      <div className="absolute bottom-3 left-[22%] hidden sm:block">
        <PixelPenguinTiny size={22} flip />
      </div>
      <div className="igloo-floor" />
    </div>
  );
}

// 밤하늘 잔별 — 띠 위쪽(어두운 영역)에만 흩어 둔다
const NIGHT_DOTS = [
  { left: "6%", top: 62, delay: "-0.4s" },
  { left: "15%", top: 88, delay: "-2.1s" },
  { left: "24%", top: 70, delay: "-1.2s" },
  { left: "33%", top: 96, delay: "-2.9s" },
  { left: "45%", top: 66, delay: "-0.8s" },
  { left: "54%", top: 90, delay: "-1.8s" },
  { left: "63%", top: 72, delay: "-2.5s" },
  { left: "72%", top: 98, delay: "-0.2s" },
  { left: "84%", top: 68, delay: "-1.5s" },
  { left: "93%", top: 92, delay: "-2.2s" },
];

/**
 * 백야의 밤(생각, #66) — 지평선 띠만 남보라 밤하늘로 물들고,
 * 오로라·초승달·잔별 아래 펭귄들이 눈 바닥에서 하늘을 올려다본다.
 */
export function NightScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="night-band">
        <span className="aurora" style={{ left: "12%", top: 66 }}>
          <PixelAurora size={230} />
        </span>
        <span className="aurora" style={{ right: "20%", top: 78, animationDelay: "-5s" }}>
          <PixelAurora size={150} flip />
        </span>
        {NIGHT_DOTS.map((s) => (
          <span
            key={s.left}
            className="night-star"
            style={{ left: s.left, top: s.top, width: 2, height: 2, background: "#f2edd8", animationDelay: s.delay }}
          />
        ))}
        <span className="night-star" style={{ left: "38%", top: 78, animationDelay: "-1s" }}>
          <PixelStar size={10} />
        </span>
        <span className="night-star" style={{ right: "8%", top: 100, animationDelay: "-2.6s" }}>
          <PixelStar size={8} />
        </span>
        <span className="absolute right-[13%] top-[58px]">
          <PixelMoon size={26} />
        </span>
      </div>
      <div className="night-floor" />
      <div className="absolute bottom-[22px] left-[9%]">
        <PixelPenguinGaze size={24} />
      </div>
      <div className="absolute bottom-5 left-[16%]">
        <PixelPenguinGaze size={19} flip />
      </div>
      <div className="absolute bottom-[24px] right-[10%]">
        <PixelPenguinGaze size={26} flip />
      </div>
      <div className="absolute bottom-5 left-[44%]">
        <PixelPenguinGaze size={20} />
      </div>
    </div>
  );
}

/**
 * 수다 빙하(언어, #66) — 펭귄들이 한국어·영어·스페인어(학습 언어)로 인사를 주고받는다.
 * 모바일은 탭바(53px) 위에 지면이 얹히도록 바닥을 올린다.
 */
export function ChatterScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-[53px] -z-10 overflow-hidden md:bottom-0"
    >
      <Snowfall />
      <div className="absolute bottom-8 right-[3%]">
        <PixelBerg size={150} flip />
      </div>
      <div className="ice-ground" />
      <div className="absolute bottom-9 left-[16%]">
        <div className="relative">
          <span className="pg-bubble">안녕!</span>
          <PixelPenguinTiny size={26} />
        </div>
      </div>
      <div className="absolute bottom-[34px] left-[27%]">
        <div className="relative">
          <span className="pg-bubble" style={{ animationDelay: "-1.4s" }}>
            Hello!
          </span>
          <PixelPenguinTiny size={22} flip />
        </div>
      </div>
      <div className="absolute bottom-8 left-[42%] opacity-80">
        <PixelTracks size={72} />
      </div>
      <div className="absolute bottom-[38px] right-[18%]">
        <div className="relative">
          <span className="pg-bubble pg-bubble-r" style={{ animationDelay: "-2.2s" }}>
            ¡Hola!
          </span>
          <PixelPenguinTiny size={24} flip />
        </div>
      </div>
      <div className="absolute bottom-9 right-[11%]">
        <PixelPenguinTiny size={20} />
      </div>
    </div>
  );
}
