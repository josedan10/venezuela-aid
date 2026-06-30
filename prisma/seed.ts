import { PrismaClient, DriverStatus, ResourceCategory, NeedStatus, DispatchStatus } from '@prisma/client';

enum Role {
  DONOR = 'DONOR',
  NGO = 'NGO',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean up existing data to ensure re-runnable seed
  await prisma.dispatchTask.deleteMany({});
  await prisma.needItem.deleteMany({});
  await prisma.need.deleteMany({});
  await prisma.stockTransaction.deleteMany({});
  await prisma.resource.deleteMany({});
  await prisma.collectionCenter.deleteMany({});
  await prisma.driverDetails.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Cleaned up existing database records.');

  // 2. Create Users
  // Admin
  await prisma.user.create({
    data: {
      email: 'admin@zentra-app.pro',
      firebaseId: 'seed-admin-uid',
      name: 'Administrador General',
      roles: 'ADMIN',
    },
  });

  // NGO
  const ngo = await prisma.user.create({
    data: {
      email: 'ong.caritas@gmail.com',
      firebaseId: 'seed-ngo-caritas-uid',
      name: 'Cáritas Venezuela',
      roles: 'NGO',
    },
  });

  const ngo2 = await prisma.user.create({
    data: {
      email: 'ong.cruzroja@gmail.com',
      firebaseId: 'seed-ngo-cruzroja-uid',
      name: 'Cruz Roja Venezolana',
      roles: 'NGO',
    },
  });

  // Donor
  const donor = await prisma.user.create({
    data: {
      email: 'donante.polar@empresa.com',
      firebaseId: 'seed-donor-polar-uid',
      name: 'Empresas Polar',
      roles: 'DONOR',
    },
  });

  // Verified Driver + Donor (Multiple Roles)
  const driverVerified = await prisma.user.create({
    data: {
      email: 'conductor.juan@gmail.com',
      firebaseId: 'seed-driver-juan-uid',
      name: 'Juan Pérez',
      roles: 'DRIVER,DONOR',
      alertRadiusKm: 20,
      driverDetails: {
        create: {
          cedula: 'V-12345678',
          vehicleDetails: 'Toyota Hilux 4x4, Color Blanco',
          licensePlate: 'ABC12D',
          licenseDocUrl: 'https://storage.googleapis.com/ve-aid-licenses/v12345678.pdf',
          status: DriverStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      },
    },
  });

  // Pending Driver
  await prisma.user.create({
    data: {
      email: 'conductor.maria@gmail.com',
      firebaseId: 'seed-driver-maria-uid',
      name: 'María Rodríguez',
      roles: 'DRIVER',
      driverDetails: {
        create: {
          cedula: 'V-87654321',
          vehicleDetails: 'Chevrolet Silverado, Color Gris',
          licensePlate: 'XYZ98W',
          licenseDocUrl: 'https://storage.googleapis.com/ve-aid-licenses/v87654321.pdf',
          status: DriverStatus.PENDING_APPROVAL,
        },
      },
    },
  });

  console.log('Users and Drivers created.');

  // 3. Create Collection Centers (collaboration points)
  const centerCatia = await prisma.collectionCenter.create({
    data: {
      name: 'Centro de Acopio Catia',
      description: 'Punto de acopio comunitario para medicinas y alimentos.',
      latitude: 10.5080,
      longitude: -66.9580,
      address: 'Distrito Capital, Catia',
      services: 'Comida,Medicina,Refugio',
      createdById: ngo.id,
    },
  });

  const centerPetare = await prisma.collectionCenter.create({
    data: {
      name: 'Centro de Acopio Petare',
      description: 'Almacén de ayuda humanitaria en zona este.',
      latitude: 10.4820,
      longitude: -66.8120,
      address: 'Miranda, Petare',
      services: 'Comida,Medicina',
      createdById: ngo2.id,
    },
  });

  console.log('Collection centers seeded.');

  // 4. Create Resources with origin locations
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);

  const insulina = await prisma.resource.create({
    data: {
      name: 'Insulina Humana 100 UI/ml',
      category: ResourceCategory.MEDICINES,
      stockQuantity: 150,
      expirationDate: futureDate,
      donorId: donor.id,
      latitude: 10.5080,
      longitude: -66.9580,
      collectionCenterId: centerCatia.id,
    },
  });

  const suero = await prisma.resource.create({
    data: {
      name: 'Suero Fisiológico 0.9%',
      category: ResourceCategory.MEDICINES,
      stockQuantity: 300,
      expirationDate: futureDate,
      donorId: donor.id,
      latitude: 10.5080,
      longitude: -66.9580,
      collectionCenterId: centerCatia.id,
    },
  });

  const harina = await prisma.resource.create({
    data: {
      name: 'Harina de Maíz Precocida 1kg',
      category: ResourceCategory.FOOD,
      stockQuantity: 1000,
      expirationDate: futureDate,
      donorId: donor.id,
      latitude: 10.4820,
      longitude: -66.8120,
      collectionCenterId: centerPetare.id,
    },
  });

  const arroz = await prisma.resource.create({
    data: {
      name: 'Arroz Blanco 1kg',
      category: ResourceCategory.FOOD,
      stockQuantity: 800,
      expirationDate: futureDate,
      donorId: donor.id,
      latitude: 10.4820,
      longitude: -66.8120,
      collectionCenterId: centerPetare.id,
    },
  });

  // Other categories (no expiration required)
  await prisma.resource.create({
    data: {
      name: 'Donantes de Sangre O Negativo',
      category: ResourceCategory.BLOOD_DONORS,
      stockQuantity: 15,
    },
  });

  await prisma.resource.create({
    data: {
      name: 'Voluntarios de Logística y Carga',
      category: ResourceCategory.HELPERS,
      stockQuantity: 50,
    },
  });

  await prisma.resource.create({
    data: {
      name: 'Generador Eléctrico 5kVA',
      category: ResourceCategory.MACHINES,
      stockQuantity: 5,
    },
  });

  await prisma.resource.create({
    data: {
      name: 'Equipo de Búsqueda y Rescate K9',
      category: ResourceCategory.RESCUE_TEAMS,
      stockQuantity: 3,
    },
  });

  console.log('Resources catalog seeded.');

  // 4. Create Stock Transactions for tracking
  await prisma.stockTransaction.createMany({
    data: [
      { resourceId: insulina.id, quantity: 150, description: 'Carga inicial - Donación Polar' },
      { resourceId: suero.id, quantity: 300, description: 'Carga inicial - Donación Cruz Roja' },
      { resourceId: harina.id, quantity: 1000, description: 'Carga inicial - Lote Donado' },
      { resourceId: arroz.id, quantity: 800, description: 'Carga inicial - Lote Donado' },
    ],
  });

  // 5. Create some initial Needs linked to collection centers
  const need1 = await prisma.need.create({
    data: {
      ngoId: ngo.id,
      description: 'Requerimos insulina urgente para pacientes con diabetes tipo 1.',
      urgencyScore: 95,
      isImmediate: true,
      state: 'Distrito Capital',
      sector: 'Catia - Hospital J.M. de los Ríos',
      latitude: 10.5111,
      longitude: -66.9036,
      collectionCenterId: centerCatia.id,
      originLatitude: centerCatia.latitude,
      originLongitude: centerCatia.longitude,
      originLabel: centerCatia.name,
      status: NeedStatus.PENDING,
      items: {
        create: [
          {
            resourceId: insulina.id,
            quantity: 50,
            matchedResourceId: insulina.id,
            pickupLatitude: centerCatia.latitude,
            pickupLongitude: centerCatia.longitude,
            pickupDistanceKm: 0.5,
            pickupLabel: centerCatia.name,
          },
        ],
      },
    },
  });

  await prisma.need.create({
    data: {
      ngoId: ngo2.id,
      description: 'Abastecimiento de alimentos básicos para comedor comunitario.',
      urgencyScore: 65,
      isImmediate: false,
      state: 'Miranda',
      sector: 'Petare',
      latitude: 10.4789,
      longitude: -66.8042,
      collectionCenterId: centerPetare.id,
      originLatitude: centerPetare.latitude,
      originLongitude: centerPetare.longitude,
      originLabel: centerPetare.name,
      status: NeedStatus.PENDING,
      items: {
        create: [
          {
            resourceId: harina.id,
            quantity: 200,
            matchedResourceId: harina.id,
            pickupLatitude: centerPetare.latitude,
            pickupLongitude: centerPetare.longitude,
            pickupDistanceKm: 0.3,
            pickupLabel: centerPetare.name,
          },
          {
            resourceId: arroz.id,
            quantity: 150,
            matchedResourceId: arroz.id,
            pickupLatitude: centerPetare.latitude,
            pickupLongitude: centerPetare.longitude,
            pickupDistanceKm: 0.3,
            pickupLabel: centerPetare.name,
          },
        ],
      },
    },
  });

  console.log('Initial Needs seeded.');

  // 6. Create an initial proposed DispatchTask
  const timeoutAt = new Date();
  timeoutAt.setSeconds(timeoutAt.getSeconds() + 60); // 60 seconds from now

  await prisma.dispatchTask.create({
    data: {
      needId: need1.id,
      driverId: driverVerified.id,
      status: DispatchStatus.PROPOSED,
      timeoutAt,
      pickupLatitude: centerCatia.latitude,
      pickupLongitude: centerCatia.longitude,
      pickupLabel: centerCatia.name,
    },
  });

  console.log('Initial Dispatch Task seeded.');
  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
