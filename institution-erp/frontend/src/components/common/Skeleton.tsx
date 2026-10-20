import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base skeleton building block with GPU-friendly subtle pulse animation.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse-subtle bg-slate-200 dark:bg-slate-800 rounded-md ${className}`}
      {...props}
    />
  );
};

/**
 * Skeleton mirroring the exact structure and dimensions of StatCard.
 * Guarantees zero layout shift (CLS = 0) on dashboard metric loading.
 */
export const SkeletonStatCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
      <div className="space-y-2 flex-1 mr-4">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
    </div>
  );
};

/**
 * Skeleton mirroring a table structure with header and N rows.
 */
export interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  hasHeaderControls?: boolean;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  columns = 5,
  rows = 5,
  hasHeaderControls = true,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
      {hasHeaderControls && (
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-150 dark:border-slate-800">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3.5">
                  <Skeleton className="h-3.5 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx}>
                {Array.from({ length: columns }).map((_, cIdx) => (
                  <td key={cIdx} className="px-4 py-3.5">
                    <Skeleton
                      className={`h-4 ${
                        cIdx === 0
                          ? 'w-28'
                          : cIdx === 1
                          ? 'w-36'
                          : cIdx === columns - 1
                          ? 'w-16'
                          : 'w-20'
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Skeleton mirroring faculty cards in TeachersListPage.
 */
export const SkeletonTeacherCard: React.FC = () => {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="pt-2 flex justify-between items-center">
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
};

/**
 * Skeleton mirroring Chart containers on dashboards.
 */
export interface SkeletonChartProps {
  title?: string;
  heightClass?: string;
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({
  title,
  heightClass = 'h-64',
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        {title ? (
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        ) : (
          <Skeleton className="h-4 w-36" />
        )}
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className={`w-full ${heightClass} flex items-end justify-between gap-3 px-4 pt-6`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton
              className="w-full rounded-t-md"
              style={{ height: `${30 + ((i * 17) % 60)}%` }}
            />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
