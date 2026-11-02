import React from 'react';

/**
 * A single animated shimmer block for skeleton loading states.
 * Usage: <SkeletonBlock className="h-8 w-full rounded-xl" />
 */
export const SkeletonBlock = ({ className = '' }) => (
  <div
    className={`bg-beige/60 animate-pulse rounded-xl ${className}`}
    aria-hidden="true"
  />
);

/**
 * Predefined skeleton layouts for common card shapes.
 */

/** Full prediction result card skeleton */
export const PredictionSkeleton = () => (
  <div className="space-y-4" aria-label="Loading prediction…">
    {/* Next Bus row */}
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-beige gap-4">
      <div className="space-y-1.5 flex-1">
        <SkeletonBlock className="h-2.5 w-16" />
        <SkeletonBlock className="h-2 w-32" />
      </div>
      <SkeletonBlock className="h-8 w-24 rounded-xl" />
    </div>
    {/* Arrival times */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="p-3 rounded-xl bg-surface border border-beige space-y-2">
        <SkeletonBlock className="h-2.5 w-20 mx-auto" />
        <SkeletonBlock className="h-2 w-24 mx-auto" />
        <SkeletonBlock className="h-8 w-20 mx-auto" />
      </div>
      <div className="p-3 rounded-xl bg-surface border border-beige space-y-2">
        <SkeletonBlock className="h-2.5 w-20 mx-auto" />
        <SkeletonBlock className="h-2 w-24 mx-auto" />
        <SkeletonBlock className="h-8 w-20 mx-auto" />
      </div>
    </div>
    {/* Delay / Wait */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="p-3 rounded-xl bg-surface border border-beige space-y-2">
        <SkeletonBlock className="h-2.5 w-16 mx-auto" />
        <SkeletonBlock className="h-2 w-24 mx-auto" />
        <SkeletonBlock className="h-8 w-14 mx-auto" />
      </div>
      <div className="p-3 rounded-xl bg-surface border border-beige space-y-2">
        <SkeletonBlock className="h-2.5 w-24 mx-auto" />
        <SkeletonBlock className="h-2 w-28 mx-auto" />
        <SkeletonBlock className="h-8 w-14 mx-auto" />
      </div>
    </div>
    {/* Crowd row */}
    <div className="p-4 rounded-xl border border-beige flex items-center gap-3">
      <SkeletonBlock className="h-10 w-10 rounded-xl shrink-0" />
      <div className="space-y-1.5 flex-1">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-2 w-32" />
      </div>
    </div>
  </div>
);

/** Live status panel skeleton (Driver page "starting" state) */
export const TripStatusSkeleton = () => (
  <div className="space-y-4" aria-label="Connecting…">
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-2.5 w-14" />
      <SkeletonBlock className="h-7 w-28 rounded-full" />
    </div>
    <div className="p-3 rounded-xl bg-surface border border-beige space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <SkeletonBlock className="h-2.5 w-12" />
          <SkeletonBlock className="h-2.5 w-20" />
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-beige">
      <SkeletonBlock className="h-2.5 w-20" />
      <SkeletonBlock className="h-6 w-20 rounded-full" />
    </div>
  </div>
);

/** Map overlay skeleton */
export const MapLoadingSkeleton = () => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-cream/80 backdrop-blur-sm pointer-events-none">
    <div className="w-10 h-10 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
    <p className="text-xs text-ink-soft animate-pulse">Loading map data…</p>
  </div>
);
