module.exports = {
    // parser:  "@babel/eslint-parser",
    globals: {
        session:    true,
        post:       true,
        SuperClass: true,
        plugins:    true,
    },
    env: {
        node:   true,
        es2021: true,
    },
    parserOptions: {
        // sourceType: 'module',
        // ecmaVersion: 'latest',
        ecmaVersion:  2017,
        ecmaFeatures: {
            globalReturn: true
        }

    },
    extends: [
        'eslint:recommended',
    ],
    rules: {
        "spaced-comment":                   ["error", "always", { "exceptions": ["-", "+"] }],
        "indent":                           ["error", 4],
        "no-empty":                         ["error", { "allowEmptyCatch": true }],
        "no-redeclare":                     "off",
        "no-unused-vars":                   ["error", { "vars": "all", "args": "after-used", "ignoreRestSiblings": true, "varsIgnorePattern": "React" }],
        "brace-style":                      ["error", "1tbs", { }],
        "object-curly-spacing":             ["error", "always"],
        "nonblock-statement-body-position": ["error", "below"],
        "array-bracket-spacing":            ["error", "never"],
        "space-before-blocks":              ["error", "always"],
        "arrow-spacing":                    ["error", { "before": true, "after": true }],
        "no-multi-spaces":                  ["error", { ignoreEOLComments: true }],
        "key-spacing":                      ["error", { "beforeColon": false, "align": "value" }],
        "semi":                             ["error", "never"],
        "padding-line-between-statements":  [
            "error",
            { "blankLine": "always", "prev": "if", "next": "*" },
            { "blankLine": "always", "prev": "switch", "next": "*" },
            { "blankLine": "always", "prev": "*", "next": "switch" },
            { "blankLine": "never", "prev": "*", "next": "block" },
        ],
    },
}