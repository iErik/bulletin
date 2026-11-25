CREATE TABLE `recurring_task_versions` (
	`rule_id` integer NOT NULL,
	`title` text NOT NULL,
	`time` text,
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
        AND "every" IS NULL AND "weekdays" IS NULL))
);
