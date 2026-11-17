import { useTable, type ColumnDef, type ColumnVisibilityState, type PaginationState } from '@tanstack/react-table';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid';
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination';
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area';
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table';

export type Column<T extends object> = ColumnDef<DataGridFeatures, T>;

/** True on a screen narrower than `px`. */
function useNarrow(px = 640): boolean {
  const query = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = (): void => setNarrow(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return narrow;
}

/**
 * A table on ReUI's Data Grid. Columns listed in `hideOnPhone` are left out on a narrow screen; `pageSize` adds
 * ReUI's pagination when there are more rows than that.
 */
export function DataTable<T extends object>({
  columns,
  data,
  getRowId,
  onRowClick,
  emptyMessage,
  isLoading = false,
  pageSize,
  hideOnPhone = [],
}: {
  columns: Column<T>[];
  data: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: ReactNode;
  isLoading?: boolean;
  pageSize?: number;
  hideOnPhone?: string[];
}) {
  const narrow = useNarrow();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: pageSize ?? 100 });
  const columnVisibility = useMemo<ColumnVisibilityState>(() => Object.fromEntries(hideOnPhone.map((id) => [id, !narrow])), [hideOnPhone, narrow]);
  const table = useTable({
    features: dataGridFeatures,
    columns,
    data,
    getRowId,
    pageCount: Math.max(1, Math.ceil(data.length / pagination.pageSize)),
    state: { pagination, columnVisibility },
    onPaginationChange: setPagination,
  });
  const paged = pageSize !== undefined && data.length > pageSize;
  return (
    <DataGrid
      table={table}
      recordCount={data.length}
      isLoading={isLoading}
      loadingMode="skeleton"
      emptyMessage={emptyMessage}
      {...(onRowClick ? { onRowClick } : {})}
      tableLayout={{ headerBackground: true, headerBorder: true, rowBorder: true, width: 'auto' }}
    >
      <div className="flex w-full flex-col gap-2.5">
        <DataGridContainer className="rounded-none border-0">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        {paged && (
          <div className="px-3 pb-3">
            <DataGridPagination sizes={[10, 25, 50]} />
          </div>
        )}
      </div>
    </DataGrid>
  );
}
