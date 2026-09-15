-- CreateEnum
CREATE TYPE "MarkTier" AS ENUM ('MUST_SEE', 'INTERESTED');

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "note" VARCHAR(280),
ADD COLUMN     "tier" "MarkTier" DEFAULT 'MUST_SEE';
