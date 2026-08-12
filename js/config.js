/* ==========================================
   DEFAULT_CONFIG
   ------------------------------------------
   This defines only the CATEGORY SCHEMA requested in the project spec
   (Responsible / Bonus / Investment groups). It contains no sample
   salary figures and no threshold amounts — every number here is 0
   ("no limit set") until the user configures it in the Config tab.

   INITIAL_TRANSACTIONS is intentionally an empty array. Nothing in
   this app ships with fake/demo transactions — the Transactions tab
   is 100% user-entered from a fresh install.
   ========================================== */

const DEFAULT_CONFIG = {
    categories: {
        Responsible: [
            { name: 'Rent', threshold: 0 },
            { name: 'Groceries', threshold: 0 },
            { name: 'Electricity', threshold: 0 },
            { name: 'Phone and Network', threshold: 0 },
            { name: 'Transport', threshold: 0 },
            { name: 'Gym', threshold: 0 },
            { name: 'Cook and Maid', threshold: 0 },
            { name: 'EMI', threshold: 0 },
            { name: 'Others', threshold: 0 }
        ],
        Bonus: [
            { name: 'Food Orders', threshold: 0 },
            { name: 'Travel (Trips)', threshold: 0 },
            { name: 'Shopping', threshold: 0 },
            { name: 'Electronics', threshold: 0 },
            { name: 'Entertainment', threshold: 0 },
            { name: 'Others', threshold: 0 }
        ],
        Investment: [
            { name: 'Mutual Funds', threshold: 0 },
            { name: 'Stocks', threshold: 0 },
            { name: 'Gold/Silver', threshold: 0 },
            { name: 'House/Land', threshold: 0 },
            { name: 'Emergency Fund', threshold: 0 },
            { name: 'Fixed Deposits', threshold: 0 },
            { name: 'Savings', threshold: 0 }
        ]
    },
    // No default salary rows. The user adds their own via
    // Config & Salary > "+ Add Month".
    salaries: []
};

// No demo/sample transactions ship with the app.
const INITIAL_TRANSACTIONS = [];
