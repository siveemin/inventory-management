"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHydrated } from "@/lib/client";

const colors = ["#1F7A4D", "#C4622D", "#C6A15B", "#1F5678", "#6B4C7A", "#3E6B5A", "#9C341F", "#8A7350"];

function Ready({ children }: { children: React.ReactNode }) {
  const ready = useHydrated();
  if (!ready) return <div className="h-[220px] w-full min-w-0 sm:h-[260px]" />;
  return <div className="h-[220px] w-full min-w-0 sm:h-[260px]">{children}</div>;
}

const tipStyle = { borderRadius: 12, borderColor: "#E4DCD0", fontSize: 12 };

export function StockBars({ data }: { data: { name: string; quantity: number }[] }) {
  return (
    <Ready>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#E4DCD0" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#6F675E", fontSize: 11 }} interval="preserveStartEnd" angle={-18} height={60} textAnchor="end" />
          <YAxis tick={{ fill: "#6F675E", fontSize: 11 }} width={40} />
          <Tooltip contentStyle={tipStyle} />
          <Bar dataKey="quantity" fill="#1F7A4D" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Ready>
  );
}

export function SalesLine({ data }: { data: { label: string; total: number }[] }) {
  return (
    <Ready>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#E4DCD0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#6F675E", fontSize: 11 }} minTickGap={24} />
          <YAxis tick={{ fill: "#6F675E", fontSize: 11 }} width={44} />
          <Tooltip contentStyle={tipStyle} />
          <Line type="monotone" dataKey="total" stroke="#C4622D" strokeWidth={2.4} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Ready>
  );
}

export function ValuePie({ data }: { data: { name: string; amount: number }[] }) {
  return (
    <Ready>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
            {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={tipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </Ready>
  );
}

export function TopBars({ data }: { data: { name: string; quantity: number }[] }) {
  return (
    <Ready>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid stroke="#E4DCD0" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#6F675E", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#6F675E", fontSize: 11 }} />
          <Tooltip contentStyle={tipStyle} />
          <Bar dataKey="quantity" fill="#1F5678" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Ready>
  );
}
