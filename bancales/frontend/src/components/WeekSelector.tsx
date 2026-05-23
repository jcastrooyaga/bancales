import React from 'react';
import { WeekId } from '../types';

function formatDisplay(w: WeekId): string {
  return `W${String(w.week).padStart(2, '0')} · ${w.year}`;
}

function previousWeek(w: WeekId): WeekId {
  if (w.week === 1) {
    // Last week of previous year: Dec 28 is always in the last ISO week
    const dec28 = new Date(Date.UTC(w.year - 1, 11, 28));
    return isoWeekOf(dec28);
  }
  return { year: w.year, week: w.week - 1 };
}

function nextWeek(w: WeekId): WeekId {
  const monday = getMondayOfWeek(w.year, w.week);
  const next = new Date(monday);
  next.setUTCDate(monday.getUTCDate() + 7);
  return isoWeekOf(next);
}

function isoWeekOf(date: Date): WeekId {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function getMondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (week - 1) * 7);
  return monday;
}

export function currentWeek(): WeekId {
  return isoWeekOf(new Date());
}

interface Props {
  value: WeekId;
  onChange: (w: WeekId) => void;
}

export const WeekSelector: React.FC<Props> = ({ value, onChange }) => {
  const now = currentWeek();
  const isCurrentWeek = value.year === now.year && value.week === now.week;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(previousWeek(value))}
        className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-sm"
        title="Semana anterior"
      >
        ‹
      </button>
      <span className="min-w-[110px] text-center font-medium text-sm">{formatDisplay(value)}</span>
      <button
        onClick={() => onChange(nextWeek(value))}
        disabled={isCurrentWeek}
        className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        title="Semana siguiente"
      >
        ›
      </button>
      {!isCurrentWeek && (
        <button
          onClick={() => onChange(now)}
          className="text-xs text-blue-600 hover:underline ml-1"
        >
          Hoy
        </button>
      )}
    </div>
  );
};
