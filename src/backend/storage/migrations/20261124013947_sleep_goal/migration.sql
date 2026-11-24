CREATE TABLE `sleep_goal` (
	`id` integer PRIMARY KEY,
	`minutes` integer NOT NULL,
	CONSTRAINT "sleep_goal_one_row" CHECK("id" = 1),
	CONSTRAINT "sleep_goal_minutes_range" CHECK("minutes" BETWEEN 240 AND 720)
);
