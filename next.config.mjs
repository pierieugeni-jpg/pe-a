/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite (Postgres embebido para desarrollo local) trae un .wasm: no hay que empaquetarlo.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
