import {
  PixelAurora,
  PixelBerg,
  PixelBookshelf,
  PixelChick,
  PixelCloud,
  PixelMoon,
  PixelPenguinBook,
  PixelPenguinGaze,
  PixelPenguinReading,
  PixelPenguinSlide,
  PixelPenguinTiny,
  PixelPortWindow,
  PixelStar,
  PixelSun,
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
 * 남극 지평선 — CV·홈·로그인·CV 편집 공용 배경 (#65, #67 전면 하늘).
 * 옅은 얼음빛 하늘 아래 빙하 산 → 눈드리프트 지면 → 펭귄 무리, 성근 눈내림.
 * -z-10 고정 레이어라 페이지 콘텐츠는 그대로 위에 얹힌다.
 */
export function IceScene() {
  return (
    <div aria-hidden="true" className="sky-ice pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Snowfall />
      <div className="absolute left-[8%] top-[10%]">
        <PixelCloud size={92} />
      </div>
      <div className="absolute right-[10%] top-[20%]">
        <PixelCloud size={68} flip />
      </div>
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
      <div className="absolute bottom-[38px] left-[9%]">
        <PixelChick size={18} />
      </div>
      <div className="absolute bottom-9 left-[13%]">
        <PixelPenguinTiny size={20} flip />
      </div>
      <div className="absolute bottom-[46px] left-[24%]">
        <PixelPenguinSlide size={44} />
      </div>
      <div className="absolute bottom-[30px] left-[34%]">
        <PixelPenguinTiny size={20} />
      </div>
      <div className="absolute bottom-[34px] right-[24%]">
        <PixelPenguinTiny size={22} flip />
      </div>
      <div className="absolute bottom-[34px] right-[16%]">
        <PixelChick size={16} flip />
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
 * 이글루 서재(책, #66·#67) — 돔 전체가 얼음 블록 벽: 위는 옅은 타일, 아래는 진한 띠.
 * 책장 곁에서 읽는 펭귄들 + 서서 읽어주는 펭귄과 듣는 아기들.
 */
export function IglooScene() {
  return (
    <div aria-hidden="true" className="igloo-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-[6%] top-[22%] hidden md:block">
        <PixelPortWindow size={60} />
      </div>
      <div className="igloo-wall" />
      <div className="absolute bottom-[10px] right-[5%]">
        <PixelBookshelf size={120} />
      </div>
      <div className="absolute bottom-[10px] right-[16%]">
        <PixelPenguinReading size={36} book="#c05e7c" />
      </div>
      <div className="absolute bottom-[10px] right-[27%]">
        <PixelPenguinReading size={40} />
      </div>
      <div className="absolute bottom-[10px] right-[38%]">
        <PixelPenguinReading size={34} book="#d9821f" flip />
      </div>
      <div className="absolute bottom-3 left-[24%]">
        <PixelPenguinBook size={44} />
      </div>
      <div className="absolute bottom-[10px] left-[32%]">
        <PixelChick size={17} />
      </div>
      <div className="absolute bottom-3 left-[37%]">
        <PixelChick size={15} flip />
      </div>
      <div className="absolute bottom-[12px] left-[10%] hidden sm:block">
        <PixelPenguinTiny size={22} flip />
      </div>
      <div className="igloo-floor" />
    </div>
  );
}

// 밤하늘 잔별 — 띠의 어두운 영역에만 흩어 둔다
const NIGHT_DOTS = [
  { left: "6%", top: 78, delay: "-0.4s" },
  { left: "13%", top: 108, delay: "-2.1s" },
  { left: "22%", top: 88, delay: "-1.2s" },
  { left: "31%", top: 118, delay: "-2.9s" },
  { left: "40%", top: 82, delay: "-0.8s" },
  { left: "48%", top: 112, delay: "-1.8s" },
  { left: "57%", top: 90, delay: "-2.5s" },
  { left: "66%", top: 122, delay: "-0.2s" },
  { left: "74%", top: 84, delay: "-1.5s" },
  { left: "82%", top: 114, delay: "-2.2s" },
  { left: "91%", top: 94, delay: "-3.1s" },
  { left: "96%", top: 124, delay: "-0.9s" },
];

// 해질녘 하늘에 먼저 뜬 별 — 반짝임 없이 은은하게
const DUSK_DOTS = [
  { left: "16%", top: "44%" },
  { left: "52%", top: "50%" },
  { left: "83%", top: "42%" },
];

/**
 * 백야의 밤(생각, #66·#67) — 화면 전체가 해질녘 라벤더에서 밤으로 저물고,
 * 지평선 띠에 오로라·초승달·잔별, 눈 바닥에서 펭귄들이 하늘을 올려다본다.
 */
export function NightScene() {
  return (
    <div aria-hidden="true" className="sky-night pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {DUSK_DOTS.map((s) => (
        <span
          key={s.left}
          className="absolute"
          style={{ left: s.left, top: s.top, width: 2, height: 2, background: "#7a74a8", opacity: 0.55 }}
        />
      ))}
      <div className="night-band">
        <span className="aurora" style={{ left: "12%", top: 84 }}>
          <PixelAurora size={230} />
        </span>
        <span className="aurora" style={{ right: "20%", top: 96, animationDelay: "-5s" }}>
          <PixelAurora size={150} flip />
        </span>
        {NIGHT_DOTS.map((s) => (
          <span
            key={s.left}
            className="night-star"
            style={{ left: s.left, top: s.top, width: 2, height: 2, background: "#f2edd8", animationDelay: s.delay }}
          />
        ))}
        <span className="night-star" style={{ left: "38%", top: 96, animationDelay: "-1s" }}>
          <PixelStar size={10} />
        </span>
        <span className="night-star" style={{ right: "8%", top: 120, animationDelay: "-2.6s" }}>
          <PixelStar size={8} />
        </span>
        <span className="absolute right-[13%] top-[76px]">
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
      <div className="absolute bottom-5 left-[30%]">
        <PixelChick size={16} />
      </div>
      <div className="absolute bottom-5 left-[44%]">
        <PixelPenguinGaze size={20} />
      </div>
      <div className="absolute bottom-[22px] right-[30%]">
        <PixelPenguinGaze size={22} flip />
      </div>
      <div className="absolute bottom-[20px] right-[17%]">
        <PixelChick size={15} flip />
      </div>
      <div className="absolute bottom-[24px] right-[10%]">
        <PixelPenguinGaze size={26} flip />
      </div>
    </div>
  );
}

/**
 * 수다 빙하(언어, #66·#67) — 낮은 해가 걸린 따뜻한 오후, 펭귄들이
 * 한국어·영어·스페인어(학습 언어)로 인사를 주고받는다.
 * 모바일은 탭바(53px) 위에 지면이 얹히도록 바닥을 올린다.
 */
export function ChatterScene() {
  return (
    <div
      aria-hidden="true"
      className="sky-chat pointer-events-none fixed inset-x-0 top-0 bottom-[53px] -z-10 overflow-hidden md:bottom-0"
    >
      <Snowfall />
      <div className="absolute right-[8%] top-[9%]">
        <PixelSun size={40} />
      </div>
      <div className="absolute left-[27%] top-[15%]">
        <PixelCloud size={76} />
      </div>
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
      <div className="absolute bottom-[34px] left-[13%]">
        <PixelChick size={16} />
      </div>
      <div className="absolute bottom-[34px] left-[27%]">
        <div className="relative">
          <span className="pg-bubble" style={{ animationDelay: "-1.4s" }}>
            Hello!
          </span>
          <PixelPenguinTiny size={22} flip />
        </div>
      </div>
      <div className="absolute bottom-[46px] left-[52%] hidden sm:block">
        <PixelPenguinSlide size={40} />
      </div>
      <div className="absolute bottom-8 left-[42%] opacity-80 sm:hidden">
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
      <div className="absolute bottom-[34px] right-[25%]">
        <PixelChick size={16} flip />
      </div>
      <div className="absolute bottom-9 right-[11%]">
        <PixelPenguinTiny size={20} />
      </div>
    </div>
  );
}
