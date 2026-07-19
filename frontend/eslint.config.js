import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

export default [
    {
        ignores: ["dist"],
    },

    {
        files: ["**/*.{js,jsx}"],

        languageOptions: {
            ...js.configs.recommended.languageOptions,

            ecmaVersion: "latest",
            sourceType: "module",

            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },

            globals: globals.browser,
        },

        plugins: {
            react,
        },

        rules: {
            "no-undef": "error",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

            "react/jsx-no-undef": "error",
            "react/jsx-uses-vars": "warn",

            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",
            "react/prop-types": "off",
        },
    },
];