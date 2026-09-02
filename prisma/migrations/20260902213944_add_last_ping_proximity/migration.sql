-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastPingDistanceMeters" DOUBLE PRECISION,
ADD COLUMN     "lastPingInRange" BOOLEAN;
