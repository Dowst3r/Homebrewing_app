// ---- Shared constants ----
export const LINCOLN_B = 2271 / 2582;

export const F_SP = 0.0128;
export const Y_XS = 0.1;
export const MW_CO2 = 44.01;
export const MW_ETH = 46.069;
export const RHO_ETH = 789.45;
export const RHO_WATER = 998.00; // TO BE CHANGED WHEN BACK HOME!!!!!!!!!!!!!!!!! SG of water at T room and multiply by reference density
export const FRACTION_FERMENTABLE = 0.925;

// ---- ABV + OG helpers ----

function platoFromSgLincoln(sg) {
  const SG = Number(sg);
  const s = SG - 1;
  return (258.6 * s) / (1 + LINCOLN_B * s);
}


// ASBC Beer-4A-style ABV (%), OG/FG in 1.xxx SG
export function abvHmrc(og, fg) {
  const OG = Number(og);
  const FG = Number(fg);

  const OE = platoFromSgLincoln(OG);
  const AE = platoFromSgLincoln(FG);

  const ABW = (0.8192 * (OE - AE)) / (2.0665 - 0.010665 * OE);

  const ABV = ABW * (FG / 0.7907);
  return ABV;
}

// Solve for OG given target ABV (%) and final gravity (SG)
export function ogForTargetAbv(fgSg, abvTarget) {
  const fg = Number(fgSg);
  const abv = Number(abvTarget);
  return (abv * A0 + fg) / (1 + abv * A1);
}

// ---- Brix estimate from SG ----

export function brixFromSg(sg) {
  const g = Number(sg);
  return (
    182.46007 * g ** 3 -
    775.68212 * g ** 2 +
    1262.7794 * g -
    669.56218
  );
}

// ---- Mead recipe core calculation ----
// This is basically the maths in show_output_window()

export function calculateMeadRecipe({
  volumeL,             // batch size in L
  finalGravity,        // FG (SG)
  targetAbv,           // % ABV
  sugarConcPct,        // honey sugar % (e.g. 79.7)
  densityKgPerM3,      // honey density (kg/m^3)
  costPer100g,         // £ per 100 g honey
  yeastNRequirement,   // "Low" | "Medium" | "High"
}) {
  const V = Number(volumeL);
  const FG = Number(finalGravity);
  const ABV = Number(targetAbv);
  const sugarConc = Number(sugarConcPct);        // %
  const density = Number(densityKgPerM3);        // kg/m^3
  const cost100 = Number(costPer100g);

  // Starting gravity from OG/ABV relationship
  const startingGravity = ogForTargetAbv(FG, ABV);

  // Ethanol mass produced
  const massEthanol = (V / 1000) * RHO_ETH * ABV / 100;

  // Total pure sugar needed to hit that ethanol
  const totalSugarNeeded =
    (1 / (1 - Y_XS)) *
    (massEthanol * (1 + (MW_CO2 / MW_ETH)) + F_SP * V) *
    1000;

  let testMassHoney = 0;
  let totalHoneyKg = 0;
  let volumeHoneyL = 0;
  let cost = 0;

  if (sugarConc > 0) {
    testMassHoney =
      ((1 / (1 - Y_XS)) *
        (massEthanol * (1 + (MW_CO2 / MW_ETH)) + F_SP * V) *
        1000) /
      (sugarConc / 100) /
      FRACTION_FERMENTABLE;

    totalHoneyKg = testMassHoney / 1000;
    volumeHoneyL = totalHoneyKg / (density / 1000); // density kg/m^3 → kg/L
    cost = (testMassHoney / 100) * cost100;
  }

  const brix = brixFromSg(startingGravity);

  // Fermaid-O (only if ABV <= 14%)
  let fermaidOGramsTotal = null;
  let fermaidOGramsPerDay = null;
  let fermaidKGramsTotal = null;
  let thirdsugarbreak = null;

  if (ABV <= 14) {
    const nitrogenFactors = {
      Low: 0.75,
      Medium: 0.9,
      High: 1.25,
    };
    const NReq = nitrogenFactors[yeastNRequirement] ?? 0.9;
    const volumeUsGallons = V / 3.78541;
    fermaidOGramsTotal = ((brix * 10) * NReq * volumeUsGallons) / 50;
    fermaidOGramsPerDay = fermaidOGramsTotal / 4; // spread across 4 days
    thirdsugarbreak = startingGravity - ((startingGravity - 1) / 3)
  } else {
    const yanFactors = {
      Low: 7.5,
      Medium: 9.0,
      High: 12.5,
    };

    const yanPerBrix = yanFactors[yeastNRequirement] ?? 9.0;

    const YANtarget = yanPerBrix * brix;

    const p = 0.35;

    const FERMAID_K_CONTRIB = 100;
    const FERMAID_O_CONTRIB = 40;

    fermaidKGramsTotal = (p * YANtarget * V) / FERMAID_K_CONTRIB;
    fermaidOGramsTotal = ((1 - p) * YANtarget * V) / FERMAID_O_CONTRIB;

    fermaidOGramsPerDay = fermaidOGramsTotal / 4;

    thirdsugarbreak = startingGravity - ((startingGravity - 1) / 3);
  }

  // Back-sweetening part (using FG vs 1.000 like in your Python)
  const imaginaryAbvForDesiredFinalSweetness = abvHmrc(FG, 1.0);
  const massEthanolSweetening =
    (V / 1000) * RHO_ETH * imaginaryAbvForDesiredFinalSweetness / 100;

  const massPureSugarNeededForSweetening =
    (1 / (1 - Y_XS)) *
    (massEthanolSweetening * (1 + (MW_CO2 / MW_ETH)) + F_SP * V) *
    1000;

  let massHoneyNeededForSweetening = 0;
  if (sugarConc > 0) {
    massHoneyNeededForSweetening =
      ((1 / (1 - Y_XS)) *
        (massEthanolSweetening * (1 + (MW_CO2 / MW_ETH)) + F_SP * V) *
        1000) /
      (sugarConc / 100) /
      FRACTION_FERMENTABLE;
  }

  return {
    startingGravity,
    brix,
    totalSugarNeeded,                // g
    honeyMassGrams: totalHoneyKg * 1000,
    honeyMassKg: totalHoneyKg,
    honeyVolumeL: volumeHoneyL,
    cost,                            // £
    waterVolumeL: (startingGravity * V - (totalHoneyKg / (RHO_WATER / 1000))),
    fermaidOGramsTotal,
    fermaidOGramsPerDay,
    fermaidKGramsTotal,
    thirdsugarbreak,
    // back-sweetening bits
    imaginaryAbvForDesiredFinalSweetness,
    massPureSugarNeededForSweetening,
    massHoneyNeededForSweetening,
  };
}

// ---- Back-sweetening only (separate screen version) ----
// Matches show_backsweetening_calculation_screen()

export function calculateBacksweetening({
  finalGravityReading,   // FG now
  targetGravity,         // desired FG
  volumeL,
  sugarConcPct,          // honey sugar %
}) {
  const FG = Number(finalGravityReading);
  const targetFG = Number(targetGravity);
  const V = Number(volumeL);
  const sugarConc = Number(sugarConcPct);

  const imaginaryAbv = abvHmrc(targetFG, FG);
  const massEthanolSweetening =
    (V / 1000) * RHO_ETH * imaginaryAbv / 100;

  const massSugarNeeded =
    (1 / (1 - Y_XS)) *
    (massEthanolSweetening * (1 + (MW_CO2 / MW_ETH)) + F_SP * V) *
    1000;

  let massHoneyNeeded = 0;
  if (sugarConc > 0) {
    massHoneyNeeded =
      (massSugarNeeded / (sugarConc / 100)) /
      FRACTION_FERMENTABLE;
  }

  return {
    massSugarNeeded,   // g
    massHoneyNeeded,   // g
  };
}

// ---- pH adjustment (CaCO3) ----

export function calculatePhAdjustment({
  currentPh,
  targetPh,
  volumeL,     // L
}) {
  const pHInitial = Number(currentPh);
  const pHTarget = Number(targetPh);
  const V = Number(volumeL);

  const HInitial = 10 ** (-pHInitial);
  const HTarget = 10 ** (-pHTarget);

  const deltaH = (HInitial - HTarget) * V * 1000;  // total mol of H+
  const molCaCO3 = deltaH / 2;                     // consumes 2 H+
  const massCaCO3 = molCaCO3 * 100.09;             // g

  return {
    HInitial,
    HTarget,
    deltaH,
    molCaCO3,
    massCaCO3,
  };
}