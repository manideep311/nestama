-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "restockLevel" INTEGER;

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "demoResetAt" TIMESTAMP(3);

-- Existing variants start from their current stock, so the first reset doesn't move anything.
UPDATE "product_variants" SET "restockLevel" = "stock";
