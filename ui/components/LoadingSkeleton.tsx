'use client';

import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'chart' | 'table' | 'sidebar';
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type = 'card' }) => {
  if (type === 'chart') {
    return (
      <div className="h-[500px] bg-[#181818] rounded-lg animate-pulse flex items-center justify-center">
        <div className="space-y-3">
          <div className="h-2 bg-gray-700 rounded w-24 mx-auto"></div>
          <div className="h-2 bg-gray-700 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (type === 'sidebar') {
    return (
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-[#2A2A2A] animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-700 rounded-full w-16"></div>
              <div className="h-6 bg-gray-700 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-[#0F0F0F] border border-[#3D3D3D] animate-pulse">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-[#3D3D3D]">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-700 rounded w-16"></div>
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 px-4 py-3">
            {[...Array(6)].map((_, j) => (
              <div key={j} className="h-3 bg-gray-700 rounded w-20"></div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-[#272727] rounded-lg p-6 animate-pulse">
      <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-700 rounded w-4/6"></div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;