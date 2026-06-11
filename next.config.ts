import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents는 동적 쿠키 인증(Supabase Auth)과 충돌하여 비활성화
  // cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
