// 순수 SVG 라인 차트 — 서버 컴포넌트 (hook 없음, 의존성 0)

interface ChartPoint {
  t: string;   // ISO 날짜 문자열
  value: number;
}

interface SpecHistoryChartProps {
  title: string;
  points: ChartPoint[];
  unit?: string;
}

const W = 600;
const H = 200;
const PAD = { top: 24, right: 20, bottom: 36, left: 64 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
}

function fmtVal(v: number): string {
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function SpecHistoryChart({ title, points, unit }: SpecHistoryChartProps) {
  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium mb-2">{title}</p>
        <p className="text-sm text-muted-foreground py-6 text-center">
          이력 데이터 부족 (갱신 2회 이상 필요)
        </p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // 범위가 0이면 ±1 패딩
  const dataRange = rawMax - rawMin || 1;
  // 여백 5%씩 추가해 점이 가장자리에 딱 붙지 않게
  const padV = dataRange * 0.08;
  const yMin = rawMin - padV;
  const yMax = rawMax + padV;
  const yRange = yMax - yMin;

  const n = points.length;

  const coords = points.map((p, i) => ({
    x: PAD.left + (i / (n - 1)) * CW,
    y: PAD.top + CH - ((p.value - yMin) / yRange) * CH,
    date: fmtDate(p.t),
    val: fmtVal(p.value),
  }));

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium mb-3">{title}</p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: '260px' }}
          aria-label={title}
        >
          {/* 그리드 상단선 */}
          <line
            x1={PAD.left} y1={PAD.top}
            x2={PAD.left + CW} y2={PAD.top}
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* 그리드 하단선 */}
          <line
            x1={PAD.left} y1={PAD.top + CH}
            x2={PAD.left + CW} y2={PAD.top + CH}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="1"
          />

          {/* Y축 최댓값 */}
          <text
            x={PAD.left - 6}
            y={PAD.top + 4}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.5"
          >
            {fmtVal(rawMax)}
          </text>
          {/* Y축 최솟값 */}
          <text
            x={PAD.left - 6}
            y={PAD.top + CH + 4}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.5"
          >
            {fmtVal(rawMin)}
          </text>

          {/* 라인 */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 데이터 포인트 */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r="4"
              fill="hsl(var(--primary))"
              stroke="hsl(var(--card))"
              strokeWidth="2"
            />
          ))}

          {/* X축 첫 날짜 */}
          <text
            x={coords[0].x}
            y={H - 6}
            textAnchor="start"
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.5"
          >
            {coords[0].date}
          </text>
          {/* X축 마지막 날짜 */}
          <text
            x={coords[n - 1].x}
            y={H - 6}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.5"
          >
            {coords[n - 1].date}
          </text>

          {/* 단위 라벨 (중앙 하단) */}
          {unit && (
            <text
              x={PAD.left + CW / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              fillOpacity="0.35"
            >
              {unit}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
