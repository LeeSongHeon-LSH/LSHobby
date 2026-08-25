import { PixelBerg, PixelPenguinTiny, PixelTracks } from "./pixel";

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

/**
 * 남극 지평선 — CV "눈밭 위 종이 한 장" 뒤에 깔리는 고정 배경.
 * 빙하 산 → 눈드리프트 지면 → 꼬마 펭귄 순으로 쌓고, 눈이 성글게 내린다.
 * 종이(z-1)가 가운데를 덮으므로 소품은 양옆 여백과 하단 띠에서 보인다.
 */
export function IceScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
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
