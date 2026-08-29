const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="h-[312px] overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:h-[335px]">
        <div className="aspect-square animate-pulse bg-muted" />
        <div className="space-y-2 p-3">
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    ))}
  </div>
);

export default ProductGridSkeleton;
