CREATE TABLE `occurrences` (
	`rule_id` integer NOT NULL,
	`scheduled` text NOT NULL,
	`title` text,
	`time` text,
	`time_changed` integer DEFAULT 0 NOT NULL,
	`day` text,
	`done_at` integer,
	`moves` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `occurrences_pk` PRIMARY KEY(`rule_id`, `scheduled`),
	CONSTRAINT `fk_occurrences_rule_id_recurring_tasks_id_fk` FOREIGN KEY (`rule_id`) REFERENCES `recurring_tasks`(`id`) ON DELETE CASCADE,
	CONSTRAINT "occurrences_title_not_blank" CHECK("title" IS NULL OR trim("title") <> ''),
	CONSTRAINT "occurrences_moves_not_negative" CHECK("moves" >= 0),
	CONSTRAINT "occurrences_flags" CHECK("time_changed" IN (0, 1)
        AND "skipped" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `occurrences_day` ON `occurrences` (`day`);