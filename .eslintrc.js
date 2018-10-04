module.exports = {
  "env": {
    "browser": true,
    "es6": true
  },
  "extends": [
    "eslint:recommended",
    "idiomatic"
  ],
  "parserOptions": {
    "sourceType": "module"
  },
  "rules": {
    "quotes": [
      "error",
      "double"
    ],
    "newline-after-var": [
      "error",
      "always"
    ]
  }
};
