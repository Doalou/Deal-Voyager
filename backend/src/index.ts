import express, { Request, Response } from 'express';
import scrapeRouter from './routes/scrape.router';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Routes de l'API
app.use('/api/v1', scrapeRouter);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Deal-Voyager API!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 