-- CreateTable
CREATE TABLE `Item` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('MEDICINES', 'FOOD', 'BLOOD_DONORS', 'HELPERS', 'MACHINES', 'RESCUE_TEAMS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Item_name_category_key`(`name`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed items from existing resources
INSERT INTO `Item` (`id`, `name`, `category`, `createdAt`, `updatedAt`)
SELECT UUID(), `name`, `category`, NOW(3), NOW(3)
FROM `Resource`
GROUP BY `name`, `category`;

-- Add itemId to Resource
ALTER TABLE `Resource` ADD COLUMN `itemId` VARCHAR(191) NULL;

UPDATE `Resource` r
INNER JOIN `Item` i ON i.name = r.name AND i.category = r.category
SET r.itemId = i.id;

ALTER TABLE `Resource` MODIFY `itemId` VARCHAR(191) NOT NULL;

-- Add itemId to NeedItem, migrate from resourceId
ALTER TABLE `NeedItem` ADD COLUMN `itemId` VARCHAR(191) NULL;

UPDATE `NeedItem` ni
INNER JOIN `Resource` r ON ni.resourceId = r.id
SET ni.itemId = r.itemId;

UPDATE `NeedItem` ni
INNER JOIN `Resource` r ON ni.resourceId = r.id
INNER JOIN `Item` i ON i.name = r.name AND i.category = r.category
SET ni.itemId = i.id
WHERE ni.itemId IS NULL;

ALTER TABLE `NeedItem` MODIFY `itemId` VARCHAR(191) NOT NULL;

-- Drop old NeedItem.resourceId FK and column
ALTER TABLE `NeedItem` DROP FOREIGN KEY `NeedItem_resourceId_fkey`;
ALTER TABLE `NeedItem` DROP COLUMN `resourceId`;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `NeedItem` ADD CONSTRAINT `NeedItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
