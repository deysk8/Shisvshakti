'use client';

import { type ReactNode, useEffect, useRef } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

function useRevealOnce(rootMargin = '-40px 0px') {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return ref;
}

export function FadeInUp({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRevealOnce('-48px 0px');

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function StaggerGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRevealOnce('-32px 0px');

  return (
    <div ref={ref} className={`stagger-grid ${className}`}>
      {children}
    </div>
  );
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`stagger-item ${className}`}>{children}</div>;
}

export function HeroMotion({ children, className = '', delay = 0 }: RevealProps) {
  return (
    <div
      className={`hero-enter ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function AnimatedList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`list-enter ${className}`}>{children}</div>;
}

export function AnimatedListItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`list-enter-item ${className}`}>{children}</div>;
}
