ALTER TABLE `occurrences` ADD `reminder_notified_at` integer;--> statement-breakpoint
ALTER TABLE `recurring_task_versions` ADD `reminder_minutes` integer;--> statement-breakpoint
ALTER TABLE `recurring_task_versions` ADD `reminder_days` integer;--> statement-breakpoint
ALTER TABLE `recurring_task_versions` ADD `reminder_time` text;--> statement-breakpoint
ALTER TABLE `recurring_tasks` ADD `reminder_minutes` integer;--> statement-breakpoint
ALTER TABLE `recurring_tasks` ADD `reminder_days` integer;--> statement-breakpoint
ALTER TABLE `recurring_tasks` ADD `reminder_time` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminder_minutes` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminder_days` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminder_time` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminder_notified_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recurring_task_versions` (
	`rule_id` integer NOT NULL,
	`title` text NOT NULL,
	`time` text,
	`reminder_minutes` integer,
	`reminder_days` integer,
	`reminder_time` text,
	`kind` text NOT NULL,
	`every` integer,
	`weekdays` integer,
	`month` integer,
	`month_day` integer,
	`first_day` text NOT NULL,
	`last_day` text NOT NULL,
	CONSTRAINT `recurring_task_versions_pk` PRIMARY KEY(`rule_id`, `last_day`),
	CONSTRAINT `fk_recurring_task_versions_rule_id_recurring_tasks_id_fk` FOREIGN KEY (`rule_id`) REFERENCES `recurring_tasks`(`id`) ON DELETE CASCADE,
	CONSTRAINT "recurring_task_versions_title_not_blank" CHECK(trim("title") <> ''),
	CONSTRAINT "recurring_task_versions_span" CHECK("last_day" >= "first_day"),
	CONSTRAINT "recurring_task_versions_schedule" CHECK(("kind" = 'days'
        AND "every" IS NOT NULL AND "every" >= 1
        AND "weekdays" IS NULL
        AND "month" IS NULL AND "month_day" IS NULL)
      OR ("kind" = 'weekly'
        AND "weekdays" IS NOT NULL
        AND "weekdays" BETWEEN 1 AND 127
        AND "every" IS NULL
        AND "month" IS NULL AND "month_day" IS NULL)
      OR ("kind" = 'monthly'
        AND "month_day" IS NOT NULL
        AND "month_day" BETWEEN 1 AND 31
        AND "every" IS NULL
        AND "weekdays" IS NULL AND "month" IS NULL)
      OR ("kind" = 'yearly'
        AND "month" IS NOT NULL
        AND "month" BETWEEN 1 AND 12
        AND "month_day" IS NOT NULL
        AND "month_day" BETWEEN 1 AND 31
        AND "every" IS NULL AND "weekdays" IS NULL)),
	CONSTRAINT "recurring_task_versions_reminder" CHECK(("reminder_minutes" IS NULL
    AND "reminder_days" IS NULL
    AND "reminder_time" IS NULL)
  OR ("reminder_minutes" IS NOT NULL
    AND "reminder_minutes" IN (0, 15, 30, 60)
    AND "reminder_days" IS NULL
    AND "reminder_time" IS NULL)
  OR ("reminder_minutes" IS NULL
    AND "reminder_days" IS NOT NULL
    AND "reminder_days" IN (1, 2)
    AND "reminder_time" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_recurring_task_versions`(`rule_id`, `title`, `time`, `kind`, `every`, `weekdays`, `month`, `month_day`, `first_day`, `last_day`) SELECT `rule_id`, `title`, `time`, `kind`, `every`, `weekdays`, `month`, `month_day`, `first_day`, `last_day` FROM `recurring_task_versions`;--> statement-breakpoint
DROP TABLE `recurring_task_versions`;--> statement-breakpoint
ALTER TABLE `__new_recurring_task_versions` RENAME TO `recurring_task_versions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recurring_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`time` text,
	`reminder_minutes` integer,
	`reminder_days` integer,
	`reminder_time` text,
	`kind` text NOT NULL,
	`every` integer,
	`weekdays` integer,
	`month` integer,
	`month_day` integer,
	`first_day` text NOT NULL,
	`last_day` text,
	`created` integer NOT NULL,
	CONSTRAINT "recurring_tasks_title_not_blank" CHECK(trim("title") <> ''),
	CONSTRAINT "recurring_tasks_schedule" CHECK(("kind" = 'days'
        AND "every" IS NOT NULL AND "every" >= 1
        AND "weekdays" IS NULL
        AND "month" IS NULL AND "month_day" IS NULL)
      OR ("kind" = 'weekly'
        AND "weekdays" IS NOT NULL
        AND "weekdays" BETWEEN 1 AND 127
        AND "every" IS NULL
        AND "month" IS NULL AND "month_day" IS NULL)
      OR ("kind" = 'monthly'
        AND "month_day" IS NOT NULL
        AND "month_day" BETWEEN 1 AND 31
        AND "every" IS NULL
        AND "weekdays" IS NULL AND "month" IS NULL)
      OR ("kind" = 'yearly'
        AND "month" IS NOT NULL
        AND "month" BETWEEN 1 AND 12
        AND "month_day" IS NOT NULL
        AND "month_day" BETWEEN 1 AND 31
        AND "every" IS NULL AND "weekdays" IS NULL)),
	CONSTRAINT "recurring_tasks_reminder" CHECK(("reminder_minutes" IS NULL
    AND "reminder_days" IS NULL
    AND "reminder_time" IS NULL)
  OR ("reminder_minutes" IS NOT NULL
    AND "reminder_minutes" IN (0, 15, 30, 60)
    AND "reminder_days" IS NULL
    AND "reminder_time" IS NULL)
  OR ("reminder_minutes" IS NULL
    AND "reminder_days" IS NOT NULL
    AND "reminder_days" IN (1, 2)
    AND "reminder_time" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_recurring_tasks`(`id`, `title`, `time`, `kind`, `every`, `weekdays`, `month`, `month_day`, `first_day`, `last_day`, `created`) SELECT `id`, `title`, `time`, `kind`, `every`, `weekdays`, `month`, `month_day`, `first_day`, `last_day`, `created` FROM `recurring_tasks`;--> statement-breakpoint
DROP TABLE `recurring_tasks`;--> statement-breakpoint
ALTER TABLE `__new_recurring_tasks` RENAME TO `recurring_tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`day` text,
	`time` text,
	`reminder_minutes` integer,
	`reminder_days` integer,
	`reminder_time` text,
	`reminder_notified_at` integer,
	`done_at` integer,
	`created` integer NOT NULL,
	`moves` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tasks_title_not_blank" CHECK(trim("title") <> ''),
	CONSTRAINT "tasks_moves_not_negative" CHECK("moves" >= 0),
	CONSTRAINT "tasks_reminder" CHECK(("reminder_minutes" IS NULL
    AND "reminder_days" IS NULL
    AND "reminder_time" IS NULL)
  OR ("reminder_minutes" IS NOT NULL
    AND "reminder_minutes" IN (0, 15, 30, 60)
    AND "reminder_days" IS NULL
    AND "reminder_time" IS NULL)
  OR ("reminder_minutes" IS NULL
    AND "reminder_days" IS NOT NULL
    AND "reminder_days" IN (1, 2)
    AND "reminder_time" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_tasks`(`id`, `title`, `day`, `time`, `done_at`, `created`, `moves`) SELECT `id`, `title`, `day`, `time`, `done_at`, `created`, `moves` FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tasks_day` ON `tasks` (`day`);