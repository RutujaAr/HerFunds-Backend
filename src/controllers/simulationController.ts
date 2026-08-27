import { Request, Response } from "express";

import {
  getSimulationList,
  calculateBudget,
  calculateMutualFundInvestment,
} from "../services/simulationService.js";

import {
  mutualFundScenario,
} from "../data/simulationData.js";


export function getSimulations(
  req: Request,
  res: Response
): void {
  res.json(getSimulationList());
}


export function runBudgetSimulation(
  req: Request,
  res: Response
): void {
  try {
    const {
      salary,
      allocations,
    } = req.body;

    if (
      typeof salary !== "number" ||
      !allocations
    ) {
      res.status(400).json({
        message:
          "Salary and allocations are required.",
      });

      return;
    }

    const result =
      calculateBudget(
        salary,
        allocations
      );

    res.json(result);
  } catch (error) {
    console.error(
      "Budget simulation error:",
      error
    );

    res.status(500).json({
      message:
        "Budget simulation failed.",
    });
  }
}


export function runMutualFundSimulation(
  req: Request,
  res: Response
): void {
  try {
    const {
      fundId,
      investmentAmount,
      currentNav,
    } = req.body;

    if (
      !fundId ||
      typeof investmentAmount !== "number" ||
      typeof currentNav !== "number"
    ) {
      res.status(400).json({
        message:
          "Fund, investment amount and NAV are required.",
      });

      return;
    }

    const result =
      calculateMutualFundInvestment(
        fundId,
        investmentAmount,
        currentNav
      );

    res.json(result);
  } catch (error) {
    console.error(
      "Mutual fund simulation error:",
      error
    );

    res.status(500).json({
      message:
        "Mutual fund simulation failed.",
    });
  }
}


export function getMutualFunds(
  req: Request,
  res: Response
): void {
  res.json(mutualFundScenario);
}