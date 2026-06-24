CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `booking` (
	`id` text PRIMARY KEY NOT NULL,
	`hostId` text NOT NULL,
	`hostUsername` text NOT NULL,
	`bookingCodeId` text,
	`guestName` text NOT NULL,
	`guestEmail` text,
	`guestEmailNormalized` text,
	`guestTimezone` text,
	`slotStartAt` integer NOT NULL,
	`slotEndAt` integer NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`calendarProvider` text,
	`calendarEventId` text,
	`cancelledAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`hostId`) REFERENCES `host_profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookingCodeId`) REFERENCES `booking_code`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "booking_slot_order_check" CHECK("booking"."slotEndAt" > "booking"."slotStartAt"),
	CONSTRAINT "booking_status_check" CHECK("booking"."status" in ('confirmed', 'cancelled')),
	CONSTRAINT "booking_source_check" CHECK("booking"."source" in ('web', 'api'))
);
--> statement-breakpoint
CREATE INDEX `booking_hostId_idx` ON `booking` (`hostId`);--> statement-breakpoint
CREATE INDEX `booking_hostUsername_idx` ON `booking` (`hostUsername`);--> statement-breakpoint
CREATE INDEX `booking_bookingCodeId_idx` ON `booking` (`bookingCodeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_confirmed_slot_unique` ON `booking` (`hostId`,`slotStartAt`,`slotEndAt`) WHERE "booking"."status" = 'confirmed';--> statement-breakpoint
CREATE TABLE `booking_code` (
	`id` text PRIMARY KEY NOT NULL,
	`hostId` text NOT NULL,
	`hostUsername` text NOT NULL,
	`label` text,
	`codeHash` text NOT NULL,
	`codeHashVersion` integer DEFAULT 1 NOT NULL,
	`wordCount` integer DEFAULT 3 NOT NULL,
	`lastUsedAt` integer,
	`expiresAt` integer,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`hostId`) REFERENCES `host_profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `booking_code_hostId_idx` ON `booking_code` (`hostId`);--> statement-breakpoint
CREATE INDEX `booking_code_hostUsername_idx` ON `booking_code` (`hostUsername`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_code_hostId_codeHash_unique` ON `booking_code` (`hostId`,`codeHash`);--> statement-breakpoint
CREATE TABLE `booking_code_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`hostId` text,
	`ipHash` text NOT NULL,
	`success` integer NOT NULL,
	`failureReason` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`hostId`) REFERENCES `host_profile`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `booking_code_attempt_username_createdAt_idx` ON `booking_code_attempt` (`username`,`createdAt`);--> statement-breakpoint
CREATE INDEX `booking_code_attempt_ipHash_createdAt_idx` ON `booking_code_attempt` (`ipHash`,`createdAt`);--> statement-breakpoint
CREATE INDEX `booking_code_attempt_hostId_createdAt_idx` ON `booking_code_attempt` (`hostId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `host_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`authUserId` text NOT NULL,
	`username` text NOT NULL,
	`displayName` text NOT NULL,
	`timezone` text NOT NULL,
	`slotSizeMinutes` integer DEFAULT 30 NOT NULL,
	`calendarProvider` text,
	`calendarAccountEmail` text,
	`calendarId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`authUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `host_profile_authUserId_unique` ON `host_profile` (`authUserId`);--> statement-breakpoint
CREATE UNIQUE INDEX `host_profile_username_unique` ON `host_profile` (`username`);--> statement-breakpoint
CREATE TABLE `rateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`lastRequest` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rateLimit_key_unique` ON `rateLimit` (`key`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);