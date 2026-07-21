import { defineConfig } from '@hey-api/openapi-ts';

const DEFAULT_OPENAPI_INPUT = 'http://localhost:8080/v3/api-docs';

export default defineConfig({
  input: process.env.CATCHHOLE_OPENAPI_INPUT ?? DEFAULT_OPENAPI_INPUT,
  output: {
    path: 'src/app/api/generated',
    clean: true,
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/client-fetch',
      baseUrl: false,
      runtimeConfigPath: './src/app/api/client-config.ts',
      throwOnError: true,
    },
    '@hey-api/sdk',
    {
      name: '@tanstack/react-query',
      mutationKeys: true,
      mutationOptions: true,
      queryKeys: true,
      queryOptions: true,
    },
  ],
});
