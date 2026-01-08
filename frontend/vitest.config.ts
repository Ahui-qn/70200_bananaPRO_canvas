import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',  // 使用 jsdom 环境支持 React Hook 测试
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
