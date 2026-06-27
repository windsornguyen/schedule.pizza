import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateExistingProfile } from "@/dashboard/profile_update.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const mocks = vi.hoisted(() => ({
  findHostProfileByAuthUserId: vi.fn<AsyncMock>(),
  findHostProfileByUsername: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
  updateHostProfile: vi.fn<AsyncMock>(),
}));

vi.mock("@/calendar/google.server", () => ({
  readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
}));

vi.mock("@/db/functions/host_profiles.server", () => ({
  findHostProfileByAuthUserId: mocks.findHostProfileByAuthUserId,
  findHostProfileByUsername: mocks.findHostProfileByUsername,
  updateHostProfile: mocks.updateHostProfile,
}));

const db = {} as Parameters<typeof updateExistingProfile>[0];
const env = {
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
} as Parameters<typeof updateExistingProfile>[1]["env"];

describe("updateExistingProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findHostProfileByAuthUserId.mockResolvedValue({
      authUserId: "auth_user_1",
      calendarId: "primary",
      id: "host_1",
      username: "alice",
    });
    mocks.readGoogleCalendarAccess.mockResolvedValue({
      code: "authorized",
      accessToken: "google_access_token",
    });
    mocks.updateHostProfile.mockResolvedValue({
      code: "updated_profile",
      bookingCode: null,
    });
  });

  it("updates the existing profile through the atomic profile writer", async () => {
    await expect(updateExistingProfile(db, {
      authUserId: "auth_user_1",
      email: "alice@example.com",
      env,
      formData: profileFormData(),
    })).resolves.toEqual({ code: "updated_profile" });

    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
    expect(mocks.readGoogleCalendarAccess).toHaveBeenCalledTimes(2);
    expect(mocks.updateHostProfile).toHaveBeenCalledWith(env.DB, {
      authUserId: "auth_user_1",
      calendarAccountEmail: "alice@example.com",
      calendarId: "primary",
      calendarProvider: "google",
      currentHostId: "host_1",
      currentUsername: "alice",
      displayName: "alice",
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
      now: expect.any(Date) as Date,
    });
  });

  it("rotates and returns a fresh booking code when the username changes", async () => {
    mocks.updateHostProfile.mockResolvedValueOnce({
      code: "updated_profile",
      bookingCode: "sun-river-ten",
    });

    await expect(updateExistingProfile(db, {
      authUserId: "auth_user_1",
      email: "alice@example.com",
      env,
      formData: profileFormData("Alice-New"),
    })).resolves.toEqual({
      code: "updated_profile",
      bookingCode: "sun-river-ten",
      username: "alice-new",
    });

    expect(mocks.updateHostProfile).toHaveBeenCalledWith(env.DB, {
      authUserId: "auth_user_1",
      calendarAccountEmail: "alice@example.com",
      calendarId: "primary",
      calendarProvider: "google",
      currentHostId: "host_1",
      currentUsername: "alice",
      displayName: "alice-new",
      username: "alice-new",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
      now: expect.any(Date) as Date,
    });
    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
  });

  it("does not use preflight username ownership as a write authority", async () => {
    mocks.findHostProfileByUsername.mockResolvedValueOnce({
      authUserId: "auth_user_2",
      username: "alice",
    });

    await expect(updateExistingProfile(db, {
      authUserId: "auth_user_1",
      email: "alice@example.com",
      env,
      formData: profileFormData(),
    })).resolves.toEqual({ code: "updated_profile" });

    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
    expect(mocks.updateHostProfile).toHaveBeenCalled();
  });

  it("reports atomic rename conflicts as username taken", async () => {
    mocks.updateHostProfile.mockResolvedValueOnce({
      code: "profile_conflict",
    });

    await expect(updateExistingProfile(db, {
      authUserId: "auth_user_1",
      email: "alice@example.com",
      env,
      formData: profileFormData("Alice-New"),
    })).resolves.toEqual({ code: "username_taken" });
    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
  });

  it("requires an authenticated account email before writing the profile", async () => {
    await expect(updateExistingProfile(db, {
      authUserId: "auth_user_1",
      email: null,
      env,
      formData: profileFormData(),
    })).resolves.toEqual({ code: "auth_user_email_missing" });

    expect(mocks.updateHostProfile).not.toHaveBeenCalled();
  });
});

function profileFormData(username = "Alice") {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("timezone", "America/Los_Angeles");
  formData.set("slotSizeMinutes", "30");

  return formData;
}
