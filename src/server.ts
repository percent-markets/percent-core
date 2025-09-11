import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import ModeratorService from './services/moderator.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

const startServer = async () => {
  try {
    const moderator = await ModeratorService.getInstance();
    console.log('Moderator service initialized');
    console.log(`Authority: ${moderator.config.authority.publicKey.toBase58()}`);
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Key required for protected endpoints`);
      if (process.env.DB_URL) {
        console.log('Database connection configured');
      } else {
        console.warn('WARNING: DB_URL not set - persistence disabled');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();