module.exports = {
  root: true,
  extends: ["plugin:prettier/recommended"],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  overrides: [
    {
      parser: "@typescript-eslint/parser",
      files: ["*.ts", "*.tsx"],
      plugins: ["@typescript-eslint"],
      extends: [
        "plugin:@typescript-eslint/recommended", // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        "prettier", // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        "plugin:prettier/recommended" // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
      ],
      rules: {
        "prefer-const": "off", // Disabled in tests
        "@typescript-eslint/no-explicit-any": "off", // Disabled in tests
        "@typescript-eslint/no-var-requires": "off", // Used extensively for page requires
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/ban-ts-comment": "off"
      }
    },
    {
      files: ["*.ts", "*.tsx"],
      excludedFiles: ["**/tests/**/*.ts"],
      rules: {
        "prefer-const": "error", // Disabled in tests
        "@typescript-eslint/no-explicit-any": "warn" // Disabled in tests
      }
    },
    {
      files: ["*.ts", "*.tsx"],
      excludedFiles: [
        "**/cypress/integration/*.ts",
        "**/cypress/custom-commands.ts"
      ],
      plugins: ["promise"],
      rules: {
        "require-await": "error",
        "promise/catch-or-return": "error"
      }
    },
    {
      parser: "@typescript-eslint/parser",
      files: ["**/cypress/**/*.ts"],
      plugins: ["@typescript-eslint"],
      rules: {
        "@typescript-eslint/no-namespace": "off"
      }
    }
  ]
};
