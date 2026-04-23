import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Narrow overrides for pre-existing violations discovered during the
// next lint -> eslint-flat migration. New code must satisfy the strict
// default. Remove each entry as the underlying file is cleaned up.
const LEGACY_EXPLICIT_ANY_FILES = [
  "src/__tests__/useNotificationStatus.test.ts",
  "src/__tests__/useWallet.test.ts",
];

const LEGACY_HTML_LINK_FILES = ["src/app/positions/page.tsx"];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: LEGACY_EXPLICIT_ANY_FILES,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: LEGACY_HTML_LINK_FILES,
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
