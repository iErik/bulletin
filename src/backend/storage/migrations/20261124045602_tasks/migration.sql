CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`day` text,
	`time` text,
	`done_at` integer,
	`created` integer NOT NULL,
	`moves` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tasks_title_not_blank" CHECK(trim("title") <> ''),
	CONSTRAINT "tasks_moves_not_negative" CHECK("moves" >= 0)
);
--> statement-breakpoint
CREATE INDEX `tasks_day` ON `tasks` (`day`);