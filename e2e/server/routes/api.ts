import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const gameScore = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/gameScore.json'), 'utf8')
);
const entities = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/entities.json'), 'utf8')
);

router.post('/:action', (req: Request, res: Response) => {
  const { action } = req.params;

  res.setHeader('Content-Type', 'application/json');

  switch (action) {
    case 'getGameScore':
      res.json(gameScore);
      break;
    case 'getEntities':
      res.json(entities);
      break;
    case 'getPortalDetails':
      res.json({ result: null });
      break;
    case 'getRegionScoreDetails':
      res.json({ result: { scoreHistory: [], topAgents: [] } });
      break;
    case 'sendPlext':
      res.json({ result: null });
      break;
    default:
      res.json({ result: null });
      break;
  }
});

export default router;
