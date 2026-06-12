const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

if (process.env.NODE_ENV === 'development') {
  pool.on('connect', () => {
    console.log('New DB client connected');
  });
}

module.exports.query = (text, params) => pool.query(text, params);
module.exports.pool = pool;

module.exports.getClient = async function getClient() {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = () => client.release();
  return { query, release, client };
};
