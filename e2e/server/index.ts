import express from 'express';
import * as path from 'path';
import { serveIntelPage } from './routes/intel-page';
import apiRouter from './routes/api';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// IITC_DIR points to the directory containing total-conversion-build.js.
// Default: ../iitc-kuku-plugin-tester/iitc relative to the project root.
const iitcDir = process.env.IITC_DIR ?? path.join(process.cwd(), 'iitc');

app.use(express.json());

app.get('/', serveIntelPage);

// Serve the IITC built script
app.use('/iitc', express.static(iitcDir));

// Serve Handlebars UMD build for the mock HelperHandlebars plugin
app.get('/libs/handlebars.min.js', (_req, res) => {
  res.sendFile(
    path.join(__dirname, '../../node_modules/handlebars/dist/handlebars.min.js')
  );
});

// Serve plugins statically (for debugging; they are also inlined by serveIntelPage)
app.use(
  '/plugin',
  express.static(
    process.env.IITC_PLUGINS_DIR ?? path.join(process.cwd(), 'e2e/plugins')
  )
);

// Mock Ingress API endpoints
app.use('/r', apiRouter);

app.listen(PORT, () => {
  console.log(`Mock IITC server running at http://localhost:${PORT}`);
});

export default app;
