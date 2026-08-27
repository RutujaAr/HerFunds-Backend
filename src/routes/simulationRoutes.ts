import { Router } from "express";

import {
  getSimulations,
  runBudgetSimulation,
  runMutualFundSimulation,
  getMutualFunds,
} from "../controllers/simulationController.js";


const router = Router();


router.get(
  "/",
  getSimulations
);


router.post(
  "/budget",
  runBudgetSimulation
);


router.get(
  "/mutual-funds",
  getMutualFunds
);


router.post(
  "/mutual-fund",
  runMutualFundSimulation
);


export default router;