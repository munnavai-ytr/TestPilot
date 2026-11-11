import React from 'react';

interface ScoreRingProps {
  score?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ScoreRing({
  score = 0,
  size = 80,
  strokeWidth = 6,
  label = 'Quality Score',
}: ScoreRingProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let colorClass = 'text-[#DC2626]'; // < 60
  if (clampedScore >= 85) {
    colorClass = 'text-[#16A34A]';
  } else if (clampedScore >= 60) {
    colorClass = 'text-[#CA8A04]';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="rotate-[-90deg] transform"
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-zinc-200 dark:text-zinc-800"
          />
          {/* Active progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-500 ease-out`}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
            {clampedScore}
          </span>
          <span className="text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 -mt-0.5">
            /100
          </span>
        </div>
      </div>
      {label && (
        <span className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
      )}
    </div>
  );
}
