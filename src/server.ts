import express, { Router } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import RouterService from '../app/services/router.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

const startServer = async () => {
  try {
    console.log('Starting server ...');
    // Load moderators from database
    const router = RouterService.getInstance();
    await router.loadModerators();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
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