CREATE TABLE `habit_goal` (
	`id` integer PRIMARY KEY,
	`percent` integer NOT NULL,
	CONSTRAINT "habit_goal_one_row" CHECK("id" = 1),
	CONSTRAINT "habit_goal_percent_range" CHECK("percent" BETWEEN 10 AND 100),
	CONSTRAINT "habit_goal_percent_step" CHECK("percent" % 5 = 0)
);
