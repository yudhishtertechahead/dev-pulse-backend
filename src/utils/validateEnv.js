const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'BCRYPT_ROUNDS',
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('Check your .env file against .env.example');
    process.exit(1);
  }

  // Warn if using default/weak secrets in production
  if (process.env.NODE_ENV === 'production') {
    const weakSecrets = [
      'dev-access-secret',
      'dev-refresh-secret',
      'your-secret-here',
      'replace-this'
    ];
    const secrets = [process.env.JWT_ACCESS_SECRET, process.env.JWT_REFRESH_SECRET];
    secrets.forEach(secret => {
      if (weakSecrets.some(weak => secret.includes(weak))) {
        console.error('FATAL: Weak JWT secret detected in production. Exiting.');
        process.exit(1);
      }
    });
  }
}

module.exports = validateEnv;
