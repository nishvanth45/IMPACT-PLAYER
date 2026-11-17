import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { OverSummaryLine } from '../types/game';

interface MatchFlowChartProps {
  overHistory: OverSummaryLine[];
  teamName: string;
  teamColor?: string;
  inningsLabel?: string;
}

const WIDTH = 640;
const HEIGHT = 210;
const MARGIN = { top: 24, right: 16, bottom: 28, left: 34 };

export function MatchFlowChart({
  overHistory,
  teamName,
  teamColor = '#F59E0B',
  inningsLabel = 'Current Innings',
}: MatchFlowChartProps) {
  const [selectedOver, setSelectedOver] = useState<number | null>(null);

  const innerW = WIDTH - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const { xScale, yScale, yTicks, linePath, areaPath, maxRuns } = useMemo(() => {
    const x = d3.scaleLinear().domain([0.5, 20.5]).range([0, innerW]);
    const peakRuns = d3.max(overHistory, (d) => d.runs) ?? 12;
    const yMax = Math.max(18, Math.ceil((peakRuns + 3) / 4) * 4);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    const lineGen = d3
      .line<OverSummaryLine>()
      .x((d) => x(d.overNumber))
      .y((d) => y(d.runs))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<OverSummaryLine>()
      .x((d) => x(d.overNumber))
      .y0(innerH)
      .y1((d) => y(d.runs))
      .curve(d3.curveMonotoneX);

    return {
      xScale: x,
      yScale: y,
      yTicks: y.ticks(4),
      linePath: overHistory.length > 0 ? lineGen(overHistory) ?? '' : '',
      areaPath: overHistory.length > 0 ? areaGen(overHistory) ?? '' : '',
      maxRuns: yMax,
    };
  }, [overHistory, innerW, innerH]);

  const activeOverData = useMemo(() => {
    if (overHistory.length === 0) return null;
    if (selectedOver !== null) {
      return (
        overHistory.find((o) => o.overNumber === selectedOver) ??
        overHistory[overHistory.length - 1]
      );
    }
    return overHistory[overHistory.length - 1];
  }, [overHistory, selectedOver]);

  const totalWickets = overHistory.reduce((s, o) => s + o.wickets, 0);
  const xTicks = [1, 3, 6, 9, 12, 15, 18, 20];
  const strokeColor = '#F59E0B';

  return (
    <div
      data-testid="match-flow-chart"
      className="border border-white/15 bg-[#101F33] p-3 text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <div className="font-mono text-[10px] font-bold tracking-wider text-[#F59E0B] uppercase">
            INNINGS FLOW (D3) · {inningsLabel}
          </div>
          <div className="font-display text-sm font-extrabold tracking-wide text-white uppercase">
            {teamName} — Runs Per Over &amp; Wickets
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-300">
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-4 rounded-[1px]"
              style={{ backgroundColor: strokeColor }}
              aria-hidden="true"
            />
            Runs/Over
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-[#EF4444]"
              aria-hidden="true"
            />
            Wicket ({totalWickets})
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`D3 line chart of runs per over and wickets for ${teamName}`}
          className="h-auto w-full min-w-[300px] select-none"
        >
          <defs>
            <linearGradient id="rpoAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {/* Phase background bands */}
            <rect
              x={xScale(0.5)}
              y={0}
              width={xScale(6.5) - xScale(0.5)}
              height={innerH}
              fill="rgba(56, 189, 248, 0.06)"
            />
            <rect
              x={xScale(6.5)}
              y={0}
              width={xScale(15.5) - xScale(6.5)}
              height={innerH}
              fill="rgba(16, 185, 129, 0.05)"
            />
            <rect
              x={xScale(15.5)}
              y={0}
              width={xScale(20.5) - xScale(15.5)}
              height={innerH}
              fill="rgba(239, 68, 68, 0.07)"
            />

            {/* Phase labels */}
            <text
              x={(xScale(0.5) + xScale(6.5)) / 2}
              y={-8}
              textAnchor="middle"
              fill="#7DD3FC"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="700"
            >
              PP 1–6
            </text>
            <text
              x={(xScale(6.5) + xScale(15.5)) / 2}
              y={-8}
              textAnchor="middle"
              fill="#6EE7B7"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="700"
            >
              MIDDLE 7–15
            </text>
            <text
              x={(xScale(15.5) + xScale(20.5)) / 2}
              y={-8}
              textAnchor="middle"
              fill="#FCA5A5"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="700"
            >
              DEATH 16–20
            </text>

            {/* Phase separator lines */}
            <line
              x1={xScale(6.5)}
              x2={xScale(6.5)}
              y1={0}
              y2={innerH}
              stroke="rgba(255,255,255,0.16)"
              strokeDasharray="3,3"
            />
            <line
              x1={xScale(15.5)}
              x2={xScale(15.5)}
              y1={0}
              y2={innerH}
              stroke="rgba(255,255,255,0.16)"
              strokeDasharray="3,3"
            />

            {/* Horizontal Y gridlines & labels */}
            {yTicks.map((tick) => (
              <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
                <line
                  x1={0}
                  x2={innerW}
                  stroke="rgba(255,255,255,0.10)"
                  strokeDasharray={tick === 0 ? undefined : '2,3'}
                />
                <text
                  x={-8}
                  y={3}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* X-axis ticks */}
            {xTicks.map((ov) => (
              <g key={ov} transform={`translate(${xScale(ov)}, ${innerH})`}>
                <line y1={0} y2={4} stroke="rgba(255,255,255,0.28)" />
                <text
                  y={15}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {ov}
                </text>
              </g>
            ))}

            {/* Y-axis unit label above tick column */}
            <text
              x={-8}
              y={-8}
              textAnchor="end"
              fill="#94A3B8"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="700"
            >
              RPO
            </text>

            {/* Area & Line */}
            {areaPath && <path d={areaPath} fill="url(#rpoAreaGrad)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2.4}
                strokeLinecap="round"
                data-testid="d3-runs-line"
              />
            )}

            {/* Empty prompt */}
            {overHistory.length === 0 && (
              <text
                x={innerW / 2}
                y={innerH / 2}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="11"
                fontFamily="monospace"
              >
                Bowl or simulate Over 1 to plot Runs Per Over &amp; Wickets
              </text>
            )}

            {/* Over points + Wicket markers */}
            {overHistory.map((d) => {
              const cx = xScale(d.overNumber);
              const cy = yScale(d.runs);
              const isSelected = activeOverData?.overNumber === d.overNumber;
              const hasWicket = d.wickets > 0;
              return (
                <g
                  key={d.overNumber}
                  onMouseEnter={() => setSelectedOver(d.overNumber)}
                  onClick={() => setSelectedOver(d.overNumber)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hasWicket ? (isSelected ? 6.5 : 5.2) : isSelected ? 4.8 : 3.2}
                    fill={hasWicket ? '#EF4444' : strokeColor}
                    stroke="#0D1B2A"
                    strokeWidth={1.6}
                    data-testid={
                      hasWicket
                        ? `d3-wicket-marker-${d.overNumber}`
                        : `d3-over-dot-${d.overNumber}`
                    }
                  />
                  {hasWicket && (
                    <text
                      x={cx}
                      y={Math.max(10, cy - 9)}
                      textAnchor="middle"
                      fill="#FCA5A5"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="800"
                    >
                      {d.wickets > 1 ? `${d.wickets}W` : 'W'}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected / Latest Over Narration Strip */}
      {activeOverData && (
        <div
          data-testid="d3-over-tooltip"
          className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 font-mono text-[10.5px] text-slate-200"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[2px] bg-[#F59E0B] px-1.5 py-0.5 font-extrabold text-[#141619]">
              OV {activeOverData.overNumber}
            </span>
            <span className="font-bold text-white">
              {activeOverData.runs} run{activeOverData.runs === 1 ? '' : 's'}
              {activeOverData.wickets > 0 && (
                <span className="text-[#FCA5A5]">
                  {' '}
                  · {activeOverData.wickets} wkt{activeOverData.wickets > 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span className="text-slate-400">by {activeOverData.bowlerName}</span>
            <span className="text-emerald-300 tabular-nums">
              Total {activeOverData.cumulativeRuns}/{activeOverData.cumulativeWickets}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {activeOverData.ballsSequence.map((ball, idx) => (
              <span
                key={`${activeOverData.overNumber}-${idx}`}
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-[2px] px-1 text-[9.5px] font-extrabold ${
                  ball === 'W'
                    ? 'bg-[#EF4444] text-white'
                    : ball === '6'
                      ? 'bg-[#6D28D9] text-white'
                      : ball === '4'
                        ? 'bg-[#157F3D] text-white'
                        : 'bg-white/10 text-slate-200'
                }`}
              >
                {ball === '0' ? '•' : ball}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
