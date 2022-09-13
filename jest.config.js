export default {
  transform: {
    "^.+\\.ts$": ["@swc/jest"],
  },
  moduleNameMapper: {
    "^~verkut$": "<rootDir>/src/lib/verkut",
    "^~verkut/(.*)$": "<rootDir>/src/lib/verkut/$1",
  },
};
