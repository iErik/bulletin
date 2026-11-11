CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	CONSTRAINT "categories_name_not_blank" CHECK(trim("name") <> '')
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`category_id` integer NOT NULL,
	`amount` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name` ON `categories` (lower("name"));--> statement-breakpoint
CREATE INDEX `transactions_date` ON `transactions` (`date`);--> statement-breakpoint
-- Seed Categories, from the Expense Tracker's Figma mock.
INSERT INTO `categories` (`name`) VALUES
	('Payment'), ('Vice'), ('Cats'), ('Health'), ('Food'),
	('Entertainment'), ('Taxes'), ('Subscription'),
	('Equipment');
