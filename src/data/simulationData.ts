export interface BudgetCategory {
  id: string;
  name: string;
  description: string;
}

export interface MutualFund {
  id: string;
  name: string;
  category: string;
  startingNav: number;
  risk: string;
}

export const budgetScenario = {
  salary: 40000,

  categories: [
    {
      id: "needs",
      name: "Needs",
      description: "Essential monthly expenses",
    },
    {
      id: "food",
      name: "Food",
      description: "Food and groceries",
    },
    {
      id: "transport",
      name: "Transport",
      description: "Travel and transportation",
    },
    {
      id: "entertainment",
      name: "Entertainment",
      description: "Shopping, movies and leisure",
    },
    {
      id: "emergency",
      name: "Emergency Fund",
      description: "Money reserved for unexpected expenses",
    },
    {
      id: "savings",
      name: "Savings",
      description: "Short-term savings",
    },
    {
      id: "sip",
      name: "SIP",
      description: "Long-term investment contribution",
    },
  ] as BudgetCategory[],
};

export const mutualFundScenario = {
  startingVirtualMoney: 50000,

  funds: [
    {
      id: "equity_growth",
      name: "Equity Growth Fund",
      category: "Equity",
      startingNav: 100,
      risk: "High",
    },
    {
      id: "balanced_growth",
      name: "Balanced Growth Fund",
      category: "Hybrid",
      startingNav: 100,
      risk: "Moderate",
    },
    {
      id: "debt_stability",
      name: "Debt Stability Fund",
      category: "Debt",
      startingNav: 100,
      risk: "Lower",
    },
  ] as MutualFund[],
};