/**
 * CATEGORY COVERAGE EVAL V1 — 108 senaryoluk kalıcı ölçüm tabanı.
 *
 * Kaynak: 2026-08-25 bağımsız kapsam denetimi (11 kategori, gerçek engine
 * çıktısından ölçüldü). Taban çizgisi: 76 PASS / 32 KNOWN_FAIL / 0 FAIL.
 *
 * SELF-FULFILLING YASAĞI: Bu dosyadaki beklenen değerler HİÇBİR ZAMAN
 * engine'e girdi olarak verilmez. Engine yalnız `input` metnini görür;
 * doğrulayıcı bunu dondurulmuş { rawInput } nesnesi ve kanarya senaryosuyla
 * kanıtlar (bkz. verify-category-coverage-v1.ts).
 *
 * KNOWN_FAIL kayıtları GERÇEK, ölçülmüş hatalardır; kök nedene bağlıdır ve
 * PASS sayısına girmez. Bir hata düzelirse doğrulayıcı XPASS ile kırmızıya
 * düşer ve bu dosyadan knownIssue bloğunun kaldırılmasını ister — düzelme
 * sessizce yeşile boyanamaz, bozulma sessizce known sayılamaz.
 */

export type CoverageSignature = {
  brandEquals?: string;
  kindEquals?: string;
  partEquals?: string;
  stateCategoryEquals?: string | null;
  understandingCategoryEquals?: string;
  missingSurfaceTerm?: string;
  snapshotAttrIncludes?: string;
  partFieldEmpty?: boolean;
};

export type CoverageExpectation = {
  /** understanding.category YA DA state.categoryId bunlardan biri olmalı ("null" = çözülmemiş kabul). */
  allowedCategories?: string[];
  /** state.categoryId bu listede olmalı (split denetimi için). */
  requireStateCategory?: string[];
  /** understanding.category bu listede olmalı (split denetimi için). */
  requireUnderstandingCategory?: string[];
  allowedKinds?: string[];
  forbiddenKinds?: string[];
  requiredBrand?: string;
  forbiddenBrands?: string[];
  requireBrandAbsent?: boolean;
  requiredModel?: string;
  requiredPart?: string;
  forbiddenPartValues?: string[];
  /** Katlanmış metin VEYA başlıkta geçmeli. */
  requiredSurfaceTerms?: string[];
  forbiddenSurfaceTerms?: string[];
  requiredQuestionKeys?: string[];
  forbiddenQuestionKeys?: string[];
  forbidAnyQuestions?: boolean;
  requiredResolvedEntities?: Array<{ entityType: string; canonicalId?: string }>;
  forbiddenSnapshotAttrs?: string[];
};

export type CoverageRootCause =
  | "RC_RENT"
  | "RC_BRAND"
  | "RC_SPLIT"
  | "RC_NUMBER"
  | "RC_COMPOSER"
  | "RC_DURABLE"
  | "CATEGORY_SPECIFIC";

export type CoverageScenario = {
  id: string;
  categoryGroup: string;
  family: string;
  input: string;
  adversarial: boolean;
  expected: CoverageExpectation;
  knownIssue?: {
    rootCause: CoverageRootCause;
    expectedVerdict: "KNOWN_FAIL";
    explanation: string;
    signature: CoverageSignature;
  };
  notMeasured: string[];
};

/** Taban çizgisi — doğrulayıcı bu sayılardan sapmayı kırmızı sayar. */
export const COVERAGE_BASELINE = {
  total: 108,
  pass: 76,
  knownFail: 32,
  fail: 0,
  adversarialMin: 33,
} as const;

export const CATEGORY_COVERAGE_V1: readonly CoverageScenario[] = [
  {
    "id": "re-01",
    "categoryGroup": "real-estate",
    "family": "satilik-konut",
    "input": "Ankara Çankaya'da satılık 3+1 daire arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-02",
    "categoryGroup": "real-estate",
    "family": "kiralik-konut",
    "input": "Kadıköy'de kiralık 2+1 daire arıyorum, bütçem aylık 25 bin TL",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-03",
    "categoryGroup": "real-estate",
    "family": "arsa",
    "input": "İzmir'de satılık arsa arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-04",
    "categoryGroup": "real-estate",
    "family": "ticari",
    "input": "Kiralık dükkan arıyorum Bursa'da",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-05",
    "categoryGroup": "real-estate",
    "family": "gunluk",
    "input": "Günlük kiralık daire arıyorum Antalya'da",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-06",
    "categoryGroup": "real-estate",
    "family": "kisa",
    "input": "Ev arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "requiredQuestionKeys": [
        "listingType"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-07",
    "categoryGroup": "real-estate",
    "family": "ticari",
    "input": "Satılık ofis arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-08",
    "categoryGroup": "real-estate",
    "family": "satilik-konut",
    "input": "3+1 ev arıyorum kiracılı olmasın",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-09",
    "categoryGroup": "real-estate",
    "family": "NEG-yazilim",
    "input": "Ofis için muhasebe yazılımı arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-10",
    "categoryGroup": "real-estate",
    "family": "NEG-klima",
    "input": "Ev için klima arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-11",
    "categoryGroup": "real-estate",
    "family": "ticari-amac",
    "input": "Restoran olmaya uygun kiralık dükkan arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "re-12",
    "categoryGroup": "real-estate",
    "family": "yazlik",
    "input": "Deniz manzaralı yazlık arıyorum Bodrum'da",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "real-estate"
      ],
      "allowedKinds": [
        "REAL_ESTATE"
      ],
      "forbiddenQuestionKeys": [
        "brand",
        "model",
        "quantity"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-01",
    "categoryGroup": "automotive",
    "family": "arac-alim",
    "input": "Mercedes C180 satın almak istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "VEHICLE"
      ],
      "requiredBrand": "Mercedes",
      "requiredModel": "C180",
      "forbiddenQuestionKeys": [
        "quantity"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-02",
    "categoryGroup": "automotive",
    "family": "arac-alim",
    "input": "2020 model dizel otomatik Volkswagen Passat arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "VEHICLE"
      ],
      "requiredBrand": "Volkswagen",
      "requiredModel": "Passat"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-03",
    "categoryGroup": "automotive",
    "family": "parca",
    "input": "Renault Clio için ön far arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredBrand": "Renault",
      "requiredModel": "Clio",
      "requiredSurfaceTerms": [
        "ön far"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-04",
    "categoryGroup": "automotive",
    "family": "parca",
    "input": "Mercedes C180 için su pompası arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredBrand": "Mercedes",
      "requiredSurfaceTerms": [
        "pompas"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-05",
    "categoryGroup": "automotive",
    "family": "kiralama",
    "input": "Araç kiralamak istiyorum İstanbul'da",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "VEHICLE"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_RENT",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "RENT niyeti nesne kanıtı olmadan emlak dalını ateşliyor; kiralanan şey araç.",
      "signature": {
        "kindEquals": "REAL_ESTATE"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-06",
    "categoryGroup": "automotive",
    "family": "filo",
    "input": "Şirketim için 10 araçlık filo kiralama arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "VEHICLE"
      ]
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Filo ailesi modellenmemiş; 'Şirketim için' bölünmesi sağ tarafı parça sanıyor, adet sorulmuyor.",
      "signature": {
        "kindEquals": "PART"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-07",
    "categoryGroup": "automotive",
    "family": "servis",
    "input": "Renault Clio için bakım arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredBrand": "Renault",
      "requiredModel": "Clio"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-08",
    "categoryGroup": "automotive",
    "family": "servis",
    "input": "BMW için ekspertiz arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredBrand": "BMW"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-09",
    "categoryGroup": "automotive",
    "family": "ticari-arac",
    "input": "Ticari araç arıyorum, panelvan olabilir",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "VEHICLE"
      ],
      "forbiddenBrands": [
        "ticari"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Ticari' sözcüğü katalog doğrulaması olmadan marka alanına yazılıyor.",
      "signature": {
        "brandEquals": "Ticari"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-10",
    "categoryGroup": "automotive",
    "family": "kisa-model",
    "input": "C200 arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "VEHICLE"
      ],
      "requiredModel": "C200"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-11",
    "categoryGroup": "automotive",
    "family": "lastik",
    "input": "Araba lastiği arıyorum 205/55 R16",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "automotive"
      ],
      "allowedKinds": [
        "PART"
      ],
      "forbiddenQuestionKeys": [
        "modelYear"
      ]
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Lastik ailesi yok: talep bütün araç sanılıyor, modelYear/engine gibi ilgisiz sorular geliyor, ebat kayboluyor.",
      "signature": {
        "kindEquals": "VEHICLE"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "auto-12",
    "categoryGroup": "automotive",
    "family": "NEG-klima-parca",
    "input": "Klima için dış ünite fan motoru arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredSurfaceTerms": [
        "fan motoru"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-01",
    "categoryGroup": "technology",
    "family": "bilgisayar",
    "input": "Dizüstü bilgisayar arıyorum, 16 GB RAM olsun",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "ram"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'16 GB RAM' içindeki RAM jetonu marka alanına yazılıyor ve envelope.brand üzerinden yanlış marka kanıtı üretir.",
      "signature": {
        "brandEquals": "RAM"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-02",
    "categoryGroup": "technology",
    "family": "telefon",
    "input": "iPhone 15 Pro arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requiredBrand": "Apple",
      "requiredModel": "iPhone 15 Pro"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-03",
    "categoryGroup": "technology",
    "family": "tv",
    "input": "Samsung 55 inç televizyon arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requiredBrand": "Samsung"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-04",
    "categoryGroup": "technology",
    "family": "lisans",
    "input": "Muhasebe yazılımı lisansı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requireStateCategory": [
        "technology"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_SPLIT",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Yazılım lisansı ürünü hizmet ipucuyla eziliyor: understanding=technology, state=services; hizmet soruları geliyor.",
      "signature": {
        "stateCategoryEquals": "services"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-05",
    "categoryGroup": "technology",
    "family": "platform-destek",
    "input": "WordPress için teknik destek arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredResolvedEntities": [
        {
          "entityType": "PLATFORM",
          "canonicalId": "platform:wordpress"
        }
      ],
      "requiredSurfaceTerms": [
        "wordpress"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-06",
    "categoryGroup": "technology",
    "family": "entegrasyon",
    "input": "Shopify için entegrasyon hizmeti arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredResolvedEntities": [
        {
          "entityType": "PLATFORM",
          "canonicalId": "platform:shopify"
        }
      ],
      "requiredSurfaceTerms": [
        "shopify"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-07",
    "categoryGroup": "technology",
    "family": "danismanlik",
    "input": "SAP danışmanlık arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredResolvedEntities": [
        {
          "entityType": "SOFTWARE_SUITE",
          "canonicalId": "software-suite:sap"
        }
      ],
      "requiredSurfaceTerms": [
        "sap"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-08",
    "categoryGroup": "technology",
    "family": "modul",
    "input": "Logo yazılımı için e-fatura modülü arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredResolvedEntities": [
        {
          "entityType": "SOFTWARE_SUITE",
          "canonicalId": "software-suite:logo-yazilim"
        }
      ],
      "requiredSurfaceTerms": [
        "e-fatura"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-09",
    "categoryGroup": "technology",
    "family": "web-yapim",
    "input": "Web sitesi yaptırmak istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-10",
    "categoryGroup": "technology",
    "family": "aksesuar",
    "input": "MacBook Pro için şarj adaptörü arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredModel": "MacBook Pro",
      "requiredSurfaceTerms": [
        "şarj adaptörü"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-11",
    "categoryGroup": "technology",
    "family": "uzak-servis",
    "input": "Sunucu bakım hizmeti arıyorum, uzaktan olabilir",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requireUnderstandingCategory": [
        "technology"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_SPLIT",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Sunucu bakımı: understanding=services, state=technology — iki otorite ayrışıyor.",
      "signature": {
        "understandingCategoryEquals": "services"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "tech-12",
    "categoryGroup": "technology",
    "family": "NEG-logo-tasarim",
    "input": "logo tasarımı arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "services",
        "printing",
        "null"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'logo tasarımı' bir hizmettir; kind PRODUCT çıkıyor ve profesyonel metin öznesiz kalıyor.",
      "signature": {
        "kindEquals": "PRODUCT"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-01",
    "categoryGroup": "printing",
    "family": "kartvizit",
    "input": "1000 adet kartvizit bastırmak istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ],
      "requiredSurfaceTerms": [
        "kartvizit"
      ],
      "requiredQuestionKeys": [
        "dimensions"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-02",
    "categoryGroup": "printing",
    "family": "brosur",
    "input": "Broşür bastırmak istiyorum A5 çift taraflı",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-03",
    "categoryGroup": "printing",
    "family": "etiket",
    "input": "Ürün etiketi bastırmak istiyorum, 5000 adet rulo",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ],
      "requiredSurfaceTerms": [
        "etiket"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Bağlaçsız besteci: 'etiket' hiçbir kullanıcı yüzeyinde kalmıyor (başlık '5.000 adet üretim üretimi').",
      "signature": {
        "missingSurfaceTerm": "etiket"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-04",
    "categoryGroup": "printing",
    "family": "kutu",
    "input": "E-ticaret için karton kutu ürettirmek istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'E-ticaret' marka sanılıyor ve teknoloji sinyaliyle kategori printing yerine technology'ye kayıyor.",
      "signature": {
        "brandEquals": "E-ticaret"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-05",
    "categoryGroup": "printing",
    "family": "promosyon",
    "input": "Logolu promosyon kalem bastırmak istiyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ],
      "forbiddenBrands": [
        "logolu"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Logolu' sıfatı marka alanına yazılıyor.",
      "signature": {
        "brandEquals": "Logolu"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-06",
    "categoryGroup": "printing",
    "family": "makine",
    "input": "Matbaa makinesi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing",
        "machinery"
      ],
      "allowedKinds": [
        "INDUSTRIAL_EQUIPMENT",
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-07",
    "categoryGroup": "printing",
    "family": "makine-parca",
    "input": "Heidelberg SM 74 için nemlendirme pompası arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredBrand": "Heidelberg",
      "requiredModel": "SM 74",
      "requiredSurfaceTerms": [
        "nemlendirme"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-08",
    "categoryGroup": "printing",
    "family": "katalog",
    "input": "Katalog bastırmak istiyorum 32 sayfa",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-09",
    "categoryGroup": "printing",
    "family": "davetiye",
    "input": "Düğün davetiyesi bastırmak istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ],
      "requiredSurfaceTerms": [
        "davetiye"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Bağlaçsız besteci: 'davetiye' kayboluyor, başlık 'üretim üretimi' biçiminde bozuk.",
      "signature": {
        "missingSurfaceTerm": "davetiye"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-10",
    "categoryGroup": "printing",
    "family": "poset",
    "input": "Kraft poşet ürettirmek istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-11",
    "categoryGroup": "printing",
    "family": "logo-sinir",
    "input": "şirket logosu yaptırmak istiyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "services",
        "printing"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "print-12",
    "categoryGroup": "printing",
    "family": "olculu-kutu",
    "input": "Ambalaj için özel kesim kutu arıyorum, ölçüler 20x15x10",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "printing"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM",
        "PRODUCT"
      ]
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Ambalaj için özel kesim kutu' bölünmesi kutuyu ambalajın parçası sanıyor.",
      "signature": {
        "kindEquals": "PART"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-01",
    "categoryGroup": "appliances",
    "family": "klima",
    "input": "Klima arıyorum salon için, 25 m2",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-02",
    "categoryGroup": "appliances",
    "family": "klima",
    "input": "İnverter klima arıyorum 12000 BTU",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "forbiddenPartValues": [
        "inverter"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_NUMBER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'İnverter' parça alanına yazılıyor; 12000 BTU hiçbir alanda tutulmuyor.",
      "signature": {
        "partEquals": "İnverter"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-03",
    "categoryGroup": "appliances",
    "family": "buzdolabi",
    "input": "Buzdolabı arıyorum, no-frost olsun",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-04",
    "categoryGroup": "appliances",
    "family": "bulasik",
    "input": "Arçelik bulaşık makinesi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requiredBrand": "Arçelik"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-05",
    "categoryGroup": "appliances",
    "family": "camasir",
    "input": "9 kg çamaşır makinesi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-06",
    "categoryGroup": "appliances",
    "family": "parca",
    "input": "Arçelik bulaşık makinesi için rezistans arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredBrand": "Arçelik",
      "requiredSurfaceTerms": [
        "rezistans"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-07",
    "categoryGroup": "appliances",
    "family": "servis",
    "input": "Bosch çamaşır makinesi için bakım arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredBrand": "Bosch"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-08",
    "categoryGroup": "appliances",
    "family": "montaj",
    "input": "Klima montajı yaptırmak istiyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-09",
    "categoryGroup": "appliances",
    "family": "tamir",
    "input": "Buzdolabı tamiri arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-10",
    "categoryGroup": "appliances",
    "family": "firin",
    "input": "Ankastre fırın arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-11",
    "categoryGroup": "appliances",
    "family": "kucuk-sinir",
    "input": "Blender arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "appliances",
        "home-kitchen"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "appl-12",
    "categoryGroup": "appliances",
    "family": "robot",
    "input": "Süpürge robotu arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "appliances",
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-01",
    "categoryGroup": "machinery",
    "family": "alim",
    "input": "CNC tezgahı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "INDUSTRIAL_EQUIPMENT",
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-02",
    "categoryGroup": "machinery",
    "family": "servis",
    "input": "CNC tezgahı için teknik servis arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-03",
    "categoryGroup": "machinery",
    "family": "servis",
    "input": "Heidelberg SM 74 için bakım arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredBrand": "Heidelberg",
      "requiredModel": "SM 74"
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-04",
    "categoryGroup": "machinery",
    "family": "kiralama",
    "input": "Forklift kiralamak istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "INDUSTRIAL_EQUIPMENT",
        "PRODUCT"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_RENT",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "RENT niyeti forklift kiralamayı emlak konusu yapıyor.",
      "signature": {
        "kindEquals": "REAL_ESTATE"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-05",
    "categoryGroup": "machinery",
    "family": "parca",
    "input": "Torna tezgahı için yedek parça arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "PART"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Torna' marka, 'tezgahı' model sanılıyor; kategori automotive'e kayıyor.",
      "signature": {
        "brandEquals": "Torna"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-06",
    "categoryGroup": "machinery",
    "family": "kapasite",
    "input": "Jeneratör arıyorum 100 kVA",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "INDUSTRIAL_EQUIPMENT",
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-07",
    "categoryGroup": "machinery",
    "family": "NEG-marka",
    "input": "CNC marka bir ürün arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "INDUSTRIAL_EQUIPMENT",
        "PRODUCT"
      ],
      "requireBrandAbsent": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "mach-08",
    "categoryGroup": "machinery",
    "family": "amac",
    "input": "Kompresör arıyorum atölye için",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "machinery"
      ],
      "allowedKinds": [
        "INDUSTRIAL_EQUIPMENT",
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "kompresör"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Kompresör' ürün adı marka alanına yazılıyor.",
      "signature": {
        "brandEquals": "Kompresör"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-01",
    "categoryGroup": "furniture",
    "family": "hazir",
    "input": "Koltuk takımı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "furniture"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-02",
    "categoryGroup": "furniture",
    "family": "toplu",
    "input": "Ofis için 50 adet çalışma sandalyesi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "furniture"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-03",
    "categoryGroup": "furniture",
    "family": "ozel-uretim",
    "input": "Özel ölçü dolap yaptırmak istiyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "furniture",
        "services"
      ],
      "allowedKinds": [
        "MANUFACTURED_ITEM",
        "SERVICE"
      ],
      "requiredSurfaceTerms": [
        "dolap"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Bağlaçsız hizmet bestecisi: 'dolap' kaybolup başlık 'Özel ölçü için servis' kalıyor.",
      "signature": {
        "missingSurfaceTerm": "dolap"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-04",
    "categoryGroup": "furniture",
    "family": "parca",
    "input": "Masa için özel bağlantı aparatı arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "furniture"
      ],
      "allowedKinds": [
        "PART"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-05",
    "categoryGroup": "furniture",
    "family": "doseme",
    "input": "Koltuk döşeme hizmeti arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services",
        "furniture"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredSurfaceTerms": [
        "koltuk"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Döşeme hizmetinde 'koltuk' hiçbir yüzeyde kalmıyor (başlık 'hizmet').",
      "signature": {
        "missingSurfaceTerm": "koltuk"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-06",
    "categoryGroup": "furniture",
    "family": "NEG-mekanizma",
    "input": "koltuk destek mekanizması arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "furniture"
      ],
      "allowedKinds": [
        "PRODUCT",
        "PART"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-07",
    "categoryGroup": "furniture",
    "family": "spec",
    "input": "Yemek masası arıyorum 6 kişilik ahşap",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "furniture"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requiredSurfaceTerms": [
        "ahşap"
      ]
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'6 kişilik ahşap' çıkarılmıyor; material/dimensions kullanıcıya YENİDEN soruluyor, başlık '6'ya bozuluyor.",
      "signature": {
        "missingSurfaceTerm": "ahşap"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "furn-08",
    "categoryGroup": "furniture",
    "family": "montaj",
    "input": "Mobilya montaj hizmeti arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services",
        "furniture"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-01",
    "categoryGroup": "health",
    "family": "cihaz",
    "input": "Tansiyon aleti arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "health"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-02",
    "categoryGroup": "health",
    "family": "kiralik-cihaz",
    "input": "Hasta yatağı arıyorum kiralık",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "health"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_RENT",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'kiralık' hasta yatağını emlak konusu yapıyor.",
      "signature": {
        "kindEquals": "REAL_ESTATE"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-03",
    "categoryGroup": "health",
    "family": "cihaz",
    "input": "Tekerlekli sandalye arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "health"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "tekerlekli"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Tekerlekli' sıfatı marka alanına yazılıyor.",
      "signature": {
        "brandEquals": "Tekerlekli"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-04",
    "categoryGroup": "health",
    "family": "sarf-toplu",
    "input": "Klinik için steril eldiven arıyorum, 100 kutu",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "health"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Toplu sarf talebi üretim talebi sanılıyor; kategori de çözülmüyor.",
      "signature": {
        "kindEquals": "MANUFACTURED_ITEM"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-05",
    "categoryGroup": "health",
    "family": "cihaz",
    "input": "İşitme cihazı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "health"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-06",
    "categoryGroup": "health",
    "family": "kalibrasyon",
    "input": "Hasta monitörü kalibrasyon hizmeti arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "health",
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-07",
    "categoryGroup": "health",
    "family": "sarf-parca",
    "input": "Şeker ölçüm cihazı için test çubuğu arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "health"
      ],
      "allowedKinds": [
        "PART",
        "PRODUCT"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_SPLIT",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Şeker ölçüm cihazı için test çubuğu' hiçbir kategoriye bağlanamıyor; parça yakalanıyor ama talep yönlendirilemez.",
      "signature": {
        "stateCategoryEquals": null
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "health-08",
    "categoryGroup": "health",
    "family": "NEG-tibbi-tavsiye",
    "input": "Baş ağrım için hangi ilacı almalıyım",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "health",
        "null"
      ],
      "requireBrandAbsent": true,
      "forbidAnyQuestions": true
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-01",
    "categoryGroup": "baby",
    "family": "araba",
    "input": "Bebek arabası arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "baby"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "bebek"
      ],
      "requiredSurfaceTerms": [
        "bebek arabası"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-02",
    "categoryGroup": "baby",
    "family": "oto-koltugu",
    "input": "Oto koltuğu arıyorum 9-36 kg",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "baby"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "forbiddenSnapshotAttrs": [
        "screenSize"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_NUMBER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'9-36 kg' ekran boyutu sanılıyor (screenSize attr); başlık '9'a bozuluyor.",
      "signature": {
        "snapshotAttrIncludes": "screenSize"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-03",
    "categoryGroup": "baby",
    "family": "sarf",
    "input": "Bebek bezi arıyorum toptan",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "baby"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-04",
    "categoryGroup": "baby",
    "family": "ikinci-el",
    "input": "İkinci el bebek arabası arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "baby"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-05",
    "categoryGroup": "baby",
    "family": "mobilya",
    "input": "Bebek odası takımı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "baby",
        "furniture"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requiredSurfaceTerms": [
        "bebek odası"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Bağlaçsız besteci: 'bebek odası takımı' kaybolup başlık 'ürün' kalıyor.",
      "signature": {
        "missingSurfaceTerm": "bebek odası"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-06",
    "categoryGroup": "baby",
    "family": "NEG-teknoloji",
    "input": "Çocuk için eğitim uygulaması arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "technology"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-07",
    "categoryGroup": "baby",
    "family": "mama-sandalyesi",
    "input": "Mama sandalyesi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "baby"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "baby-08",
    "categoryGroup": "baby",
    "family": "parca",
    "input": "Bebek arabası için tekerlek arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "baby"
      ],
      "allowedKinds": [
        "PART"
      ],
      "requiredPart": "tekerlek"
    },
    "knownIssue": {
      "rootCause": "CATEGORY_SPECIFIC",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "Parça talebi tanınıyor ama 'tekerlek' part alanına yazılmıyor; ageRange gibi ilgisiz soru geliyor.",
      "signature": {
        "partFieldEmpty": true
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-01",
    "categoryGroup": "home-kitchen",
    "family": "tencere",
    "input": "Tencere seti arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "home-kitchen"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-02",
    "categoryGroup": "home-kitchen",
    "family": "sofra",
    "input": "6 kişilik yemek takımı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "home-kitchen"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "requiredSurfaceTerms": [
        "yemek takımı"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'6 kişilik yemek takımı' kaybolup başlık 'ürün' kalıyor.",
      "signature": {
        "missingSurfaceTerm": "yemek takımı"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-03",
    "categoryGroup": "home-kitchen",
    "family": "kucuk-cihaz",
    "input": "Kahve makinesi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "home-kitchen",
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-04",
    "categoryGroup": "home-kitchen",
    "family": "toplu",
    "input": "Toptan bardak arıyorum, 500 adet",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "home-kitchen"
      ],
      "allowedKinds": [
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "toptan"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Toptan' sözcüğü marka alanına yazılıyor.",
      "signature": {
        "brandEquals": "Toptan"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-05",
    "categoryGroup": "home-kitchen",
    "family": "NEG-sap",
    "input": "Tavanın sapı kırıldı, yenisini arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "home-kitchen"
      ],
      "allowedKinds": [
        "PART",
        "PRODUCT"
      ],
      "requiredSurfaceTerms": [
        "tava"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_COMPOSER",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'tava' hiçbir yüzeyde kalmıyor; talep konusu belirsizleşiyor.",
      "signature": {
        "missingSurfaceTerm": "tava"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-06",
    "categoryGroup": "home-kitchen",
    "family": "NEG-sap",
    "input": "Kürek sapı arıyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "home-kitchen",
        "null"
      ],
      "allowedKinds": [
        "PART",
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "kürek"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Kürek' marka, 'sapı' model sanılıyor (SAP olmaması doğru; sahte marka yanlış).",
      "signature": {
        "brandEquals": "Kürek"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-07",
    "categoryGroup": "home-kitchen",
    "family": "parca",
    "input": "Çelik tencere kapağı arıyorum 24 cm",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "home-kitchen"
      ],
      "allowedKinds": [
        "PART",
        "PRODUCT"
      ],
      "forbiddenBrands": [
        "çelik"
      ]
    },
    "knownIssue": {
      "rootCause": "RC_BRAND",
      "expectedVerdict": "KNOWN_FAIL",
      "explanation": "'Çelik' malzeme adı marka alanına yazılıyor.",
      "signature": {
        "brandEquals": "Çelik"
      }
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "home-08",
    "categoryGroup": "home-kitchen",
    "family": "kucuk-cihaz",
    "input": "Mutfak robotu arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "home-kitchen",
        "appliances"
      ],
      "allowedKinds": [
        "PRODUCT"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-01",
    "categoryGroup": "services",
    "family": "periyodik",
    "input": "Ev temizliği arıyorum haftada bir",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ],
      "requiredQuestionKeys": [
        "frequency"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-02",
    "categoryGroup": "services",
    "family": "tasima",
    "input": "Ofis taşıma hizmeti arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-03",
    "categoryGroup": "services",
    "family": "boya",
    "input": "Boya badana yaptırmak istiyorum 3+1 daire",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-04",
    "categoryGroup": "services",
    "family": "etkinlik",
    "input": "Düğün fotoğrafçısı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-05",
    "categoryGroup": "services",
    "family": "ozel-ders",
    "input": "Matematik özel ders öğretmeni arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-06",
    "categoryGroup": "services",
    "family": "uzaktan",
    "input": "Uzaktan İngilizce dersi arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-07",
    "categoryGroup": "services",
    "family": "danismanlik",
    "input": "Genel hukuk danışmanlığı arıyorum",
    "adversarial": false,
    "expected": {
      "allowedCategories": [
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  },
  {
    "id": "svc-08",
    "categoryGroup": "services",
    "family": "NEG-kombi",
    "input": "Kombi bakımı yaptırmak istiyorum",
    "adversarial": true,
    "expected": {
      "allowedCategories": [
        "appliances",
        "services"
      ],
      "allowedKinds": [
        "SERVICE"
      ]
    },
    "notMeasured": [
      "supplier_capability",
      "live_notification",
      "zero_match_guard"
    ]
  }
] as const;
