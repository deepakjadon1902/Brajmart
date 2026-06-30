import { ReactNode, useEffect, useRef, useState } from 'react';

interface DeferredMountProps {
  children: ReactNode;
  className?: string;
  minHeight?: number | string;
  rootMargin?: string;
}

const DeferredMount = ({
  children,
  className = '',
  minHeight,
  rootMargin = '180px 0px',
}: DeferredMountProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(() =>
    typeof window === 'undefined' || Boolean(window.__BRAJMART_INITIAL_DATA__)
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={minHeight ? { minHeight } : undefined}>
      {isVisible ? children : null}
    </div>
  );
};

export default DeferredMount;
