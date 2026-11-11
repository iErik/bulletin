CREATE TABLE `habits` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`created` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "habits_name_not_blank" CHECK(trim("name") <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habits_name` ON `habits` (lower("name"));