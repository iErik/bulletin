CREATE TABLE `budget` (
	`month` text PRIMARY KEY,
	`amount` integer NOT NULL,
	CONSTRAINT "budget_month_not_null" CHECK("month" IS NOT NULL),
	CONSTRAINT "budget_amount_not_negative" CHECK("amount" >= 0)
);
