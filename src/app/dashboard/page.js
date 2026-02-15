"use client";

import { useEffect, useState, useCallback } from "react";
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,} from "recharts";
import styles from "@/app/dashboard/Dashboard.module.css";

const RISK_COLORS = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#f97316",
  Critical: "#ef4444",
  Error: "#6b7280",
};

const ZONE_CAPACITY = 5;

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [connected, setConnected] = useState(true);

  // Poll /api/stats every 2 seconds
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Service unavailable");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  // Poll /api/history every 5 seconds
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history?minutes=2");
      if (!res.ok) return;
      const data = await res.json();
      const formatted = data.map((row) => ({
        ...row,
        time: new Date(row.timestamp).toLocaleTimeString(),
        density_pct: Math.round(row.density_ratio * 100),
      }));
      setHistory(formatted);
    } catch {
      // silent — history is non-critical
    }
  }, []);

  // Poll longer history for heatmap every 10 seconds
  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await fetch("/api/history?minutes=5");
      if (!res.ok) return;
      const data = await res.json();
      // Group into 15-second buckets
      const buckets = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const d = new Date(row.timestamp);
        const bucketKey = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}:${String(Math.floor(d.getSeconds() / 15) * 15).padStart(2, "0")}`;
        const last = buckets[buckets.length - 1];
        if (last && last.key === bucketKey) {
          last.densitySum += row.density_ratio;
          last.count += 1;
          last.maxRisk = Math.max(last.maxRisk, row.risk_score);
          last.riskLevel = row.risk_level;
        } else {
          buckets.push({
            key: bucketKey,
            label: bucketKey,
            densitySum: row.density_ratio,
            count: 1,
            maxRisk: row.risk_score,
            riskLevel: row.risk_level,
          });
        }
      }
      setHeatmapData(
        buckets.map((b) => ({
          label: b.label,
          density: Math.round((b.densitySum / b.count) * 100),
          riskScore: b.maxRisk,
          riskLevel: b.riskLevel,
        }))
      );
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchHistory();
    fetchHeatmap();
    const statsInterval = setInterval(fetchStats, 2000);
    const historyInterval = setInterval(fetchHistory, 5000);
    const heatmapInterval = setInterval(fetchHeatmap, 10000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(historyInterval);
      clearInterval(heatmapInterval);
    };
  }, [fetchStats, fetchHistory, fetchHeatmap]);

  const riskLevel = stats?.risk_level || "Error";
  const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.Error;
  const densityPct = stats ? Math.round(stats.density_ratio * 100) : 0;
  const surgeFlagActive = stats?.surge_flag || false;
  const durationHigh = stats?.duration_in_high_state || 0;

  return (
    <div className={styles.dashboardContainer}>
      <h1 className={styles.title}>AI Crowd Risk Monitor</h1>

      {!connected && (
        <div className={styles.connectionBanner}>
          AI service offline — retrying...
        </div>
      )}

      {surgeFlagActive && (
        <div className={styles.surgeBanner}>SURGE DETECTED — Rapid crowd increase</div>
      )}

      {/* ── Live Camera Feed ────────────────── */}
      <div className={styles.feedCard}>
        <h2 className={styles.chartTitle}>Live Camera Feed</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="http://127.0.0.1:5001/video_feed"
          alt="Live camera feed"
          className={styles.feedImg}
        />
      </div>

      {/* ── Metric Cards ────────────────────── */}
      <div className={styles.cardsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>People Count</span>
          <span className={styles.metricValue}>{stats?.current_count ?? "—"}</span>
          <span className={styles.metricSub}>of {ZONE_CAPACITY} capacity</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Density</span>
          <span className={styles.metricValue}>{densityPct}%</span>
          <div className={styles.densityBarTrack}>
            <div
              className={styles.densityBarFill}
              style={{
                width: `${Math.min(densityPct, 100)}%`,
                backgroundColor: riskColor,
              }}
            />
          </div>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Risk Level</span>
          <span className={styles.riskBadge} style={{ backgroundColor: riskColor }}>
            {riskLevel}
          </span>
          <span className={styles.metricSub}>
            Score: {stats?.risk_score?.toFixed(2) ?? "—"}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Growth Rate</span>
          <span className={styles.metricValue}>
            {stats?.growth_rate !== undefined
              ? (stats.growth_rate > 0 ? "+" : "") + stats.growth_rate
              : "—"}
          </span>
          <span className={styles.metricSub}>persons / window</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Overload Duration</span>
          <span className={styles.metricValue}>
            {durationHigh > 0 ? `${durationHigh}s` : "—"}
          </span>
          <span className={styles.metricSub}>
            {durationHigh >= 10
              ? "CRITICAL — sustained overload"
              : durationHigh > 0
              ? "High density active"
              : "Normal"}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Surge Alert</span>
          <span
            className={styles.metricValue}
            style={{ color: surgeFlagActive ? "#ef4444" : "#22c55e" }}
          >
            {surgeFlagActive ? "ACTIVE" : "None"}
          </span>
        </div>
      </div>

      {/* ── Density Trend ─────────────────────── */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Density Trend (Last 2 Minutes)</h2>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  stroke="#888"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#888"
                  domain={[0, 150]}
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Density %",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#888",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="density_pct"
                  stroke="#00e5ff"
                  strokeWidth={2}
                  dot={false}
                  name="Density %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.chartPlaceholder}>Collecting data...</p>
          )}
      </div>

      {/* ── Density Heatmap ───────────────────── */}
      <div className={styles.chartCard} style={{ marginTop: 20 }}>
        <h2 className={styles.chartTitle}>Density Heatmap (Last 5 Minutes)</h2>
        {heatmapData.length > 0 ? (
          <div className={styles.heatmapContainer}>
            <div className={styles.heatmapGrid}>
              {heatmapData.map((cell, i) => {
                const color =
                  RISK_COLORS[cell.riskLevel] || RISK_COLORS.Error;
                const opacity = Math.max(0.15, Math.min(cell.density / 120, 1));
                return (
                  <div
                    key={i}
                    className={styles.heatmapCell}
                    style={{ backgroundColor: color, opacity }}
                    title={`${cell.label}\nDensity: ${cell.density}%\nRisk: ${cell.riskLevel}`}
                  >
                    <span className={styles.heatmapCellValue}>
                      {cell.density}%
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={styles.heatmapLegend}>
              <span className={styles.heatmapLegendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "#22c55e" }} /> Low
              </span>
              <span className={styles.heatmapLegendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "#f59e0b" }} /> Medium
              </span>
              <span className={styles.heatmapLegendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "#f97316" }} /> High
              </span>
              <span className={styles.heatmapLegendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "#ef4444" }} /> Critical
              </span>
            </div>
          </div>
        ) : (
          <p className={styles.chartPlaceholder}>Collecting data...</p>
        )}
      </div>
    </div>
  );
}
