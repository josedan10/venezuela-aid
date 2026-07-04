-- AlterTable
ALTER TABLE `User`
  ADD COLUMN `teamRole` ENUM('MANAGER', 'COLLABORATOR') NOT NULL DEFAULT 'COLLABORATOR';

ALTER TABLE `Team`
  ADD COLUMN `deliveryPolicy` ENUM('TEAM_ONLY', 'TEAM_AND_APPROVED_EXTERNAL') NOT NULL DEFAULT 'TEAM_ONLY';

-- CreateTable
CREATE TABLE `TeamDriverAccess` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeamDriverAccess_teamId_driverId_key`(`teamId`, `driverId`),
    INDEX `TeamDriverAccess_teamId_idx`(`teamId`),
    INDEX `TeamDriverAccess_driverId_idx`(`driverId`),
    INDEX `TeamDriverAccess_approvedById_idx`(`approvedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeamDriverAccess` ADD CONSTRAINT `TeamDriverAccess_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamDriverAccess` ADD CONSTRAINT `TeamDriverAccess_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamDriverAccess` ADD CONSTRAINT `TeamDriverAccess_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
