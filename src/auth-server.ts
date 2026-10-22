import express from 'express';
import dotenv from 'dotenv';
import { setupAuthRoutes } from './auth';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8080);


// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Setup Auth Routes
setupAuthRoutes(app);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Auth Server is running on port ${PORT}`);
  console.log(`Please visit http://localhost:${PORT}/auth/login to authenticate.`);
});
