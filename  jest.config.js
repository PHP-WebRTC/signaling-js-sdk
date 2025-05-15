/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
    moduleNameMapper: {
        // Handle JSON imports
        '\\.(json)$': '<rootDir>/tests/mocks/jsonMock.js'
    },
    collectCoverage: false,
    coverageDirectory: "coverage",
};

module.exports = config;