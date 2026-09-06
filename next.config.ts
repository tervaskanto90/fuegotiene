import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ffmpeg viene como binario dentro de node_modules: no se empaqueta con
  // webpack y se incluye entero en la función que genera portadas.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "@ffmpeg-installer/linux-x64"],
  outputFileTracingIncludes: {
    "/api/arte/**": ["./node_modules/@ffmpeg-installer/linux-x64/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
