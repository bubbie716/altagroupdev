-- Track when the applicant was last DM'd about Alta Credit Desk messages in this deal room.
ALTER TABLE "SecureDealRoomDiscordSession"
ADD COLUMN "lastStaffMessageDmAt" TIMESTAMP(3);
