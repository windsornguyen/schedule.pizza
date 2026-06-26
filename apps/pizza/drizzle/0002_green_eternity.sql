PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking` (
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
	CONSTRAINT "booking_slot_order_check" CHECK("__new_booking"."slotEndAt" > "__new_booking"."slotStartAt"),
	CONSTRAINT "booking_status_check" CHECK("__new_booking"."status" in ('pending_calendar', 'confirmed', 'calendar_failed', 'cancelled')),
	CONSTRAINT "booking_source_check" CHECK("__new_booking"."source" in ('web', 'api'))
);
--> statement-breakpoint
INSERT INTO `__new_booking`("id", "hostId", "hostUsername", "bookingCodeId", "guestName", "guestEmail", "guestEmailNormalized", "guestTimezone", "slotStartAt", "slotEndAt", "status", "source", "calendarProvider", "calendarEventId", "cancelledAt", "createdAt", "updatedAt") SELECT "id", "hostId", "hostUsername", "bookingCodeId", "guestName", "guestEmail", "guestEmailNormalized", "guestTimezone", "slotStartAt", "slotEndAt", "status", "source", "calendarProvider", "calendarEventId", "cancelledAt", "createdAt", "updatedAt" FROM `booking`;--> statement-breakpoint
DROP TABLE `booking`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `booking_hostId_idx` ON `booking` (`hostId`);--> statement-breakpoint
CREATE INDEX `booking_hostUsername_idx` ON `booking` (`hostUsername`);--> statement-breakpoint
CREATE INDEX `booking_bookingCodeId_idx` ON `booking` (`bookingCodeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_confirmed_slot_unique` ON `booking` (`hostId`,`slotStartAt`,`slotEndAt`) WHERE "booking"."status" in ('pending_calendar', 'confirmed');