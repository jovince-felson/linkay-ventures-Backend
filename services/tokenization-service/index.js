import 'dotenv/config';
import { createApp }       from './src/config/app.js';
import { connectDatabase } from './src/config/database.js';
import './src/workers/tokenization.worker.js';
import './src/workers/auction.worker.js';

const PORT = process.env.PORT || 4005;

async function bootstrap() {
  try {
    await connectDatabase();
    console.log('✅ Database connected');

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`🚀 Tokenization Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

bootstrap();
