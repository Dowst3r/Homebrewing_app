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
  const FG = Number(fgSg);
  const ABV = Number(abvTarget);

  // 1. Convert ABV back to Alcohol by Weight (ABW)
  const ABW = ABV * (0.7907 / FG);

  // 2. Calculate AE (Apparent Extract in Plato) from FG
  const AE = platoFromSgLincoln(FG);

  // 3. Solve for OE (Original Extract in Plato)
  // Derived from: ABW = (0.8192 * (OE - AE)) / (2.0665 - 0.010665 * OE)
  const OE = (2.0665 * ABW + 0.8192 * AE) / (0.8192 + 0.010665 * ABW);

  // 4. Convert Plato back to SG (Specific Gravity)
  // Derived from the Lincoln Plato equation: P = (258.6 * s) / (1 + LINCOLN_B * s)
  const s = OE / (258.6 - LINCOLN_B * OE);
  return s + 1;
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
export function calculateMeadRecipe({
  volumeL,
  finalGravity,
  targetAbv,
  sugarConcPct,
  pricePerContainer,
  massPerContainerG,
  yeastNRequirement,
}) {
  const V = Number(volumeL);
  const FG = Number(0.996);
  const ABV = Number(targetAbv);
  const targetSweetFG = Number(finalGravity);
  const sugarConc = Number(sugarConcPct);
  const costcontainer = Number(pricePerContainer);
  const masscontainer = Number(massPerContainerG);

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
  let containers = 0;
  let cost = 0;

  if (sugarConc > 0) {
    testMassHoney =
      ((1 / (1 - Y_XS)) *
        (massEthanol * (1 + (MW_CO2 / MW_ETH)) + F_SP * V) *
        1000) /
      (sugarConc / 100) /
      FRACTION_FERMENTABLE;

    totalHoneyKg = testMassHoney / 1000;
    containers = Math.ceil((testMassHoney / masscontainer));
    cost = containers * costcontainer;
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
    fermaidOGramsPerDay = fermaidOGramsTotal / 4;
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
  const imaginaryAbvForDesiredFinalSweetness = abvHmrc(targetSweetFG, FG);
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
    totalSugarNeeded,
    honeyMassGrams: totalHoneyKg * 1000,
    honeyMassKg: totalHoneyKg,
    containers,
    cost,
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
export function calculateBacksweetening({
  finalGravityReading,
  targetGravity,
  volumeL,
  sugarConcPct,
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
    massSugarNeeded,
    massHoneyNeeded,
  };
}

// ---- pH adjustment (CaCO3) ----
export function calculatePhAdjustment({
  currentPh,
  targetPh,
  volumeL,
  adjusterType,
  hPlusPerMol,
  molarMass,
}) {
  const pHInitial = Number(currentPh);
  const pHTarget = Number(targetPh);
  const V = Number(volumeL);

  const HInitial = 10 ** (-pHInitial);
  const HTarget = 10 ** (-pHTarget);

  // positive means we need to ADD H+ (acid), negative means REMOVE H+ (base)
  const deltaMolH = (HTarget - HInitial) * V;

  const need = deltaMolH > 0 ? "acid" : (deltaMolH < 0 ? "base" : "none");
  const molHNeeded = Math.abs(deltaMolH);

  const stoich = Number(hPlusPerMol);
  const mw = Number(molarMass);

  if (!Number.isFinite(stoich) || stoich <= 0) {
    return { error: "Invalid H+ per mol (stoichiometry) for this adjuster." };
  }
  if (!Number.isFinite(mw) || mw <= 0) {
    return { error: "Invalid molar mass for this adjuster." };
  }

  // If user picked the wrong type (e.g. acid when pH must be raised), warn.
  const mismatch = (need !== "none" && adjusterType !== need);

  const molCompound = (need === "none") ? 0 : (molHNeeded / stoich);
  const massG = molCompound * mw;

  return {
    HInitial,
    HTarget,
    deltaMolH,
    need,
    mismatch,
    molHNeeded,
    molCompound,
    massG,
  };
}