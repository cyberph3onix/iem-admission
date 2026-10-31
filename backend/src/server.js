const config = require('./config');
const app = require('./app');
const { connectDatabase } = require('./config/database');

connectDatabase(config.mongoUri)
  .then(() => app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
