-- AlterTable
ALTER TABLE `User` ADD COLUMN `alertRadiusKm` INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE `Resource` ADD COLUMN `donorId` VARCHAR(191) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `collectionCenterId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Need` ADD COLUMN `collectionCenterId` VARCHAR(191) NULL,
    ADD COLUMN `originLatitude` DOUBLE NULL,
    ADD COLUMN `originLongitude` DOUBLE NULL,
    ADD COLUMN `originLabel` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `NeedItem` ADD COLUMN `matchedResourceId` VARCHAR(191) NULL,
    ADD COLUMN `pickupLatitude` DOUBLE NULL,
    ADD COLUMN `pickupLongitude` DOUBLE NULL,
    ADD COLUMN `pickupDistanceKm` DOUBLE NULL,
    ADD COLUMN `pickupLabel` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DispatchTask` ADD COLUMN `pickupLatitude` DOUBLE NULL,
    ADD COLUMN `pickupLongitude` DOUBLE NULL,
    ADD COLUMN `pickupLabel` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_collectionCenterId_fkey` FOREIGN KEY (`collectionCenterId`) REFERENCES `CollectionCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Need` ADD CONSTRAINT `Need_collectionCenterId_fkey` FOREIGN KEY (`collectionCenterId`) REFERENCES `CollectionCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NeedItem` ADD CONSTRAINT `NeedItem_matchedResourceId_fkey` FOREIGN KEY (`matchedResourceId`) REFERENCES `Resource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
