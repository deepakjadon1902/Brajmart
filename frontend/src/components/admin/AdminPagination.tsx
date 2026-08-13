export const ADMIN_PAGE_SIZE = 10;

type AdminPaginationProps = {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  itemLabel?: string;
};

const getVisiblePages = (page: number, totalPages: number) => {
  const candidates = [1, page - 1, page, page + 1, totalPages]
    .filter((value) => value >= 1 && value <= totalPages);
  return Array.from(new Set(candidates)).sort((a, b) => a - b);
};

const AdminPagination = ({
  page,
  totalItems,
  onPageChange,
  pageSize = ADMIN_PAGE_SIZE,
  itemLabel = 'records',
}: AdminPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const visiblePages = getVisiblePages(safePage, totalPages);

  const goToPage = (nextPage: number) => {
    const normalized = Math.min(Math.max(nextPage, 1), totalPages);
    if (normalized !== safePage) onPageChange(normalized);
  };

  return (
    <div className="admin-pagination flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold">
        Showing {start}-{end} of {totalItems.toLocaleString('en-IN')} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => goToPage(1)} disabled={safePage === 1}>
          First
        </button>
        <button type="button" onClick={() => goToPage(safePage - 1)} disabled={safePage === 1}>
          Previous
        </button>
        {visiblePages.map((pageNumber, index) => (
          <span key={pageNumber} className="inline-flex items-center gap-2">
            {index > 0 && pageNumber - visiblePages[index - 1] > 1 && (
              <span className="admin-pagination-gap">...</span>
            )}
            <button
              type="button"
              onClick={() => goToPage(pageNumber)}
              className={pageNumber === safePage ? 'is-active' : ''}
              aria-current={pageNumber === safePage ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          </span>
        ))}
        <button type="button" onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages}>
          Next
        </button>
        <button type="button" onClick={() => goToPage(totalPages)} disabled={safePage === totalPages}>
          Last
        </button>
      </div>
    </div>
  );
};

export default AdminPagination;
