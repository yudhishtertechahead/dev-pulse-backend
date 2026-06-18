module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/envSetup.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/migrate.js',
    '!src/config/update-constraint.js',
    '!src/scripts/**'
  ]
};
