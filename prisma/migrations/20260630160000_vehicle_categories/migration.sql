-- AlterTable
ALTER TABLE `DriverDetails` ADD COLUMN `vehicleCategory` ENUM('MOTO', 'SEDAN', 'PICKUP', 'SUV_4X4', 'VAN', 'TRUCK') NULL;
ALTER TABLE `DriverDetails` ADD COLUMN `seatCount` INT NULL;

UPDATE `DriverDetails`
SET `vehicleCategory` = 'SUV_4X4', `seatCount` = 5
WHERE LOWER(`vehicleDetails`) LIKE '%hilux%' OR LOWER(`vehicleDetails`) LIKE '%4x4%';

UPDATE `DriverDetails`
SET `vehicleCategory` = 'PICKUP', `seatCount` = 5
WHERE `vehicleCategory` IS NULL AND (
  LOWER(`vehicleDetails`) LIKE '%silverado%'
  OR LOWER(`vehicleDetails`) LIKE '%pickup%'
  OR LOWER(`vehicleDetails`) LIKE '%camioneta%'
);

UPDATE `DriverDetails`
SET `vehicleCategory` = 'MOTO', `seatCount` = 2
WHERE `vehicleCategory` IS NULL AND LOWER(`vehicleDetails`) LIKE '%moto%';

UPDATE `DriverDetails`
SET `vehicleCategory` = 'VAN', `seatCount` = 8
WHERE `vehicleCategory` IS NULL AND (
  LOWER(`vehicleDetails`) LIKE '%van%'
  OR LOWER(`vehicleDetails`) LIKE '%furgon%'
);

UPDATE `DriverDetails`
SET `vehicleCategory` = 'TRUCK', `seatCount` = 3
WHERE `vehicleCategory` IS NULL AND (
  LOWER(`vehicleDetails`) LIKE '%camión%'
  OR LOWER(`vehicleDetails`) LIKE '%camion%'
);

UPDATE `DriverDetails`
SET `vehicleCategory` = 'SEDAN', `seatCount` = 4
WHERE `vehicleCategory` IS NULL;

ALTER TABLE `DriverDetails` MODIFY `vehicleCategory` ENUM('MOTO', 'SEDAN', 'PICKUP', 'SUV_4X4', 'VAN', 'TRUCK') NOT NULL;
ALTER TABLE `DriverDetails` MODIFY `seatCount` INT NOT NULL;
