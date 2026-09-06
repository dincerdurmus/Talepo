/** Human-written requests and independent expectations; no category pins. */
export type CategoryScenario = {
  id: string;
  categoryId: string;
  text: string;
  requiredQuestions: string[];
  forbiddenQuestions: string[];
};

function cases(categoryId: string, rows: string): CategoryScenario[] {
  return rows.trim().split("\n").map((row, index) => {
    const [text, required = "", forbidden = ""] = row.trim().split("|");
    return {
      id: `${categoryId}-${index + 1}`,
      categoryId,
      text,
      requiredQuestions: required.split(",").filter(Boolean),
      forbiddenQuestions: forbidden.split(",").filter(Boolean),
    };
  });
}

export const categoryScenarios: CategoryScenario[] = [
  ...cases("real-estate", `
Kiralık daire arıyorum|roomCount,area,floor,buildingAge|condition,deedStatus,transferScope
Satılık müstakil ev arıyorum|roomCount,area,totalFloors,buildingAge|condition,cooperativeStage
Satılık arsa arıyorum|area,deedStatus|roomCount,floor,buildingAge
Kiralık iş yeri arıyorum|area|condition,roomCount
Kiralık ofis arıyorum|area,floor,parking|officeChairMechanism,roomCount
Kiralık dükkan arıyorum|area,storefrontNeed|roomCount,lodgingPermit
Kiralık depo arıyorum|area,loadingAccess,ceilingHeight|roomCount,buildingAge
Satılık fabrika arıyorum|area,industrialPower,ceilingHeight|roomCount,storefrontNeed
Satılık otel arıyorum|roomCount,lodgingPermit|officeChairMechanism
Devren işyeri arıyorum|businessActivity,transferScope,businessPermitStatus|roomCount,buildingAge
Satılık müştemilat arıyorum|outbuildingUsage,area,independentAccess|cooperativeStage
Kooperatif hissesi arıyorum|cooperativePurpose,cooperativeStage,cooperativeShareCount|roomCount,floor
Satılık turistik tesis arıyorum|tourismFacilityType,lodgingPermit,tourismOperationStatus|condition
Devre mülk arıyorum|timeshareFacilityType,timesharePeriod,timeshareSeason|roomCount,condition
`),
  ...cases("technology", `
Televizyon arıyorum|screenSize,resolution,panelType,refreshRate|processor,ram
Dizüstü bilgisayar arıyorum|usagePurpose,processor,ram,storage|panelType,mobileNetwork
Masaüstü bilgisayar arıyorum|processor,ram,storage,graphics|tabletAccessory,mobileNetwork
Cep telefonu arıyorum|storageCapacity,mobileNetwork,cameraPriority|processor,tabletAccessory
Tablet arıyorum|storageCapacity,tabletConnectivity,tabletAccessory|mobileNetwork,graphics
Kurumsal web sitesi yaptırmak istiyorum||fridgeCapacity,carSeatGroup
Stok takip yazılımı yaptırmak istiyorum||screenSize,panelType
Sunucu arıyorum||roomCount,fridgeType
`),
  ...cases("appliances", `
Buzdolabı arıyorum|fridgeType,fridgeCapacity,fridgeCoolingSystem,energyClass|capacityKg,capacityBtu
Çamaşır makinesi arıyorum|capacityKg,washerDryFeature,washerLoadType,spinSpeed|fridgeType,capacityBtu
Klima arıyorum|airConditionerType,capacityBtu,climateRoomSize,inverterPreference|fridgeType,capacityKg
Bulaşık makinesi arıyorum||fridgeType,washerLoadType
Elektrikli süpürge arıyorum||fridgeType,capacityBtu
Kahve makinesi arıyorum||carSeatGroup,roomCount
Kurutma makinesi arıyorum||fridgeType,panelType
`),
  ...cases("furniture", `
Makam odası takımı arıyorum|executiveDeskConfiguration,cableManagement|bedSize,diningSeats
Toplantı masası arıyorum|meetingCapacity,meetingTableShape|bedSize,officeChairMechanism
Ofis sandalyesi arıyorum|officeChairMechanism,officeChairErgonomics|bedSize,diningSeats
Köşe koltuk arıyorum||meetingCapacity,officeChairMechanism
Yatak odası takımı arıyorum||officeChairMechanism,meetingCapacity
Gardırop arıyorum||officeChairMechanism
Yemek masası arıyorum||bedSize,officeChairMechanism
Kafe için masa sandalye takımı arıyorum||bedSize
`),
  ...cases("printing", `
Ürünlerim için karton kutu bastırmak istiyorum|boxDimensions,boxMaterial,boxPrintCoverage,boxDieLine|labelAdhesive,publicationPageCount
Rulo etiket bastırmak istiyorum|labelDimensions,labelMaterial,labelAdhesive,labelFormat|publicationPageCount,boxDieLine
Katalog bastırmak istiyorum|publicationFormat,publicationPageCount,publicationBinding|labelAdhesive
Broşür bastırmak istiyorum|flatPrintFormat,flatPrintSides,flatPrintPaperWeight,flatPrintFold|publicationBinding
Kartvizit bastırmak istiyorum|cardFormat,cardStock,cardFinish|publicationPageCount
Tişört baskı yaptırmak istiyorum|promoTextilePrintMethod,promoTextileSizing,promoTextilePlacement|labelAdhesive
Kalem baskı yaptırmak istiyorum|promoObjectPrintMethod,promoObjectBrandingArea,promoObjectPackaging|promoTextileSizing
Roll-up bastırmak istiyorum|largeFormatDimensions,largeFormatPlacement,largeFormatInstall|publicationPageCount
Kaşe yaptırmak istiyorum|customPrintSpecs,customPrintMaterial|publicationBinding,promoTextileSizing
`),
  ...cases("machinery", `
CNC tezgahı için yedek parça arıyorum|partPreference|pressCapacity,machiningPrecision
Jeneratör arıyorum|generatorFuel|tractorPowerClass,pressCapacity
Mini ekskavatör arıyorum|excavatorWeightClass,miniExcavatorDigDepth,miniExcavatorCabin|fullExcavatorWeightClass
Ekskavatör arıyorum|fullExcavatorWeightClass,excavatorUndercarriage,fullExcavatorDigDepth|miniExcavatorCabin
Yükleyici arıyorum|loaderCapacity,loaderAttachment,loaderMachineType|miniExcavatorCabin
Beton santrali arıyorum|concretePlantType,concretePlantCapacity|pressCapacity
Beton pompası arıyorum|concretePumpType,concretePumpReach|concretePlantCapacity
Kule vinç arıyorum|towerCraneCapacity,towerCraneJibLength,towerCraneMounting|mobileCraneSiteAccess
Mobil vinç arıyorum|mobileCraneCapacity,mobileCraneReach,mobileCraneSiteAccess|towerCraneMounting
Yol silindiri arıyorum|compactorType,compactorWeightClass|pressCapacity
Ağaç yonga makinesi arıyorum|woodChipperFeedDiameter,woodChipperDriveType|tractorPowerClass
Arazi ölçüm cihazı arıyorum|surveyEquipmentType,surveyAccuracyLevel,surveyCorrectionSource|roomCount
Traktör arıyorum|tractorPowerClass,tractorDriveType,tractorCabinType|balerForm
Balya makinesi arıyorum|balerForm,balerCropType|tractorCabinType
Mibzer arıyorum|seederMethod,seederWorkingWidth|plowType
Pulluk arıyorum|plowType,plowFurrowCount|seederMethod
Süt sağım makinesi arıyorum|milkingSystemType,milkingUnitCount|feedMixerCapacity
Yem karma makinesi arıyorum|feedMixerType,feedMixerCapacity|milkingUnitCount
Paketleme makinesi arıyorum|packagingProcess,packagingFormat,packagingThroughput|machiningPrecision
Lazer kesim makinesi arıyorum|cuttingTechnology,cuttingMaterial,cuttingThickness|pressCapacity
CNC freze arıyorum|machiningControl,dimensions,machiningPrecision|pressCapacity
Hidrolik pres arıyorum|formingMachineType,pressCapacity,formingControl|cuttingThickness
Plastik enjeksiyon makinesi arıyorum|plasticProcess,plasticThroughput,plasticMaterial|weldingPower
TIG kaynak makinesi arıyorum|weldingProcess,weldingPower,weldingAutomation|plasticThroughput
Vidalı kompresör arıyorum|fluidMachineType,fluidCapacity,fluidOperation|liftCapacity
Elektrikli forklift arıyorum|liftCapacity,liftingPowerDrive,liftingOperation|generatorFuel
`),
  ...cases("baby", `
Bebek arabası arıyorum|strollerType,strollerUseCase,strollerFoldPreference|carSeatGroup,feedingBottleCapacity
Bebek için oto koltuğu arıyorum|carSeatGroup,carSeatMount,carSeatDirection|strollerFoldPreference
Kanguru aksesuarı arıyorum|carrierAccessoryType,carrierAccessoryCompatibility|carrierCarryPosition
Bebek kangurusu arıyorum|carrierAgeWeightRange,carrierCarryPosition,carrierErgonomicSupport|strollerType
Portbebe arıyorum|carrycotUseCase,carrycotCompatibility,carrycotFeature|carSeatMount
Bebek arabası aksesuarı arıyorum|strollerAccessoryType,strollerAccessoryCompatibility|strollerType
Oto koltuğu aksesuarı arıyorum|carSeatAccessoryType,carSeatAccessoryCompatibility|carSeatGroup
Bebek alt açma örtüsü arıyorum|diaperCareProduct,diaperCareMaterial|babyBathStage
Bebek bezi çöp kovası arıyorum|diaperDisposalProduct,diaperDisposalCapacity|feedingBottleMaterial
Bebek için ıslak mendil arıyorum|skinCareProduct,skinCareSensitivity,skinCarePackSize|babyBathStage
Bebek banyo küveti arıyorum|babyBathProduct,babyBathStage,babyBathFeature|feedingBottleCapacity
Bebek sağlık bakım ürünü arıyorum|babyHealthProduct,babyHealthOperation|babyBathStage
Emzik aksesuarı arıyorum|pacifierAccessoryProduct,pacifierAccessoryMaterial|feedingBottleCapacity
Bebek lazımlığı arıyorum|toiletTrainingProduct,toiletTrainingStage|babyBathStage
Bebek güvenlik ürünü arıyorum|safetyProtectionTarget,safetyInstallation|toyPlayTheme
Bebek oyun ve gezi ürünü arıyorum|playTravelAgeStage,playTravelUseSetting|safetyInstallation
Bebek oyuncağı arıyorum|toyAgeStage,toyPlayTheme|carSeatGroup
Diğer bebek ürünü arıyorum|otherBabyProduct,otherBabyUseStage|strollerType
Beşik arıyorum|sleepSetupType,dimensions,sleepSafetyFeature|feedingBottleCapacity
Mama sandalyesi arıyorum|highChairUseStage,highChairHarness,highChairAdjustability|feedingDeviceCapacity
Biberon arıyorum|feedingBottleCapacity,feedingBottleMaterial,feedingBottleFeature|feedingNippleStage
Biberon ucu arıyorum|feedingNippleStage,feedingNippleMaterial|feedingBottleCapacity
Bebek biberon sterilizatörü arıyorum|feedingDeviceType,feedingDeviceCapacity|feedingBottleMaterial
Göğüs pompası arıyorum|breastPumpOperation,breastPumpConfiguration|feedingDeviceCapacity
Anne sütü saklama poşeti arıyorum|maternalFeedingItem,maternalFeedingMaterial,maternalFeedingPackSize|breastPumpOperation
Bebek gıdası arıyorum|babyFoodType,babyFoodPackageSize,babyFoodPreference|feedingBottleMaterial
Bebek uyku tulumu arıyorum|sleepBagTog,sleepBagClosure|sleepTextileSize
Bebek battaniyesi arıyorum|sleepTextileType,sleepTextileMaterial,sleepTextileSize|sleepBagTog
Bebek odası mobilya seti arıyorum|babyRoomSetContents,dimensions,babyRoomMaterial|sleepBagTog
Bebek yatak koruyucu arıyorum|sleepSupportType,sleepSupportMaterial|babyRoomSetContents
`),
  ...cases("home-kitchen", `
Yemek takımı arıyorum|serviceCount,pieceCount,material|cooktopCompatibility
Kayık tabak arıyorum|pieceCount,material,dishwasherSafe|cooktopCompatibility
Tencere takımı arıyorum|cookwareSetType,material,cooktopCompatibility,cookwareSize|serviceCount
Kahve fincan takımı arıyorum|serviceCount,drinkwareSetContents|brewCapacity
French press arıyorum|brewCapacity,filterPreference|cooktopCompatibility
Termos arıyorum|drinkwareVolume,insulationPreference|serviceCount
Çatal bıçak takımı arıyorum|cutleryServiceCount,cutleryFinish|glasswareCapacity
Bardak seti arıyorum|serviceCount,glasswareCapacity|cutleryFinish
Fırın kabı arıyorum|bakewareCapacity,ovenSafe|fridgeCapacity
Saklama kabı arıyorum|storageCapacity,storageSeal|kitchenLayout
Mutfak gereçleri arıyorum|kitchenToolPurpose,kitchenToolMaterial|fridgeType
Prefabrike mutfak arıyorum|kitchenLayout,cabinetMaterial|cooktopCompatibility
Eviye arıyorum|sinkMountType,fixtureMaterial|cooktopCompatibility
Mutfak bataryası arıyorum|faucetType,fixtureFinish|processor,ram
Klozet arıyorum|bathroomFixtureType,installation|fridgeType
Sunum tabağı arıyorum|pieceCount,material|cutleryFinish
Duvar kağıdı arıyorum|coverageArea,decorStyle|careProductPurpose
Kilim arıyorum|homeTextileMaterial,decorStyle|cooktopCompatibility
Vazo arıyorum|decorStyle,displayLocation|storageSeal
Bahçe hortumu arıyorum|outdoorUse,weatherResistance|roomCount
Ev temizlik malzemeleri arıyorum|careProductPurpose,packageSize,scentPreference|homeCleaningSize
Ev düzenleme ürünü arıyorum|organizationPurpose,protectionSurface|cooktopCompatibility
`),
  ...cases("health", `
Hasta monitörü arıyorum|medicalDeviceSetting,medicalDeviceCondition,medicalDeviceSpec|clinicalDimensions
Muayene masası arıyorum|clinicalEquipmentMode,clinicalDimensions,clinicalAccessories|labCalibration
Diş üniti arıyorum|labUseCase,labDeviceSpec,labCalibration|supportProductFit
Tekerlekli sandalye arıyorum|supportProductUsage,supportProductFit,supportProductCondition|labCalibration
`),
  ...cases("services", `
Yaşlı annem için evde bakım desteği arıyorum|homeCareSupportScope,homeCareSchedule,homeCareDuration,homeCareStart|homeHelperScope
Boş ev temizliği yaptırmak istiyorum|emptyHomeSize,emptyHomeCondition,emptyHomeSupplies|homeCleaningFrequency
Boya badana yaptırmak istiyorum|paintArea,paintPrep,paintSupply|tileRemoval
Cam balkon yaptırmak istiyorum|balconySize,balconySystem,balconyGlass|roomCount
Kombi servisi arıyorum|boilerBrand,boilerServiceNeed,boilerIssue,boilerUrgency|airConditionerType
Klima servisi arıyorum|airConditionerBrand,airConditionerNeed,airConditionerIssue|boilerBrand
Direksiyon dersi almak istiyorum|drivingLicenseClass,drivingLevel,drivingSchedule|modelYear
Duvar dekorasyon yaptırmak istiyorum|wallDecorArea,wallDecorType,wallDecorPrep|tileRemoval
Elektrikçi arıyorum|electricalWork,electricalPlace,electricalUrgency|boilerBrand
Parça eşya taşıma hizmeti arıyorum|partialMoveItems,partialMoveFloors,partialMoveDate|movingPacking
Ev dekorasyon yaptırmak istiyorum|homeDecorScope,homeDecorArea,homeDecorDelivery|roomCount
Ev temizliği yaptırmak istiyorum|homeCleaningSize,homeCleaningFrequency,homeCleaningSupplies|emptyHomeCondition
Evden eve nakliyat istiyorum|movingHomeSize,movingFloors,movingPacking,movingDate|partialMoveItems
Fayans döşeme ustası arıyorum|tileArea,tileSpace,tileRemoval,tileSupply|paintPrep
Halı yıkama hizmeti arıyorum|carpetLoad,carpetPickup,carpetIssue|upholsterySeatCount
Koltuk yıkama yaptırmak istiyorum|upholsterySeatCount,upholsteryOnSite,upholsteryIssue|carpetLoad
İç mimar arıyorum|interiorDesignScope,interiorDesignArea,interiorDesignDelivery|roomCount
`),
];
