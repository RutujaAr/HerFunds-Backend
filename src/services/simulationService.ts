import {
    budgetScenario,
    mutualFundScenario,
    MutualFund,
  } from "../data/simulationData.js";
  
  
  export function getSimulationList() {
    return [
      {
        id: "budget",
        title: "Personal Budget",
        description:
          "Manage your monthly income and financial priorities.",
        icon: "budget",
      },
      {
        id: "mutual_fund",
        title: "Mutual Fund",
        description:
          "Practice investing with virtual money.",
        icon: "investment",
      },
    ];
  }
  
  
  export function calculateBudget(
    salary: number,
    allocations: Record<string, number>
  ) {
    const totalAllocated = Object.values(
      allocations
    ).reduce(
      (sum: number, value: number) =>
        sum + Number(value || 0),
      0
    );
  
    const remaining =
      salary - totalAllocated;
  
    let score = 100;
  
    const feedback: string[] = [];
  
    if (remaining < 0) {
      score -= 40;
  
      feedback.push(
        "Your expenses are greater than your monthly income."
      );
    }
  
    const emergency =
      Number(allocations.emergency || 0);
  
    const savings =
      Number(allocations.savings || 0);
  
    const sip =
      Number(allocations.sip || 0);
  
    if (emergency === 0) {
      score -= 15;
  
      feedback.push(
        "You have not allocated anything toward an emergency fund."
      );
    }
  
    if (savings === 0) {
      score -= 10;
  
      feedback.push(
        "Consider keeping some money for short-term savings."
      );
    }
  
    if (sip > salary * 0.4) {
      score -= 10;
  
      feedback.push(
        "A very large investment allocation may leave insufficient money for current needs."
      );
    }
  
    if (remaining > 0) {
      feedback.push(
        `You still have ₹${remaining.toFixed(0)} unallocated.`
      );
    }
  
    if (feedback.length === 0) {
      feedback.push(
        "Good job! Your budget is balanced across current needs and future goals."
      );
    }
  
    score = Math.max(
      0,
      Math.min(100, score)
    );
  
    return {
      salary,
      totalAllocated,
      remaining,
      score,
      feedback,
    };
  }
  
  
  export function calculateMutualFundInvestment(
    fundId: string,
    investmentAmount: number,
    currentNav: number
  ) {
    const fund: MutualFund | undefined =
      mutualFundScenario.funds.find(
        (item: MutualFund) =>
          item.id === fundId
      );
  
    if (!fund) {
      throw new Error("Fund not found");
    }
  
    const startingNav =
      fund.startingNav;
  
    const units =
      investmentAmount / startingNav;
  
    const currentValue =
      units * currentNav;
  
    const profitLoss =
      currentValue - investmentAmount;
  
    const returnPercentage =
      (profitLoss / investmentAmount) * 100;
  
    return {
      fund: fund.name,
      category: fund.category,
      risk: fund.risk,
      investedAmount: investmentAmount,
      startingNav,
      currentNav,
      units,
      currentValue,
      profitLoss,
      returnPercentage,
    };
  }