"use client";

import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

type DataTableColumn<T> = {
  key: string;
  title: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  emptyText?: string;
  pageSize?: number;
  mobileCardTitle?: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  rows,
  columns,
  loading = false,
  emptyText = 'No records found.',
  pageSize = 10,
  mobileCardTitle,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage]);

  const desktopSkeletonRows = useMemo(() => Array.from({ length: Math.min(pageSize, 5) }), [pageSize]);
  const mobileSkeletonRows = useMemo(() => Array.from({ length: Math.min(pageSize, 4) }), [pageSize]);

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
        <table className="w-full table-auto text-left text-sm text-slate-200">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-300">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className ?? 'px-3 py-2'}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              desktopSkeletonRows.map((_, skeletonIndex) => (
                <tr key={`desktop_skeleton_${skeletonIndex}`} className="border-t border-white/5">
                  {columns.map((column) => (
                    <td key={`${column.key}_desktop_skeleton_${skeletonIndex}`} className={column.className ?? 'px-3 py-2'}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : null}

            {!loading && paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-5 text-slate-400">
                  {emptyText}
                </td>
              </tr>
            ) : null}

            {!loading
              ? paginatedRows.map((row, index) => (
                  <tr key={index} className="border-t border-white/5">
                    {columns.map((column) => (
                      <td key={`${column.key}_${index}`} className={column.className ?? 'px-3 py-2'}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? (
          mobileSkeletonRows.map((_, skeletonIndex) => (
            <div key={`mobile_skeleton_${skeletonIndex}`} className="rounded-xl border border-white/10 bg-slate-900/30 p-3 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))
        ) : null}

        {!loading && paginatedRows.length === 0 ? (
          <div className="rounded-xl border border-white/10 px-3 py-4 text-sm text-slate-400">{emptyText}</div>
        ) : null}

        {!loading
          ? paginatedRows.map((row, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                {mobileCardTitle ? (
                  <div className="mb-2 text-sm font-semibold text-white">{mobileCardTitle(row)}</div>
                ) : null}
                <div className="space-y-2">
                  {columns.map((column) => (
                    <div key={`${column.key}_mobile_${index}`} className="flex items-start justify-between gap-3 text-sm">
                      <span className="shrink-0 text-slate-400">{column.title}</span>
                      <span className="min-w-0 text-right text-slate-200 break-all">{column.render(row)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          : null}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>
          Page {safePage} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-[44px] rounded border border-white/20 px-3 py-1 disabled:opacity-50"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={safePage === 1}
          >
            Prev
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded border border-white/20 px-3 py-1 disabled:opacity-50"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
