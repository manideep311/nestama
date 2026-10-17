"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatINR, type RevenuePoint } from "@nestama/shared";

// One series colour: a forest-family green that passes the dataviz lightness/chroma checks
// (forest itself reads as near-black ink). Text never wears it — axes and labels use ink tokens.
const SERIES = "#1F7A55";
const GRID = "rgb(18 61 47 / 0.1)";
const MUTED = "#5b625e";
const SURFACE = "#ffffff";

const compactINR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
export const formatCompactINR = (paise: number) => compactINR.format(paise / 100);

const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const asDate = (key: string) => new Date(`${key}T00:00:00Z`);

function RevenueTooltip({ active, payload, label, by }: TooltipContentProps<number, string> & { by: "day" | "week" }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload as RevenuePoint;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lift ring-1 ring-line">
      {/* Value first: the reader already knows the series and wants the number. */}
      <p className="text-sm font-extrabold text-charcoal">{formatINR(point.revenue)}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-muted">
        <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES }} aria-hidden="true" />
        {by === "week" ? `Week of ${dayLabel.format(asDate(String(label)))}` : fullDay.format(asDate(String(label)))} · {point.orders}{" "}
        {point.orders === 1 ? "order" : "orders"}
      </p>
    </div>
  );
}

/** Revenue over time: 2px line, 10% wash, hairline grid, crosshair tooltip. */
export function RevenueChart({ data, by = "day", height = 260 }: { data: RevenuePoint[]; by?: "day" | "week"; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Revenue by ${by}; the table below lists every value.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => dayLabel.format(asDate(d))}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactINR(v)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            allowDecimals={false}
          />
          <Tooltip
            content={(props) => <RevenueTooltip {...(props as TooltipContentProps<number, string>)} by={by} />}
            cursor={{ stroke: MUTED, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={SERIES}
            strokeWidth={2}
            fill={SERIES}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for revenue by category: ≤ 18px thick, rounded data end, value at the tip. */
export function CategoryBars({ data }: { data: { category: string; revenue: number }[] }) {
  const height = Math.max(120, data.length * 40 + 16);
  return (
    <div style={{ height }} role="img" aria-label="Revenue by category; the table below lists every value.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="category"
            width={128}
            tick={{ fill: "#202522", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgb(18 61 47 / 0.05)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lift ring-1 ring-line">
                  <p className="text-sm font-extrabold text-charcoal">{formatINR(Number(payload[0]!.value))}</p>
                  <p className="text-muted">{String((payload[0]!.payload as { category: string }).category)}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="revenue" fill={SERIES} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="revenue"
              position="right"
              formatter={(v: unknown) => formatCompactINR(Number(v))}
              style={{ fill: "#202522", fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Every chart's numbers, readable without hovering or seeing colour. */
export function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-bold text-forest">Show as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg ring-1 ring-line">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-cream">
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 font-bold text-muted ${i > 0 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[0])} className="border-t border-line">
                {r.map((cell, i) => (
                  <td key={i} className={`px-3 py-1.5 ${i > 0 ? "text-right tabular-nums" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export const tableDate = (key: string) => dayLabel.format(asDate(key));
