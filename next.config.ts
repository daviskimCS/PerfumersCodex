import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // This repo is checked out as a git worktree nested inside the main
    // checkout, and Turbopack infers the project root from the outermost
    // package-lock.json — which would pull in the parent checkout's files.
    // Pin the root so a worktree builds itself and nothing above it.
    root: __dirname,
  },
};

export default nextConfig;
